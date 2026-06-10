import GraspKdeWorker from './graspKdeWorker?worker';
import type {
    BlockedGroupKey,
    KdeRawInputs,
    KdeWorkerConfig,
    KdeWorkerInbound,
    KdeWorkerOutbound,
    KdeWorkerProgress,
    KdeWorkerResult,
    LockedAssignmentDTO,
} from './graspKdeTypes';

export interface RunKdeGraspWorkerOptions {
    /** archivos_requeridos COMPLETOS (los bloqueados se excluyen en el worker via blockedKeys). */
    inputs: KdeRawInputs;
    config: KdeWorkerConfig;
    lockedAssignments?: LockedAssignmentDTO[];
    completedEcos?: number[];
    /** Grupos bloqueados a excluir del catálogo del pase (por contenido, no por id). */
    blockedKeys?: BlockedGroupKey[];
    onProgress?: (event: KdeWorkerProgress) => void;
    signal?: AbortSignal;
}

export interface RunKdeGraspWorkerHandle {
    promise: Promise<KdeWorkerResult>;
    cancel: () => void;
}

export function runKdeGraspWorker(options: RunKdeGraspWorkerOptions): RunKdeGraspWorkerHandle {
    const worker = new GraspKdeWorker();

    let settled = false;
    let resolveOuter!: (value: KdeWorkerResult) => void;
    let rejectOuter!: (reason: unknown) => void;
    const promise = new Promise<KdeWorkerResult>((resolve, reject) => {
        resolveOuter = resolve;
        rejectOuter = reject;
    });

    const cleanup = () => {
        worker.terminate();
    };

    const cancel = () => {
        if (settled) return;
        settled = true;
        const msg: KdeWorkerInbound = { type: 'cancel' };
        worker.postMessage(msg);
        cleanup();
        rejectOuter(new DOMException('KDE GRASP worker cancelled', 'AbortError'));
    };

    if (options.signal) {
        if (options.signal.aborted) {
            cancel();
        } else {
            options.signal.addEventListener('abort', cancel, { once: true });
        }
    }

    worker.addEventListener('message', (event: MessageEvent<KdeWorkerOutbound>) => {
        if (settled) return;
        const data = event.data;
        if (data.type === 'progress') {
            options.onProgress?.(data.payload);
        } else if (data.type === 'result') {
            settled = true;
            cleanup();
            resolveOuter(data.payload);
        } else if (data.type === 'error') {
            settled = true;
            cleanup();
            const error = new Error(data.message);
            if (data.stack) error.stack = data.stack;
            rejectOuter(error);
        }
    });

    worker.addEventListener('error', (event) => {
        if (settled) return;
        settled = true;
        cleanup();
        rejectOuter(event.error ?? new Error(event.message || 'Worker error'));
    });

    const initMsg: KdeWorkerInbound = {
        type: 'run',
        inputs: options.inputs,
        config: options.config,
        lockedAssignments: options.lockedAssignments,
        completedEcos: options.completedEcos,
        blockedKeys: options.blockedKeys,
    };
    worker.postMessage(initMsg);

    return { promise, cancel };
}
