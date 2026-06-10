import { describe, it, expect, beforeEach } from 'vitest';
import {
    invalidateStalePenaltyRedisOncePass0,
    resetPass0PenaltyInvalidationForTests,
    STALE_PENALTY_REDIS_PATTERNS,
    type ClearableCache,
} from '../ml/PenaltyPass0Invalidation';

/** Redis falso: SCAN devuelve una pagina por patron, DEL cuenta las claves. */
class FakeRedis {
    public scanCalls: Array<{ match?: string }> = [];
    public deleted: string[] = [];
    public quitCalled = 0;

    constructor(private readonly keysByPattern: Record<string, string[]> = {}) {}

    async scan(_cursor: string | number, ...rest: any[]): Promise<[string, string[]]> {
        // deleteRedisKeysByPattern usa scan(cursor, 'MATCH', pattern, 'COUNT', n) y
        // espera un cursor STRING ('0' = fin). Devolvemos una sola pagina por patron.
        const idx = rest.indexOf('MATCH');
        const match = idx >= 0 ? rest[idx + 1] : undefined;
        this.scanCalls.push({ match });
        const keys = (match && this.keysByPattern[match]) || [];
        return ['0', keys];
    }

    async del(...keys: string[]): Promise<number> {
        this.deleted.push(...keys);
        return keys.length;
    }

    async quit(): Promise<'OK'> {
        this.quitCalled++;
        return 'OK';
    }
}

function fakeCache(): ClearableCache & { cleared: number } {
    return {
        cleared: 0,
        clearCache() {
            this.cleared++;
        },
    };
}

describe('PenaltyPass0Invalidation (pase 0 local)', () => {
    beforeEach(() => {
        resetPass0PenaltyInvalidationForTests();
    });

    it('purga las claves del modelo viejo (v2) y vacia la cache en memoria', async () => {
        const redis = new FakeRedis({
            'Penalty:v2:*': ['Penalty:v2:1', 'Penalty:v2:2'],
            'PenaltyObserved:v2:*': ['PenaltyObserved:v2:abc'],
        });
        const cache = fakeCache();

        const result = await invalidateStalePenaltyRedisOncePass0({
            redisFactory: () => redis as any,
            cache,
        });

        expect(cache.cleared).toBe(1);
        expect(result.attempted).toBe(true);
        expect(result.redisAvailable).toBe(true);
        expect(result.deleted).toBe(3);
        expect(redis.deleted).toEqual(['Penalty:v2:1', 'Penalty:v2:2', 'PenaltyObserved:v2:abc']);
        expect(redis.quitCalled).toBe(1);
        // Cubre ambos patrones del namespace viejo.
        const matched = redis.scanCalls.map(c => c.match);
        for (const pattern of STALE_PENALTY_REDIS_PATTERNS) {
            expect(matched).toContain(pattern);
        }
    });

    it('es idempotente: la purga Redis solo corre una vez por proceso', async () => {
        const redisA = new FakeRedis({ 'Penalty:v2:*': ['Penalty:v2:1'] });
        const cacheA = fakeCache();
        const first = await invalidateStalePenaltyRedisOncePass0({ redisFactory: () => redisA as any, cache: cacheA });
        expect(first.attempted).toBe(true);
        expect(first.deleted).toBe(1);

        // Segunda invocacion (simula otro pase >0 o reentrada): no toca Redis.
        const redisB = new FakeRedis({ 'Penalty:v2:*': ['Penalty:v2:9'] });
        const cacheB = fakeCache();
        const second = await invalidateStalePenaltyRedisOncePass0({ redisFactory: () => redisB as any, cache: cacheB });
        expect(second.attempted).toBe(false);
        expect(second.deleted).toBe(0);
        expect(redisB.deleted).toHaveLength(0);
        // La cache en memoria SIEMPRE se vacia (barato e idempotente).
        expect(cacheB.cleared).toBe(1);
    });

    it('es degradable: si Redis falla, no lanza y reporta no disponible', async () => {
        const cache = fakeCache();
        const result = await invalidateStalePenaltyRedisOncePass0({
            redisFactory: () => {
                throw new Error('ECONNREFUSED');
            },
            cache,
        });
        expect(result.attempted).toBe(true);
        expect(result.redisAvailable).toBe(false);
        expect(result.deleted).toBe(0);
        expect(cache.cleared).toBe(1);
    });
});
