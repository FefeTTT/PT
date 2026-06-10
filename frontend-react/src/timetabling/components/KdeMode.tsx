import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    KdeRawInputs,
    KdeWorkerConfig,
    KdeWorkerProgress,
    KdeWorkerSurfaceData,
} from '../engine/kde/graspKdeTypes';
import { runKdeGraspIterative, type IterativeRunState } from '../engine/kde/runKdeGraspIterative';
import { candidateKey, type CandidateRow } from '../engine/kde/candidateRow';
import { applyManualAssign, applyRemoveAssignment, applyReplaceAssignment, applyReplaceOccupiedAssignment } from '../utils/solutionMutations';
import { SolutionGraphDAO } from '../dao/SolutionGraphDAO';
import { KdeConfigDAO } from '../dao/KdeConfigDAO';
import { CompletedEcosDAO } from '../dao/CompletedEcosDAO';
import { KdeModelsConfigDAO } from '../dao/KdeModelsConfigDAO';
import { KDE_MODELS_DEFAULTS, type KdeModelsConfig } from '../dtos/kdeModelsConfig';
import {
    candidateRowToDTO,
    estadoSolucionToIterativeState,
    iterativeStateToEstadoSolucion,
} from '../dtos/solutionGraph';
import { useBackendConfig } from '../hooks/useBackendConfig';
import { useCreateXLSXFromCurrent } from '../hooks/useCreateXLSXFromCurrent';
import { useSaveAssignationSolution } from '../hooks/useSaveAssignationSolution';
import { useSetAssignation } from '../hooks/useSetAssignation';
import type { WorkspaceDTO } from '../dtos';
import { KdeConfigModal } from './KdeConfigModal';
import { CompletedEcosPanel } from './CompletedEcosPanel';
import { SolutionLockTable } from './SolutionLockTable';
import { type KdeBarPoint } from './KdeBarChart';
import { crearZScoreKDE } from '@solution/ml/ZScoreKDE';
import { JSONAssignmentAdapter } from '@solution/data/JSONAssignmentAdapter';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import { seedReglasJson, crearPipelineManual } from '../engine/kde/manualAssignmentFsm';
import { crearHistorialUea } from '../engine/kde/manualCandidates';
import { SnapshotDAO } from '../dao/SnapshotDAO';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { IconPlay, IconCheck } from './atoms';
import styles from './KdeMode.module.css';

/** Entrada de la pila de deshacer en memoria (estado previo a una mutación). */
interface UndoEntry {
    state: IterativeRunState;
    locks: Set<string>;
    completed: Set<number>;
    label: string;
}

export interface KdeModeProps {
    rawInputs: KdeRawInputs;
    ecoNombre: Record<string, string>;
    /** Workspace del modo Legacy. Si está disponible, alimenta el panel "Penalty (batch)" del modal. */
    workspace?: WorkspaceDTO;
    /** Abierto/cerrado del modal unificado de Configuración (controlado desde el header). */
    configModalOpen?: boolean;
    onCloseConfigModal?: () => void;
}

const DEFAULT_HORAS = Array.from({ length: 29 }, (_, i) => 7 + i * 0.5);
const DEFAULT_TARGET_ECOS = [19834, 28650, 14416];
const LOG_TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

const STAGE_LABELS: Record<string, string> = {
    'pipeline:pase': 'Preparando pase',
    'pipeline:filtrar': 'Filtrando catálogo del pase',
    'pipeline:diff': 'Comparando resultado contra pase previo',
    'pipeline:convergencia': 'Convergencia detectada',
    rng: 'Semilla aleatoria lista',
    'seed:helper_files': 'Cargando catálogos del GRASP',
    'parse:profesores': 'Parseando profesores',
    'parse:grupos': 'Parseando grupos',
    'kde:factory': 'Construyendo KDE',
    'kde:surface': 'Calculando superficies KDE',
    'grasp:run': 'Ejecutando GRASP',
    'grasp:seed': 'Sembrando asignaciones ya asignadas',
    'grasp:done': 'GRASP terminó el pase',
    'penalty:init': 'Inicializando penalty ML',
    'penalty:ready': 'Penalty ML listo',
    'done:render-only': 'Render-only terminado',
    cancel: 'Cancelación solicitada',
};

function formatProgressEvent(p: KdeWorkerProgress): string | null {
    if (p.kind === 'stage') {
        const label = STAGE_LABELS[p.stage] ?? p.stage;
        return p.detail ? `${label} · ${p.detail}` : label;
    }
    if (p.kind === 'metric') {
        return `${p.key}: ${p.value}`;
    }
    return null;
}

function stampProgressMessage(message: string): string {
    return `${LOG_TIME_FORMATTER.format(new Date())} · ${message}`;
}

function makeDefaultConfig(): KdeWorkerConfig {
    return {
        mode: 'kde_ij',
        seed: 20260526,
        k: 48,
        alpha: 0.25,
        renderOnly: false,
        // Penalty ON por defecto para igualar testAsinacionKDE (paridad del pase 0).
        // Requiere Python(:8000)+Redis(:6379). Desmarca "--no-penalty" en la UI para KDE-only.
        noPenalty: false,
        withRhat: false,
        targetEcos: DEFAULT_TARGET_ECOS,
        horasSuperficie: DEFAULT_HORAS,
        options: {
            steepPower: 2,
            halfLife: 8,
            bandwidthUea: 8,
            bandwidthHour: 1.25,
            minKdeIj: 0.02,
            minKdeIh: 0.05,
            minKdePlan: 0.05,
        },
    };
}

/**
 * Fuente unica de verdad de los params de KDE: el scoring TS deriva bandwidth/steep/halfLife
 * desde el panel "Modelos KDE" (kdeModelsConfig); minKde* (umbrales de dominio) y Seed/K/Alpha/
 * flags siguen viniendo de `config`. Se reusa en el pase (worker) y en el scoring del modal de
 * asignacion manual para garantizar que kde_ij/kde_ih coincidan con la tabla.
 */
function buildConfigForRun(config: KdeWorkerConfig, kdeModelsConfig: KdeModelsConfig): KdeWorkerConfig {
    return {
        ...config,
        options: {
            ...config.options,
            steepPower: kdeModelsConfig.kde_ij.steep_power,
            halfLife: kdeModelsConfig.kde_ij.half_life,
            bandwidthUea: kdeModelsConfig.kde_ij.bandwidth_uea,
            bandwidthHour: kdeModelsConfig.kde_unificado.kde_bandwidth_horas,
        },
    };
}

export function flattenSamples(
    surfaceData: KdeWorkerSurfaceData[] | undefined,
    field: 'kde_ij' | 'kde_ih' | 'kde_plan' | 'score',
    axis: 'hora' | 'uea',
    ecoFilter?: number,
): KdeBarPoint[] {
    if (!surfaceData) return [];
    const out: KdeBarPoint[] = [];
    for (const eco of surfaceData) {
        if (ecoFilter !== undefined && eco.eco !== ecoFilter) continue;
        for (const arr of [eco.l_mi_v, eco.m_j, eco.l_m_mi_v]) {
            for (const pt of arr) {
                const y = (pt as any)[field];
                if (typeof y === 'number' && Number.isFinite(y)) {
                    out.push({ x: axis === 'hora' ? pt.hora : pt.uea, y });
                }
            }
        }
    }
    return out;
}

function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

interface GraspProgressModalProps {
    runLabel: string;
    currentProgress: string;
    progressLog: string[];
    onCancel: () => void;
}

function GraspProgressModal({ runLabel, currentProgress, progressLog, onCancel }: GraspProgressModalProps) {
    const visibleLog = progressLog.length > 0 ? progressLog.slice(-12) : ['Preparando pipeline GRASP...'];

    return (
        <div className={styles.progressModalOverlay} role="presentation">
            <div
                className={styles.progressModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="grasp-progress-title"
            >
                <div className={styles.progressModalHeader}>
                    <div>
                        <p className={styles.progressModalEyebrow}>Pipeline GRASP</p>
                        <h3 id="grasp-progress-title">{runLabel}</h3>
                    </div>
                    <span className={styles.progressLiveBadge}>En vivo</span>
                </div>

                <div className={styles.progressModalBody}>
                    <div className={styles.progressCurrent} aria-live="polite">
                        <span className={styles.progressSpinner} aria-hidden="true" />
                        <div>
                            <strong>Etapa actual</strong>
                            <span>{currentProgress}</span>
                        </div>
                    </div>

                    <div
                        className={styles.progressIndeterminate}
                        role="progressbar"
                        aria-label="Progreso del pipeline GRASP"
                        aria-valuetext={currentProgress}
                    />

                    <p className={styles.progressHint}>Este modal se cerrará automáticamente cuando termine el pase.</p>

                    <div className={styles.progressLogList} aria-live="polite">
                        {visibleLog.map((entry, index) => (
                            <div className={styles.progressLogItem} key={`${entry}-${index}`}>
                                {entry}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.progressModalFooter}>
                    <button className={`${styles.runBtn} ${styles.runBtnCancel}`} type="button" onClick={onCancel}>
                        Cancelar ejecución
                    </button>
                </div>
            </div>
        </div>
    );
}

export function KdeMode({ rawInputs, ecoNombre, workspace, configModalOpen = false, onCloseConfigModal }: KdeModeProps) {
    const [config, setConfig] = useState<KdeWorkerConfig>(() => makeDefaultConfig());
    const [iterativeState, setIterativeState] = useState<IterativeRunState | null>(null);
    const [locks, setLocks] = useState<Set<string>>(new Set());
    // ConjuntoCompletado: ECOs marcados como "carga terminada" (excluidos de reasignaciones).
    const [completedEcos, setCompletedEcos] = useState<Set<number>>(new Set());
    // Params de entrenamiento de los joblibs KDE de Python (graficas).
    const [kdeModelsConfig, setKdeModelsConfig] = useState<KdeModelsConfig>(KDE_MODELS_DEFAULTS);
    // Sube tras un reentrenamiento exitoso para cache-bust de las graficas (<img>).
    const [chartsVersion, setChartsVersion] = useState(0);
    const [progressLog, setProgressLog] = useState<string[]>([]);
    const [currentProgress, setCurrentProgress] = useState('Esperando inicio del pipeline GRASP');
    const [activeRunLabel, setActiveRunLabel] = useState('GRASP');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Sube tras cada auto-guardado de snapshot: el panel de historial (tabla) re-lista.
    const [historyVersion, setHistoryVersion] = useState(0);
    // Profundidad de la pila de deshacer en memoria (para habilitar el botón "Deshacer").
    const [undoCount, setUndoCount] = useState(0);
    const cancelRef = useRef<AbortController | null>(null);
    const hydratedRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const configSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const modelsConfigSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const undoRef = useRef<UndoEntry[]>([]);
    const { baseUrl, config: backendConfig, setConfig: setBackendConfig } = useBackendConfig();
    const { track } = useSaveStatus();
    const gruposCatalogo = useMemo(
        () => JSONAssignmentAdapter.parsearGruposDesdeObjeto(rawInputs.programacionVacia),
        [rawInputs.programacionVacia],
    );

    // Refs sincronizados al último render: permiten capturar el estado "actual" para la pila
    // de deshacer y leer completedEcos al disparar un snapshot debounced sin closures viejos.
    const iterativeStateRef = useRef(iterativeState);
    iterativeStateRef.current = iterativeState;
    const locksRef = useRef(locks);
    locksRef.current = locks;
    const completedRef = useRef(completedEcos);
    completedRef.current = completedEcos;
    const configRef = useRef(config);
    configRef.current = config;

    // Persiste el snapshot 'current' (grafo bipartito + candidatos) en SQLite, mostrando el
    // estado de guardado en el topbar (pieza Eje 3). `track` traga el error y lo reporta.
    const persistSolution = useCallback(async (state: IterativeRunState, cfg: KdeWorkerConfig) => {
        await track(() => SolutionGraphDAO.saveCurrent(iterativeStateToEstadoSolucion(state, cfg)));
    }, [track]);

    // Auto-guardado: escribe un snapshot COMPLETO navegable y refresca el historial.
    const saveSnapshot = useCallback(async (state: IterativeRunState, cfg: KdeWorkerConfig, completed: Set<number>) => {
        try {
            await SnapshotDAO.save(iterativeStateToEstadoSolucion(state, cfg), [...completed]);
            setHistoryVersion(v => v + 1);
        } catch (e) {
            console.warn('No se pudo auto-guardar el snapshot en SQLite:', e);
        }
    }, []);

    // Snapshot debounced (colapsa ráfagas de toggles en un solo checkpoint).
    const scheduleSnapshot = useCallback((state: IterativeRunState, cfg: KdeWorkerConfig) => {
        if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = setTimeout(() => {
            void saveSnapshot(state, cfg, completedRef.current);
        }, 1500);
    }, [saveSnapshot]);

    // Captura el estado ACTUAL (pre-mutación) en la pila de deshacer en memoria.
    const pushUndo = useCallback((label: string) => {
        if (!iterativeStateRef.current) return;
        undoRef.current.push({
            state: iterativeStateRef.current,
            locks: locksRef.current,
            completed: completedRef.current,
            label,
        });
        if (undoRef.current.length > 25) undoRef.current.shift();
        setUndoCount(undoRef.current.length);
    }, []);

    // Deshacer: restaura el último estado capturado (toast "Deshacer").
    const onUndo = useCallback(() => {
        const entry = undoRef.current.pop();
        setUndoCount(undoRef.current.length);
        if (!entry) return;
        setIterativeState(entry.state);
        setLocks(new Set(entry.locks));
        setCompletedEcos(new Set(entry.completed));
        void persistSolution(entry.state, configRef.current);
        void CompletedEcosDAO.save([...entry.completed]).catch(() => {});
    }, [persistSolution]);

    // "Volver aquí": restaura un snapshot COMPLETO del historial (cruza límites de pase).
    const restoreSnapshot = useCallback(async (id: number) => {
        const snap = await SnapshotDAO.load(id);
        if (!snap) return;
        const dto = SnapshotDAO.toEstadoSolucion(snap);
        const { state, locks: restoredLocks } = estadoSolucionToIterativeState(dto);
        pushUndo('Antes de volver a un punto del historial');
        setIterativeState(state);
        setLocks(restoredLocks);
        setCompletedEcos(new Set(snap.finishes));
        setConfig(snap.configs);
        void persistSolution(state, snap.configs);
        void CompletedEcosDAO.save(snap.finishes).catch(() => {});
    }, [persistSolution, pushUndo]);

    // Hidratacion al montar: repuebla candidatos/locks/pase/config desde SQLite.
    // PRIORIDAD DEL CONFIG: `kde_config` (lo ultimo que el usuario edito en la UI) gana
    // sobre `estado_solucion.config_grasp` (historico, el que produjo la solucion guardada).
    // De lo contrario, refrescar despues de editar nunca aplicaria los cambios si ya hay
    // una solucion persistida.
    useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;
        Promise.all([
            SolutionGraphDAO.loadCurrent().catch(e => {
                console.warn('No se pudo hidratar la solucion desde SQLite:', e);
                return null;
            }),
            KdeConfigDAO.load().catch(e => {
                console.warn('No se pudo hidratar kde_config desde SQLite:', e);
                return null;
            }),
            CompletedEcosDAO.load().catch(e => {
                console.warn('No se pudo hidratar completed_ecos desde SQLite:', e);
                return null;
            }),
            KdeModelsConfigDAO.load().catch(e => {
                console.warn('No se pudo hidratar kde_models_config desde SQLite:', e);
                return null;
            }),
        ]).then(([solutionDto, kdeCfg, completed, modelsCfg]) => {
            if (solutionDto) {
                const { state, locks: hydratedLocks, config: solutionConfig } =
                    estadoSolucionToIterativeState(solutionDto);
                setIterativeState(state);
                setLocks(hydratedLocks);
                // `kde_config` independiente gana sobre el config historico de la solucion.
                setConfig(kdeCfg ?? solutionConfig);
            } else if (kdeCfg) {
                setConfig(kdeCfg);
            }
            if (completed) setCompletedEcos(new Set(completed));
            if (modelsCfg) {
                // Merge sobre defaults por si el JSON guardado no trae todas las keys.
                setKdeModelsConfig({
                    kde_ij: { ...KDE_MODELS_DEFAULTS.kde_ij, ...modelsCfg.kde_ij },
                    kde_unificado: { ...KDE_MODELS_DEFAULTS.kde_unificado, ...modelsCfg.kde_unificado },
                });
            }
        });
    }, []);

    // Wrapper de setKdeModelsConfig que persiste en SQLite (debounced 400ms).
    const setKdeModelsConfigPersisted = useCallback((next: KdeModelsConfig) => {
        setKdeModelsConfig(next);
        if (modelsConfigSaveTimerRef.current) clearTimeout(modelsConfigSaveTimerRef.current);
        modelsConfigSaveTimerRef.current = setTimeout(() => {
            void KdeModelsConfigDAO.save(next).catch(e =>
                console.warn('No se pudo persistir kde_models_config en SQLite:', e),
            );
        }, 400);
    }, []);

    // Wrapper de setConfig que persiste el config en SQLite (debounced 400ms para no
    // saturar mientras el usuario edita campos numericos).
    const setConfigPersisted = useCallback((next: KdeWorkerConfig) => {
        setConfig(next);
        if (configSaveTimerRef.current) clearTimeout(configSaveTimerRef.current);
        configSaveTimerRef.current = setTimeout(() => {
            void KdeConfigDAO.save(next).catch(e =>
                console.warn('No se pudo persistir kde_config en SQLite:', e),
            );
        }, 400);
    }, []);

    // Guardado debounced del estado (para toggles de lock frecuentes).
    const scheduleSave = useCallback((state: IterativeRunState | null, cfg: KdeWorkerConfig) => {
        if (!state) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            void persistSolution(state, cfg);
        }, 600);
    }, [persistSolution]);

    const appendLog = useCallback((msg: string) => {
        setProgressLog(prev => [...prev.slice(-59), stampProgressMessage(msg)]);
    }, []);

    const onProgress = useCallback((p: KdeWorkerProgress) => {
        const message = formatProgressEvent(p);
        if (!message) return;
        setCurrentProgress(message);
        appendLog(message);
    }, [appendLog]);

    // Config efectivo del pase (params KDE derivados del panel "Modelos KDE"). Memoizado para
    // reusarlo en el worker (runPass) y en el factory de scoring del modal de asignacion manual.
    const configForRun = useMemo(() => buildConfigForRun(config, kdeModelsConfig), [config, kdeModelsConfig]);

    // gruposCatalogo (catálogo crudo, ids estables) también va a los snapshots del runner:
    // sin él, mapLockedRowsToDTO omite locks con ids renumerados y el payload subestima la W.
    useSetAssignation({ state: iterativeState, config: configForRun, rawInputs, completedEcos, gruposCatalogo });
    useSaveAssignationSolution({ state: iterativeState, config: configForRun, rawInputs, completedEcos, gruposCatalogo });
    useCreateXLSXFromCurrent({ state: iterativeState, config: configForRun, rawInputs, completedEcos, gruposCatalogo });

    const runPass = useCallback(async (autoConverge: boolean) => {
        const runLabel = autoConverge
            ? 'Auto-convergencia GRASP'
            : iterativeState
                ? `Pase ${iterativeState.pass + 1}`
                : 'Pase 0';
        setActiveRunLabel(runLabel);
        setCurrentProgress('Preparando pipeline GRASP');
        setProgressLog([stampProgressMessage(`Iniciando ${runLabel}`)]);
        setBusy(true);
        setError(null);
        pushUndo('Antes de correr un pase');
        const controller = new AbortController();
        cancelRef.current = controller;
        try {
            const next = await runKdeGraspIterative({
                baseInputs: rawInputs,
                initialState: iterativeState ?? undefined,
                locks,
                completedEcos: [...completedEcos],
                config: configForRun,
                autoConverge,
                maxPasses: 10,
                signal: controller.signal,
                gruposCatalogo,
                onProgress,
                onPass: state => {
                    const message = `Pase ${state.pass} terminado · ${state.lastResult.summary.totalAsignaciones} asignaciones`;
                    setCurrentProgress(message);
                    appendLog(message);
                    setIterativeState(state);
                    setLocks(new Set(state.candidates.filter(c => c.locked).map(candidateKey)));
                    void persistSolution(state, configForRun);
                    void SolutionGraphDAO.appendPass({ pase: state.pass, resumen: state.lastResult.summary, diff: state.lastDiff })
                        .catch(e => console.warn('No se pudo persistir el historial de pase:', e));
                    void saveSnapshot(state, configForRun, completedRef.current);
                },
            });
            setIterativeState(next);
            setLocks(new Set(next.candidates.filter(c => c.locked).map(candidateKey)));
            void persistSolution(next, configForRun);
            void SolutionGraphDAO.appendPass({ pase: next.pass, resumen: next.lastResult.summary, diff: next.lastDiff })
                .catch(e => console.warn('No se pudo persistir el historial de pase:', e));
            void saveSnapshot(next, configForRun, completedRef.current);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setBusy(false);
            cancelRef.current = null;
        }
    }, [configForRun, iterativeState, locks, completedEcos, onProgress, rawInputs, gruposCatalogo, persistSolution, saveSnapshot, pushUndo, appendLog]);

    const onToggleLock = useCallback((key: string, next: boolean) => {
        pushUndo(next ? 'Asignaste una fila' : 'Desasignaste una fila');
        setIterativeState(state => {
            if (!state) return state;
            const updated = state.candidates.map(c => candidateKey(c) === key ? { ...c, locked: next } : c);
            const newState = { ...state, candidates: updated };
            scheduleSave(newState, config);
            scheduleSnapshot(newState, config);
            return newState;
        });
        setLocks(prev => {
            const cp = new Set(prev);
            if (next) cp.add(key); else cp.delete(key);
            return cp;
        });
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    const onBulkSet = useCallback((rows: CandidateRow[], locked: boolean) => {
        const rowKeys = new Set(rows.map(candidateKey));
        pushUndo(locked ? `Asignaste ${rows.length} filas` : `Desasignaste ${rows.length} filas`);
        setIterativeState(state => {
            if (!state) return state;
            const updated = state.candidates.map(c => rowKeys.has(candidateKey(c)) ? { ...c, locked } : c);
            const newState = { ...state, candidates: updated };
            scheduleSave(newState, config);
            scheduleSnapshot(newState, config);
            return newState;
        });
        setLocks(prev => {
            const cp = new Set(prev);
            for (const k of rowKeys) {
                if (locked) cp.add(k); else cp.delete(k);
            }
            return cp;
        });
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    // Inyecta filas manuales (ya validadas por la FSM en el modal) como carga asignada del
    // pase actual. Se siembran en el grafoInicial del siguiente pase via mapLockedRowsToDTO.
    // Reusa applyManualAssign para compartir la lógica EXACTA con los tests de integridad.
    const onManualAssign = useCallback((rows: CandidateRow[]) => {
        if (rows.length === 0) return;
        const cur = iterativeStateRef.current;
        if (!cur) return;
        pushUndo(`Inyectaste ${rows.length} asignación(es) a mano`);
        const next = applyManualAssign(cur.candidates, locksRef.current, rows);
        const newState = { ...cur, candidates: next.candidates };
        setIterativeState(newState);
        setLocks(next.locks);
        scheduleSave(newState, config);
        scheduleSnapshot(newState, config);
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    // Desasigna (libera) una fila: la quita de la solución y su grupo vuelve al pool de
    // "candidatos a programar" (derivado: gruposValidos − idUeaGrupo asignados). Reversible
    // con Deshacer. NO borra el grupo, solo lo libera.
    const onRemoveAssignment = useCallback((row: CandidateRow) => {
        const cur = iterativeStateRef.current;
        if (!cur) return;
        pushUndo(`Desasignaste ${row.uea}/${row.claveGrupo}`);
        const next = applyRemoveAssignment(cur.candidates, locksRef.current, row);
        const newState = { ...cur, candidates: next.candidates };
        setIterativeState(newState);
        setLocks(next.locks);
        scheduleSave(newState, config);
        scheduleSnapshot(newState, config);
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    // Reemplaza (swap 1↔1) una fila por una nueva: libera la vieja (vuelve al pool) y asigna la
    // nueva, de forma atómica (un solo punto de Deshacer).
    const onReplaceAssignment = useCallback((oldRow: CandidateRow, newRows: CandidateRow[]) => {
        const cur = iterativeStateRef.current;
        if (!cur) return;
        pushUndo(`Reemplazaste ${oldRow.uea}/${oldRow.claveGrupo}`);
        const next = applyReplaceAssignment(cur.candidates, locksRef.current, oldRow, newRows);
        const newState = { ...cur, candidates: next.candidates };
        setIterativeState(newState);
        setLocks(next.locks);
        scheduleSave(newState, config);
        scheduleSnapshot(newState, config);
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    const onReplaceOccupiedAssignment = useCallback((oldRow: CandidateRow, occupiedRow: CandidateRow, newRows: CandidateRow[], mode: 'take' | 'swap') => {
        const cur = iterativeStateRef.current;
        if (!cur) return;
        pushUndo(mode === 'swap'
            ? `Intercambiaste UEAs entre ECO ${oldRow.numeroEconomico} y ECO ${occupiedRow.numeroEconomico}`
            : `Tomaste ${occupiedRow.uea}/${occupiedRow.claveGrupo} de ECO ${occupiedRow.numeroEconomico}`);
        const next = applyReplaceOccupiedAssignment(cur.candidates, locksRef.current, oldRow, occupiedRow, newRows);
        const newState = { ...cur, candidates: next.candidates };
        setIterativeState(newState);
        setLocks(next.locks);
        scheduleSave(newState, config);
        scheduleSnapshot(newState, config);
    }, [config, scheduleSave, scheduleSnapshot, pushUndo]);

    // Marca/desmarca un ECO como "carga terminada". Persiste de inmediato (click puntual).
    const onToggleEcoComplete = useCallback((eco: number) => {
        pushUndo('Cambiaste un ECO completado');
        setCompletedEcos(prev => {
            const next = new Set(prev);
            if (next.has(eco)) next.delete(eco); else next.add(eco);
            void CompletedEcosDAO.save([...next]).catch(e =>
                console.warn('No se pudo persistir completed_ecos en SQLite:', e),
            );
            return next;
        });
        if (iterativeStateRef.current) scheduleSnapshot(iterativeStateRef.current, configRef.current);
    }, [pushUndo, scheduleSnapshot]);

    // Devuelve TODOS los ECOs completados al pool (sin reiniciar la solucion).
    const returnAllCompletedEcos = useCallback(() => {
        setCompletedEcos(new Set());
        void CompletedEcosDAO.save([]).catch(e =>
            console.warn('No se pudo limpiar completed_ecos en SQLite:', e),
        );
    }, []);

    const onReset = useCallback(() => {
        setIterativeState(null);
        setLocks(new Set());
        setProgressLog([]);
        setError(null);
        // Reestablecer los ECOs completados al volver a pase 0: antes quedaban filtrados
        // para siempre y un ECO sin filas no podia desmarcarse desde la tabla.
        setCompletedEcos(new Set());
        // Vacía la pila de deshacer en memoria. NOTA: los snapshots persistidos NO se borran,
        // de modo que "Volver aquí" puede recuperar el estado tras un reinicio accidental.
        undoRef.current = [];
        setUndoCount(0);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
        void SolutionGraphDAO.deleteCurrent().catch(e => console.warn('No se pudo borrar la solucion en SQLite:', e));
        void CompletedEcosDAO.save([]).catch(e => console.warn('No se pudo limpiar completed_ecos en SQLite:', e));
    }, []);

    const onDownloadCurrentSolution = useCallback(() => {
        if (!iterativeState) return;
        downloadJson(`solucion_asignacion_pase${iterativeState.pass}.json`,
            iterativeState.candidates.map(candidateRowToDTO),
        );
    }, [iterativeState]);

    const onDownloadSummary = useCallback(() => {
        if (!iterativeState) return;
        downloadJson(`testAsinacionKDE_summary_pase${iterativeState.pass}.json`, iterativeState.lastResult.summary);
    }, [iterativeState]);

    const onDownloadSurface = useCallback(() => {
        if (!iterativeState) return;
        downloadJson(`kde_surface_points_pase${iterativeState.pass}.json`, iterativeState.lastResult.surfaceData);
    }, [iterativeState]);

    const onCancel = useCallback(() => {
        cancelRef.current?.abort();
    }, []);

    const contradictionGroupIds = useMemo(() => {
        if (!iterativeState) return undefined;
        const set = new Set<number>();
        for (const resumen of iterativeState.lastResult.summary.ecos) {
            if (resumen.contradicciones.length === 0) continue;
            const matchingGrupos = iterativeState.lastResult.gruposValidos.filter(g =>
                resumen.asignaciones.some(a => a.grupo === g.claveGrupo && a.uea === g.ueaClave),
            );
            for (const g of matchingGrupos) set.add(g.idUeaGrupo);
        }
        return set;
    }, [iterativeState]);

    // ── Soporte para el modal de asignacion manual (modo KDE) ──
    const lastResult = iterativeState?.lastResult;

    // Factory de scoring KDE en el hilo principal, con los MISMOS inputs/opciones que uso el
    // worker para producir este pase (graspKdeWorker.ts:168) -> kde_ij/kde_ih identicos a la tabla.
    const zFactory = useMemo(() => {
        if (!lastResult) return null;
        return crearZScoreKDE({
            profesores: lastResult.profesores,
            grupos: lastResult.gruposValidos,
            dfHist: rawInputs.dfHist,
            options: { mode: configForRun.mode, ...configForRun.options },
        });
    }, [lastResult, rawInputs.dfHist, configForRun]);

    const evaluarGrupo = useCallback(
        (eco: number, grupo: GrupoDTO): ZScoreDetails =>
            zFactory ? zFactory.evaluarGrupo(eco, grupo) : { score: 0, h_ih: 0, rhat: 0 },
        [zFactory],
    );

    // Conteo de imparticiones por (eco, uea) en los ultimos half_life trimestres de KDE IJ.
    const kdeIjHalfLife = configForRun.options?.halfLife ?? 8;
    const historial = useMemo(
        () => crearHistorialUea(rawInputs.dfHist, kdeIjHalfLife),
        [rawInputs.dfHist, kdeIjHalfLife],
    );

    // Pipeline FSM = mismas reglas que el GRASP (fast-fail + restantes). seedReglasJson inyecta
    // los catalogos (vigentes / area_profesor) en este realm ANTES de construir las reglas.
    const pipeline = useMemo(() => {
        seedReglasJson(rawInputs);
        return crearPipelineManual();
    }, [rawInputs]);

    return (
        <div>
            {busy && (
                <GraspProgressModal
                    runLabel={activeRunLabel}
                    currentProgress={currentProgress}
                    progressLog={progressLog}
                    onCancel={onCancel}
                />
            )}

            {/* Configuración GRASP+KDE, Modelos KDE, Penalty (batch) y Servicios viven en un modal
                unificado controlado desde el header de TimetablingApp. Esto deja el área principal
                solo con los botones de pase y la tabla de candidatos. */}
            <KdeConfigModal
                open={configModalOpen}
                onClose={() => onCloseConfigModal?.()}
                backendConfig={backendConfig}
                onSaveBackendConfig={setBackendConfig}
                kdeConfig={config}
                onChangeKdeConfig={setConfigPersisted}
                kdeModelsConfig={kdeModelsConfig}
                onChangeKdeModelsConfig={setKdeModelsConfigPersisted}
                baseUrl={baseUrl}
                onModelsRetrained={() => setChartsVersion(v => v + 1)}
                workspace={workspace}
                ecoNombre={ecoNombre}
                busy={busy}
            />

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Ejecución</h2>
                <div className={styles.runRow}>
                    <button
                        className={`${styles.runBtn} ${styles.runBtnPrimary}`}
                        onClick={() => runPass(false)}
                        disabled={busy}
                    >
                        <IconPlay size={15} />
                        {iterativeState ? `Pase ${iterativeState.pass + 1} · reasignar no deseados` : 'Pase 0 (inicial)'}
                    </button>
                    <button
                        className={`${styles.runBtn} ${styles.runBtnAuto}`}
                        onClick={() => runPass(true)}
                        disabled={busy}
                    >
                        Auto-convergencia
                    </button>
                    {busy && (
                        <button className={`${styles.runBtn} ${styles.runBtnCancel}`} onClick={onCancel}>
                            Cancelar
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {iterativeState && (
                        <>
                            <button className={styles.downloadBtn} onClick={onDownloadCurrentSolution}>↓ solución.json</button>
                            <button className={styles.downloadBtn} onClick={onDownloadSummary}>↓ summary.json</button>
                            <button className={styles.downloadBtn} onClick={onDownloadSurface}>↓ surface.json</button>
                        </>
                    )}
                </div>

                {/* Anticipar el pase (pieza Eje 3): qué se mantiene / regenera / excluye. */}
                {iterativeState && !iterativeState.converged && (
                    <div className={styles.anticipate}>
                        <div className={styles.anticipateHead}>
                            <IconPlay size={14} color="var(--tt-accent)" />
                            Al correr el Pase {iterativeState.pass + 1} (reasignar no deseados)
                        </div>
                        <div className={styles.anticipateGrid}>
                            <div className={styles.antCell} style={{ background: 'rgba(53,107,82,0.08)' }}>
                                <div className={styles.antNum} style={{ color: 'var(--tt-accent)' }}>
                                    {iterativeState.candidates.filter(c => c.locked).length}
                                </div>
                                <div className={styles.antLabel}>se mantienen</div>
                                <div className={styles.antDesc}>asignadas como carga W</div>
                            </div>
                            <div className={styles.antCell} style={{ background: 'rgba(177,96,58,0.08)' }}>
                                <div className={styles.antNum} style={{ color: 'var(--tt-accent2)' }}>
                                    {iterativeState.candidates.filter(c => !c.locked).length}
                                </div>
                                <div className={styles.antLabel}>se regeneran</div>
                                <div className={styles.antDesc}>libres, descartadas y re-resueltas</div>
                            </div>
                            <div className={styles.antCell} style={{ background: 'rgba(63,125,94,0.08)' }}>
                                <div className={styles.antNum} style={{ color: 'var(--tt-good)' }}>{completedEcos.size}</div>
                                <div className={styles.antLabel}>se excluyen</div>
                                <div className={styles.antDesc}>ECOs completados, no reciben carga</div>
                            </div>
                        </div>
                        <div className={styles.anticipateFoot}>
                            <span>
                                semilla cambia → <strong style={{ color: 'var(--tt-ink)' }}>{config.seed + iterativeState.pass + 1}</strong> (explora alternativas)
                            </span>
                        </div>
                    </div>
                )}

                {iterativeState && iterativeState.converged && (
                    <div className={styles.convergedBanner}>
                        <IconCheck size={18} color="var(--tt-good)" />
                        <div>
                            <div style={{ fontWeight: 700 }}>Convergido en el pase {iterativeState.pass}</div>
                            <div style={{ fontSize: 11, color: 'var(--tt-sub)' }}>
                                El diff con el pase anterior es idéntico — no hay más que reasignar.
                            </div>
                        </div>
                    </div>
                )}

                {error && <div className={styles.errorBox}>ERROR: {error}</div>}
                {progressLog.length > 0 && (
                    <div className={styles.statusBox}>
                        {progressLog.slice(-10).map((m, i) => <div key={i}>{m}</div>)}
                    </div>
                )}
            </section>

            {iterativeState && (
                <>
                    <SolutionLockTable
                        candidates={iterativeState.candidates}
                        gruposCatalogo={gruposCatalogo}
                        contradictionGroupIds={contradictionGroupIds}
                        ecoNombre={ecoNombre}
                        claveUea={rawInputs.claveUea}
                        onToggleLock={onToggleLock}
                        onBulkSet={onBulkSet}
                        completedEcos={completedEcos}
                        onToggleEcoComplete={onToggleEcoComplete}
                        chartsVersion={chartsVersion}
                        onReassignUnlocked={() => runPass(false)}
                        onAutoConverge={() => runPass(true)}
                        onReset={onReset}
                        busy={busy}
                        iterativePass={iterativeState.pass}
                        iterativeConverged={iterativeState.converged}
                        iterativeDelta={iterativeState.lastDiff && {
                            added: iterativeState.lastDiff.added.length,
                            removed: iterativeState.lastDiff.removed.length,
                            reassigned: iterativeState.lastDiff.reassigned.length,
                        }}
                        gruposValidos={iterativeState.lastResult.gruposValidos}
                        profesores={iterativeState.lastResult.profesores}
                        evaluarGrupo={evaluarGrupo}
                        historial={historial}
                        pipeline={pipeline}
                        currentPass={iterativeState.pass}
                        baseUrl={baseUrl}
                        onManualAssign={onManualAssign}
                        onRemoveAssignment={onRemoveAssignment}
                        onReplaceAssignment={onReplaceAssignment}
                        onReplaceOccupiedAssignment={onReplaceOccupiedAssignment}
                        onUndo={onUndo}
                        canUndo={undoCount > 0}
                        onRestoreSnapshot={restoreSnapshot}
                        historyRefreshKey={historyVersion}
                        onBackupBeforeReset={onDownloadCurrentSolution}
                    />

                    {iterativeState.lastResult.summary.ecos.some(e => e.contradicciones.length > 0) && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Contradicciones detectadas per-ECO</h2>
                            <ul>
                                {iterativeState.lastResult.summary.ecos.map(e =>
                                    e.contradicciones.length > 0 && (
                                        <li key={e.eco}>
                                            <strong>{e.eco}</strong> — total={e.totalUeas} mañana={e.manana} medioDía={e.medioDia} tarde={e.tarde}
                                            <ul>
                                                {e.contradicciones.map((c, i) => <li key={i} style={{ color: '#8f2d2d' }}>{c}</li>)}
                                            </ul>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </section>
                    )}
                </>
            )}

            {completedEcos.size > 0 ? (
                <CompletedEcosPanel
                    completedEcos={completedEcos}
                    candidates={iterativeState?.candidates ?? []}
                    ecoNombre={ecoNombre}
                    onReturn={onToggleEcoComplete}
                    onReturnAll={returnAllCompletedEcos}
                    disabled={busy}
                />
            ) : null}
        </div>
    );
}
