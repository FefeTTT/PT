/**
 * PenaltyPass0Invalidation.ts
 * ---------------------------
 * Gancho de PASE 0 para el GRASP local (Node): invalida la cache de penalizacion
 * del modelo VIEJO antes de la fase constructiva.
 *
 * El modelo de penalizacion fue reentrenado (carga = UEAs TOTALES asignadas) y el
 * namespace subio de v2 -> v3 (ver CacheKeys.ts / score_loader.py). En el pase 0:
 *   1) vaciamos la cache en memoria del PenaltyObservedCache, y
 *   2) purgamos las claves viejas Penalty:v2 / PenaltyObserved:v2 en Redis,
 * de modo que el pase 0 recompute fresco contra el modelo nuevo y recachee bajo v3.
 *
 * Idempotente: la purga Redis solo se intenta UNA vez por proceso. Degradable: si
 * Redis no esta disponible, NO lanza (el bump v3 ya garantiza correctitud; las v2
 * expiran por TTL).
 */

import { Redis } from 'ioredis';
import { deleteRedisKeysByPattern } from './RedisCacheInvalidation';

/** Patrones de las claves del modelo VIEJO (v2) que el pase 0 debe purgar. */
export const STALE_PENALTY_REDIS_PATTERNS = [
    'Penalty:v2:*',
    'PenaltyObserved:v2:*',
] as const;

/** Interfaz minima que necesita el gancho (compatible con PenaltyObservedCache). */
export interface ClearableCache {
    clearCache(): void;
}

let _pass0Done = false;

/** Reinicia el flag de idempotencia. Uso en tests. */
export function resetPass0PenaltyInvalidationForTests(): void {
    _pass0Done = false;
}

export interface Pass0InvalidationOptions {
    /** Cliente Redis inyectable (default: nuevo Redis local). */
    redisFactory?: () => Redis;
    /** Cache en memoria a vaciar (PenaltyObservedCache). */
    cache?: ClearableCache | null;
}

export interface Pass0InvalidationResult {
    attempted: boolean;
    deleted: number;
    redisAvailable: boolean;
}

/**
 * Ejecuta la invalidacion de pase 0 una sola vez por proceso.
 * - Vacia la cache en memoria (siempre, es barato e idempotente).
 * - Purga las claves v2 en Redis (solo la primera vez; degradable).
 */
export async function invalidateStalePenaltyRedisOncePass0(
    options: Pass0InvalidationOptions = {},
): Promise<Pass0InvalidationResult> {
    options.cache?.clearCache();

    if (_pass0Done) {
        return { attempted: false, deleted: 0, redisAvailable: false };
    }
    _pass0Done = true;

    const factory = options.redisFactory
        ?? (() => new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true, maxRetriesPerRequest: 1 }));

    let redis: Redis | null = null;
    try {
        redis = factory();
        let deleted = 0;
        for (const pattern of STALE_PENALTY_REDIS_PATTERNS) {
            deleted += await deleteRedisKeysByPattern(redis, pattern);
        }
        return { attempted: true, deleted, redisAvailable: true };
    } catch {
        // Redis no disponible: el bump v3 ya cubre la correctitud (las v2 expiran por TTL).
        return { attempted: true, deleted: 0, redisAvailable: false };
    } finally {
        if (redis) {
            try {
                await redis.quit();
            } catch {
                // best-effort
            }
        }
    }
}
