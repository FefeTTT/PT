/**
 * penaltyCacheInvalidation.ts
 * ---------------------------
 * Invalidacion de la cache de penalizacion al iniciar el PASE 0 del GRASP web.
 *
 * Contexto: el modelo de penalizacion fue reentrenado/re-finetuneado (cambio la
 * semantica de "carga" = UEAs TOTALES asignadas). El namespace de la cache subio
 * de v2 -> v3 (ver score_loader.py / CacheKeys.ts), por lo que las entradas viejas
 * quedan huerfanas y expiran por TTL. Aun asi, en el pase 0 disparamos una limpieza
 * explicita de las claves Penalty:v2:* / PenaltyObserved:v2:* en Redis para no
 * arrastrar basura, y vaciamos cualquier cache en memoria persistida en el cliente.
 *
 * Idempotencia: `markPass0PenaltyInvalidationDone` garantiza que la limpieza Redis
 * solo se intenta UNA vez por proceso/sesion. Pases > 0 reutilizan la cache v3 ya
 * regenerada (no se vuelve a limpiar).
 */

/** Patrones de las claves del modelo VIEJO (v2) que el pase 0 debe purgar. */
export const STALE_PENALTY_REDIS_PATTERNS = [
    'Penalty:v2:*',
    'PenaltyObserved:v2:*',
] as const;

let _pass0RedisFlushDone = false;

/** Reinicia el flag de idempotencia. Uso en tests. */
export function resetPass0PenaltyInvalidationForTests(): void {
    _pass0RedisFlushDone = false;
}

/** True si el flush Redis del pase 0 ya se ejecuto en este proceso/sesion. */
export function isPass0PenaltyInvalidationDone(): boolean {
    return _pass0RedisFlushDone;
}

export interface Pass0PenaltyInvalidationResult {
    /** Se ejecuto la peticion de flush (false si ya se habia hecho antes). */
    attempted: boolean;
    /** El backend reporto Redis disponible. */
    redisAvailable: boolean;
    /** Numero de claves viejas eliminadas (0 si Redis no estaba disponible). */
    deleted: number;
}

interface FlushResponse {
    available?: boolean;
    deleted?: number;
}

/**
 * Dispara el flush de las claves Penalty:v2 / PenaltyObserved:v2 en Redis a traves
 * del endpoint backend `/admin/penalty/flush_cache` (proxied como `/py/...` por Vite).
 *
 * - Idempotente: solo la PRIMERA invocacion realmente pega al backend.
 * - Degradable: si Redis no esta disponible (available:false) o la peticion falla,
 *   NO lanza; el bump de namespace v3 ya garantiza correctitud (las v2 expiran por TTL).
 *
 * @param origin  origin del worker/ventana (self.location.origin).
 * @param fetchImpl  inyectable para tests (default global fetch).
 */
export async function invalidateStalePenaltyRedisOnce(
    origin: string,
    fetchImpl: typeof fetch = fetch,
): Promise<Pass0PenaltyInvalidationResult> {
    if (_pass0RedisFlushDone) {
        return { attempted: false, redisAvailable: false, deleted: 0 };
    }
    _pass0RedisFlushDone = true;

    const url = `${origin}/py/admin/penalty/flush_cache`;
    try {
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patterns: STALE_PENALTY_REDIS_PATTERNS }),
        });
        if (!response.ok) {
            return { attempted: true, redisAvailable: false, deleted: 0 };
        }
        const data = (await response.json()) as FlushResponse;
        return {
            attempted: true,
            redisAvailable: Boolean(data?.available),
            deleted: typeof data?.deleted === 'number' ? data.deleted : 0,
        };
    } catch {
        // Redis/back no disponible en dev: el bump v3 ya cubre la correctitud.
        return { attempted: true, redisAvailable: false, deleted: 0 };
    }
}
