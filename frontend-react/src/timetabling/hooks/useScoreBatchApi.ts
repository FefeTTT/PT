import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { buildBackendBaseUrl } from './useBackendConfig';

export type ScoreBatchModel = 'penalty' | 'rhat' | 'kde' | 'kde_unificado';

export interface ScoreBatchItem {
    id?: string;
    eco: string;
    uea?: string;
    horario?: string;
    ueas_asignadas_actuales?: string[];
    horarios_asignados_actuales?: string[];
}

export interface ScoreBatchResultRow {
    id: string;
    key: string;
    score: Record<string, unknown>;
}

export interface ScoreBatchErrorRow {
    id: string;
    error: string;
}

export interface ScoreBatchResponse {
    model: string;
    count: number;
    redis: {
        available: boolean;
        writes: number;
        errors: number;
        ttl_seconds: number;
    };
    results: ScoreBatchResultRow[];
    errors: ScoreBatchErrorRow[];
}

export interface ScoreBatchRequest {
    model: ScoreBatchModel;
    items: ScoreBatchItem[];
    session_id?: string;
    ttl_seconds?: number;
}

export interface ScoreBatchHook {
    loading: boolean;
    error: string | null;
    lastResponse: ScoreBatchResponse | null;
    submit: (request: ScoreBatchRequest, opts?: { timeoutMs?: number }) => Promise<ScoreBatchResponse>;
}

const DEFAULT_TIMEOUT_MS = 300_000;

export function useScoreBatchApi(config: BackendConfigDTO): ScoreBatchHook {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResponse, setLastResponse] = useState<ScoreBatchResponse | null>(null);

    const submit = useCallback(async (
        request: ScoreBatchRequest,
        opts?: { timeoutMs?: number }
    ): Promise<ScoreBatchResponse> => {
        setLoading(true);
        setError(null);
        try {
            const url = `${buildBackendBaseUrl(config)}/score_batch`;
            const response = await axios.post<ScoreBatchResponse>(url, request, {
                timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
                headers: { 'Content-Type': 'application/json' },
            });
            setLastResponse(response.data);
            return response.data;
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : 'Score batch fallo.';
            setError(message);
            throw requestError;
        } finally {
            setLoading(false);
        }
    }, [config]);

    return { loading, error, lastResponse, submit };
}
