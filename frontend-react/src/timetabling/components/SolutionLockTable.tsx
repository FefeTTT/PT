import { useEffect, useMemo, useRef, useState } from 'react';
import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import type { ReglaBase } from '@solution/rules/ReglaBase';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { candidateKey } from '../engine/kde/candidateRow';
import { grupoToCandidateRow, metadataExcepcionesManual, rankKde, type HistorialUea } from '../engine/kde/manualCandidates';
import {
    construirGrafoActual,
    crearContextoManualAsignacion,
    EstadoAsignacion,
    validarAsignacion,
    type ResultadoAsignacion,
} from '../engine/kde/manualAssignmentFsm';
import { EditarAsignacionEcoModal } from './EditarAsignacionEcoModal';
import { EcoDetailPanel } from './EcoDetailPanel';
import { EcoPenaltyBadge } from './EcoPenaltyBadge';
import { useSolutionHistory } from '../hooks/useSolutionHistory';
import { ruleLabel } from '../utils/fsmRuleLabels';
import {
    Dot,
    IconLock, IconCheck, IconUndo, IconSearch, IconChevronD, IconChevronR,
    IconReset, IconAlert, IconSwap, IconTrash,
} from './atoms';
import {
    pct, computeScoreStats, scoreColor,
    type ScoreStats, type ScoreStatsByKind,
} from '../utils/scoreLens';
import styles from './KdeMode.module.css';

export interface SolutionLockTableProps {
    candidates: CandidateRow[];
    /** Catalogo crudo de horarios a programar, antes de filtrar SAI/CPRO por ingesta. */
    gruposCatalogo?: GrupoDTO[];
    contradictionGroupIds?: Set<number>;
    onToggleLock: (key: string, next: boolean) => void;
    onBulkSet: (rows: CandidateRow[], locked: boolean) => void;
    completedEcos?: Set<number>;
    onToggleEcoComplete?: (eco: number) => void;
    /** Sube tras reentrenar joblibs KDE; fuerza refetch de las graficas del modal/ficha. */
    chartsVersion?: number;
    ecoNombre?: Record<string, string>;
    /** Mapa clave de UEA → nombre legible (de clave-uea.json). Si falta, se muestra "UEA <clave>". */
    claveUea?: Record<string, string>;
    onReassignUnlocked?: () => void;
    onAutoConverge?: () => void;
    onReset?: () => void;
    busy?: boolean;
    iterativePass?: number;
    iterativeConverged?: boolean;
    iterativeDelta?: { added: number; removed: number; reassigned: number };
    // ── Asignación manual (modal de edición) ──
    gruposValidos: GrupoDTO[];
    profesores: ProfesorDTO[];
    evaluarGrupo: (eco: number, grupo: GrupoDTO) => ZScoreDetails;
    historial: HistorialUea;
    pipeline: ReglaBase[];
    currentPass: number;
    baseUrl: string;
    onManualAssign: (rows: CandidateRow[]) => void;
    /** Desasigna (libera) una fila: su grupo vuelve al pool de candidatos a programar. */
    onRemoveAssignment: (row: CandidateRow) => void;
    /** Reemplaza (swap 1↔1) una fila por la(s) nueva(s) seleccionadas en el modal. */
    onReplaceAssignment: (oldRow: CandidateRow, newRows: CandidateRow[]) => void;
    /** Toma/intercambia un jh ya asignado a otro ECO, preservando atomicidad. */
    onReplaceOccupiedAssignment: (oldRow: CandidateRow, occupiedRow: CandidateRow, newRows: CandidateRow[], mode: 'take' | 'swap') => void;
    // ── Deshacer + historial (pieza Eje 3) ──
    onUndo?: () => void;
    canUndo?: boolean;
    onRestoreSnapshot?: (id: number) => void;
    /** Cambia tras cada auto-guardado; re-lista el historial. */
    historyRefreshKey?: number;
    /** Respaldo (descarga) de la solución actual antes de "Reiniciar a pase 0". */
    onBackupBeforeReset?: () => void;
}

const DAY_KEYS = ['L', 'Ma', 'Mi', 'J', 'V'] as const;
type FilterMode = 'pool' | 'all' | 'locked' | 'unlocked' | 'contradiction';
const MAX_PROFESORES_ASIGNAR = 80;
/** Etiqueta visible por columna. La clave del dato es 'Ma' (clash con 'Mi' al parsear), pero la UI
 *  lo muestra como 'M' porque la posición (cabecera de día) ya desambigua. */
const DAY_LABEL: Record<(typeof DAY_KEYS)[number], string> = { L: 'L', Ma: 'M', Mi: 'Mi', J: 'J', V: 'V' };
const FILTER_LABEL: Record<FilterMode, string> = {
    pool: 'Sin emparejar',
    all: 'Todos',
    locked: 'Asignadas',
    unlocked: 'Por asignar',
    contradiction: 'Revisar',
};

interface DayRange { start: string; end: string; }

/** Rango HH:MM–HH:MM por día desde "L:07:00-08:30|Mi:19:00-20:30" para mostrar en la lista. */
function rangeByDay(raw: string): Record<string, DayRange | null> {
    const out: Record<string, DayRange | null> = { L: null, Ma: null, Mi: null, J: null, V: null };
    if (!raw) return out;
    for (const seg of raw.split('|')) {
        const m = seg.trim().match(/^(L|M|Ma|Mi|J|V):(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/i);
        const dayKey = m ? normalizeDayKey(m[1]) : null;
        if (m && dayKey && !out[dayKey]) {
            out[dayKey] = {
                start: `${m[2].padStart(2, '0')}:${m[3]}`,
                end: `${m[4].padStart(2, '0')}:${m[5]}`,
            };
        }
    }
    return out;
}

function normalizeDayKey(raw: string): (typeof DAY_KEYS)[number] | null {
    const day = raw.trim().toUpperCase();
    if (day === 'L' || day === 'J' || day === 'V') return day;
    if (day === 'M' || day === 'MA') return 'Ma';
    if (day === 'MI') return 'Mi';
    return null;
}

function isIgnoredSaiCproGroup(grupo: GrupoDTO): boolean {
    const clave = grupo.claveGrupo.trim().toUpperCase();
    return clave.includes('SAI') || clave.includes('PRO');
}

function IconAssignProfessor({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
                d="M3 12h8m0 0-3-3m3 3-3 3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="17" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
                d="M12.5 21a5.5 5.5 0 0 1 11 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function timeLabel(ts: number): string {
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

/**
 * Botón de bote de basura por fila = DESASIGNAR (libera el jh y su grupo vuelve al pool).
 * Muestra un tooltip "desasignar" arriba al hover y pide confirmación inline antes de actuar.
 */
function RowDesasignarButton({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
    const [confirming, setConfirming] = useState(false);
    return (
        <span className={styles.rowActWrap} onClick={(e) => e.stopPropagation()}>
            <button
                className={styles.iconBtn}
                aria-label="desasignar"
                onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
                disabled={disabled}
            >
                <IconTrash size={14} />
                <span className={styles.rowActTip} aria-hidden="true">desasignar</span>
            </button>
            {confirming && (
                <span className={styles.rowConfirm} role="dialog" aria-label="Confirmar desasignar">
                    <span className={styles.rowConfirmText}>¿Desasignar? Vuelve al pool.</span>
                    <button
                        className={styles.rowConfirmCancel}
                        onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                    >
                        Cancelar
                    </button>
                    <button
                        className={styles.rowConfirmOk}
                        onClick={(e) => { e.stopPropagation(); setConfirming(false); onConfirm(); }}
                    >
                        Desasignar
                    </button>
                </span>
            )}
        </span>
    );
}

interface ProfesorEvaluado {
    profesor: ProfesorDTO;
    detalles: ZScoreDetails;
    fsm: ResultadoAsignacion;
    /** Viable, ya sea directo o vía excepciones manuales. */
    ok: boolean;
    /** La viabilidad requirió la excepción manual de REGLA_IGNORAR_GRUPOS (SAI/CPRO). */
    usaExcepcionGrupoIgnorado: boolean;
    /** La viabilidad requirió además mutuo acuerdo de REGLA_HORARIO_LABORAL. */
    usaMutuoAcuerdo: boolean;
    motivoGrupoIgnorado?: string;
    motivoMutuoAcuerdo?: string;
}

function AssignProfessorModal({
    grupo,
    ecoNombre,
    claveUea,
    gruposValidos,
    gruposCatalogo,
    profesores,
    evaluarGrupo,
    historial,
    pipeline,
    candidates,
    currentPass,
    onManualAssign,
    onClose,
}: {
    grupo: GrupoDTO;
    ecoNombre?: Record<string, string>;
    claveUea?: Record<string, string>;
    gruposValidos: GrupoDTO[];
    /** Catálogo crudo (con SAI/CPRO) para que la carga de filas fuera de catálogo sea visible. */
    gruposCatalogo?: GrupoDTO[];
    profesores: ProfesorDTO[];
    evaluarGrupo: (eco: number, grupo: GrupoDTO) => ZScoreDetails;
    historial: HistorialUea;
    pipeline: ReglaBase[];
    candidates: CandidateRow[];
    currentPass: number;
    onManualAssign: (rows: CandidateRow[]) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [selectedEco, setSelectedEco] = useState<number | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    const gruposParaGrafo = useMemo(() => {
        if (gruposValidos.some(g => g.idUeaGrupo === grupo.idUeaGrupo)) return gruposValidos;
        return [...gruposValidos, grupo];
    }, [grupo, gruposValidos]);

    const grafoBase = useMemo(
        () => construirGrafoActual(profesores, gruposParaGrafo, candidates, gruposCatalogo),
        [profesores, gruposParaGrafo, candidates, gruposCatalogo],
    );

    const evalCache = useMemo(() => new Map<number, ProfesorEvaluado>(), [grafoBase, pipeline, grupo]);
    // Evaluación encadenada: FSM directa → si falla REGLA_IGNORAR_GRUPOS, revalida con la
    // excepción manual SAI/CPRO → si entonces falla REGLA_HORARIO_LABORAL, revalida con ambos
    // flags (mutuo acuerdo + grupos ignorados). Registra qué excepciones se usaron.
    const evaluarProfesor = (profesor: ProfesorDTO): ProfesorEvaluado => {
        const cached = evalCache.get(profesor.numeroEconomico);
        if (cached) return cached;
        const detalles = evaluarGrupo(profesor.numeroEconomico, grupo);
        let fsm = validarAsignacion(grafoBase, profesor.numeroEconomico, grupo.idUeaGrupo, pipeline);
        let usaExcepcionGrupoIgnorado = false;
        let usaMutuoAcuerdo = false;
        let motivoGrupoIgnorado: string | undefined;
        let motivoMutuoAcuerdo: string | undefined;
        if (fsm.estado !== EstadoAsignacion.ASIGNACION_OK && fsm.error?.reglaFallo === 'REGLA_IGNORAR_GRUPOS') {
            motivoGrupoIgnorado = fsm.error?.motivo;
            const conExcepcion = validarAsignacion(
                grafoBase,
                profesor.numeroEconomico,
                grupo.idUeaGrupo,
                pipeline,
                crearContextoManualAsignacion(detalles, false, { asignarManualmenteGruposIgnorados: true }),
            );
            if (conExcepcion.estado === EstadoAsignacion.ASIGNACION_OK) {
                fsm = conExcepcion;
                usaExcepcionGrupoIgnorado = true;
            } else if (conExcepcion.error?.reglaFallo === 'REGLA_HORARIO_LABORAL') {
                motivoMutuoAcuerdo = conExcepcion.error?.motivo;
                const conAmbas = validarAsignacion(
                    grafoBase,
                    profesor.numeroEconomico,
                    grupo.idUeaGrupo,
                    pipeline,
                    crearContextoManualAsignacion(detalles, true, { asignarManualmenteGruposIgnorados: true }),
                );
                if (conAmbas.estado === EstadoAsignacion.ASIGNACION_OK) {
                    fsm = conAmbas;
                    usaExcepcionGrupoIgnorado = true;
                    usaMutuoAcuerdo = true;
                } else {
                    fsm = conAmbas; // muestra el fallo residual (más informativo que SAI/CPRO)
                }
            } else {
                fsm = conExcepcion; // falla por otra regla (traslape, horas, etc.)
            }
        }
        const value: ProfesorEvaluado = {
            profesor,
            detalles,
            fsm,
            ok: fsm.estado === EstadoAsignacion.ASIGNACION_OK,
            usaExcepcionGrupoIgnorado,
            usaMutuoAcuerdo,
            motivoGrupoIgnorado,
            motivoMutuoAcuerdo,
        };
        evalCache.set(profesor.numeroEconomico, value);
        return value;
    };

    const listaProfesores = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? profesores.filter(p =>
                `${p.numeroEconomico} ${ecoNombre?.[String(p.numeroEconomico)] ?? ''} ${p.idArea.join(' ')}`.toLowerCase().includes(q))
            : profesores;
        // Orden: viable directo > viable con excepción > no viable; luego KDE e historial.
        const grado = (e: ProfesorEvaluado) =>
            e.ok ? (e.usaExcepcionGrupoIgnorado || e.usaMutuoAcuerdo ? 1 : 2) : 0;
        const evaluados = base.map(evaluarProfesor).sort((a, b) => {
            const okA = grado(a);
            const okB = grado(b);
            if (okA !== okB) return okB - okA;
            const rankDiff = rankKde(b.detalles) - rankKde(a.detalles);
            if (rankDiff !== 0) return rankDiff;
            const histA = historial.contar(a.profesor.numeroEconomico, grupo.ueaClave).count;
            const histB = historial.contar(b.profesor.numeroEconomico, grupo.ueaClave).count;
            if (histA !== histB) return histB - histA;
            return a.profesor.numeroEconomico - b.profesor.numeroEconomico;
        });
        const filas = evaluados.slice(0, MAX_PROFESORES_ASIGNAR);
        return { filas, total: evaluados.length, truncado: evaluados.length > filas.length };
    }, [ecoNombre, grupo.ueaClave, historial, profesores, query, evaluarProfesor]);

    useEffect(() => {
        if (selectedEco != null && listaProfesores.filas.some(f => f.profesor.numeroEconomico === selectedEco)) return;
        const first = listaProfesores.filas.find(f => f.ok) ?? listaProfesores.filas[0];
        setSelectedEco(first?.profesor.numeroEconomico ?? null);
        setAviso(null);
    }, [listaProfesores.filas, selectedEco]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        dialogRef.current?.focus();
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const selectedProfesor = selectedEco == null
        ? null
        : profesores.find(p => p.numeroEconomico === selectedEco) ?? null;
    const selectedEval = selectedProfesor ? evaluarProfesor(selectedProfesor) : null;
    const selectedOk = selectedEval?.ok ?? false;
    const selectedConExcepcion = selectedOk
        && ((selectedEval?.usaExcepcionGrupoIgnorado ?? false) || (selectedEval?.usaMutuoAcuerdo ?? false));

    const asignar = () => {
        if (!selectedEval) return;
        if (!selectedEval.ok) {
            setAviso(`No se puede asignar a ECO ${selectedEval.profesor.numeroEconomico}: ${ruleLabel(selectedEval.fsm.error?.reglaFallo)} — ${selectedEval.fsm.error?.motivo ?? ''}`);
            return;
        }
        onManualAssign([
            grupoToCandidateRow(
                selectedEval.profesor.numeroEconomico,
                grupo,
                selectedEval.detalles,
                currentPass,
                metadataExcepcionesManual(selectedEval.detalles, {
                    grupoIgnorado: { aplicada: selectedEval.usaExcepcionGrupoIgnorado, motivo: selectedEval.motivoGrupoIgnorado },
                    mutuoAcuerdo: { aplicada: selectedEval.usaMutuoAcuerdo, motivo: selectedEval.motivoMutuoAcuerdo },
                }),
            ),
        ]);
        onClose();
    };

    return (
        <div
            role="presentation"
            style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 18,
            }}
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                style={{
                    width: '92%', maxWidth: 980, maxHeight: '92vh', overflowY: 'auto',
                    backgroundColor: 'var(--tt-panel2)', border: '3px solid var(--tt-ink)',
                    borderRadius: 'var(--tt-radius)', boxShadow: '8px 8px 0 rgba(34,29,22,0.28)',
                    padding: 18, outline: 'none', fontFamily: 'var(--tt-font)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--tt-ink)' }}>
                            Asignar a profesor — {grupo.ueaClave}/{grupo.claveGrupo}
                        </h3>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--tt-sub)' }}>
                            {claveUea?.[String(grupo.ueaClave)] ?? `UEA ${grupo.ueaClave}`} · {grupo.horarioStringRaw}
                        </div>
                    </div>
                    <button className={styles.detailBtn} onClick={onClose}>Cerrar</button>
                </div>

                <div className={styles.searchBar}>
                    <input
                        placeholder="Buscar por ECO, nombre o área..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        aria-label="Buscar profesor para asignar"
                    />
                </div>

                <div className={styles.tableWrap} style={{ maxHeight: 420 }}>
                    <table className={styles.lockTable}>
                        <thead>
                            <tr>
                                <th>Elegir</th>
                                <th>ECO</th>
                                <th>Nombre</th>
                                <th>Áreas</th>
                                <th>kde_ij</th>
                                <th>kde_ih</th>
                                <th title={`Veces impartida en los últimos ${historial.ventana} trimestres`}>Últimos {historial.ventana} tri.</th>
                                <th>FSM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listaProfesores.filas.map((evaluado) => {
                                const { profesor, detalles, fsm, ok, usaExcepcionGrupoIgnorado, usaMutuoAcuerdo } = evaluado;
                                const conExcepcion = ok && (usaExcepcionGrupoIgnorado || usaMutuoAcuerdo);
                                const selected = selectedEco === profesor.numeroEconomico;
                                const conteo = historial.contar(profesor.numeroEconomico, grupo.ueaClave);
                                const etiquetasExcepcion = [
                                    ...(usaExcepcionGrupoIgnorado ? [ruleLabel('REGLA_IGNORAR_GRUPOS')] : []),
                                    ...(usaMutuoAcuerdo ? [ruleLabel('REGLA_HORARIO_LABORAL')] : []),
                                ];
                                const motivosExcepcion = [
                                    ...(evaluado.motivoGrupoIgnorado ? [evaluado.motivoGrupoIgnorado] : []),
                                    ...(evaluado.motivoMutuoAcuerdo ? [evaluado.motivoMutuoAcuerdo] : []),
                                ].join(' · ');
                                return (
                                    <tr
                                        key={profesor.numeroEconomico}
                                        className={[
                                            selected ? styles.locked : '',
                                            !ok ? styles.contradiction : '',
                                            conExcepcion ? styles.warning : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => { setSelectedEco(profesor.numeroEconomico); setAviso(null); }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <input
                                                type="radio"
                                                checked={selected}
                                                onChange={() => { setSelectedEco(profesor.numeroEconomico); setAviso(null); }}
                                                aria-label={conExcepcion
                                                    ? `Elegir ECO ${profesor.numeroEconomico} (requiere excepción manual)`
                                                    : `Elegir ECO ${profesor.numeroEconomico}`}
                                            />
                                        </td>
                                        <td>{profesor.numeroEconomico}</td>
                                        <td>{ecoNombre?.[String(profesor.numeroEconomico)] ?? '—'}</td>
                                        <td>{profesor.idArea.join(', ')}</td>
                                        <td>{pct(detalles.kde_ij)}</td>
                                        <td>{pct(detalles.kde_ih)}</td>
                                        <td title={`Histórico total: ${conteo.total} · ponderado: ${conteo.weighted}`}>{conteo.count}</td>
                                        {conExcepcion ? (
                                            <td
                                                style={{ color: 'var(--tt-warn)', fontWeight: 800 }}
                                                title={motivosExcepcion || 'Viable solo con excepción manual'}
                                            >
                                                ⚠ {etiquetasExcepcion.join(' + ')}
                                            </td>
                                        ) : (
                                            <td style={{ color: ok ? 'var(--tt-accent)' : 'var(--tt-danger)', fontWeight: 800 }} title={fsm.error?.motivo ?? ''}>
                                                {ok ? '✓ viable' : `✗ ${ruleLabel(fsm.error?.reglaFallo)}`}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {listaProfesores.filas.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--tt-sub)', padding: 12 }}>
                                        Sin profesores que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {listaProfesores.truncado && (
                    <div style={{ fontSize: 11, color: 'var(--tt-sub)', marginTop: 4 }}>
                        Mostrando {MAX_PROFESORES_ASIGNAR} de {listaProfesores.total}. Afina la búsqueda para ver más.
                    </div>
                )}

                {aviso && (
                    <div role="alert" style={{ marginTop: 10, padding: '8px 10px', border: '2px solid var(--tt-danger)', borderRadius: 6, color: 'var(--tt-danger)', fontSize: 12, fontWeight: 700 }}>
                        {aviso}
                    </div>
                )}

                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 180, fontSize: 12, color: selectedOk ? 'var(--tt-accent)' : 'var(--tt-sub)', fontWeight: 800 }}>
                        {selectedEval
                            ? selectedOk
                                ? `Listo para asignar a ECO ${selectedEval.profesor.numeroEconomico}${selectedConExcepcion ? ' (con excepción manual)' : ''}`
                                : `ECO ${selectedEval.profesor.numeroEconomico} no pasa FSM`
                            : 'Elige un profesor'}
                    </span>
                    {selectedEval && selectedConExcepcion && (
                        <span
                            className={styles.mutuoAcuerdoBadge}
                            aria-label="La asignación usará una excepción manual"
                            title={[
                                selectedEval.usaExcepcionGrupoIgnorado ? 'Excepción SAI/CPRO: grupo excluido asignado con autorización explícita.' : '',
                                selectedEval.usaMutuoAcuerdo ? 'Mutuo acuerdo: horario fuera de contrato.' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            <IconAlert size={13} />
                            {selectedEval.usaExcepcionGrupoIgnorado ? 'Excepción SAI/CPRO' : ''}
                            {selectedEval.usaExcepcionGrupoIgnorado && selectedEval.usaMutuoAcuerdo ? ' + ' : ''}
                            {selectedEval.usaMutuoAcuerdo ? 'Mutuo acuerdo' : ''}
                        </span>
                    )}
                    <button className={styles.detailBtn} onClick={onClose}>Cancelar</button>
                    <button
                        className={styles.detailBtn}
                        onClick={asignar}
                        disabled={!selectedEval}
                        title={selectedConExcepcion
                            ? 'Asignar a profesor con excepción manual validada por FSM'
                            : 'Asignar a profesor validando FSM'}
                        style={{ background: 'var(--tt-accent)', color: 'var(--tt-on-ink)', borderColor: 'var(--tt-accent)' }}
                    >
                        {selectedConExcepcion && selectedEval?.usaExcepcionGrupoIgnorado
                            ? 'Asignar a profesor con excepción SAI/CPRO'
                            : 'Asignar a profesor'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SolutionLockTable({
    candidates,
    gruposCatalogo,
    contradictionGroupIds,
    onToggleLock,
    onBulkSet,
    completedEcos,
    onToggleEcoComplete,
    chartsVersion,
    ecoNombre,
    claveUea,
    onReassignUnlocked,
    onAutoConverge,
    onReset,
    busy,
    iterativePass,
    iterativeConverged,
    iterativeDelta,
    gruposValidos,
    profesores,
    evaluarGrupo,
    historial,
    pipeline,
    currentPass,
    baseUrl,
    onManualAssign,
    onRemoveAssignment,
    onReplaceAssignment,
    onReplaceOccupiedAssignment,
    onUndo,
    canUndo,
    onRestoreSnapshot,
    historyRefreshKey,
    onBackupBeforeReset,
}: SolutionLockTableProps) {
    const [query, setQuery] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [selectedEco, setSelectedEco] = useState<number | null>(null);
    // Objetivo del modal de edición: sólo `eco` = agregar; con `replace` = reemplazo (swap 1↔1).
    const [editTarget, setEditTarget] = useState<{ eco: number; replace?: CandidateRow } | null>(null);
    const [assignTarget, setAssignTarget] = useState<GrupoDTO | null>(null);
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const [toast, setToast] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [resetArmed, setResetArmed] = useState(false);
    const [resetText, setResetText] = useState('');
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { snapshots, refresh } = useSolutionHistory(50);

    const assignedGroupIds = useMemo(
        () => new Set(candidates.map(c => c.idUeaGrupo)),
        [candidates],
    );

    const poolGroups = useMemo(() => {
        const source = gruposCatalogo?.length ? gruposCatalogo : gruposValidos;
        const seen = new Set<number>();
        const available: GrupoDTO[] = [];
        for (const grupo of source) {
            if (assignedGroupIds.has(grupo.idUeaGrupo) || seen.has(grupo.idUeaGrupo)) continue;
            seen.add(grupo.idUeaGrupo);
            available.push(grupo);
        }
        return available.sort((a, b) =>
            a.ueaClave - b.ueaClave || a.claveGrupo.localeCompare(b.claveGrupo),
        );
    }, [assignedGroupIds, gruposCatalogo, gruposValidos]);

    const poolFiltered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return poolGroups;
        return poolGroups.filter(g => {
            const haystack = `${g.ueaClave} ${claveUea?.[String(g.ueaClave)] ?? ''} ${g.claveGrupo} ${g.idArea} ${g.horarioStringRaw}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [claveUea, poolGroups, query]);

    // Re-lista el historial tras cada auto-guardado (KdeMode bumpea historyRefreshKey).
    useEffect(() => { if (showHistory) void refresh(); }, [historyRefreshKey, showHistory, refresh]);

    // Selección por defecto: primer ECO disponible.
    useEffect(() => {
        if (selectedEco == null && candidates.length > 0) setSelectedEco(candidates[0].numeroEconomico);
    }, [candidates, selectedEco]);

    const showToast = (msg: string) => {
        setToast(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 5000);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return candidates.filter(c => {
            if (filterMode === 'locked' && !c.locked) return false;
            if (filterMode === 'unlocked' && c.locked) return false;
            if (filterMode === 'contradiction' && !contradictionGroupIds?.has(c.idUeaGrupo)) return false;
            if (!q) return true;
            const haystack = `${c.numeroEconomico} ${c.claveGrupo} ${c.uea} ${c.horarioStringRaw} ${ecoNombre?.[String(c.numeroEconomico)] ?? ''}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [candidates, contradictionGroupIds, ecoNombre, filterMode, query]);

    // Agrupado por ECO (Balanceado), preservando el orden de aparición.
    const groups = useMemo(() => {
        const m = new Map<number, CandidateRow[]>();
        for (const c of filtered) {
            const arr = m.get(c.numeroEconomico);
            if (arr) arr.push(c); else m.set(c.numeroEconomico, [c]);
        }
        return [...m.entries()].map(([eco, rows]) => ({ eco, rows }));
    }, [filtered]);

    const detailUeas = useMemo(
        () => candidates.filter(c => c.numeroEconomico === selectedEco),
        [candidates, selectedEco],
    );

    // Población del pase para colorear el % por una campana centrada en la mediana (no por
    // umbrales fijos: con los scores observados en 0.20–0.35 casi todo quedaba amarillo).
    const scoreStats = useMemo(() => {
        const values: number[] = [];
        for (const c of candidates) {
            if (typeof c.score === 'number' && Number.isFinite(c.score)) values.push(c.score);
        }
        return computeScoreStats(values);
    }, [candidates]);

    // Campana por TIPO de score (kde_ih/ij/plan) sobre toda la población del pase: la ficha de
    // detalle la usa para colorear y normalizar (min–max) cada barra con el mismo criterio que la
    // columna % de la lista. Cada tipo tiene su propia escala, por eso se calcula por separado.
    const detailScoreStats = useMemo<ScoreStatsByKind>(() => {
        const collect = (pick: (c: CandidateRow) => number | undefined): ScoreStats | null => {
            const values: number[] = [];
            for (const c of candidates) {
                const v = pick(c);
                if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
            }
            return computeScoreStats(values);
        };
        return {
            ih: collect(c => c.kde_ih),
            ij: collect(c => c.kde_ij),
            plan: collect(c => c.kde_plan),
        };
    }, [candidates]);

    const lockedCount = candidates.filter(c => c.locked).length;
    const unlockedCount = candidates.length - lockedCount;
    const poolIgnoredCount = poolGroups.filter(isIgnoredSaiCproGroup).length;

    const toggleCollapse = (eco: number) => setCollapsed(prev => {
        const cp = new Set(prev);
        if (cp.has(eco)) cp.delete(eco); else cp.add(eco);
        return cp;
    });

    const handleToggleLock = (row: CandidateRow) => {
        onToggleLock(candidateKey(row), !row.locked);
        showToast(row.locked ? 'Desasignaste una fila' : 'Asignaste una fila');
    };
    const handleLockGroup = (rows: CandidateRow[], lock: boolean) => {
        onBulkSet(rows, lock);
        showToast(lock ? `Asignaste ${rows.length} filas` : `Desasignaste ${rows.length} filas`);
    };

    const confirmReset = () => {
        if (resetText.trim().toLowerCase() !== 'pase 0') return;
        onBackupBeforeReset?.();
        onReset?.();
        setResetArmed(false);
        setResetText('');
    };

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
                Candidatos de la solución
                {typeof iterativePass === 'number' && (
                    <span className={iterativeConverged ? styles.passConverged : styles.passDelta}>
                        Pase {iterativePass}{iterativeConverged ? ' · convergido' : ''}
                    </span>
                )}
                {iterativeDelta && (
                    <span className={styles.passDelta}>
                        Δ +{iterativeDelta.added} -{iterativeDelta.removed} re-{iterativeDelta.reassigned}
                    </span>
                )}
            </h2>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><strong>{candidates.length}</strong><span>Total filas</span></div>
                <div className={styles.summaryItem}><strong>{lockedCount}</strong><span>Asignadas</span></div>
                <div className={styles.summaryItem}><strong>{unlockedCount}</strong><span>Por asignar</span></div>
                <div className={styles.summaryItem}><strong>{poolGroups.length}</strong><span>Sin emparejar</span></div>
                {contradictionGroupIds && (
                    <div className={styles.summaryItem}>
                        <strong>{Array.from(contradictionGroupIds).length}</strong>
                        <span>Contradicción</span>
                    </div>
                )}
            </div>

            <div className={styles.searchBar}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 1, border: 'var(--tt-border-line)', borderRadius: 'var(--tt-radius-sm)', background: 'var(--tt-panel)', padding: '0 8px' }}>
                    <IconSearch size={14} color="var(--tt-sub)" />
                    <input
                        placeholder={filterMode === 'pool'
                            ? 'Buscar por uea, grupo, nombre, área, horario...'
                            : 'Buscar por eco, uea, grupo, nombre, horario...'}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ flex: 1, border: 'none', background: 'transparent', padding: '6px 2px' }}
                    />
                </span>
                <div className={styles.filterTabs}>
                    {(['pool', 'all', 'locked', 'unlocked', 'contradiction'] as const).map(f => (
                        <button
                            key={f}
                            className={`${styles.filterTab} ${filterMode === f ? styles.filterTabActive : ''}`}
                            onClick={() => setFilterMode(f)}
                            title={f === 'pool'
                                ? `Sin emparejar: horarios a programar no usados por GRASP ni asignados/tentativos (${poolGroups.length}; ${poolIgnoredCount} SAI/CPRO)`
                                : undefined}
                        >
                            {FILTER_LABEL[f]}
                        </button>
                    ))}
                </div>
                <button className={styles.detailBtn} onClick={onUndo} disabled={!canUndo} title="Deshacer la última acción">
                    <IconUndo size={13} /> Deshacer
                </button>
                <button className={styles.detailBtn} onClick={() => setShowHistory(s => !s)} title="Historial de auto-guardados">
                    <IconReset size={13} /> Historial
                </button>
            </div>

            {filterMode !== 'pool' && (
                <div className={styles.bulkRow}>
                    <button onClick={() => handleLockGroup(candidates, true)} disabled={busy}>Asignar todo</button>
                    <button onClick={() => handleLockGroup(candidates, false)} disabled={busy}>Desasignar todo</button>
                    <button onClick={onReassignUnlocked} disabled={busy || unlockedCount === 0} style={{ background: 'var(--tt-accent)', color: 'var(--tt-on-ink)', borderColor: 'var(--tt-accent)' }}>
                        Reasignar no deseados ({unlockedCount})
                    </button>
                    <button onClick={onAutoConverge} disabled={busy || unlockedCount === 0}>Auto-convergencia</button>
                    {onReset && (
                        <button onClick={() => setResetArmed(true)} disabled={busy} style={{ background: 'var(--tt-danger)', color: '#fff7ed', borderColor: 'var(--tt-danger)' }}>
                            Reiniciar a pase 0
                        </button>
                    )}
                </div>
            )}

            {resetArmed && (
                <div className={styles.dangerCard}>
                    <div className={styles.dangerHead}><IconAlert size={18} /> Reiniciar a pase 0</div>
                    <div className={styles.dangerBody}>
                        <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                            Esto es <strong>irreversible</strong>. Se perderá el snapshot actual
                            ({candidates.length} filas, {lockedCount} asignadas) y los ECOs completados.
                            Se <strong>descargará la solución actual</strong> como respaldo antes de borrar.
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--tt-sub)', marginBottom: 8 }}>
                            Escribe <strong style={{ fontFamily: 'var(--tt-mono)', color: 'var(--tt-ink)' }}>pase 0</strong> para confirmar:
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <input
                                className={styles.dangerInput}
                                value={resetText}
                                onChange={e => setResetText(e.target.value)}
                                placeholder="pase 0"
                                autoFocus
                            />
                            <button
                                className={styles.detailBtn}
                                style={{ background: 'var(--tt-danger)', color: '#fff7ed', borderColor: 'var(--tt-danger)' }}
                                disabled={resetText.trim().toLowerCase() !== 'pase 0'}
                                onClick={confirmReset}
                            >
                                Reiniciar
                            </button>
                            <button className={styles.detailBtn} onClick={() => { setResetArmed(false); setResetText(''); }}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className={styles.historyPanel}>
                    <div className={styles.historyHead}>
                        <IconReset size={12} /> Historial de auto-guardados ({snapshots.length})
                    </div>
                    {snapshots.length === 0 && (
                        <div style={{ padding: '12px 13px', fontSize: 12, color: 'var(--tt-sub)' }}>
                            Aún no hay auto-guardados. Corre un pase o manipula la solución.
                        </div>
                    )}
                    {snapshots.map(s => (
                        <div key={s.id} className={styles.historyRow}>
                            <Dot color={s.convergio ? 'var(--tt-good)' : 'var(--tt-accent)'} size={8} />
                            <div className={styles.historyRowMeta}>
                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                                    Pase {s.pase} · {s.lockedCount} asig · {s.finishesCount} compl.
                                </div>
                                <div style={{ fontFamily: 'var(--tt-mono)', fontSize: 10.5, color: 'var(--tt-sub)' }}>
                                    {timeLabel(s.timestamp)}
                                </div>
                            </div>
                            <button className={styles.historyBack} onClick={() => onRestoreSnapshot?.(s.id)} disabled={busy}>
                                Volver aquí
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {filterMode === 'pool' ? (
                <div className={styles.tableWrap}>
                    <table className={styles.lockTable}>
                        <thead>
                            <tr>
                                <th rowSpan={2}>UEA</th>
                                <th rowSpan={2}>Nombre</th>
                                <th rowSpan={2}>Grupo</th>
                                <th rowSpan={2}>Área</th>
                                <th colSpan={5} style={{ textAlign: 'center' }}>Horario</th>
                                <th rowSpan={2}>Estado</th>
                                <th rowSpan={2} style={{ textAlign: 'center' }}>Asignar</th>
                            </tr>
                            <tr>
                                {DAY_KEYS.map(d => <th key={d} style={{ textAlign: 'center' }}>{DAY_LABEL[d]}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {poolFiltered.map(grupo => {
                                const hd = rangeByDay(grupo.horarioStringRaw);
                                const ignored = isIgnoredSaiCproGroup(grupo);
                                return (
                                    <tr key={grupo.idUeaGrupo} className={ignored ? styles.warning : ''}>
                                        <td>{grupo.ueaClave}</td>
                                        <td title={claveUea?.[String(grupo.ueaClave)] ?? `UEA ${grupo.ueaClave}`}>
                                            {claveUea?.[String(grupo.ueaClave)] ?? '—'}
                                        </td>
                                        <td>{grupo.claveGrupo}</td>
                                        <td>{grupo.idArea}</td>
                                        {DAY_KEYS.map(d => {
                                            const r = hd[d];
                                            return (
                                                <td key={d} style={{ padding: 2 }}>
                                                    <span
                                                        className={`${styles.dayCell} ${r ? styles.dayCellOn : ''}`}
                                                        title={r ? `${DAY_LABEL[d]} · ${r.start} - ${r.end}` : `${DAY_LABEL[d]} · sin clase`}
                                                    >
                                                        {r ? (
                                                            <>
                                                                <span className={styles.dayCellTime}>{r.start}</span>
                                                                <span className={styles.dayCellEnd}>{r.end}</span>
                                                            </>
                                                        ) : (
                                                            <span className={styles.dayCellTime}>·</span>
                                                        )}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td title={ignored ? 'Excluido por REGLA_IGNORAR_GRUPOS (SAI/CPRO)' : 'No usado por GRASP ni asignado manualmente'}>
                                            {ignored ? 'Filtrado SAI/CPRO' : 'Sin emparejar'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                className={styles.iconBtn}
                                                title="Asignar a profesor"
                                                aria-label={`Asignar UEA ${grupo.ueaClave} grupo ${grupo.claveGrupo} a profesor`}
                                                onClick={() => setAssignTarget(grupo)}
                                            >
                                                <IconAssignProfessor size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {poolFiltered.length === 0 && (
                                <tr>
                                    <td colSpan={11} style={{ textAlign: 'center', color: 'var(--tt-sub)', padding: 12 }}>
                                        No hay jh disponibles que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--tt-sub)' }}>
                        Mostrando {poolFiltered.length} de {poolGroups.length} jh sin emparejar; {poolIgnoredCount} fueron filtrados por SAI/CPRO.
                    </div>
                </div>
            ) : (
                /* Master-detail: lista Balanceada (izq) + ficha persistente Radical (der). */
                <div className={styles.masterDetail}>
                <div className={styles.masterCol}>
                    {groups.map(({ eco, rows }) => {
                        const isCollapsed = collapsed.has(eco);
                        const lockedInGroup = rows.filter(r => r.locked).length;
                        const allLocked = lockedInGroup === rows.length;
                        // El penalty model cuenta carga por asignaciones/grupos, no por UEAs distintas.
                        const assignmentCount = rows.filter(r => r.uea !== -1 && r.horarioStringRaw.trim() !== '').length;
                        const nombre = ecoNombre?.[String(eco)] ?? `ECO ${eco}`;
                        return (
                            <div key={eco} className={styles.ecoGroup}>
                                <div
                                    className={styles.ecoGroupHead}
                                    onClick={() => { setSelectedEco(eco); }}
                                >
                                    <span onClick={(e) => { e.stopPropagation(); toggleCollapse(eco); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>
                                        {isCollapsed ? <IconChevronR size={14} color="var(--tt-on-ink)" /> : <IconChevronD size={14} color="var(--tt-on-ink)" />}
                                    </span>
                                    <span className={styles.ecoGroupName}>{nombre}</span>
                                    <span className={styles.ecoGroupEco}>ECO {eco}</span>
                                    <EcoPenaltyBadge
                                        label={`${assignmentCount} grupos · ${lockedInGroup}/${rows.length} asig`}
                                        baseUrl={baseUrl}
                                        eco={eco}
                                        lockedUeas={rows.filter(r => r.locked).map(r => ({ uea: r.uea, horario: r.horarioStringRaw }))}
                                        allUeas={rows.map(r => ({ uea: r.uea, horario: r.horarioStringRaw }))}
                                    />
                                    {completedEcos?.has(eco) && (
                                        <span className={styles.ecoBadgeDone}><IconCheck size={10} /> completado</span>
                                    )}
                                    <button
                                        className={styles.groupLockAll}
                                        onClick={(e) => { e.stopPropagation(); handleLockGroup(rows, !allLocked); }}
                                        disabled={busy}
                                    >
                                        {allLocked ? 'Desasignar todo' : 'Asignar todo'}
                                    </button>
                                </div>
                                {!isCollapsed && (
                                    <div className={styles.dayHeaderRow} aria-hidden="true">
                                        {/* Espaciadores sobre lock + nombre, etiquetas de día sobre las
                                            celdas de horario, espaciadores sobre score + historial + desasignar + swap. */}
                                        <span />
                                        <span />
                                        {DAY_KEYS.map(d => (
                                            <span key={d} className={styles.dayHead}>{DAY_LABEL[d]}</span>
                                        ))}
                                        <span />
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                )}
                                {!isCollapsed && rows.map(row => {
                                    const key = candidateKey(row);
                                    const hd = rangeByDay(row.horarioStringRaw);
                                    const isSel = row.numeroEconomico === selectedEco;
                                    const isCon = contradictionGroupIds?.has(row.idUeaGrupo) ?? false;
                                    return (
                                        <div
                                            key={key}
                                            className={[
                                                styles.ueaRow,
                                                isSel ? styles.ueaRowSelected : '',
                                                row.locked && !isSel ? styles.ueaRowLocked : '',
                                            ].filter(Boolean).join(' ')}
                                            onClick={() => setSelectedEco(eco)}
                                            title={isCon ? 'Contradicción: assert de prueba heredado del script' : undefined}
                                        >
                                            <button
                                                className={`${styles.lockBtn} ${row.locked ? styles.lockBtnOn : ''}`}
                                                onClick={(e) => { e.stopPropagation(); handleToggleLock(row); }}
                                                disabled={busy}
                                            >
                                                <IconLock size={11} />{row.locked ? 'Asignada' : 'Asignar'}
                                            </button>
                                            {(() => {
                                                const ueaNombre = claveUea?.[String(row.uea)];
                                                return (
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className={styles.ueaName} title={ueaNombre ?? `UEA ${row.uea}`}>
                                                            {ueaNombre ?? `UEA ${row.uea}`}{isCon ? ' ⚠' : ''}
                                                        </div>
                                                        <div className={styles.ueaMeta}>
                                                            {ueaNombre && <span>{row.uea} · </span>}
                                                            <span style={{ color: '#777777' }}>{row.claveGrupo}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            {DAY_KEYS.map(d => {
                                                const r = hd[d];
                                                return (
                                                    <span
                                                        key={d}
                                                        className={`${styles.dayCell} ${r ? styles.dayCellOn : ''}`}
                                                        title={r ? `${DAY_LABEL[d]} · ${r.start} - ${r.end}` : `${DAY_LABEL[d]} · sin clase`}
                                                    >
                                                        {r ? (
                                                            <>
                                                                <span className={styles.dayCellTime}>{r.start}</span>
                                                                <span className={styles.dayCellEnd}>{r.end}</span>
                                                            </>
                                                        ) : (
                                                            <span className={styles.dayCellTime}>·</span>
                                                        )}
                                                    </span>
                                                );
                                            })}
                                            <span
                                                className={styles.scoreCell}
                                                style={{ color: scoreColor(row.score, scoreStats) }}
                                                title={scoreStats
                                                    ? `Score ${pct(row.score)} · campana del pase: mediana ${pct(scoreStats.median)}, σ ${pct(scoreStats.sigma)} (n=${scoreStats.n}). Verde si score ≥ mediana − σ/2 (incluye toda la cola alta); amarillo hasta mediana − σ; rojo más abajo.`
                                                    : `Score ${pct(row.score)}`}
                                            >
                                                <Dot color={scoreColor(row.score, scoreStats)} size={6} />
                                                {pct(row.score)}
                                            </span>
                                            {(() => {
                                                const conteo = row.uea === -1 ? null : historial.contar(row.numeroEconomico, row.uea);
                                                return (
                                                    <span
                                                        className={styles.impartidasCell}
                                                        title={conteo
                                                            ? `Veces impartida en los últimos ${historial.ventana} trimestres KDE IJ: ${conteo.count} (total histórico: ${conteo.total})`
                                                            : `Sin UEA para consultar historial KDE IJ`}
                                                    >
                                                        {conteo ? conteo.count : '–'}
                                                    </span>
                                                );
                                            })()}
                                            <RowDesasignarButton
                                                onConfirm={() => onRemoveAssignment(row)}
                                                disabled={busy}
                                            />
                                            <button
                                                className={styles.iconBtn}
                                                title="Reemplazar UEA (intercambiar por otra del pool)"
                                                onClick={(e) => { e.stopPropagation(); setEditTarget({ eco, replace: row }); }}
                                                disabled={busy}
                                            >
                                                <IconSwap size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                                {!isCollapsed && (
                                    <div className={styles.ecoAssignRow}>
                                        <button
                                            className={styles.ecoAssignBtn}
                                            onClick={(e) => { e.stopPropagation(); setEditTarget({ eco }); }}
                                            disabled={busy}
                                        >
                                            + Asignar UEA manualmente
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {groups.length === 0 && (
                        <div style={{ padding: 16, fontSize: 13, color: 'var(--tt-sub)' }}>
                            No hay filas que coincidan con el filtro.
                        </div>
                    )}
                </div>

                <EcoDetailPanel
                    eco={selectedEco}
                    ecoNombre={ecoNombre}
                    claveUea={claveUea}
                    ueas={detailUeas}
                    scoreStats={detailScoreStats}
                    baseUrl={baseUrl}
                    chartsVersion={chartsVersion}
                    completed={selectedEco != null && (completedEcos?.has(selectedEco) ?? false)}
                    busy={busy}
                    onLockAll={() => handleLockGroup(detailUeas, true)}
                    onEdit={() => selectedEco != null && setEditTarget({ eco: selectedEco })}
                    onToggleComplete={() => selectedEco != null && onToggleEcoComplete?.(selectedEco)}
                />
            </div>
            )}

            {toast && (
                <div className={styles.undoToast}>
                    <IconCheck size={16} color="var(--tt-good)" />
                    <span style={{ flex: 1 }}>{toast}</span>
                    <button className={styles.undoToastBtn} onClick={() => { onUndo?.(); setToast(null); }} disabled={!canUndo}>
                        <IconUndo size={13} /> Deshacer
                    </button>
                </div>
            )}

            {editTarget !== null && (
                <EditarAsignacionEcoModal
                    eco={editTarget.eco}
                    ecoNombre={ecoNombre}
                    claveUea={claveUea}
                    gruposValidos={gruposValidos}
                    gruposCatalogo={gruposCatalogo}
                    profesores={profesores}
                    evaluarGrupo={evaluarGrupo}
                    historial={historial}
                    pipeline={pipeline}
                    candidates={candidates}
                    currentPass={currentPass}
                    baseUrl={baseUrl}
                    chartsVersion={chartsVersion}
                    scoreStats={detailScoreStats}
                    onManualAssign={onManualAssign}
                    replaceRow={editTarget.replace}
                    onReplaceAssign={onReplaceAssignment}
                    onReplaceOccupiedAssign={onReplaceOccupiedAssignment}
                    onClose={() => setEditTarget(null)}
                />
            )}

            {assignTarget !== null && (
                <AssignProfessorModal
                    grupo={assignTarget}
                    ecoNombre={ecoNombre}
                    claveUea={claveUea}
                    gruposValidos={gruposValidos}
                    gruposCatalogo={gruposCatalogo}
                    profesores={profesores}
                    evaluarGrupo={evaluarGrupo}
                    historial={historial}
                    pipeline={pipeline}
                    candidates={candidates}
                    currentPass={currentPass}
                    onManualAssign={onManualAssign}
                    onClose={() => setAssignTarget(null)}
                />
            )}
        </section>
    );
}
