import type { BrowserGraspRunOptions, BrowserGraspRunResult } from './browserGraspPipeline';
import { runBrowserGraspPipeline } from './browserGraspPipeline';
import type { PipelineMetadataDTO, WorkspaceDTO } from '../dtos';

type WorkerMessage =
    | { id: string; type: 'metadata'; metadata: PipelineMetadataDTO }
    | { id: string; type: 'completed'; result: BrowserGraspRunResult }
    | { id: string; type: 'failed'; error: string };

export function runGraspPipelineClient(
    workspace: WorkspaceDTO,
    options: BrowserGraspRunOptions
): Promise<BrowserGraspRunResult> {
    if (typeof Worker === 'undefined') {
        return runBrowserGraspPipeline(workspace, options);
    }

    return new Promise((resolve, reject) => {
        const id = `grasp-worker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const worker = new Worker(new URL('./graspPipeline.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => worker.terminate();

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const message = event.data;
            if (message.id !== id) return;

            if (message.type === 'metadata') {
                options.onMetadata?.(message.metadata);
                return;
            }

            cleanup();
            if (message.type === 'completed') {
                resolve(message.result);
            } else {
                reject(new Error(message.error));
            }
        };

        worker.onerror = (event) => {
            cleanup();
            reject(new Error(event.message || 'El Web Worker del GRASP fallo.'));
        };

        const { onMetadata: _onMetadata, ...serializableOptions } = options;
        worker.postMessage({ id, workspace, options: serializableOptions });
    });
}
