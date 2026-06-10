import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import type { ReglaBase } from '@solution/rules/ReglaBase';
import { EstadoAsignacion, validarAsignacion, construirGrafoActual, crearContextoManualAsignacion, asegurarGrupoEnGrafo, type ResultadoAsignacion } from '../engine/kde/manualAssignmentFsm';
import { grupoToCandidateRow, metadataExcepcionesManual, rankKde, type HistorialUea } from '../engine/kde/manualCandidates';
import { candidateKey, type CandidateRow } from '../engine/kde/candidateRow';
import { pct, scoreColor, type ScoreStatsByKind } from '../utils/scoreLens';
import { decimalToTime } from '../utils/schedule';
import { ruleLabel } from '../utils/fsmRuleLabels';
import { RuleViolationInfo } from './RuleViolationInfo';
import { IconLock, IconSwap, IconWarn } from './atoms/Icons';
import styles from './KdeMode.module.css';

const MAX_FILAS_BUSQUEDA = 80;
const REGLA_HORARIO_LABORAL = 'REGLA_HORARIO_LABORAL';
const REGLA_IGNORAR_GRUPOS = 'REGLA_IGNORAR_GRUPOS';

type GrafoManual = ReturnType<typeof construirGrafoActual>;
type ExchangeMode = 'take' | 'swap';

export interface EditarAsignacionEcoModalProps {
    eco: number;
    ecoNombre?: Record<string, string>;
    claveUea?: Record<string, string>;
    /** Catálogo de UEA-horario válidas del pase (candidatos jh). */
    gruposValidos: GrupoDTO[];
    /** Catálogo CRUDO del workspace (con SAI/CPRO, ids estables). Respaldo para resolver filas
     *  asignadas fuera del catálogo del pase (p.ej. SAI asignados a mano). */
    gruposCatalogo?: GrupoDTO[];
    profesores: ProfesorDTO[];
    /** Scoring KDE del pase actual (mismas opciones que la tabla). */
    evaluarGrupo: (eco: number, grupo: GrupoDTO) => ZScoreDetails;
    historial: HistorialUea;
    /** Pipeline FSM = fast-fail + reglas internas del GRASP. */
    pipeline: ReglaBase[];
    /** Filas de la solución actual; se usan para sembrar la carga del grafo y excluir grupos tomados. */
    candidates: CandidateRow[];
    currentPass: number;
    baseUrl: string;
    chartsVersion?: number;
    /** Campana por tipo de score (kde_ih/ij/plan) del pase, para colorear los % igual que la lista y los insights. */
    scoreStats?: ScoreStatsByKind;
    onManualAssign: (rows: CandidateRow[]) => void;
    /**
     * Modo REEMPLAZO (swap 1↔1): si se pasa, la fila se libera del grafo/pool para validar y el
     * modal selecciona un solo grupo nuevo. Al aceptar llama `onReplaceAssign(replaceRow, rows)`.
     */
    replaceRow?: CandidateRow;
    onReplaceAssign?: (oldRow: CandidateRow, newRows: CandidateRow[]) => void;
    onReplaceOccupiedAssign?: (oldRow: CandidateRow, occupiedRow: CandidateRow, newRows: CandidateRow[], mode: ExchangeMode) => void;
    onClose: () => void;
}

// Espejo del cache-bust de CandidatoSolucionModal para la gráfica KDE IH.
// 3: el backend renombró los títulos del PNG (KDE IH → "Horas en las que ha impartido clase").
//    Subirlo invalida el PNG cacheado para que se vea el título nuevo sin esperar al ETag.
const CHART_VERSION = 3;

interface EvalFsm {
    detalles: ZScoreDetails;
    fsm: ResultadoAsignacion;
}

interface ManualLegEval extends EvalFsm {
    ok: boolean;
    requiereMutuoAcuerdo: boolean;
    motivoMutuoAcuerdo?: string;
    /** La pierna requirió la excepción manual de REGLA_IGNORAR_GRUPOS (grupo SAI/CPRO). */
    requiereExcepcionGrupoIgnorado: boolean;
    motivoGrupoIgnorado?: string;
}

interface ExchangeEvaluation {
    take: ManualLegEval;
    swap: {
        ok: boolean;
        current: ManualLegEval;
        owner?: ManualLegEval;
        bloqueo?: string;
    };
}

interface OccupiedExchangeRow {
    grupo: GrupoDTO;
    occupiedRow: CandidateRow;
    evals: ExchangeEvaluation;
}

interface GrupoEvaluado extends EvalFsm {
    grupo: GrupoDTO;
}

function num(n: number | undefined, digits = 3): string {
    return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function esFalloHorarioLaboral(fsm: ResultadoAsignacion): boolean {
    return fsm.estado !== EstadoAsignacion.ASIGNACION_OK && fsm.error?.reglaFallo === REGLA_HORARIO_LABORAL;
}

function esFalloGrupoIgnorado(fsm: ResultadoAsignacion): boolean {
    return fsm.estado !== EstadoAsignacion.ASIGNACION_OK && fsm.error?.reglaFallo === REGLA_IGNORAR_GRUPOS;
}

function fsmResumen(fsm: ResultadoAsignacion): string {
    return `${ruleLabel(fsm.error?.reglaFallo)}${fsm.error?.motivo ? ` — ${fsm.error.motivo}` : ''}`;
}

function legResumen(prefix: string, evalLeg: ManualLegEval): string {
    if (evalLeg.ok) {
        const excepciones = [
            ...(evalLeg.requiereExcepcionGrupoIgnorado ? ['excepción SAI/CPRO'] : []),
            ...(evalLeg.requiereMutuoAcuerdo ? ['mutuo acuerdo'] : []),
        ];
        return `${prefix}: ${excepciones.length > 0 ? `viable con ${excepciones.join(' + ')}` : 'viable'}`;
    }
    return `${prefix}: ${fsmResumen(evalLeg.fsm)}`;
}

/** Días L–V para la rejilla semanal de horario (dia: 1=L … 5=V). */
const DAY_DEFS = [
    { dia: 1, label: 'L' },
    { dia: 2, label: 'M' },
    { dia: 3, label: 'Mi' },
    { dia: 4, label: 'J' },
    { dia: 5, label: 'V' },
] as const;

/** Etiquetas de día (L–V) en la 2ª fila de cabecera, bajo la columna fusionada "Horario":
 *  claras y tenues (estilo dayHead). `top: 22` las fija justo debajo de la fila superior al
 *  hacer scroll (≈ alto de la cabecera "Horario"); `borderTop: none` las une a "Horario". */
const dayHeadCellStyle: CSSProperties = {
    top: 22,
    background: 'var(--tt-panel)',
    color: 'var(--tt-sub)',
    textAlign: 'center',
    fontFamily: 'var(--tt-mono)',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    borderTop: 'none',
};

export function EditarAsignacionEcoModal({
    eco,
    ecoNombre,
    claveUea,
    scoreStats,
    gruposValidos,
    gruposCatalogo,
    profesores,
    evaluarGrupo,
    historial,
    pipeline,
    candidates,
    currentPass,
    baseUrl,
    chartsVersion,
    onManualAssign,
    replaceRow,
    onReplaceAssign,
    onReplaceOccupiedAssign,
    onClose,
}: EditarAsignacionEcoModalProps) {
    const modoReemplazo = replaceRow != null;
    // En modo reemplazo, la fila vieja se EXCLUYE de la carga efectiva: así la validación FSM
    // (traslapes/horas) se hace contra el estado YA liberado, y su grupo reaparece en el pool.
    const candidatesEff = useMemo(
        () => (replaceRow ? candidates.filter(c => candidateKey(c) !== candidateKey(replaceRow)) : candidates),
        [candidates, replaceRow],
    );
    const [query, setQuery] = useState('');
    const [exchangeQuery, setExchangeQuery] = useState('');
    const [verTodasAreas, setVerTodasAreas] = useState(false);
    const [seleccionIds, setSeleccionIds] = useState<number[]>([]);
    const [aviso, setAviso] = useState<string | null>(null);
    const [mostrarGrafica, setMostrarGrafica] = useState(false);
    const [graficaError, setGraficaError] = useState(false);
    const [graficaAmpliada, setGraficaAmpliada] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const nombre = ecoNombre?.[String(eco)] ?? '';
    const conHistorial = historial.tieneHistorial(eco);

    const areasProfe = useMemo(() => {
        const p = profesores.find(pr => pr.numeroEconomico === eco);
        return new Set((p?.idArea ?? []).map(String));
    }, [profesores, eco]);

    // Profesor del eco y sus asignaciones actuales — alimentan las tarjetas de detalle de regla
    // (qué UEA se traslapa, horario laboral del eco, etc.) del icono ⓘ en la columna FSM.
    const ecoProfesor = useMemo(
        () => profesores.find(p => p.numeroEconomico === eco),
        [profesores, eco],
    );
    const ecoAsignados = useMemo(
        () => candidatesEff
            .filter(c => c.numeroEconomico === eco)
            .map(c => ({ uea: c.uea, claveGrupo: c.claveGrupo, horarioStringRaw: c.horarioStringRaw })),
        [candidatesEff, eco],
    );

    // Carga actual de la solución: grafo sembrado + grupos ya tomados (a excluir del pool).
    // En modo reemplazo se usa candidatesEff (sin la fila vieja) para liberar su grupo y horario.
    const assignedGroupIds = useMemo(() => new Set(candidatesEff.map(c => c.idUeaGrupo)), [candidatesEff]);
    const gruposValidosById = useMemo(() => {
        const m = new Map<number, GrupoDTO>();
        for (const g of gruposValidos) m.set(g.idUeaGrupo, g);
        return m;
    }, [gruposValidos]);
    const gruposCatalogoById = useMemo(() => {
        const m = new Map<number, GrupoDTO>();
        for (const g of gruposCatalogo ?? []) m.set(g.idUeaGrupo, g);
        return m;
    }, [gruposCatalogo]);
    /**
     * Resuelve el GrupoDTO de una fila asignada: primero el catálogo del pase y si no coincide
     * (ids renumerados o fila SAI fuera de gruposValidos), el catálogo crudo. Ambos lookups se
     * verifican contra (ueaClave, claveGrupo) de la fila para evitar colisiones de id.
     */
    const resolverGrupoDeFila = useCallback((row: CandidateRow): GrupoDTO | undefined => {
        const valido = gruposValidosById.get(row.idUeaGrupo);
        if (valido && valido.ueaClave === row.uea && valido.claveGrupo === row.claveGrupo) return valido;
        const crudo = gruposCatalogoById.get(row.idUeaGrupo);
        if (crudo && crudo.ueaClave === row.uea && crudo.claveGrupo === row.claveGrupo) return crudo;
        return undefined;
    }, [gruposValidosById, gruposCatalogoById]);
    const grafoBase = useMemo(
        () => construirGrafoActual(profesores, gruposValidos, candidatesEff, gruposCatalogo),
        [profesores, gruposValidos, candidatesEff, gruposCatalogo],
    );

    // Validación encadenada de una pierna manual: FSM directa → excepción manual SAI/CPRO
    // (REGLA_IGNORAR_GRUPOS) → mutuo acuerdo (REGLA_HORARIO_LABORAL), acumulando flags de qué
    // excepciones se requieren. Los flags quedan en true solo cuando la pierna ES viable usándolos.
    const validarManualConFsm = useCallback((
        grafo: GrafoManual,
        ecoEval: number,
        grupo: GrupoDTO,
        detalles: ZScoreDetails,
    ): ManualLegEval => {
        const fsm = validarAsignacion(grafo, ecoEval, grupo.idUeaGrupo, pipeline);
        if (fsm.estado === EstadoAsignacion.ASIGNACION_OK) {
            return { detalles, fsm, ok: true, requiereMutuoAcuerdo: false, requiereExcepcionGrupoIgnorado: false };
        }
        let fsmActual = fsm;
        let necesitaExcepcionGrupoIgnorado = false;
        let motivoGrupoIgnorado: string | undefined;
        if (esFalloGrupoIgnorado(fsmActual)) {
            necesitaExcepcionGrupoIgnorado = true;
            motivoGrupoIgnorado = fsmActual.error?.motivo;
            const fsmExcepcion = validarAsignacion(
                grafo,
                ecoEval,
                grupo.idUeaGrupo,
                pipeline,
                crearContextoManualAsignacion(detalles, false, { asignarManualmenteGruposIgnorados: true }),
            );
            if (fsmExcepcion.estado === EstadoAsignacion.ASIGNACION_OK) {
                return {
                    detalles,
                    fsm: fsmExcepcion,
                    ok: true,
                    requiereMutuoAcuerdo: false,
                    requiereExcepcionGrupoIgnorado: true,
                    motivoGrupoIgnorado,
                };
            }
            fsmActual = fsmExcepcion;
        }
        if (!esFalloHorarioLaboral(fsmActual)) {
            return {
                detalles,
                fsm: fsmActual,
                ok: false,
                requiereMutuoAcuerdo: false,
                requiereExcepcionGrupoIgnorado: false,
                motivoGrupoIgnorado,
            };
        }
        const fsmMutuo = validarAsignacion(
            grafo,
            ecoEval,
            grupo.idUeaGrupo,
            pipeline,
            crearContextoManualAsignacion(
                detalles,
                true,
                necesitaExcepcionGrupoIgnorado ? { asignarManualmenteGruposIgnorados: true } : undefined,
            ),
        );
        const okMutuo = fsmMutuo.estado === EstadoAsignacion.ASIGNACION_OK;
        return {
            detalles,
            fsm: fsmMutuo,
            ok: okMutuo,
            requiereMutuoAcuerdo: okMutuo,
            motivoMutuoAcuerdo: fsmActual.error?.motivo,
            requiereExcepcionGrupoIgnorado: necesitaExcepcionGrupoIgnorado && okMutuo,
            motivoGrupoIgnorado,
        };
    }, [pipeline]);

    const evaluarIntercambioOcupado = useCallback((grupoOcupado: GrupoDTO, occupiedRow: CandidateRow): ExchangeEvaluation => {
        if (!replaceRow) {
            const detalles = evaluarGrupo(eco, grupoOcupado);
            const fsm: ResultadoAsignacion = {
                estado: EstadoAsignacion.ERROR_REGLA,
                error: {
                    reglaFallo: 'SIN_REEMPLAZO',
                    motivo: 'Abre el intercambio desde una UEA asignada para definir qué fila se reemplaza.',
                    numeroEconomico: eco,
                    idUeaGrupo: grupoOcupado.idUeaGrupo,
                },
            };
            const take = { detalles, fsm, ok: false, requiereMutuoAcuerdo: false, requiereExcepcionGrupoIgnorado: false };
            return { take, swap: { ok: false, current: take, bloqueo: fsm.error?.motivo } };
        }

        const involvedKeys = new Set([candidateKey(replaceRow), candidateKey(occupiedRow)]);
        const baseRows = candidates.filter(c => !involvedKeys.has(candidateKey(c)));
        const grafoLiberado = construirGrafoActual(profesores, gruposValidos, baseRows, gruposCatalogo);
        // Registro explícito de los DTOs involucrados: baseRows EXCLUYE replaceRow/occupiedRow,
        // así que ni el grupo objetivo (p.ej. SAI fuera de gruposValidos) ni el grupo que
        // recibiría el otro ECO quedan registrados por construirGrafoActual. Sin esto la FSM
        // devuelve INTEGRIDAD_GRAFO antes de evaluar reglas (y la excepción SAI/CPRO no aplica).
        const replaceGrupo = resolverGrupoDeFila(replaceRow);
        asegurarGrupoEnGrafo(grafoLiberado, grupoOcupado);
        asegurarGrupoEnGrafo(grafoLiberado, replaceGrupo);
        const detallesActual = evaluarGrupo(eco, grupoOcupado);
        const take = validarManualConFsm(grafoLiberado, eco, grupoOcupado, detallesActual);

        if (!replaceGrupo) {
            return {
                take,
                swap: {
                    ok: false,
                    current: take,
                    bloqueo: 'La UEA reemplazada no está en el catálogo del pase ni en el catálogo del workspace; no se puede validar la segunda pierna.',
                },
            };
        }
        if (!take.ok || !take.fsm.nuevoGrafo) {
            return { take, swap: { ok: false, current: take } };
        }

        // `asignar()` propaga el map de grupos a la copia, así que el registro explícito
        // sobrevive en nuevoGrafo; el aseguramiento extra es defensivo (no-op si ya está).
        const grafoTrasTake = take.fsm.nuevoGrafo;
        asegurarGrupoEnGrafo(grafoTrasTake, replaceGrupo);
        const detallesOwner = evaluarGrupo(occupiedRow.numeroEconomico, replaceGrupo);
        const owner = validarManualConFsm(grafoTrasTake, occupiedRow.numeroEconomico, replaceGrupo, detallesOwner);
        return { take, swap: { ok: owner.ok, current: take, owner } };
    }, [candidates, eco, evaluarGrupo, gruposValidos, gruposCatalogo, profesores, replaceRow, resolverGrupoDeFila, validarManualConFsm]);

    // Cache (eco, grupo) -> {score KDE, resultado FSM} contra el grafo base. Las componentes
    // KDE y la viabilidad "en aislamiento" no dependen de la selección; el Map se reinicia solo
    // cuando cambian eco / grafo base / pipeline.
    const evalCache = useMemo(() => new Map<number, EvalFsm>(), [eco, grafoBase, pipeline]);
    const evalFsm = useCallback((grupo: GrupoDTO): EvalFsm => {
        const hit = evalCache.get(grupo.idUeaGrupo);
        if (hit) return hit;
        const value: EvalFsm = {
            detalles: evaluarGrupo(eco, grupo),
            fsm: validarAsignacion(grafoBase, eco, grupo.idUeaGrupo, pipeline),
        };
        evalCache.set(grupo.idUeaGrupo, value);
        return value;
    }, [evalCache, eco, grafoBase, pipeline, evaluarGrupo]);

    const ordenarCandidatos = useCallback((a: GrupoEvaluado, b: GrupoEvaluado) => {
        const viableA = a.fsm.estado === EstadoAsignacion.ASIGNACION_OK ? 1 : 0;
        const viableB = b.fsm.estado === EstadoAsignacion.ASIGNACION_OK ? 1 : 0;
        if (viableA !== viableB) return viableB - viableA;

        const rankDiff = rankKde(b.detalles) - rankKde(a.detalles);
        if (rankDiff !== 0) return rankDiff;

        const histA = conHistorial ? historial.contar(eco, a.grupo.ueaClave).count : 0;
        const histB = conHistorial ? historial.contar(eco, b.grupo.ueaClave).count : 0;
        if (histA !== histB) return histB - histA;

        return a.grupo.ueaClave - b.grupo.ueaClave || a.grupo.claveGrupo.localeCompare(b.grupo.claveGrupo);
    }, [conHistorial, eco, historial]);

    // Pool disponible = catálogo − grupos ya tomados por alguna fila de la solución.
    const disponibles = useMemo(
        () => gruposValidos.filter(g => !assignedGroupIds.has(g.idUeaGrupo)),
        [gruposValidos, assignedGroupIds],
    );
    const disponiblesEnArea = useMemo(
        () => disponibles.filter(g => areasProfe.has(String(g.idArea))),
        [disponibles, areasProfe],
    );

    const gruposById = useMemo(() => {
        const m = new Map<number, GrupoDTO>();
        for (const g of disponibles) m.set(g.idUeaGrupo, g);
        return m;
    }, [disponibles]);

    // Mejores ≤5 disponibles (solo con historial): viables por FSM y dentro de dominio KDE,
    // ordenadas por max(kde_ij, kde_ih) y luego por imparticiones recientes.
    const mejores = useMemo(() => {
        if (!conHistorial) return [];
        return disponiblesEnArea
            .map(grupo => ({ grupo, ...evalFsm(grupo) }))
            .filter(e => e.fsm.estado === EstadoAsignacion.ASIGNACION_OK && !e.detalles.domainBlocked)
            .sort(ordenarCandidatos)
            .slice(0, 5);
    }, [conHistorial, disponiblesEnArea, evalFsm, ordenarCandidatos]);

    // Lista de la búsqueda manual. Con historial, por defecto solo áreas del profe (toggle
    // "ver todas"); sin historial, búsqueda general. Filtra por texto y limita filas.
    const listaManual = useMemo(() => {
        const base = (conHistorial && !verTodasAreas) ? disponiblesEnArea : disponibles;
        const q = query.trim().toLowerCase();
        const filtrados = q
            ? base.filter(g =>
                `${g.ueaClave} ${g.claveGrupo} ${g.horarioStringRaw} ${g.idArea}`.toLowerCase().includes(q))
            : base;
        const ordenados = filtrados
            .map(grupo => ({ grupo, ...evalFsm(grupo) }))
            .sort(ordenarCandidatos);
        const recortado = ordenados.slice(0, MAX_FILAS_BUSQUEDA);
        return {
            filas: recortado,
            truncado: filtrados.length > recortado.length,
            total: filtrados.length,
        };
    }, [conHistorial, verTodasAreas, disponibles, disponiblesEnArea, query, evalFsm, ordenarCandidatos]);

    const listaIntercambio = useMemo(() => {
        if (!modoReemplazo || !replaceRow) return { filas: [] as OccupiedExchangeRow[], truncado: false, total: 0 };
        const q = exchangeQuery.trim().toLowerCase();
        const base: Array<{ grupo: GrupoDTO; occupiedRow: CandidateRow }> = [];
        const seen = new Set<number>();
        for (const row of candidatesEff) {
            if (row.numeroEconomico === eco || seen.has(row.idUeaGrupo)) continue;
            // Fallback al catálogo crudo: las filas SAI asignadas (fuera de gruposValidos)
            // también son objetivos válidos de Tomar/Intercambiar.
            const grupo = resolverGrupoDeFila(row);
            if (!grupo) continue;
            const ownerName = ecoNombre?.[String(row.numeroEconomico)] ?? '';
            const haystack = `${grupo.ueaClave} ${claveUea?.[String(grupo.ueaClave)] ?? ''} ${grupo.claveGrupo} ${grupo.idArea} ${grupo.horarioStringRaw} ${row.numeroEconomico} ${ownerName}`.toLowerCase();
            if (q && !haystack.includes(q)) continue;
            seen.add(row.idUeaGrupo);
            base.push({ grupo, occupiedRow: row });
        }
        const ordenados = base.sort((a, b) =>
            a.grupo.ueaClave - b.grupo.ueaClave || a.grupo.claveGrupo.localeCompare(b.grupo.claveGrupo),
        );
        const recortado = ordenados.slice(0, MAX_FILAS_BUSQUEDA)
            .map(item => ({ ...item, evals: evaluarIntercambioOcupado(item.grupo, item.occupiedRow) }))
            .sort((a, b) => {
                const viableA = a.evals.take.ok || a.evals.swap.ok ? 1 : 0;
                const viableB = b.evals.take.ok || b.evals.swap.ok ? 1 : 0;
                if (viableA !== viableB) return viableB - viableA;
                const rankDiff = rankKde(b.evals.take.detalles) - rankKde(a.evals.take.detalles);
                if (rankDiff !== 0) return rankDiff;
                return a.grupo.ueaClave - b.grupo.ueaClave || a.grupo.claveGrupo.localeCompare(b.grupo.claveGrupo);
            });
        return {
            filas: recortado,
            truncado: ordenados.length > recortado.length,
            total: ordenados.length,
        };
    }, [candidatesEff, claveUea, eco, ecoNombre, evaluarIntercambioOcupado, exchangeQuery, resolverGrupoDeFila, modoReemplazo, replaceRow]);

    const crearRowManual = useCallback((ecoDestino: number, grupo: GrupoDTO, evalLeg: ManualLegEval): CandidateRow => (
        grupoToCandidateRow(
            ecoDestino,
            grupo,
            evalLeg.detalles,
            currentPass,
            metadataExcepcionesManual(evalLeg.detalles, {
                mutuoAcuerdo: { aplicada: evalLeg.requiereMutuoAcuerdo, motivo: evalLeg.motivoMutuoAcuerdo },
                grupoIgnorado: { aplicada: evalLeg.requiereExcepcionGrupoIgnorado, motivo: evalLeg.motivoGrupoIgnorado },
            }),
        )
    ), [currentPass]);

    const aplicarIntercambioOcupado = useCallback((
        mode: ExchangeMode,
        grupoOcupado: GrupoDTO,
        occupiedRow: CandidateRow,
        evals: ExchangeEvaluation,
    ) => {
        if (!replaceRow || !onReplaceOccupiedAssign || !evals.take.ok) return;
        const newRows = [crearRowManual(eco, grupoOcupado, evals.take)];
        if (mode === 'swap') {
            const replaceGrupo = resolverGrupoDeFila(replaceRow);
            if (!replaceGrupo || !evals.swap.ok || !evals.swap.owner?.ok) return;
            newRows.push(crearRowManual(occupiedRow.numeroEconomico, replaceGrupo, evals.swap.owner));
        }
        onReplaceOccupiedAssign(replaceRow, occupiedRow, newRows, mode);
        onClose();
    }, [crearRowManual, eco, resolverGrupoDeFila, onClose, onReplaceOccupiedAssign, replaceRow]);

    const seleccionSet = useMemo(() => new Set(seleccionIds), [seleccionIds]);

    const excepcionesSeleccionadas = useMemo(
        () => seleccionIds.filter(id => {
            const grupo = gruposById.get(id);
            return grupo ? esFalloHorarioLaboral(evalFsm(grupo).fsm) : false;
        }).length,
        [seleccionIds, gruposById, evalFsm],
    );

    const toggleSeleccion = useCallback((grupo: GrupoDTO) => {
        setAviso(null);
        if (seleccionSet.has(grupo.idUeaGrupo)) {
            setSeleccionIds(prev => prev.filter(id => id !== grupo.idUeaGrupo));
            return;
        }
        // Validación CONJUNTA: el candidato debe pasar la FSM contra el grafo base + lo ya
        // seleccionado (traslapes y carga diaria acumulada entre las propias selecciones).
        // En reemplazo (1↔1) NO se acumula: se descarta la selección previa y se valida solo
        // contra el grafo base (que ya excluye la fila vieja vía candidatesEff).
        let grafo = grafoBase;
        if (!modoReemplazo) {
            try {
                for (const id of seleccionIds) grafo = grafo.asignar(eco, id);
            } catch {
                /* defensivo: estado inconsistente, la validación de abajo lo refleja */
            }
        }
        const { detalles } = evalFsm(grupo);
        const res = validarAsignacion(grafo, eco, grupo.idUeaGrupo, pipeline);
        if (res.estado !== EstadoAsignacion.ASIGNACION_OK) {
            const resMutuoAcuerdo = esFalloHorarioLaboral(res)
                ? validarAsignacion(grafo, eco, grupo.idUeaGrupo, pipeline, crearContextoManualAsignacion(detalles, true))
                : res;
            if (resMutuoAcuerdo.estado !== EstadoAsignacion.ASIGNACION_OK) {
                setAviso(`No se puede ${modoReemplazo ? 'reemplazar por' : 'añadir'} ${grupo.ueaClave}/${grupo.claveGrupo}: ${ruleLabel(res.error?.reglaFallo)} — ${res.error?.motivo ?? ''}`);
                return;
            }
        }
        if (modoReemplazo) setSeleccionIds([grupo.idUeaGrupo]);
        else setSeleccionIds(prev => [...prev, grupo.idUeaGrupo]);
    }, [grafoBase, eco, pipeline, seleccionIds, seleccionSet, modoReemplazo, evalFsm]);

    const inyectar = useCallback(() => {
        const rows: CandidateRow[] = [];
        for (const id of seleccionIds) {
            const grupo = gruposById.get(id);
            if (!grupo) continue;
            const { detalles, fsm } = evalFsm(grupo);
            rows.push(grupoToCandidateRow(
                eco,
                grupo,
                detalles,
                currentPass,
                esFalloHorarioLaboral(fsm)
                    ? metadataExcepcionesManual(detalles, { mutuoAcuerdo: { aplicada: true, motivo: fsm.error?.motivo } })
                    : undefined,
            ));
        }
        if (rows.length > 0) {
            if (modoReemplazo && replaceRow && onReplaceAssign) onReplaceAssign(replaceRow, rows);
            else onManualAssign(rows);
        }
        onClose();
    }, [seleccionIds, gruposById, evalFsm, eco, currentPass, onManualAssign, onClose, modoReemplazo, replaceRow, onReplaceAssign]);

    // a11y: cerrar con Escape y enfocar el diálogo al montar.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (graficaAmpliada) setGraficaAmpliada(false);
                else onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        dialogRef.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, graficaAmpliada]);

    const graficaSrc = `${baseUrl}/charts/kde/${eco}?tipo=ih&cv=${CHART_VERSION}${chartsVersion ? `&v=${chartsVersion}` : ''}`;

    const titleId = `editar-eco-${eco}-titulo`;

    return (
        <div
            role="presentation"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                style={{
                    backgroundColor: 'var(--tt-panel2)', borderRadius: 'var(--tt-radius)', padding: 20,
                    width: '92%', maxWidth: 1100, maxHeight: '92vh', overflowY: 'auto',
                    border: '3px solid var(--tt-ink)', boxShadow: '8px 8px 0 rgba(34,29,22,0.28)',
                    outline: 'none', fontFamily: 'var(--tt-font)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Encabezado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                    <h3 id={titleId} style={{ margin: 0, color: 'var(--tt-ink)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {modoReemplazo
                            ? `Reemplazar ${replaceRow!.uea}/${replaceRow!.claveGrupo} — Eco ${eco}`
                            : `Asignar UEA — Eco ${eco}`}{nombre ? ` · ${nombre}` : ''}
                        {conHistorial ? (
                            <span style={badgeStyle('var(--tt-accent)')}>Con historial</span>
                        ) : (
                            <span style={badgeStyle('var(--tt-danger)')}>Sin historial (eco no visto)</span>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--tt-danger)', color: 'var(--tt-on-ink)', border: 'none', borderRadius: 4,
                            padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', minHeight: 24,
                        }}
                    >
                        Cerrar
                    </button>
                </div>

                {/* Gráfica KDE IH (solo con historial) */}
                {conHistorial && (
                    <div style={{ marginBottom: 12 }}>
                        <button
                            onClick={() => setMostrarGrafica(v => !v)}
                            style={secondaryBtn}
                            aria-expanded={mostrarGrafica}
                        >
                            {mostrarGrafica ? 'Ocultar' : 'Ver'} gráfica KDE IH (¿a qué hora imparte?)
                        </button>
                        {mostrarGrafica && (
                            graficaError ? (
                                <div style={{ color: 'var(--tt-danger)', fontStyle: 'italic', padding: '12px 0' }}>
                                    Gráfica KDE IH no disponible (¿backend Python apagado?).
                                </div>
                            ) : (
                                <img
                                    src={graficaSrc}
                                    alt={`Distribución horaria (KDE IH) del Eco ${eco}`}
                                    loading="lazy"
                                    onError={() => setGraficaError(true)}
                                    onClick={() => setGraficaAmpliada(true)}
                                    style={{ marginTop: 8, maxWidth: '100%', height: 'auto', cursor: 'zoom-in', border: '1px solid var(--tt-line)', borderRadius: 6 }}
                                />
                            )
                        )}
                    </div>
                )}

                {/* Mejores ≤5 disponibles (solo con historial) */}
                {conHistorial && (
                    <section className={styles.section} style={{ marginTop: 4 }}>
                        <h4 className={styles.sectionTitle}>Mejores UEA disponibles (viable · max KDE · últimos {historial.ventana} tri.)</h4>
                        {mejores.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--tt-sub)' }}>
                                No hay UEA disponibles viables (FSM) en las áreas del profesor.
                            </div>
                        ) : (
                            <div className={styles.tableWrap} style={{ maxHeight: 240 }}>
                                <table className={styles.lockTable}>
                                    <thead>
                                        <tr>
                                            <th rowSpan={2}>Asignar</th>
                                            <th rowSpan={2}>UEA</th><th rowSpan={2}>Nombre</th><th rowSpan={2}>Grupo</th>
                                            <th colSpan={5} style={{ textAlign: 'center' }}>Horario</th>
                                            <th rowSpan={2}>kde_ij</th><th rowSpan={2}>kde_ih</th><th rowSpan={2}>max</th><th rowSpan={2} title={`Veces impartida en los últimos ${historial.ventana} trimestres`} style={{ whiteSpace: 'normal', width: 56, minWidth: 0 }}>Últimos {historial.ventana} tri. impartida</th>
                                        </tr>
                                        <tr>
                                            {DAY_DEFS.map(({ dia, label }) => <th key={dia} style={dayHeadCellStyle}>{label}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mejores.map(({ grupo, detalles }) => {
                                            const conteo = historial.contar(eco, grupo.ueaClave);
                                            const sel = seleccionSet.has(grupo.idUeaGrupo);
                                            return (
                                                <tr key={grupo.idUeaGrupo} className={sel ? styles.locked : ''}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={sel}
                                                            onChange={() => toggleSeleccion(grupo)}
                                                            aria-label={`Asignar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo}`}
                                                        />
                                                    </td>
                                                    <td>{grupo.ueaClave}</td>
                                                    <td title={claveUea?.[String(grupo.ueaClave)] ?? `UEA ${grupo.ueaClave}`} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{claveUea?.[String(grupo.ueaClave)] ?? '—'}</td>
                                                    <td>{grupo.claveGrupo}</td>
                                                    {DAY_DEFS.map(({ dia, label }) => {
                                                        const f = grupo.horarios.find(h => h.dia === dia);
                                                        return (
                                                            <td key={dia} style={{ padding: 2 }}>
                                                                <span
                                                                    className={`${styles.dayCell} ${f ? styles.dayCellOn : ''}`}
                                                                    title={f ? `${label} · ${decimalToTime(f.horaInicio)} - ${decimalToTime(f.horaFin)}` : `${label} · sin clase`}
                                                                >
                                                                    {f ? (
                                                                        <>
                                                                            <span className={styles.dayCellTime}>{decimalToTime(f.horaInicio)}</span>
                                                                            <span className={styles.dayCellEnd}>{decimalToTime(f.horaFin)}</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className={styles.dayCellTime}>·</span>
                                                                    )}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ color: scoreColor(detalles.kde_ij, scoreStats?.ij ?? null) }}>{pct(detalles.kde_ij)}</td>
                                                    <td style={{ color: scoreColor(detalles.kde_ih, scoreStats?.ih ?? null) }}>{pct(detalles.kde_ih)}</td>
                                                    <td><strong>{num(rankKde(detalles))}</strong></td>
                                                    <td title={`Histórico total: ${conteo.total} · ponderado: ${conteo.weighted}`} style={{ textAlign: 'center' }}>{conteo.count}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {modoReemplazo && replaceRow && (
                    <section className={styles.section}>
                        <h4 className={styles.sectionTitle}>Intercambiar UEA con otro profesor</h4>
                        <p className={styles.exchangeHint}>Intercambia asignaciones posibles entre profesores.</p>
                        <div className={styles.searchBar}>
                            <input
                                placeholder="Buscar por UEA, grupo, horario, ECO o profesor…"
                                value={exchangeQuery}
                                onChange={e => setExchangeQuery(e.target.value)}
                                aria-label="Buscar UEA ocupadas por otro profesor"
                            />
                        </div>

                        <div className={styles.tableWrap} style={{ maxHeight: 300 }}>
                            <table className={styles.lockTable}>
                                <thead>
                                    <tr>
                                        <th rowSpan={2}>Acción</th>
                                        <th rowSpan={2}>Estado</th>
                                        <th rowSpan={2}>UEA</th><th rowSpan={2}>Nombre</th><th rowSpan={2}>Grupo</th>
                                        <th colSpan={5} style={{ textAlign: 'center' }}>Horario</th>
                                        <th rowSpan={2}>Profesor actual</th>
                                        <th rowSpan={2}>kde_ij</th><th rowSpan={2}>kde_ih</th>
                                        <th rowSpan={2}>FSM predictiva</th>
                                    </tr>
                                    <tr>
                                        {DAY_DEFS.map(({ dia, label }) => <th key={dia} style={dayHeadCellStyle}>{label}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {listaIntercambio.filas.map(({ grupo, occupiedRow, evals }) => {
                                        const ownerName = ecoNombre?.[String(occupiedRow.numeroEconomico)] ?? '';
                                        const ownerLabel = `ECO ${occupiedRow.numeroEconomico}${ownerName ? ` · ${ownerName}` : ''}`;
                                        const puedeTomar = evals.take.ok && onReplaceOccupiedAssign != null;
                                        const puedeIntercambiar = evals.swap.ok && onReplaceOccupiedAssign != null;
                                        const requiereExcepcion = evals.take.requiereMutuoAcuerdo
                                            || evals.take.requiereExcepcionGrupoIgnorado
                                            || (evals.swap.owner?.requiereMutuoAcuerdo ?? false)
                                            || (evals.swap.owner?.requiereExcepcionGrupoIgnorado ?? false);
                                        const rowClassName = [
                                            !evals.take.ok && !evals.swap.ok ? styles.contradiction : '',
                                            requiereExcepcion ? styles.warning : '',
                                        ].filter(Boolean).join(' ');
                                        const tipId = `ocupada-${eco}-${grupo.idUeaGrupo}`;
                                        const swapResumen = evals.swap.owner
                                            ? `${legResumen('Intercambiar actual', evals.swap.current)} · ${legResumen(`ECO ${occupiedRow.numeroEconomico}`, evals.swap.owner)}`
                                            : `Intercambiar: ${evals.swap.bloqueo ?? fsmResumen(evals.swap.current.fsm)}`;
                                        return (
                                            <tr key={grupo.idUeaGrupo} className={rowClassName}>
                                                <td>
                                                    <div className={styles.exchangeActions}>
                                                        <button
                                                            type="button"
                                                            className={`${styles.detailBtn} ${styles.detailBtnPrimary}`}
                                                            disabled={!puedeTomar}
                                                            onClick={() => aplicarIntercambioOcupado('take', grupo, occupiedRow, evals)}
                                                            aria-label={`Tomar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo} desde ${ownerLabel}`}
                                                        >
                                                            Tomar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.detailBtn}
                                                            disabled={!puedeIntercambiar}
                                                            onClick={() => aplicarIntercambioOcupado('swap', grupo, occupiedRow, evals)}
                                                            aria-label={`Intercambiar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo} con ${ownerLabel}`}
                                                        >
                                                            <IconSwap size={13} /> Intercambiar
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={styles.tooltipWrap} tabIndex={0} aria-describedby={tipId}>
                                                        <span className={styles.mutuoAcuerdoBadge} aria-label={`UEA ocupada por ${ownerLabel}`}>
                                                            <IconLock size={13} /> Ocupada
                                                        </span>
                                                        <span id={tipId} role="tooltip" className={styles.tooltipCard}>
                                                            <span className={styles.tooltipTitle}>Horario ocupado</span>
                                                            <span>Ocupada por <span className={styles.tooltipMono}>{ownerLabel}</span></span>
                                                            <span>{grupo.ueaClave}/{grupo.claveGrupo}</span>
                                                        </span>
                                                    </span>
                                                </td>
                                                <td>{grupo.ueaClave}</td>
                                                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{claveUea?.[String(grupo.ueaClave)] ?? '—'}</td>
                                                <td>{grupo.claveGrupo}</td>
                                                {DAY_DEFS.map(({ dia }) => {
                                                    const f = grupo.horarios.find(h => h.dia === dia);
                                                    return (
                                                        <td key={dia} style={{ padding: 2 }}>
                                                            <span className={`${styles.dayCell} ${f ? styles.dayCellOn : ''}`}>
                                                                {f ? (
                                                                    <>
                                                                        <span className={styles.dayCellTime}>{decimalToTime(f.horaInicio)}</span>
                                                                        <span className={styles.dayCellEnd}>{decimalToTime(f.horaFin)}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className={styles.dayCellTime}>·</span>
                                                                )}
                                                            </span>
                                                        </td>
                                                    );
                                                })}
                                                <td>{ownerLabel}</td>
                                                <td style={{ color: scoreColor(evals.take.detalles.kde_ij, scoreStats?.ij ?? null) }}>{pct(evals.take.detalles.kde_ij)}</td>
                                                <td style={{ color: scoreColor(evals.take.detalles.kde_ih, scoreStats?.ih ?? null) }}>{pct(evals.take.detalles.kde_ih)}</td>
                                                <td>
                                                    <div className={styles.exchangeAlert} role={!evals.take.ok && !evals.swap.ok ? 'alert' : undefined}>
                                                        <div>{legResumen('Tomar', evals.take)}</div>
                                                        <div>{swapResumen}</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {listaIntercambio.filas.length === 0 && (
                                        <tr>
                                            <td colSpan={14} style={{ textAlign: 'center', color: 'var(--tt-sub)', padding: 12 }}>
                                                {exchangeQuery.trim() ? 'Sin UEA ocupadas que coincidan con la búsqueda.' : 'No hay UEA ocupadas por otro profesor.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {listaIntercambio.truncado && (
                            <div style={{ fontSize: 11, color: 'var(--tt-sub)', marginTop: 4 }}>
                                Mostrando {MAX_FILAS_BUSQUEDA} de {listaIntercambio.total}. Afina la búsqueda para ver más.
                            </div>
                        )}
                    </section>
                )}

                {/* Búsqueda manual de candidatos jh */}
                <section className={styles.section}>
                    <h4 className={styles.sectionTitle}>
                        Asignación manual {conHistorial ? '(todas las áreas vistas del profe)' : '(búsqueda general)'}
                    </h4>
                    <div className={styles.searchBar}>
                        <input
                            placeholder="Buscar por UEA, grupo, horario, área…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            aria-label="Buscar candidatos uea-horario"
                        />
                        {conHistorial && (
                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                <input type="checkbox" checked={verTodasAreas} onChange={e => setVerTodasAreas(e.target.checked)} />
                                Ver todas las áreas
                            </label>
                        )}
                    </div>

                    <div className={styles.tableWrap} style={{ maxHeight: 320 }}>
                        <table className={styles.lockTable}>
                            <thead>
                                <tr>
                                    <th rowSpan={2}>Asignar</th>
                                    <th rowSpan={2}>UEA</th><th rowSpan={2}>Nombre</th><th rowSpan={2}>Grupo</th>
                                    <th colSpan={5} style={{ textAlign: 'center' }}>Horario</th>
                                    <th rowSpan={2}>kde_ij</th><th rowSpan={2}>kde_ih</th>
                                    {conHistorial && <th rowSpan={2} title={`Veces impartida en los últimos ${historial.ventana} trimestres`} style={{ whiteSpace: 'normal', width: 56, minWidth: 0 }}>Últimos {historial.ventana} tri. impartida</th>}
                                    <th rowSpan={2}>FSM</th>
                                </tr>
                                <tr>
                                    {DAY_DEFS.map(({ dia, label }) => <th key={dia} style={dayHeadCellStyle}>{label}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {listaManual.filas.map(({ grupo, detalles, fsm }) => {
                                    const ok = fsm.estado === EstadoAsignacion.ASIGNACION_OK;
                                    const warning = esFalloHorarioLaboral(fsm)
                                        && validarAsignacion(grafoBase, eco, grupo.idUeaGrupo, pipeline, crearContextoManualAsignacion(detalles, true)).estado === EstadoAsignacion.ASIGNACION_OK;
                                    const asignable = ok || warning;
                                    const sel = seleccionSet.has(grupo.idUeaGrupo);
                                    const conteo = conHistorial ? historial.contar(eco, grupo.ueaClave) : null;
                                    const rowClassName = [
                                        sel ? styles.locked : '',
                                        warning ? styles.warning : '',
                                        !sel && !warning && !ok ? styles.contradiction : '',
                                    ].filter(Boolean).join(' ');
                                    return (
                                        <tr key={grupo.idUeaGrupo} className={rowClassName}>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={sel}
                                                    disabled={!asignable && !sel}
                                                    onChange={() => toggleSeleccion(grupo)}
                                                    aria-label={warning
                                                        ? `Asignar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo} como excepción fuera de horario laboral por mutuo acuerdo`
                                                        : asignable
                                                        ? `Asignar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo}`
                                                        : `No asignable: ${ruleLabel(fsm.error?.reglaFallo)} — ${fsm.error?.motivo ?? ''}`}
                                                />
                                            </td>
                                            <td>{grupo.ueaClave}</td>
                                            <td title={claveUea?.[String(grupo.ueaClave)] ?? `UEA ${grupo.ueaClave}`} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{claveUea?.[String(grupo.ueaClave)] ?? '—'}</td>
                                            <td>{grupo.claveGrupo}</td>
                                            {DAY_DEFS.map(({ dia, label }) => {
                                                const f = grupo.horarios.find(h => h.dia === dia);
                                                return (
                                                    <td key={dia} style={{ padding: 2 }}>
                                                        <span
                                                            className={`${styles.dayCell} ${f ? styles.dayCellOn : ''}`}
                                                            title={f ? `${label} · ${decimalToTime(f.horaInicio)} - ${decimalToTime(f.horaFin)}` : `${label} · sin clase`}
                                                        >
                                                            {f ? (
                                                                <>
                                                                    <span className={styles.dayCellTime}>{decimalToTime(f.horaInicio)}</span>
                                                                    <span className={styles.dayCellEnd}>{decimalToTime(f.horaFin)}</span>
                                                                </>
                                                            ) : (
                                                                <span className={styles.dayCellTime}>·</span>
                                                            )}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                            <td style={{ color: scoreColor(detalles.kde_ij, scoreStats?.ij ?? null) }}>{pct(detalles.kde_ij)}</td>
                                            <td style={{ color: scoreColor(detalles.kde_ih, scoreStats?.ih ?? null) }}>{pct(detalles.kde_ih)}</td>
                                            {conHistorial && <td title={`Histórico total: ${conteo!.total} · ponderado: ${conteo!.weighted}`} style={{ textAlign: 'center' }}>{conteo!.count}</td>}
                                            <td style={{ color: ok ? 'var(--tt-accent)' : (warning ? 'var(--tt-warn)' : 'var(--tt-danger)'), fontWeight: 700 }}>
                                                {ok ? (
                                                    <span title="Pasa la FSM (fast-fail + reglas del GRASP)">✓ viable</span>
                                                ) : warning ? (
                                                    <span title={fsm.error?.motivo ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <IconWarn size={14} title="Requiere mutuo acuerdo" />
                                                        {ruleLabel(fsm.error?.reglaFallo)}
                                                        <RuleViolationInfo
                                                            rule={fsm.error?.reglaFallo}
                                                            titulo={ruleLabel(fsm.error?.reglaFallo)}
                                                            motivo={fsm.error?.motivo}
                                                            candidato={grupo}
                                                            profesorEco={ecoProfesor}
                                                            ecoAsignados={ecoAsignados}
                                                        />
                                                    </span>
                                                ) : (
                                                    <span title={fsm.error?.motivo ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        ✗ {ruleLabel(fsm.error?.reglaFallo)}
                                                        <RuleViolationInfo
                                                            rule={fsm.error?.reglaFallo}
                                                            titulo={ruleLabel(fsm.error?.reglaFallo)}
                                                            motivo={fsm.error?.motivo}
                                                            candidato={grupo}
                                                            profesorEco={ecoProfesor}
                                                            ecoAsignados={ecoAsignados}
                                                        />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {listaManual.filas.length === 0 && (
                                    <tr><td colSpan={conHistorial ? 13 : 12} style={{ textAlign: 'center', color: 'var(--tt-sub)', padding: 12 }}>Sin candidatos.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {listaManual.truncado && (
                        <div style={{ fontSize: 11, color: 'var(--tt-sub)', marginTop: 4 }}>
                            Mostrando {MAX_FILAS_BUSQUEDA} de {listaManual.total}. Afina la búsqueda para ver más.
                        </div>
                    )}
                </section>

                {/* Aviso de FSM al intentar seleccionar */}
                {aviso && (
                    <div role="alert" style={{ marginTop: 8, padding: '8px 10px', border: '2px solid var(--tt-danger)', borderRadius: 6, color: 'var(--tt-danger)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <IconWarn size={16} title="Aviso" /><span>{aviso}</span>
                    </div>
                )}

                {/* Barra de inyección */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tt-ink)' }}>
                        {modoReemplazo
                            ? (seleccionIds.length === 0 ? 'Elige la UEA de reemplazo' : 'Reemplazo listo')
                            : `${seleccionIds.length} seleccionada(s)`}
                    </span>
                    {excepcionesSeleccionadas > 0 && (
                        <span className={styles.mutuoAcuerdoBadge} aria-label={`${excepcionesSeleccionadas} excepción de horario laboral con mutuo acuerdo`}>
                            <IconWarn size={13} />
                            Mutuo acuerdo: {excepcionesSeleccionadas}
                        </span>
                    )}
                    <button
                        onClick={inyectar}
                        disabled={seleccionIds.length === 0}
                        style={{
                            background: seleccionIds.length === 0 ? 'var(--tt-line)' : 'var(--tt-accent)',
                            color: 'var(--tt-panel)', border: '2px solid var(--tt-ink)', borderRadius: 6,
                            padding: '8px 16px', fontWeight: 800,
                            cursor: seleccionIds.length === 0 ? 'not-allowed' : 'pointer', minHeight: 24,
                        }}
                    >
                        {modoReemplazo
                            ? `Reemplazar ${replaceRow!.uea}/${replaceRow!.claveGrupo}${excepcionesSeleccionadas > 0 ? ' con mutuo acuerdo' : ''}`
                            : `Forzar ${seleccionIds.length} asignación${seleccionIds.length === 1 ? '' : 'es'}${excepcionesSeleccionadas > 0 ? ' con mutuo acuerdo' : ''}`}
                    </button>
                    {seleccionIds.length > 0 && (
                        <button onClick={() => setSeleccionIds([])} style={secondaryBtn}>Limpiar selección</button>
                    )}
                </div>
            </div>

            {/* Zoom de la gráfica */}
            {graficaAmpliada && (
                <div
                    role="presentation"
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                    }}
                    onClick={e => { e.stopPropagation(); setGraficaAmpliada(false); }}
                >
                    <button
                        onClick={e => { e.stopPropagation(); setGraficaAmpliada(false); }}
                        aria-label="Cerrar gráfica"
                        style={{ position: 'absolute', top: 16, right: 24, background: 'transparent', color: '#fff', border: 'none', fontSize: 36, lineHeight: 1, cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        &times;
                    </button>
                    <img
                        src={graficaSrc}
                        alt={`Distribución horaria (KDE IH) del Eco ${eco}`}
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', backgroundColor: '#fff', borderRadius: 4 }}
                    />
                </div>
            )}
        </div>
    );
}

function badgeStyle(bg: string): CSSProperties {
    return { background: bg, color: 'var(--tt-panel)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 800 };
}

const secondaryBtn: CSSProperties = {
    background: 'var(--tt-panel)', color: 'var(--tt-ink)', border: '2px solid var(--tt-ink)',
    borderRadius: 4, padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 12, minHeight: 24,
};
