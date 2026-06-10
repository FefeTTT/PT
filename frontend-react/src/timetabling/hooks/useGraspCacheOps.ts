import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { buildBackendBaseUrl } from './useBackendConfig';

export type CacheTarget = 'grasp' | 'r_hat' | 'kde' | 'all';

export function useGraspCacheOps(config: BackendConfigDTO) {
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const invalidate = useCallback(async (target: CacheTarget) => {
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(`${buildBackendBaseUrl(config)}/grasp/cache/invalidate`, { target }, { timeout: 5000 });
            setMessage(`Cache invalidada: ${target}.`);
        } catch (requestError) {
            setMessage(requestError instanceof Error ? requestError.message : 'No se pudo invalidar cache.');
        } finally {
            setLoading(false);
        }
    }, [config]);

    return { invalidate, loading, message };
}
