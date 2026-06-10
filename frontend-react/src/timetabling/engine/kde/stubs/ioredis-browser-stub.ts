/**
 * Stub funcional de ioredis para el bundle del browser/worker.
 *
 * En Node, `@solution/ml/ModeloPenaltyCached` abre Redis directamente
 * (`new Redis().mget(...)`). En el browser no hay TCP a Redis, pero el dev server
 * de Vite expone un proxy `/api/redis/mget` (ver vite.config.ts) que reenvia el
 * MGET al Redis real (127.0.0.1:6379). Este stub redirige `mget` a ese proxy para
 * que el modelo de penalty pueda cargar sus estadisticos baseline sin cambios.
 *
 * Solo se ejercita cuando penalty esta activo (config.noPenalty === false). Con
 * --no-penalty el modelo nunca se construye y este stub queda inerte.
 *
 * Notas:
 *  - `get` usa el mismo proxy mget (1 key). `set`/`del`/`expire` son no-ops:
 *    el unico consumidor en el worker (PenaltyObservedCache) no inyecta cliente
 *    Redis, asi que nunca escribe.
 *  - URL absoluta basada en el origin del worker para que la peticion la resuelva
 *    el dev server (same-origin => sin CORS).
 */

function redisProxyUrl(): string {
    // `self.location.origin` existe tanto en Window como en WorkerGlobalScope.
    const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
    return `${origin}/api/redis/mget`;
}

async function proxyMget(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const response = await fetch(redisProxyUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
            `[ioredis-stub] /api/redis/mget respondio HTTP ${response.status}${detail ? `: ${detail}` : ''}. ` +
            `Revisa que el dev server alcance Redis (vite.config.ts getRedis()).`,
        );
    }
    return response.json();
}

export class Redis {
    constructor(_opts?: unknown) {
        // No-op: la conexion real vive en el proxy de Vite.
    }

    async mget(...keys: string[]): Promise<Array<string | null>> {
        return proxyMget(keys);
    }

    async get(key: string): Promise<string | null> {
        const [value] = await proxyMget([key]);
        return value ?? null;
    }

    async set(_key: string, _value: string, ..._rest: unknown[]): Promise<'OK'> {
        // No-op en browser: no se persiste a Redis desde el worker.
        return 'OK';
    }

    async del(..._keys: string[]): Promise<number> {
        return 0;
    }

    async expire(_key: string, _seconds: number): Promise<number> {
        return 0;
    }

    async ping(): Promise<'PONG'> {
        return 'PONG';
    }

    async quit(): Promise<'OK'> {
        return 'OK';
    }

    disconnect(): void {
        // No-op.
    }
}

export type RedisOptions = Record<string, unknown>;

export default Redis;
