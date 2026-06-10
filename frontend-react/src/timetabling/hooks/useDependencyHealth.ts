/*
 * useDependencyHealth — salud centralizada de las dependencias (Worker/Python/Redis/SQLite),
 * para los chips del topbar (pieza transversal de transparencia §9.4 / fricción §10.3 #10).
 *
 * Antes cada componente reaccionaba por su cuenta; aquí se consolida una sola sonda:
 *   - Python : GET {baseUrl}/health        (vía proxy /py)
 *   - Redis  : POST /api/redis/mget        (sonda directa Vite→Redis, independiente de Python)
 *   - SQLite : GET /api/db/health          (middleware de Vite)
 *   - Worker : motor KDE local (siempre disponible; refleja "en uso" si hay actividad)
 */
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { buildBackendBaseUrl } from './useBackendConfig';

export type DepHealth = 'ok' | 'warn' | 'bad' | 'checking';

export interface DepStatus {
    id: 'worker' | 'python' | 'redis' | 'sqlite';
    label: string;
    sub: string;
    state: DepHealth;
}

const INITIAL: DepStatus[] = [
    { id: 'worker', label: 'KDE', sub: 'motor local', state: 'ok' },
    { id: 'python', label: 'Python', sub: 'sin verificar', state: 'checking' },
    { id: 'redis', label: 'Redis', sub: 'sin verificar', state: 'checking' },
    { id: 'sqlite', label: 'SQL', sub: 'sin verificar', state: 'checking' },
];

export function useDependencyHealth(
    config: BackendConfigDTO,
    opts?: { workerActive?: boolean; intervalMs?: number },
) {
    const [deps, setDeps] = useState<DepStatus[]>(INITIAL);
    const workerActive = opts?.workerActive ?? false;
    const intervalMs = opts?.intervalMs ?? 20000;
    const configRef = useRef(config);
    configRef.current = config;

    const check = useCallback(async () => {
        const base = buildBackendBaseUrl(configRef.current);

        const checkPython = async (): Promise<DepStatus> => {
            try {
                await axios.get(`${base}/health`, { timeout: 2500 });
                return { id: 'python', label: 'Python', sub: 'encontrado', state: 'ok' };
            } catch {
                return { id: 'python', label: 'Python', sub: 'no encontrado', state: 'bad' };
            }
        };

        const checkRedis = async (): Promise<DepStatus> => {
            try {
                const res = await fetch('/api/redis/mget', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys: ['__tt_health__'] }),
                });
                return res.ok
                    ? { id: 'redis', label: 'Redis', sub: 'encontrado', state: 'ok' }
                    : { id: 'redis', label: 'Redis', sub: 'no encontrado', state: 'warn' };
            } catch {
                return { id: 'redis', label: 'Redis', sub: 'no encontrado', state: 'warn' };
            }
        };

        const checkSqlite = async (): Promise<DepStatus> => {
            try {
                const res = await fetch('/api/db/health');
                return res.ok
                    ? { id: 'sqlite', label: 'SQL', sub: 'encontrado', state: 'ok' }
                    : { id: 'sqlite', label: 'SQL', sub: 'no responde', state: 'bad' };
            } catch {
                return { id: 'sqlite', label: 'SQL', sub: 'no responde', state: 'bad' };
            }
        };

        const [python, redis, sqlite] = await Promise.all([checkPython(), checkRedis(), checkSqlite()]);
        setDeps([
            {
                id: 'worker',
                label: 'KDE',
                sub: workerActive ? 'motor en uso' : 'motor local',
                state: 'ok',
            },
            python,
            redis,
            sqlite,
        ]);
    }, [workerActive]);

    useEffect(() => {
        void check();
        if (intervalMs <= 0) return;
        const t = setInterval(() => void check(), intervalMs);
        return () => clearInterval(t);
    }, [check, intervalMs]);

    return { deps, refresh: check };
}
