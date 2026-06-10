import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    REQUIRED_TIMETABLING_FILES,
    type AssignmentDTO,
    type BackendConfigDTO,
    type EcoProfileDTO,
    type PreassignmentsArtifactDTO,
    type RequiredTimetablingFileKey,
    type SolutionDTO,
    type ValidationIssueDTO,
    type WorkspaceDTO,
} from './dtos';
import { AssignmentInsights } from './components/AssignmentInsights';
import { KdeMode } from './components/KdeMode';
import { RichGroupList } from './components/RichGroupList';
import { RichProfessorList } from './components/RichProfessorList';
import { SettingsModal } from './components/SettingsModal';
import { SolutionComparator } from './components/SolutionComparator';
import { UploadWorkspacePanel, type UploadedFileState } from './components/UploadWorkspacePanel';
import type { KdeRawInputs } from './engine/kde/graspKdeTypes';
import { runGraspPipelineClient } from './engine/runGraspPipelineClient';
import { useBackendConfig } from './hooks/useBackendConfig';
import { requestCreateXLSXFromCurrent } from './hooks/useCreateXLSXFromCurrent';
import { requestSaveAssignationSolution } from './hooks/useSaveAssignationSolution';
import { useScoresApi, type EcoScoresResult } from './hooks/useScoresApi';
import {
    assignmentsFromPreassignments,
    mergeAssignmentsIntoGroups,
} from './utils/artifacts';
import {
    buildTimetablingWorkspace,
    type TimetablingRawInputs,
} from './utils/buildWorkspace';
import { readJsonFile } from './utils/fileReaders';
import { ArchivosRequeridosDAO } from './dao/ArchivosRequeridosDAO';
import { SaveStatusProvider } from './hooks/useSaveStatus';
import { SaveChip } from './components/SaveChip';
import { useDependencyHealth, type DepStatus } from './hooks/useDependencyHealth';
import { Dot } from './components/atoms';
import styles from './TimetablingApp.module.css';

type RawInputState = Partial<Record<RequiredTimetablingFileKey, unknown>>;

export function TimetablingApp() {
    const { config, setConfig } = useBackendConfig();
    const scoresApi = useScoresApi(config);
    const { deps } = useDependencyHealth(config);
    const [files, setFiles] = useState<Record<RequiredTimetablingFileKey, UploadedFileState>>(createInitialFileState);
    const [rawInputs, setRawInputs] = useState<RawInputState>({});
    const [sourceFiles, setSourceFiles] = useState<Record<RequiredTimetablingFileKey, string>>(createDefaultSourceFiles);
    const [workspace, setWorkspace] = useState<WorkspaceDTO | undefined>();
    const [issues, setIssues] = useState<ValidationIssueDTO[]>([]);
    const [preasignaciones, setPreasignaciones] = useState<PreassignmentsArtifactDTO | undefined>();
    const [solution, setSolution] = useState<SolutionDTO | undefined>();
    const [scoreCache, setScoreCache] = useState<Record<number, EcoScoresResult>>({});
    const [selectedEco, setSelectedEco] = useState<number | undefined>();
    const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
    const [professorQuery, setProfessorQuery] = useState('');
    const [groupQuery, setGroupQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showKdeConfig, setShowKdeConfig] = useState(false);
    const [showValidationDetails, setShowValidationDetails] = useState(false);
    const [validateStoredWorkspace, setValidateStoredWorkspace] = useState(false);
    const [pipelineLoading, setPipelineLoading] = useState(false);
    const [appMode, setAppMode] = useState<'kde' | 'legacy'>('kde');

    const kdeRawInputs: KdeRawInputs | null = useMemo(() => {
        const ecoHorarioRegular = rawInputs.horariosRegulares as Record<string, string> | undefined;
        const areaProfesor = rawInputs.areaProfesor as Record<string, string[]> | undefined;
        const programacionVacia = rawInputs.programacionVacia as Record<string, Array<{ grupo: string; horario: string | null }>> | undefined;
        const ecoNombreRaw = rawInputs.ecoNombre as Record<string, string> | undefined;
        const dfHist = rawInputs.dfHist as unknown[] | undefined;
        if (!ecoHorarioRegular || !areaProfesor || !programacionVacia || !ecoNombreRaw || !dfHist) {
            return null;
        }
        return {
            ecoHorarioRegular,
            ecoHorarioIrregular: rawInputs.horariosIrregularesInferidos as Record<string, unknown> | undefined,
            ecoHorarioIrregularVigente: rawInputs.horariosIrregulares as Record<string, string> | undefined,
            areaProfesor,
            programacionVacia,
            ecoNombre: ecoNombreRaw,
            claveUea: rawInputs.claveUea as Record<string, string> | undefined,
            dfHist,
        };
    }, [rawInputs]);

    const ecoNombreMap = useMemo(() => (rawInputs.ecoNombre as Record<string, string>) ?? {}, [rawInputs.ecoNombre]);

    const canBuild = REQUIRED_TIMETABLING_FILES
        .filter(spec => spec.requiredFor.includes('legacy'))
        .every((spec) => rawInputs[spec.key] !== undefined);

    const assignments = useMemo(() => {
        if (solution) {
            return solution.assignments;
        }
        if (workspace && preasignaciones) {
            return assignmentsFromPreassignments(preasignaciones, workspace.grupos);
        }
        return [];
    }, [preasignaciones, solution, workspace]);

    const grupos = useMemo(() => {
        if (!workspace) {
            return [];
        }
        return mergeAssignmentsIntoGroups(workspace.grupos, assignments);
    }, [assignments, workspace]);

    const profesores = useMemo(() => {
        if (!workspace) {
            return [];
        }
        return mergeAssignmentsIntoProfessors(workspace.profesores, assignments, scoreCache);
    }, [assignments, scoreCache, workspace]);

    const summary = useMemo(() => ({
        profesores: profesores.length,
        grupos: grupos.length,
        asignaciones: assignments.length,
        issues: issues.length,
    }), [assignments.length, grupos.length, issues.length, profesores.length]);

    const processUnifiedJson = useCallback((dataUnificada: Record<string, any>) => {
        const newRawInputs: RawInputState = {};
        const newSourceFiles: Record<RequiredTimetablingFileKey, string> = { ...createDefaultSourceFiles() };
        const newFiles = createInitialFileState();

        REQUIRED_TIMETABLING_FILES.forEach((spec) => {
            let foundKey = Object.keys(dataUnificada).find(k => k === spec.fileName);
            if (!foundKey && spec.key === 'programacionVacia') {
                 foundKey = Object.keys(dataUnificada).find(k => k.startsWith('programacion_vacia'));
            }
            
            if (foundKey && dataUnificada[foundKey]) {
                newRawInputs[spec.key] = dataUnificada[foundKey];
                newSourceFiles[spec.key] = foundKey;
                newFiles[spec.key] = { name: foundKey, status: 'loaded', issueCount: 0 };
            } else {
                newFiles[spec.key] = { status: 'missing', issueCount: 0 };
            }
        });

        setRawInputs(newRawInputs);
        setSourceFiles(newSourceFiles);
        setFiles(newFiles);
    }, []);

    const handleBuildWorkspace = useCallback(() => {
        const result = buildTimetablingWorkspace(rawInputs as TimetablingRawInputs, sourceFiles);
        setIssues(result.issues);
        setWorkspace(result.workspace);
        setSolution(undefined);

        const issueCounts = countIssuesByRequiredFile(result.issues);
        setFiles((current) => {
            const next = { ...current };
            REQUIRED_TIMETABLING_FILES.forEach((spec) => {
                next[spec.key] = {
                    ...next[spec.key],
                    status: issueCounts[spec.key] ? 'invalid' : next[spec.key].status,
                    issueCount: issueCounts[spec.key] ?? 0,
                };
            });
            return next;
        });
    }, [rawInputs, sourceFiles]);

    useEffect(() => {
        let cancelled = false;

        const hydrateStoredWorkspace = async () => {
            try {
                const stored = await ArchivosRequeridosDAO.load();
                const storedData = stored ?? readArchivosRequeridosFromLocalStorage();
                if (!cancelled && storedData) {
                    processUnifiedJson(storedData as Record<string, any>);
                    setValidateStoredWorkspace(true);
                }
            } catch (e) {
                console.error('Error al leer archivos_requeridos desde almacenamiento local', e);
                const storedData = readArchivosRequeridosFromLocalStorage();
                if (!cancelled && storedData) {
                    processUnifiedJson(storedData as Record<string, any>);
                    setValidateStoredWorkspace(true);
                }
            }
        };

        void hydrateStoredWorkspace();
        return () => {
            cancelled = true;
        };
    }, [processUnifiedJson]);

    useEffect(() => {
        if (!validateStoredWorkspace || !canBuild) return;
        handleBuildWorkspace();
        setValidateStoredWorkspace(false);
    }, [canBuild, handleBuildWorkspace, validateStoredWorkspace]);

    const handleUnifiedFile = async (file: File) => {
        try {
            const parsed = await readJsonFile(file) as Record<string, any>;
            try {
                await ArchivosRequeridosDAO.save(parsed);
            } catch (storageError) {
                console.warn('No se pudo guardar archivos_requeridos en SQLite:', storageError);
            }
            processUnifiedJson(parsed);
        } catch (fileError) {
            setIssues((current) => [
                ...current,
                {
                    path: file.name,
                    message: fileError instanceof Error ? fileError.message : 'No se pudo leer el archivo unificado.',
                    severity: 'error',
                },
            ]);
        }
    };

    const handleSelectEco = async (eco: number) => {
        setSelectedEco(eco);
        if (scoreCache[eco]) {
            return;
        }
        const scores = await scoresApi.getEcoScores(eco);
        setScoreCache((current) => ({ ...current, [eco]: scores }));
    };

    const handleInitializePipeline = async () => {
        if (!workspace) {
            return;
        }
        setPipelineLoading(true);
        try {
            const result = await runGraspPipelineClient(workspace, {
                config,
            });
            setPreasignaciones(result.preasignaciones);
            setSolution(result.solution);
        } catch (pipelineError) {
            setIssues((current) => [
                ...current,
                {
                    path: 'grasp-local',
                    message: pipelineError instanceof Error ? pipelineError.message : 'No se pudo ejecutar el GRASP local.',
                    severity: 'error',
                },
            ]);
        } finally {
            setPipelineLoading(false);
        }
    };


    return (
        <SaveStatusProvider>
        <main className={styles.app}>
            <div className={styles.shell}>
                <header className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>FSM · GRASP · KDE</p>
                        <h1 className={styles.title}>Timetabling de producción</h1>
                        <p className={styles.subtitle}>
                            Modo KDE · mesa de trabajo human-in-the-loop.
                        </p>
                    </div>
                    <div className={styles.toolbar}>
                        <div className={styles.modeToggle}>
                            <button
                                type="button"
                                onClick={() => setAppMode('kde')}
                                className={`${styles.modeBtn} ${appMode === 'kde' ? styles.modeBtnActive : ''}`}
                            >
                                Modo KDE
                            </button>
                            <button
                                type="button"
                                onClick={() => setAppMode('legacy')}
                                className={`${styles.modeBtn} ${appMode === 'legacy' ? styles.modeBtnActive : ''}`}
                            >
                                Modo Legacy
                            </button>
                        </div>
                        <SaveChip />
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={() => {
                                // En modo KDE con datos cargados, abrir el modal unificado
                                // (incluye GRASP+KDE, Modelos KDE, Penalty batch y Servicios).
                                // En Legacy o sin datos KDE, abrir el modal de Servicios clásico.
                                if (appMode === 'kde' && kdeRawInputs) setShowKdeConfig(true);
                                else setShowSettings(true);
                            }}
                        >
                            Configuración
                        </button>
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={requestSaveAssignationSolution}
                        >
                            Guardar solución
                        </button>
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={requestCreateXLSXFromCurrent}
                        >
                            Guardar como Excel
                        </button>
                        {appMode === 'legacy' && (
                            <button
                                className={styles.button}
                                type="button"
                                onClick={handleInitializePipeline}
                                disabled={!workspace || pipelineLoading}
                            >
                                {pipelineLoading ? 'Ejecutando GRASP...' : 'Inicializar GRASP'}
                            </button>
                        )}
                    </div>
                </header>

                <div className={styles.topMeta}>
                    <span className={styles.metaLabel}>Estado</span>
                    {deps.map((d) => (
                        <span key={d.id} className={styles.depChip} title={d.sub}>
                            <Dot color={depColor(d.state)} pulse={d.state !== 'ok' && d.state !== 'checking'} />
                            {d.label}
                            <span style={{ color: 'var(--tt-sub)', fontWeight: 600 }}>· {d.sub}</span>
                        </span>
                    ))}
                </div>

                <div className={styles.summaryStrip}>
                    <div className={styles.metric}>
                        <strong>{summary.profesores}</strong>
                        <span>Profesores</span>
                    </div>
                    <div className={styles.metric}>
                        <strong>{summary.grupos}</strong>
                        <span>Grupos</span>
                    </div>
                    <div className={styles.metric}>
                        <strong>{summary.asignaciones}</strong>
                        <span>Asignaciones</span>
                    </div>
                    <div className={styles.metric}>
                        <strong>{summary.issues}</strong>
                        <span>Issues</span>
                    </div>
                </div>

                <div className={`${styles.sectionGrid} ${styles.sectionGridSingle}`}>
                    <UploadWorkspacePanel
                        files={files}
                        onUnifiedFileSelected={handleUnifiedFile}
                        onBuildWorkspace={handleBuildWorkspace}
                        onOpenValidationDetails={() => setShowValidationDetails(true)}
                        canBuild={canBuild}
                        validationIssueCount={issues.length}
                    />
                </div>

                {/* Penalty (batch) se movió al modal unificado de Configuración del modo KDE
                    (pestaña "Penalty (batch)"). Aquí ya no se monta inline. */}

                {appMode === 'kde' && kdeRawInputs && (
                    <KdeMode
                        rawInputs={kdeRawInputs}
                        ecoNombre={ecoNombreMap}
                        workspace={workspace}
                        configModalOpen={showKdeConfig}
                        onCloseConfigModal={() => setShowKdeConfig(false)}
                    />
                )}
                {appMode === 'kde' && !kdeRawInputs && (
                    <div className={styles.empty}>
                        Modo KDE requiere los 7 archivos (incluyendo <code>df_hist.json</code> y <code>ecos_irregulares_inferidos.json</code>). Carga el JSON unificado para habilitarlo.
                    </div>
                )}

                {appMode === 'legacy' && workspace ? (
                    <>
                        <div className={styles.wideGrid}>
                            <RichProfessorList
                                profesores={profesores}
                                query={professorQuery}
                                selectedEco={selectedEco}
                                loadingEco={scoresApi.loadingEco}
                                scoreError={scoresApi.error}
                                onQueryChange={setProfessorQuery}
                                onSelect={handleSelectEco}
                            />
                            <RichGroupList
                                grupos={grupos}
                                query={groupQuery}
                                selectedGroupId={selectedGroupId}
                                onQueryChange={setGroupQuery}
                                onSelect={setSelectedGroupId}
                            />
                        </div>
                        <div className={styles.wideGrid}>
                            <AssignmentInsights
                                solution={solution}
                                assignments={assignments}
                                grupos={grupos}
                                profesores={profesores}
                            />
                            <SolutionComparator assignments={assignments} profesores={profesores} />
                        </div>
                    </>
                ) : appMode === 'legacy' ? (
                    <div className={styles.empty}>
                        Valida los archivos requeridos del modo Legacy para habilitar la previsualizacion rica y la inicializacion.
                    </div>
                ) : null}
            </div>

            <SettingsModal
                isOpen={showSettings}
                config={config}
                onSave={(nextConfig: BackendConfigDTO) => {
                    setConfig(nextConfig);
                    setShowSettings(false);
                }}
                onClose={() => setShowSettings(false)}
            />
            <ValidationIssuesModal
                open={showValidationDetails}
                issues={issues}
                onClose={() => setShowValidationDetails(false)}
            />
        </main>
        </SaveStatusProvider>
    );
}

interface ValidationIssuesModalProps {
    open: boolean;
    issues: ValidationIssueDTO[];
    onClose: () => void;
}

function ValidationIssuesModal({ open, issues, onClose }: ValidationIssuesModalProps) {
    if (!open) return null;

    return (
        <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="validation-issues-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h2 id="validation-issues-title">Validación e integridad</h2>
                    <div className={styles.bandHeaderActions}>
                        <span className={styles.statusPill}>{issues.length}</span>
                        <button className={styles.secondaryButton} type="button" onClick={onClose}>Cerrar</button>
                    </div>
                </div>
                <div className={styles.modalBody}>
                    {issues.length > 0 ? (
                        <>
                            <div className={styles.scrollList}>
                                {issues.slice(0, 80).map((issue) => (
                                    <div className={styles.notice} key={`${issue.path}-${issue.message}`}>
                                        <strong>{issue.severity}</strong> {issue.path}: {issue.message}
                                    </div>
                                ))}
                            </div>
                            {issues.length > 80 && (
                                <div className={styles.notice}>
                                    Mostrando 80 de {issues.length} issues. Corrige los primeros y vuelve a validar.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.empty}>No hay issues de validación registrados.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function readArchivosRequeridosFromLocalStorage(): Record<string, unknown> | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem('archivos_requeridos');
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch (e) {
        console.warn('No se pudo leer archivos_requeridos desde localStorage:', e);
    }
    return null;
}

function depColor(state: DepStatus['state']): string {
    if (state === 'ok') return 'var(--tt-good)';
    if (state === 'warn') return 'var(--tt-mid)';
    if (state === 'bad') return 'var(--tt-bad)';
    return 'var(--tt-sub)';
}


function mergeAssignmentsIntoProfessors(
    profesores: EcoProfileDTO[],
    assignments: AssignmentDTO[],
    scoreCache: Record<number, EcoScoresResult>
): EcoProfileDTO[] {
    const assignmentsByEco = new Map<number, AssignmentDTO[]>();
    assignments.forEach((assignment) => {
        const current = assignmentsByEco.get(assignment.numeroEconomico) ?? [];
        current.push(assignment);
        assignmentsByEco.set(assignment.numeroEconomico, current);
    });

    return profesores.map((profesor) => ({
        ...profesor,
        topRHat: scoreCache[profesor.numeroEconomico]?.topRHat ?? profesor.topRHat,
        topKde: scoreCache[profesor.numeroEconomico]?.topKde ?? profesor.topKde,
        assignments: assignmentsByEco.get(profesor.numeroEconomico) ?? [],
    }));
}

function createInitialFileState(): Record<RequiredTimetablingFileKey, UploadedFileState> {
    return REQUIRED_TIMETABLING_FILES.reduce((acc, spec) => ({
        ...acc,
        [spec.key]: { status: 'missing', issueCount: 0 },
    }), {} as Record<RequiredTimetablingFileKey, UploadedFileState>);
}

function createDefaultSourceFiles(): Record<RequiredTimetablingFileKey, string> {
    return REQUIRED_TIMETABLING_FILES.reduce((acc, spec) => ({
        ...acc,
        [spec.key]: spec.fileName,
    }), {} as Record<RequiredTimetablingFileKey, string>);
}

function countIssuesByRequiredFile(
    issues: ValidationIssueDTO[]
): Partial<Record<RequiredTimetablingFileKey, number>> {
    const counts: Partial<Record<RequiredTimetablingFileKey, number>> = {};
    REQUIRED_TIMETABLING_FILES.forEach((spec) => {
        counts[spec.key] = issues.filter((issue) => issue.path.startsWith(spec.fileName)).length;
    });
    return counts;
}
