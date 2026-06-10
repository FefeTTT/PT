import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { buildBackendBaseUrl } from './useBackendConfig';

export type DockerAction = 'build' | 'up';

export function useDockerOps(config: BackendConfigDTO) {
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const requestDockerAction = useCallback(async (action: DockerAction) => {
        setLoading(true);
        setMessage(null);
        try {
            await axios.post(`${buildBackendBaseUrl(config)}/ops/docker/${action}`, undefined, { timeout: 30000 });
            setMessage(`Operacion Docker solicitada: ${action}.`);
        } catch (requestError) {
            setMessage(
                requestError instanceof Error
                    ? `${requestError.message}. Si el backend no expone ops, lanza Docker manualmente desde esta configuracion.`
                    : 'No se pudo solicitar la operacion Docker.'
            );
        } finally {
            setLoading(false);
        }
    }, [config]);

    return { requestDockerAction, loading, message };
}
