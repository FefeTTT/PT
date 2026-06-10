import type { Redis } from 'ioredis';

export const ML_CACHE_PATTERNS = [
    'Sijh_*',
    'Sijh:v1:*',
    'Sijh:v2:*',
    'KDE:*',
    'KDE:v1:*',
    'KDE:v2:*',
    'PenaltyObserved:v1:*',
    'PenaltyObserved:v2:*',
    'Penalty_*',
    'Penalty:v2:*',
] as const;

export async function deleteRedisKeysByPattern(
    redis: Redis,
    pattern: string,
    batchSize: number = 500
): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
        cursor = nextCursor;

        if (keys.length > 0) {
            deleted += await redis.del(...keys);
        }
    } while (cursor !== '0');

    return deleted;
}

export async function invalidateMlRedisCaches(
    redis: Redis,
    patterns: readonly string[] = ML_CACHE_PATTERNS
): Promise<number> {
    let deleted = 0;
    for (const pattern of patterns) {
        deleted += await deleteRedisKeysByPattern(redis, pattern);
    }
    return deleted;
}
