import type {
    BackendConfigDTO,
    PipelineMetadataDTO,
    PipelineStageStatus,
    PreassignmentsArtifactDTO,
    SolutionDTO,
    WorkspaceDTO,
} from '../dtos';
import { buildBackendBaseUrl } from '../hooks/useBackendConfig';
import {
    BrowserScoreCacheStore,
    createBaselinePenaltyPayload,
    warmupBrowserScoreCache,
} from './solution-parity/ml/BrowserScoreCache';

import { ModeloPenaltyCached } from './solution-parity/ml/ModeloPenaltyCached';
import { ModeloSijhCached } from './solution-parity/ml/ModeloSijhCached';
import { PenaltyObservedCache } from './solution-parity/ml/PenaltyObservedCache';
import { penaltyObservedKey } from './solution-parity/ml/CacheKeys';
import type { PenaltyObservedResponse } from './solution-parity/ml/PenaltyObservedCache';
import { GreedyOrchestrator } from './solution-parity/greedy/GreedyOrchestrator';
import { EstrategiaUeaMenosVista } from './solution-parity/greedy/EstrategiaUeaMenosVista';
import { GrafoBipartito } from './solution-parity/models/GrafoBipartito';
import { ViabilidadHuecos } from './solution-parity/objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from './solution-parity/objective/ViabilidadPenalizacionCarga';
import type { ConstraintPonderada } from './solution-parity/objective/FuncionObjetivoZ';
import { configurarCatalogosReglas } from './solution-parity/rules/ReglasImplementacion';
import {
    filterGroupsByIngestaFSM,
    graphToPreassignmentsArtifact,
    resultToSolutionDTO,
    workspaceToSolutionCatalogs,
    workspaceToSolutionGrupos,
    workspaceToSolutionProfesores,
} from './solution-parity/adapters/workspaceAdapters';
import type { GrupoDTO, ProfesorDTO } from './solution-parity/types/AssignmentTypes';

export interface BrowserGraspRunResult {
    solution: SolutionDTO;
    metadata: PipelineMetadataDTO;
    preasignaciones: PreassignmentsArtifactDTO;
}

export interface BrowserGraspRunOptions {
    config: BackendConfigDTO;
    k?: number;
    alpha?: number;
    warmupConcurrency?: number;
    penaltyConcurrency?: number;
    cleanCache?: boolean;
    onMetadata?: (metadata: PipelineMetadataDTO) => void;
}

const DEFAULT_K = 20;
const DEFAULT_ALPHA = 0.2;
const DEFAULT_WARMUP_CONCURRENCY = 32;
const DEFAULT_PENALTY_CONCURRENCY = 8;

export async function runBrowserGraspPipeline(
    workspace: WorkspaceDTO,
    options: BrowserGraspRunOptions
): Promise<BrowserGraspRunResult> {
    const started = performance.now();
    const runId = `solution-parity-${Date.now()}`;
    const k = options.k ?? DEFAULT_K;
    const alpha = options.alpha ?? DEFAULT_ALPHA;
    const baseUrl = buildBackendBaseUrl(options.config);
    const metadata = createMetadata(runId, {
        k,
        alpha,
        scoringBaseUrl: baseUrl,
        mode: 'local-typescript-solution-parity',
        source: '/solution/greedy/testIngestaML.ts',
    });
    const emit = (stageName: PipelineStageStatus | string, status: PipelineMetadataDTO['stages'][number]['status'], progress: number) => {
        updateStage(metadata, stageName, status, progress);
        metadata.estadoGlobal = normalizeGlobalStage(stageName, status);
        metadata.updatedAt = new Date().toISOString();
        options.onMetadata?.(cloneMetadata(metadata));
    };

    try {
        emit('ingesta', 'running', 5);
        const profesores = workspaceToSolutionProfesores(workspace);
        const gruposCrudos = workspaceToSolutionGrupos(workspace);
        configurarCatalogosReglas(workspaceToSolutionCatalogs(workspace));
        const grupos = filterGroupsByIngestaFSM(profesores, gruposCrudos, metadata);
        completeStage(metadata, 'ingesta', { profesores: profesores.length, grupos: grupos.length });
        options.onMetadata?.(cloneMetadata(metadata));

        emit('fsm_inicial', 'running', 15);
        const grafoInicial = createRegisteredGraph(profesores, grupos);
        completeStage(metadata, 'fsm_inicial', {
            nodosProfesor: grafoInicial.profesores.size,
            nodosGrupo: grafoInicial.grupos.size,
        });
        options.onMetadata?.(cloneMetadata(metadata));

        const cacheStore = new BrowserScoreCacheStore();
        emit('sijh_warmup', 'running', 20);
        emit('kde_warmup', 'running', 24);
        emit('penalty_warmup', 'running', 28);
        const warmup = await warmupBrowserScoreCache(cacheStore, profesores, grupos, {
            baseUrl,
            concurrency: options.warmupConcurrency ?? DEFAULT_WARMUP_CONCURRENCY,
            cleanCache: options.cleanCache,
            onProgress: (progress) => {
                const baseProgress = progress.stage === 'sijh_warmup' ? 20 : progress.stage === 'kde_warmup' ? 24 : 28;
                const span = progress.stage === 'penalty_warmup' ? 10 : 4;
                const pct = progress.total === 0 ? 100 : Math.round(baseProgress + (progress.processed / progress.total) * span);
                updateStage(metadata, progress.stage, 'running', pct);
                metadata.updatedAt = new Date().toISOString();
                if (progress.processed === progress.total || progress.processed % 250 === 0) {
                    options.onMetadata?.(cloneMetadata(metadata));
                }
            },
        });
        completeStage(metadata, 'sijh_warmup', { keys: warmup.rhatKeys });
        completeStage(metadata, 'kde_warmup', { keys: warmup.kdeKeys });
        completeStage(metadata, 'penalty_warmup', { keys: warmup.penaltyKeys, errores: warmup.errors });
        options.onMetadata?.(cloneMetadata(metadata));

        emit('rcl', 'running', 40);
        // 2. Modelo Sijh (carga rhat y h_ih desde indexedDB)
        const modeloSijh = new ModeloSijhCached(1.0, 1.0, undefined, cacheStore);
        await modeloSijh.inicializar(profesores, grupos, false);
        const modeloPenalty = new ModeloPenaltyCached(cacheStore);
        await modeloPenalty.inicializarEstadisticos(profesores, grupos);
        completeStage(metadata, 'rcl', { k, alpha });
        options.onMetadata?.(cloneMetadata(metadata));

        emit('greedy', 'running', 45);
        const penaltyObservedCache = new PenaltyObservedCache({
            baseUrl,
            maxConcurrentFetches: options.penaltyConcurrency ?? DEFAULT_PENALTY_CONCURRENCY,
            requestTimeoutMs: 15_000,
            maxAttempts: 3,
        });
        await primeBaselinePenaltyObserved(cacheStore, penaltyObservedCache, profesores, grupos);

        const constraints: ConstraintPonderada[] = [
            { constraint: new ViabilidadHuecos(), lambda: 2.0 },
            {
                constraint: new ViabilidadPenalizacionCarga(baseUrl, modeloPenalty, penaltyObservedCache),
                lambda: 1.0,
            },
        ];
        const orchestrator = new GreedyOrchestrator(
            new EstrategiaUeaMenosVista(grupos),
            modeloSijh,
            constraints,
            undefined,
            modeloPenalty,
            { k, alpha }
        );

        const resultado = await orchestrator.ejecutarAsync(profesores, grupos, grafoInicial, {
            K: k,
            Alpha: alpha,
            fase: 'grasp-produccion',
        });
        await penaltyObservedCache.waitForIdle({ fase: 'post-greedy' });
        completeStage(metadata, 'greedy', {
            evaluaciones: resultado.metricas.totalEvaluaciones,
            rechazados: resultado.metricas.totalRechazados,
        });
        options.onMetadata?.(cloneMetadata(metadata));

        emit('ejection', 'completed', 86);
        completeStage(metadata, 'ejection', {
            mejorasLocales: resultado.metricas.mejorasLocales,
            reparaciones: resultado.metricas.reparaciones,
        });
        emit('final_z', 'completed', 92);
        completeStage(metadata, 'final_z', { scoreZ: Math.round(resultado.metricas.scoreZ) });

        emit('export', 'running', 96);
        const grafoFinal = createGraphFromResult(profesores, grupos, resultado.asignaciones);
        const solution = resultToSolutionDTO(
            runId,
            resultado,
            workspace.grupos,
            grupos,
            metadata,
            (eco, idUeaGrupo) => modeloSijh.score(eco, idUeaGrupo)
        );
        const preasignaciones = graphToPreassignmentsArtifact(grafoFinal);
        metadata.estadoGlobal = 'completed';
        metadata.solutionId = solution.id;
        metadata.metrics = {
            asignados: solution.metrics.asignados,
            huerfanos: solution.metrics.huerfanos,
            preasignados: solution.metrics.preasignados,
            rechazados: resultado.metricas.totalRechazados,
            scorePromedio: solution.metrics.scorePromedio,
            scoreZ: resultado.metricas.scoreZ,
            mejorasLocales: resultado.metricas.mejorasLocales,
            reparaciones: resultado.metricas.reparaciones,
            tiempoMs: Math.round(performance.now() - started),
            penaltyObserved: penaltyObservedCache.stats(),
            logsFase1: resultado.metricas.logsFase1 ?? [],
            logsEjection: resultado.metricas.logsEjection ?? [],
            logsFirstFSM: resultado.metricas.logsFirstFSM ?? [],
        };
        completeStage(metadata, 'export', {
            asignaciones: solution.assignments.length,
            huerfanos: solution.orphanGroups.length,
        });
        updateStage(metadata, 'completed', 'completed', 100);
        metadata.updatedAt = new Date().toISOString();
        const finalMetadata = cloneMetadata(metadata);
        options.onMetadata?.(finalMetadata);

        return {
            solution: { ...solution, metadata: finalMetadata },
            metadata: finalMetadata,
            preasignaciones,
        };
    } catch (error) {
        metadata.estadoGlobal = 'failed';
        metadata.errors.push(error instanceof Error ? error.message : String(error));
        updateStage(metadata, 'failed', 'failed', 100);
        metadata.updatedAt = new Date().toISOString();
        options.onMetadata?.(cloneMetadata(metadata));
        throw error;
    }
}

async function primeBaselinePenaltyObserved(
    cacheStore: BrowserScoreCacheStore,
    observedCache: PenaltyObservedCache,
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[]
): Promise<void> {
    const keys: string[] = [];
    const taskMap = new Map<string, { eco: number; grupo: GrupoDTO }>();

    for (const profesor of profesores) {
        for (const grupo of grupos) {
            if (!grupo.horarioStringRaw) continue;
            try {
                const payload = createBaselinePenaltyPayload(profesor.numeroEconomico, grupo);
                const key = penaltyObservedKey(payload);
                if (!taskMap.has(key)) {
                    keys.push(key);
                    taskMap.set(key, { eco: profesor.numeroEconomico, grupo });
                }
            } catch {
                continue;
            }
        }
    }

    const chunkSize = 5000;
    for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        const results = await cacheStore.mget(...chunk);

        for (let j = 0; j < chunk.length; j++) {
            const raw = results[j];
            if (!raw) continue;
            
            try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;
                if (typeof parsed.total_penalty === 'number' && Number.isFinite(parsed.total_penalty)) {
                    const task = taskMap.get(chunk[j]);
                    if (task) {
                        observedCache.prime(
                            createBaselinePenaltyPayload(task.eco, task.grupo),
                            { ...parsed, total_penalty: parsed.total_penalty } as PenaltyObservedResponse
                        );
                    }
                }
            } catch {
                // Ignore malformed warmup entries; observed cache will fetch on demand.
            }
        }
    }
}

function createRegisteredGraph(profesores: ProfesorDTO[], grupos: GrupoDTO[]): GrafoBipartito {
    const grafo = new GrafoBipartito();
    profesores.forEach((profesor) => grafo.registrarProfesor(profesor));
    grupos.forEach((grupo) => grafo.registrarGrupo(grupo));
    return grafo;
}

function createGraphFromResult(
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[],
    asignaciones: Array<{ numeroEconomico: number; idUeaGrupo: number }>
): GrafoBipartito {
    const grafo = createRegisteredGraph(profesores, grupos);
    asignaciones.forEach((asignacion) => {
        if (!grafo.asignacionesInversas.has(asignacion.idUeaGrupo)) {
            grafo.asignarMutable(asignacion.numeroEconomico, asignacion.idUeaGrupo);
        }
    });
    return grafo;
}

function createMetadata(runId: string, pipelineConfig: Record<string, unknown>): PipelineMetadataDTO {
    const now = new Date().toISOString();
    return {
        runId,
        solutionId: runId,
        createdAt: now,
        updatedAt: now,
        estadoGlobal: 'idle',
        pipelineConfig,
        stages: [
            { name: 'ingesta', status: 'pending', progress: 0 },
            { name: 'fsm_inicial', status: 'pending', progress: 0 },
            { name: 'sijh_warmup', status: 'pending', progress: 0 },
            { name: 'kde_warmup', status: 'pending', progress: 0 },
            { name: 'penalty_warmup', status: 'pending', progress: 0 },
            { name: 'rcl', status: 'pending', progress: 0 },
            { name: 'greedy', status: 'pending', progress: 0 },
            { name: 'ejection', status: 'pending', progress: 0 },
            { name: 'final_z', status: 'pending', progress: 0 },
            { name: 'export', status: 'pending', progress: 0 },
            { name: 'completed', status: 'pending', progress: 0 },
            { name: 'failed', status: 'pending', progress: 0 },
        ],
        fsmTrace: [],
        metrics: {},
        errors: [],
    };
}

function updateStage(
    metadata: PipelineMetadataDTO,
    name: PipelineStageStatus | string,
    status: PipelineMetadataDTO['stages'][number]['status'],
    progress: number
): void {
    const stage = metadata.stages.find((item) => item.name === name);
    if (!stage) return;
    stage.status = status;
    stage.progress = progress;
    if (status === 'running' && !stage.startedAt) stage.startedAt = new Date().toISOString();
    if (status === 'completed' || status === 'failed') stage.finishedAt = new Date().toISOString();
}

function completeStage(metadata: PipelineMetadataDTO, name: PipelineStageStatus | string, counters?: Record<string, number>): void {
    updateStage(metadata, name, 'completed', 100);
    const stage = metadata.stages.find((item) => item.name === name);
    if (stage) stage.counters = counters;
}

function normalizeGlobalStage(stageName: PipelineStageStatus | string, status: PipelineMetadataDTO['stages'][number]['status']): PipelineStageStatus {
    if (status === 'failed') return 'failed';
    if (stageName === 'sijh_warmup' || stageName === 'kde_warmup' || stageName === 'penalty_warmup') {
        return stageName;
    }
    if (stageName === 'final_z') return 'final_z';
    if (stageName === 'completed') return 'completed';
    if (stageName === 'failed') return 'failed';
    if (stageName === 'idle') return 'idle';
    if (stageName === 'ingesta') return 'ingesta';
    if (stageName === 'fsm_inicial') return 'fsm_inicial';
    if (stageName === 'rcl') return 'rcl';
    if (stageName === 'greedy') return 'greedy';
    if (stageName === 'ejection') return 'ejection';
    if (stageName === 'export') return 'export';
    return 'greedy';
}

function cloneMetadata(metadata: PipelineMetadataDTO): PipelineMetadataDTO {
    return {
        ...metadata,
        stages: metadata.stages.map((stage) => ({ ...stage, counters: stage.counters ? { ...stage.counters } : undefined })),
        fsmTrace: metadata.fsmTrace.map((trace) => ({ ...trace })),
        metrics: { ...metadata.metrics },
        errors: [...metadata.errors],
    };
}
