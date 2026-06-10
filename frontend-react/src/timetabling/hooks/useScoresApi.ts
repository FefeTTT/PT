import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BackendConfigDTO, ScoreDTO } from '../dtos';
import { buildBackendBaseUrl } from './useBackendConfig';

export interface EcoScoresResult {
    topRHat: ScoreDTO[];
    topKde: ScoreDTO[];
}

export function useScoresApi(config: BackendConfigDTO) {
    const [loadingEco, setLoadingEco] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getTopRHat = useCallback(async (eco: number): Promise<ScoreDTO[]> => {
        const response = await axios.get<unknown>(`${buildBackendBaseUrl(config)}/scores/r-hat/${eco}/top`, {
            params: { limit: 5 },
            timeout: 5000,
        });
        return normalizeScores(response.data, eco, 'r_hat');
    }, [config]);

    const getTopKde = useCallback(async (eco: number): Promise<ScoreDTO[]> => {
        const response = await axios.get<unknown>(`${buildBackendBaseUrl(config)}/scores/kde/${eco}/top`, {
            params: { limit: 5 },
            timeout: 5000,
        });
        return normalizeScores(response.data, eco, 'kde');
    }, [config]);

    const getScoresForAssignment = useCallback(async (
        eco: number,
        ueaClave: number,
        idUeaGrupo: number
    ): Promise<ScoreDTO[]> => {
        const response = await axios.get<unknown>(`${buildBackendBaseUrl(config)}/scores/assignment`, {
            params: { eco, ueaClave, idUeaGrupo },
            timeout: 5000,
        });
        return normalizeScores(response.data, eco, 'score_final');
    }, [config]);

    const getEcoScores = useCallback(async (eco: number): Promise<EcoScoresResult> => {
        setLoadingEco(eco);
        setError(null);
        try {
            const [topRHat, topKde] = await Promise.all([getTopRHat(eco), getTopKde(eco)]);
            return { topRHat, topKde };
        } catch (requestError) {
            const message = requestError instanceof Error ? requestError.message : 'No se pudieron obtener scores.';
            setError(message);
            return { topRHat: [], topKde: [] };
        } finally {
            setLoadingEco(null);
        }
    }, [getTopKde, getTopRHat]);

    return {
        loadingEco,
        error,
        getTopRHat,
        getTopKde,
        getScoresForAssignment,
        getEcoScores,
    };
}

function normalizeScores(input: unknown, eco: number, source: ScoreDTO['source']): ScoreDTO[] {
    const rows = Array.isArray(input)
        ? input
        : isRecord(input) && Array.isArray(input.items)
            ? input.items
            : isRecord(input) && Array.isArray(input.scores)
                ? input.scores
                : [];

    return rows
        .map((row, index) => scoreFromUnknown(row, eco, source, index))
        .filter((score): score is ScoreDTO => Boolean(score))
        .slice(0, 5);
}

function scoreFromUnknown(
    input: unknown,
    eco: number,
    source: ScoreDTO['source'],
    index: number
): ScoreDTO | undefined {
    if (!isRecord(input)) {
        return undefined;
    }

    const score = toNumber(input.score ?? input.value ?? input[source]);
    if (score === undefined) {
        return undefined;
    }

    const ueaClave = toNumber(input.ueaClave ?? input.uea ?? input.claveUEA);
    const idUeaGrupo = toNumber(input.idUeaGrupo);
    const claveGrupo = typeof input.claveGrupo === 'string' ? input.claveGrupo : undefined;
    const label = String(input.label ?? input.nombre ?? input.ueaNombre ?? ueaClave ?? `Score ${index + 1}`);

    return {
        eco,
        ueaClave,
        idUeaGrupo,
        claveGrupo,
        label,
        score,
        source,
    };
}

function isRecord(input: unknown): input is Record<string, unknown> {
    return typeof input === 'object' && input !== null;
}

function toNumber(input: unknown): number | undefined {
    const value = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN;
    return Number.isFinite(value) ? value : undefined;
}
