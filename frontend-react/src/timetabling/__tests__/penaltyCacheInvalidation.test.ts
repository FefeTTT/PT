import { describe, it, expect, beforeEach } from 'vitest';
import {
    invalidateStalePenaltyRedisOnce,
    isPass0PenaltyInvalidationDone,
    resetPass0PenaltyInvalidationForTests,
    STALE_PENALTY_REDIS_PATTERNS,
} from '../engine/kde/penaltyCacheInvalidation';
import { penaltyObservedKey } from '../engine/solution-parity/ml/CacheKeys';
import type { PenaltyObservedPayload } from '../engine/solution-parity/ml/PenaltyObservedCache';

function payload(overrides: Partial<PenaltyObservedPayload> = {}): PenaltyObservedPayload {
    return {
        eco: '19834',
        horario: 'L:08:30-10:00',
        ueas_asignadas_actuales: ['1112022'],
        horarios_asignados_actuales: ['L:08:30-10:00'],
        uea_prediccion: '1112030',
        ...overrides,
    };
}

describe('penaltyCacheInvalidation (pase 0 web)', () => {
    beforeEach(() => {
        resetPass0PenaltyInvalidationForTests();
    });

    it('usa el nuevo namespace v3 para las claves de penalty', () => {
        expect(penaltyObservedKey(payload())).toMatch(/^PenaltyObserved:v3:/);
    });

    it('apunta a los patrones del modelo viejo (v2) para purgar', () => {
        expect(STALE_PENALTY_REDIS_PATTERNS).toContain('Penalty:v2:*');
        expect(STALE_PENALTY_REDIS_PATTERNS).toContain('PenaltyObserved:v2:*');
    });

    it('flushea una sola vez (idempotente) y pases >0 no vuelven a flushear', async () => {
        let calls = 0;
        const fetchImpl = (async () => {
            calls++;
            return {
                ok: true,
                json: async () => ({ available: true, deleted: 7 }),
            } as Response;
        }) as typeof fetch;

        expect(isPass0PenaltyInvalidationDone()).toBe(false);

        const first = await invalidateStalePenaltyRedisOnce('http://localhost:5173', fetchImpl);
        expect(first.attempted).toBe(true);
        expect(first.redisAvailable).toBe(true);
        expect(first.deleted).toBe(7);
        expect(calls).toBe(1);
        expect(isPass0PenaltyInvalidationDone()).toBe(true);

        // Simula pases siguientes (>0): no se vuelve a pegar al backend.
        const second = await invalidateStalePenaltyRedisOnce('http://localhost:5173', fetchImpl);
        const third = await invalidateStalePenaltyRedisOnce('http://localhost:5173', fetchImpl);
        expect(second.attempted).toBe(false);
        expect(third.attempted).toBe(false);
        expect(calls).toBe(1);
    });

    it('es degradable: no lanza si el backend/Redis falla', async () => {
        const fetchImpl = (async () => {
            throw new Error('ECONNREFUSED');
        }) as typeof fetch;

        const result = await invalidateStalePenaltyRedisOnce('http://localhost:5173', fetchImpl);
        expect(result.attempted).toBe(true);
        expect(result.redisAvailable).toBe(false);
        expect(result.deleted).toBe(0);
    });

    it('reporta redis no disponible cuando el backend responde available:false', async () => {
        const fetchImpl = (async () => ({
            ok: true,
            json: async () => ({ available: false, deleted: 0 }),
        } as Response)) as typeof fetch;

        const result = await invalidateStalePenaltyRedisOnce('http://localhost:5173', fetchImpl);
        expect(result.attempted).toBe(true);
        expect(result.redisAvailable).toBe(false);
        expect(result.deleted).toBe(0);
    });
});
