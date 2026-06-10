import axios from 'axios';
import { useCallback, useState } from 'react';
import type {
    PipelineMetadataDTO,
    PreassignmentsArtifactDTO,
    WorkspaceDTO,
    BackendConfigDTO,
} from '../dtos';
import { parsePipelineMetadata, parsePreassignmentsArtifact } from '../utils/artifacts';
import { buildBackendBaseUrl } from './useBackendConfig';

export interface PipelineInitResponse {
    metadata?: PipelineMetadataDTO;
    preasignaciones?: PreassignmentsArtifactDTO;
    message: string;
}

export function useGraspPipelineApi(config: BackendConfigDTO) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initializePipeline = useCallback(async (workspace: WorkspaceDTO): Promise<PipelineInitResponse> => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post<unknown>(
                `${buildBackendBaseUrl(config)}/grasp/pipeline/initialize`,
                {
                    profesores: workspace.profesores.map((profile) => profile.profesor),
                    grupos: workspace.grupos,
                    sourceFiles: workspace.sourceFiles,
                },
                { timeout: 15000 }
            );

            return normalizePipelineResponse(response.data);
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : 'No se pudo inicializar el pipeline.';
            setError(message);
            return { message };
        } finally {
            setLoading(false);
        }
    }, [config]);

    const fetchMetadata = useCallback(async (): Promise<PipelineMetadataDTO | undefined> => {
        const response = await axios.get<unknown>(
            `${buildBackendBaseUrl(config)}/grasp/pipeline/metadata`,
            { timeout: 5000 }
        );
        return parsePipelineMetadata(response.data).data;
    }, [config]);

    return { loading, error, initializePipeline, fetchMetadata };
}

function normalizePipelineResponse(input: unknown): PipelineInitResponse {
    if (!isRecord(input)) {
        return { message: 'Pipeline respondio sin artefactos.' };
    }

    const metadataInput = input.metadata ?? input['metadata-solucion'] ?? input.metadataSolucion;
    const preassignmentsInput = input.preasignaciones ?? input['preasignaciones'];
    const metadata = metadataInput === undefined ? undefined : parsePipelineMetadata(metadataInput).data;
    const preasignaciones = preassignmentsInput === undefined
        ? undefined
        : parsePreassignmentsArtifact(preassignmentsInput).data;

    return {
        metadata,
        preasignaciones,
        message: typeof input.message === 'string' ? input.message : 'Pipeline inicializado.',
    };
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return typeof input === 'object' && input !== null;
}
