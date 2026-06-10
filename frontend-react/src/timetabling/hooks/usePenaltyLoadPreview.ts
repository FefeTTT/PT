import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * usePenaltyLoadPreview — carga perezosa (lazy) del score de penalización de carga
 * para una badge por-profesor (ECO). Compara la carga ACTUAL (asignaciones ya bloqueadas)
 * contra la PROYECTADA (si además se bloquearan las asignaciones restantes).
 *
 * Golpea UNA sola vez el endpoint batch `${baseUrl}/get_horario_penalty_finetuned_batch`
 * (un round-trip para ambos números). El fetch arranca en el PRIMER `trigger()` (hover/focus)
 * y se memoiza por firma del conjunto bloqueado + conjunto total, de modo que alternar un
 * candado invalida la caché y vuelve a pedir.
 *
 * Regla "menos-el-último" (obligatoria por contrato del backend): para puntuar una carga de
 * K asignaciones [u0..u_{K-1}], la ÚLTIMA va en `horario`+`uea_prediccion`, y las primeras K-1 van
 * en los dos arreglos `*_actuales` (alineados por índice). `*_actuales` puede ser [] (K==1).
 */

/** Una asignación candidata mínima para puntuar (clave UEA + su horario canónico). */
export interface PenaltyUea {
    /** Clave de la UEA (se serializa como string al backend). */
    uea: number;
    /** Horario canónico tipo "L:07:00-08:30|Mi:07:00-08:30|V:07:00-08:30". */
    horario: string;
}

export type PenaltyLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PenaltyLoadPreview {
    status: PenaltyLoadStatus;
    /** total_penalty de la carga actualmente bloqueada (undefined si no hay carga actual). */
    current?: number;
    /** total_penalty de la carga proyectada (todas las asignaciones). */
    projected?: number;
    /** Conteo de asignaciones de la carga proyectada (projected_uea_count del backend). */
    projectedCount?: number;
    /** Conteo de asignaciones de la carga actual (projected_uea_count del item "current"). */
    currentCount?: number;
    /** load_probability de la carga proyectada (≈ severidad si < 0.05). */
    projectedProbability?: number;
    /** load_probability de la carga actual (0..1 ≈ "qué tan habitual" es esta carga). */
    currentProbability?: number;
    /** Curva de penalización semanal (w=2..max_w, índice 0 = 2 asignaciones) de la carga ACTUAL. */
    currentLoads?: number[];
    /** Curva de habitualidad (w=2..max_w, índice 0 = 2 asignaciones) de la carga ACTUAL. */
    currentLoadProbabilities?: number[];
    /** Curva de penalización semanal (w=2..max_w, índice 0 = 2 asignaciones) de la carga PROYECTADA. */
    projectedLoads?: number[];
    /** Curva de habitualidad (w=2..max_w, índice 0 = 2 asignaciones) de la carga PROYECTADA. */
    projectedLoadProbabilities?: number[];
    /** Mensaje de error no bloqueante (fetch falló o el backend devolvió el item en errors[]). */
    error?: string;
    /** Dispara el fetch perezoso (idempotente para una misma firma). Llamar en hover/focus. */
    trigger: () => void;
}

interface BatchItem {
    id: string;
    eco: string;
    horario: string;
    ueas_asignadas_actuales: string[];
    horarios_asignados_actuales: string[];
    uea_prediccion: string;
}

interface BatchResultRow {
    id: string;
    total_penalty?: unknown;
    projected_uea_count?: unknown;
    load_probability?: unknown;
    /** Curva de penalización semanal por carga w=2..max_w (índice 0 = 2 asignaciones). */
    loads?: unknown;
    /** Curva de "qué tan habitual" por carga w=2..max_w (índice 0 = 2 asignaciones). */
    load_probabilities?: unknown;
}

interface BatchErrorRow {
    id: string;
    error?: unknown;
}

interface BatchResponse {
    results?: BatchResultRow[];
    errors?: BatchErrorRow[];
}

const FETCH_TIMEOUT_MS = 60_000;

/** Filtra placeholders/huérfanos (uea === -1 o sin horario) y normaliza. */
function usableUeas(ueas: PenaltyUea[]): PenaltyUea[] {
    return ueas.filter(u => u.uea !== -1 && typeof u.horario === 'string' && u.horario.trim() !== '');
}

/**
 * Construye un item batch para una carga de K asignaciones aplicando la regla "menos-el-último".
 * Devuelve null si la carga está vacía (no hay nada que puntuar).
 */
function buildLoadItem(id: string, eco: string, load: PenaltyUea[]): BatchItem | null {
    if (load.length === 0) return null;
    const last = load[load.length - 1];
    const prev = load.slice(0, load.length - 1);
    return {
        id,
        eco,
        horario: last.horario,
        ueas_asignadas_actuales: prev.map(u => String(u.uea)),
        horarios_asignados_actuales: prev.map(u => u.horario),
        uea_prediccion: String(last.uea),
    };
}

/** Firma estable de un conjunto de asignaciones (orden-independiente) para memoizar/invalidar. */
function signatureOf(ueas: PenaltyUea[]): string {
    return usableUeas(ueas)
        .map(u => `${u.uea}@${u.horario}`)
        .sort()
        .join('~');
}

function asFiniteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Arreglo numérico finito completo, o undefined si falta/llega malformado (contrato todo-o-nada). */
function asNumberArray(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out: number[] = [];
    for (const v of value) {
        if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
        else return undefined;
    }
    return out;
}

/**
 * @param baseUrl  `${origin}/py`
 * @param eco      número económico del profesor (se serializa a string).
 * @param lockedUeas  asignaciones ya bloqueadas (la carga "actual").
 * @param allUeas     todas las asignaciones del profesor (bloqueadas ∪ desbloqueadas) — la carga "proyectada".
 */
export function usePenaltyLoadPreview(
    baseUrl: string,
    eco: number,
    lockedUeas: PenaltyUea[],
    allUeas: PenaltyUea[],
): PenaltyLoadPreview {
    // Firmas memoizadas: cualquier cambio en los conjuntos invalida la caché perezosa.
    const lockedSig = useMemo(() => signatureOf(lockedUeas), [lockedUeas]);
    const allSig = useMemo(() => signatureOf(allUeas), [allUeas]);
    const cacheKey = `${eco}::${lockedSig}::${allSig}`;

    const [state, setState] = useState<{
        key: string;
        status: PenaltyLoadStatus;
        current?: number;
        projected?: number;
        projectedCount?: number;
        currentCount?: number;
        projectedProbability?: number;
        currentProbability?: number;
        currentLoads?: number[];
        currentLoadProbabilities?: number[];
        projectedLoads?: number[];
        projectedLoadProbabilities?: number[];
        error?: string;
    }>({ key: '', status: 'idle' });

    const abortRef = useRef<AbortController | null>(null);
    // Evita re-disparar mientras un fetch para la MISMA firma sigue en curso.
    const inFlightKeyRef = useRef<string | null>(null);

    // Si cambia la firma (toggle de candado), abortar lo en curso y volver a idle.
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            abortRef.current = null;
            inFlightKeyRef.current = null;
        };
    }, [cacheKey]);

    // Abort al desmontar.
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            abortRef.current = null;
        };
    }, []);

    const trigger = useCallback(() => {
        // Ya resuelto/cargando para esta misma firma → no repetir.
        if (state.key === cacheKey && (state.status === 'ready' || state.status === 'loading')) return;
        if (inFlightKeyRef.current === cacheKey) return;

        const locked = usableUeas(lockedUeas);
        const all = usableUeas(allUeas);

        const items: BatchItem[] = [];
        const currentItem = buildLoadItem('current', String(eco), locked);
        if (currentItem) items.push(currentItem);
        const projectedItem = buildLoadItem('projected', String(eco), all);
        if (projectedItem) items.push(projectedItem);

        // Nada que puntuar (ni actual ni proyectada): estado listo vacío.
        if (items.length === 0) {
            setState({ key: cacheKey, status: 'ready' });
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        inFlightKeyRef.current = cacheKey;
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        setState({ key: cacheKey, status: 'loading' });

        void (async () => {
            try {
                const res = await fetch(`${baseUrl}/get_horario_penalty_finetuned_batch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                    signal: controller.signal,
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = (await res.json()) as BatchResponse;
                if (controller.signal.aborted) return;

                const results = Array.isArray(data.results) ? data.results : [];
                const errors = Array.isArray(data.errors) ? data.errors : [];
                const byId = new Map<string, BatchResultRow>();
                for (const r of results) {
                    if (r && typeof r.id === 'string') byId.set(r.id, r);
                }
                const errById = new Map<string, string>();
                for (const e of errors) {
                    if (e && typeof e.id === 'string') {
                        errById.set(e.id, typeof e.error === 'string' ? e.error : 'error');
                    }
                }

                const currentRow = byId.get('current');
                const projectedRow = byId.get('projected');

                // Un item solicitado que no volvió ni en results ni en errors es un fallo de contrato.
                const requestedIds = items.map(i => i.id);
                const missing = requestedIds.filter(id => !byId.has(id) && !errById.has(id));
                const itemErrors = requestedIds.filter(id => errById.has(id));

                if (missing.length > 0 || itemErrors.length > 0) {
                    const parts: string[] = [];
                    for (const id of itemErrors) parts.push(`${id}: ${errById.get(id)}`);
                    if (missing.length > 0) parts.push(`sin resultado: ${missing.join(', ')}`);
                    setState({
                        key: cacheKey,
                        status: 'error',
                        // Aun con error parcial, exponer lo que sí volvió (no bloqueante).
                        current: currentItem ? asFiniteNumber(currentRow?.total_penalty) : undefined,
                        currentCount: currentItem ? asFiniteNumber(currentRow?.projected_uea_count) : undefined,
                        projected: projectedItem ? asFiniteNumber(projectedRow?.total_penalty) : undefined,
                        projectedCount: projectedItem ? asFiniteNumber(projectedRow?.projected_uea_count) : undefined,
                        projectedProbability: asFiniteNumber(projectedRow?.load_probability),
                        currentProbability: currentItem ? asFiniteNumber(currentRow?.load_probability) : undefined,
                        currentLoads: currentItem ? asNumberArray(currentRow?.loads) : undefined,
                        currentLoadProbabilities: currentItem ? asNumberArray(currentRow?.load_probabilities) : undefined,
                        projectedLoads: projectedItem ? asNumberArray(projectedRow?.loads) : undefined,
                        projectedLoadProbabilities: projectedItem ? asNumberArray(projectedRow?.load_probabilities) : undefined,
                        error: parts.join(' · '),
                    });
                    return;
                }

                setState({
                    key: cacheKey,
                    status: 'ready',
                    current: currentItem ? asFiniteNumber(currentRow?.total_penalty) : undefined,
                    currentCount: currentItem ? asFiniteNumber(currentRow?.projected_uea_count) : undefined,
                    projected: projectedItem ? asFiniteNumber(projectedRow?.total_penalty) : undefined,
                    projectedCount: projectedItem ? asFiniteNumber(projectedRow?.projected_uea_count) : undefined,
                    projectedProbability: asFiniteNumber(projectedRow?.load_probability),
                    currentProbability: currentItem ? asFiniteNumber(currentRow?.load_probability) : undefined,
                    currentLoads: currentItem ? asNumberArray(currentRow?.loads) : undefined,
                    currentLoadProbabilities: currentItem ? asNumberArray(currentRow?.load_probabilities) : undefined,
                    projectedLoads: projectedItem ? asNumberArray(projectedRow?.loads) : undefined,
                    projectedLoadProbabilities: projectedItem ? asNumberArray(projectedRow?.load_probabilities) : undefined,
                });
            } catch (err) {
                if (controller.signal.aborted) return; // abort por unmount/toggle → silencioso
                const message = err instanceof Error ? err.message : 'No se pudo calcular la penalización.';
                setState({ key: cacheKey, status: 'error', error: message });
            } finally {
                clearTimeout(timeoutId);
                if (inFlightKeyRef.current === cacheKey) inFlightKeyRef.current = null;
                if (abortRef.current === controller) abortRef.current = null;
            }
        })();
    }, [baseUrl, cacheKey, eco, lockedUeas, allUeas, state.key, state.status]);

    // Si la firma cambió respecto a lo cacheado, el estado efectivo es idle (pendiente de re-trigger).
    const stale = state.key !== cacheKey;
    return {
        status: stale ? 'idle' : state.status,
        current: stale ? undefined : state.current,
        projected: stale ? undefined : state.projected,
        projectedCount: stale ? undefined : state.projectedCount,
        currentCount: stale ? undefined : state.currentCount,
        projectedProbability: stale ? undefined : state.projectedProbability,
        currentProbability: stale ? undefined : state.currentProbability,
        currentLoads: stale ? undefined : state.currentLoads,
        currentLoadProbabilities: stale ? undefined : state.currentLoadProbabilities,
        projectedLoads: stale ? undefined : state.projectedLoads,
        projectedLoadProbabilities: stale ? undefined : state.projectedLoadProbabilities,
        error: stale ? undefined : state.error,
        trigger,
    };
}
