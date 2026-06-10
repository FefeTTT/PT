import type { BrowserGraspRunOptions } from './browserGraspPipeline';
import { runBrowserGraspPipeline } from './browserGraspPipeline';
import type { WorkspaceDTO } from '../dtos';

interface WorkerRequest {
    id: string;
    workspace: WorkspaceDTO;
    options: Omit<BrowserGraspRunOptions, 'onMetadata'>;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { id, workspace, options } = event.data;
    try {
        const result = await runBrowserGraspPipeline(workspace, {
            ...options,
            onMetadata: (metadata) => {
                self.postMessage({ id, type: 'metadata', metadata });
            },
        });
        self.postMessage({ id, type: 'completed', result });
    } catch (error) {
        self.postMessage({
            id,
            type: 'failed',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
