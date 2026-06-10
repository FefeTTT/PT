import axios from 'axios';
import { useCallback, useState } from 'react';
import type { BackendConfigDTO } from '../dtos';

export type ServiceHealthState = 'idle' | 'checking' | 'online' | 'offline';

export interface HealthResult {
    state: ServiceHealthState;
    message: string;
}

const IDLE_HEALTH: HealthResult = {
    state: 'idle',
    message: 'Sin verificar',
};

/**
 * Health checks que sondean EXACTAMENTE las rutas same-origin que usa el GRASP en el worker, para
 * que el modal detecte lo que el motor realmente alcanza:
 *
 *  - Python -> proxy `/py` (graspKdeWorker.ts usa `${origin}/py`; charts y /admin/kde/config tambien).
 *  - Redis  -> proxy `/api/redis/mget` (ioredis-browser-stub.ts usa `${origin}/api/redis/mget`).
 *
 * Por que cambiaron respecto a la version anterior (que daba falsos "offline" aunque el GRASP
 * accediera):
 *   1. `/redis/health` NO EXISTE en el backend Python (solo hay `/health`), asi que Redis salia
 *      siempre offline. El GRASP nunca usa esa ruta: llega a Redis por el middleware de Vite.
 *   2. El backend Python NO expone CORS. En modo "directo" el navegador bloqueaba `GET host:port/health`
 *      por CORS; el worker lo evita porque siempre usa el proxy same-origin `/py`. Sondear `/py`
 *      replica esa garantia, independientemente del toggle directo/proxy.
 *
 * El parametro `config` se conserva por compatibilidad de firma, pero NO se usa para construir la
 * URL: el transporte se fija a los proxies del dev-server, igual que el worker.
 */

const PYTHON_HEALTH_URL = '/py/health';
const REDIS_PROBE_URL = '/api/redis/mget';
const HEALTH_TIMEOUT_MS = 4000;

export function usePythonBackendHealth(_config: BackendConfigDTO) {
    const [health, setHealth] = useState<HealthResult>(IDLE_HEALTH);

    const check = useCallback(async () => {
        setHealth({ state: 'checking', message: 'Verificando Python (proxy /py)...' });
        try {
            await axios.get(PYTHON_HEALTH_URL, { timeout: HEALTH_TIMEOUT_MS });
            setHealth({ state: 'online', message: 'Python disponible (via proxy /py, igual que el GRASP).' });
        } catch (requestError) {
            setHealth({ state: 'offline', message: formatNetworkError(requestError, 'Python') });
        }
    }, []);

    return { health, check };
}

export function useRedisHealth(_config: BackendConfigDTO) {
    const [health, setHealth] = useState<HealthResult>(IDLE_HEALTH);

    const check = useCallback(async () => {
        setHealth({ state: 'checking', message: 'Verificando Redis (proxy /api/redis/mget)...' });
        try {
            // Mismo transporte que el worker del GRASP: ioredis-stub -> /api/redis/mget -> Redis real.
            // Un MGET de una clave-sonda responde 200 con un array (p. ej. [null]) si Redis contesta.
            const response = await axios.post<Array<string | null>>(
                REDIS_PROBE_URL,
                { keys: ['__frontend_health_probe__'] },
                { timeout: HEALTH_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } },
            );
            if (Array.isArray(response.data)) {
                setHealth({ state: 'online', message: 'Redis disponible (via proxy Vite, igual que el GRASP).' });
            } else {
                setHealth({ state: 'offline', message: 'Redis: respuesta inesperada del proxy /api/redis/mget.' });
            }
        } catch (requestError) {
            setHealth({ state: 'offline', message: formatNetworkError(requestError, 'Redis') });
        }
    }, []);

    return { health, check };
}

function formatNetworkError(error: unknown, servicio: string): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = typeof error.response?.data === 'string' && error.response.data
            ? error.response.data
            : error.message;
        return status
            ? `${servicio} no disponible (HTTP ${status}): ${detail}`
            : `${servicio} no disponible: ${error.message} (¿dev server / servicio caído?)`;
    }
    return error instanceof Error ? error.message : `${servicio} no disponible.`;
}
