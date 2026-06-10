import { fork, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { GreedyOrchestrator } from './GreedyOrchestrator';
import { ModeloSijhCached } from '../ml/ModeloSijhCached';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';

import { ViabilidadHuecos } from '../objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from '../objective/ViabilidadPenalizacionCarga';
import { PenaltyObservedCache, PenaltyObservedPayload, PenaltyObservedResponse } from '../ml/PenaltyObservedCache';

const __filename = fileURLToPath(import.meta.url);

export interface WorkerIndex {
    id: number;
    worker: ChildProcess;
    sessionFlag: string;
    isBusy: boolean;
}

export interface WorkerInitData {
    profesores: any[];
    grupos: any[];
}

export interface WorkerTask {
    type: 'EVALUATE';
    taskId: string;
    k: number;
    alpha: number;
    iteracionId: number;
}

export interface WorkerResponse {
    type: 'TASK_COMPLETE';
    taskId: string;
    metricas: any;
}

export interface PenaltyRequest {
    type: 'GET_PENALTY';
    msgId: string;
    eco: string;
    grupoId: number;
    payload: PenaltyObservedPayload;
}

export interface PenaltyResponse {
    type: 'PENALTY_RESULT';
    msgId: string;
    viabilidad: number;
    penalty: number;
    response?: PenaltyObservedResponse;
    error?: string;
}

// ---------------------------------------------------------
// MASTER THREAD (Main)
// ---------------------------------------------------------
export class WorkerPool {
    private pool: WorkerIndex[] = [];
    private maxWorkers: number;
    private taskQueue: { task: WorkerTask; resolve: (val: any) => void; reject: (err: any) => void }[] = [];

    constructor(numWorkers: number, _penaltyCache: PenaltyObservedCache) {
        this.maxWorkers = numWorkers;
    }

    public async inicializar(profesores: any[], grupos: any[]): Promise<void> {
        console.log(`[WorkerPool] Inicializando ${this.maxWorkers} workers (child_process)...`);

        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = fork(__filename, [], {
                execArgv: process.execArgv
            });

            const workerIndex: WorkerIndex = {
                id: i,
                worker: worker,
                sessionFlag: `sesion_worker_${i}`,
                isBusy: false
            };

            worker.on('message', async (msg: any) => {
                if (msg.type === 'READY') {
                    // Ready to receive tasks
                } else if (msg.type === 'TASK_COMPLETE') {
                    workerIndex.isBusy = false;
                    this.pumpQueue();
                }
            });

            worker.on('error', (err) => console.error(`[Worker ${i}] Error:`, err));
            worker.on('exit', (code) => {
                if (code !== 0) console.error(`[Worker ${i}] Exit code ${code}`);
            });

            // Enviar data inicial
            worker.send({
                type: 'INIT',
                profesores,
                grupos,
                penaltyConfig: {
                    baseUrl: process.env['PENALTY_ML_BASE_URL'] || 'http://127.0.0.1:8000',
                    maxEntries: Number.parseInt(process.env['PENALTY_LRU_MAX_ENTRIES'] || '50000', 10),
                    maxConcurrentFetches: Number.parseInt(process.env['PENALTY_ML_CONCURRENCY'] || '32', 10),
                    requestTimeoutMs: Number.parseInt(process.env['PENALTY_ML_TIMEOUT_MS'] || '10000', 10),
                    maxAttempts: Number.parseInt(process.env['PENALTY_ML_ATTEMPTS'] || '3', 10),
                    retryBaseDelayMs: Number.parseInt(process.env['PENALTY_ML_RETRY_BASE_MS'] || '500', 10),
                    watchdogMs: Number.parseInt(process.env['PENALTY_ML_WATCHDOG_MS'] || '300000', 10),
                    batchSize: Number.parseInt(process.env['PENALTY_BATCH_SIZE'] || '256', 256),
                }
            });

            this.pool.push(workerIndex);
        }

        // Dar un tiempo para que todos terminen de levantar redis internamente
        await new Promise(r => setTimeout(r, 2000));
    }

    public async ejecutarIteracion(k: number, alpha: number, iteracionId: number): Promise<any> {
        return new Promise((resolve, reject) => {
            const taskId = `task_${k}_${alpha}_${iteracionId}`;
            const task: WorkerTask = { type: 'EVALUATE', taskId, k, alpha, iteracionId };

            this.taskQueue.push({ task, resolve, reject });
            this.pumpQueue();
        });
    }

    private pumpQueue() {
        if (this.taskQueue.length === 0) return;

        const availableWorker = this.pool.find(w => !w.isBusy);
        if (!availableWorker) return;

        const { task, resolve } = this.taskQueue.shift()!;
        availableWorker.isBusy = true;

        const handleMessage = (msg: any) => {
            if (msg.type === 'TASK_COMPLETE' && msg.taskId === task.taskId) {
                availableWorker.worker.off('message', handleMessage);
                resolve(msg.metricas);
            }
        };

        availableWorker.worker.on('message', handleMessage);
        availableWorker.worker.send(task);
    }

    public cerrar() {
        for (const w of this.pool) {
            w.worker.kill();
        }
    }
}

// ---------------------------------------------------------
// WORKER THREAD (Child Process)
// ---------------------------------------------------------
// Si process.send existe, significa que somos un proceso hijo forkeado
if (process.send) {
    let orchestrator: GreedyOrchestrator | null = null;
    let profesoresLocal: any[] = [];
    let gruposLocal: any[] = [];
    let constraintsLocal: any[] = [];
    let modeloSijh: ModeloSijhCached | null = null;
    let modeloPenaltyMock: ModeloPenaltyCached | null = null;
    let workerPenaltyCache: PenaltyObservedCache | null = null;

    process.on('message', async (msg: any) => {
        if (msg.type === 'INIT') {
            profesoresLocal = msg.profesores;
            gruposLocal = msg.grupos;

            // Inicializar ModeloSijhCached
            modeloSijh = new ModeloSijhCached(1.0, 1.0);
            await modeloSijh.inicializar(profesoresLocal, gruposLocal, false);

            workerPenaltyCache = new PenaltyObservedCache({
                baseUrl: msg.penaltyConfig.baseUrl,
                maxEntries: msg.penaltyConfig.maxEntries,
                maxConcurrentFetches: msg.penaltyConfig.maxConcurrentFetches,
                requestTimeoutMs: msg.penaltyConfig.requestTimeoutMs,
                maxAttempts: msg.penaltyConfig.maxAttempts,
                retryBaseDelayMs: msg.penaltyConfig.retryBaseDelayMs,
                watchdogMs: msg.penaltyConfig.watchdogMs,
                batchSize: msg.penaltyConfig.batchSize,
                redis: {
                    host: '127.0.0.1',
                    port: 6379
                }
            });

            // Usar la clase original ViabilidadPenalizacionCarga
            modeloPenaltyMock = new ModeloPenaltyCached();
            await modeloPenaltyMock.inicializarEstadisticos(profesoresLocal, gruposLocal);
            constraintsLocal = [
                { constraint: new ViabilidadHuecos(), lambda: 2.0 },
                { constraint: new ViabilidadPenalizacionCarga(msg.penaltyConfig.baseUrl, modeloPenaltyMock, workerPenaltyCache), lambda: 1.0 }
            ];

            process.send!({ type: 'READY' });

        } else if (msg.type === 'EVALUATE') {
            orchestrator = new GreedyOrchestrator(
                undefined, // estrategia
                modeloSijh ? ((eco, g) => modeloSijh!.getScoreDetails(eco, g)) : undefined, // modelo
                constraintsLocal, // constraints
                undefined, // ejectionChain
                modeloPenaltyMock || undefined, // modeloPenalty
                { k: msg.k, alpha: msg.alpha, disableLogs: true } // rclConfig
            );

            try {
                const statsBefore = workerPenaltyCache ? workerPenaltyCache.stats() : null;
                const start = performance.now();
                const res = await orchestrator.ejecutarAsync(profesoresLocal, gruposLocal, null, {
                    fase: 'worker-eval'
                });
                const end = performance.now();
                res.metricas.tiempoMs = Math.round(end - start);

                if (workerPenaltyCache && statsBefore) {
                    const statsAfter = workerPenaltyCache.stats();
                    (res.metricas as any).cacheStatsDelta = {
                        hits: statsAfter.hits - statsBefore.hits,
                        redisHits: statsAfter.redisHits - statsBefore.redisHits,
                        misses: statsAfter.misses - statsBefore.misses,
                        redisMisses: statsAfter.redisMisses - statsBefore.redisMisses,
                        redisWrites: statsAfter.redisWrites - statsBefore.redisWrites,
                        retries: statsAfter.retries - statsBefore.retries,
                        errors: statsAfter.errors - statsBefore.errors
                    };
                }

                process.send!({
                    type: 'TASK_COMPLETE',
                    taskId: msg.taskId,
                    metricas: res.metricas
                } as WorkerResponse);

            } catch (err) {
                console.error(`[Worker] Error ejecutando tarea ${msg.taskId}:`, err);
                process.send!({
                    type: 'TASK_COMPLETE',
                    taskId: msg.taskId,
                    metricas: { error: true }
                });
            }
        }
    });
}
