import { describe, it, expect } from 'vitest';
import { PenaltyObservedCache, PenaltyObservedPayload } from '../ml/PenaltyObservedCache';

function payload(overrides: Partial<PenaltyObservedPayload> = {}): PenaltyObservedPayload {
    return {
        eco: '100',
        horario: 'L:08:30-10:00',
        ueas_asignadas_actuales: ['1100001'],
        horarios_asignados_actuales: ['Mi:08:30-10:00'],
        uea_prediccion: '1100002',
        ...overrides
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe('PenaltyObservedCache', () => {
    it('genera keys distintas para payloads con diferente dia-horario', () => {
        const keyLunes = PenaltyObservedCache.keyForPayload(payload({ horario: 'L:08:30-10:00' }));
        const keyMiercoles = PenaltyObservedCache.keyForPayload(payload({ horario: 'Mi:08:30-10:00' }));

        expect(keyLunes).toMatch(/^PenaltyObserved:v3:/);
        expect(keyLunes).not.toBe(keyMiercoles);
    });

    it('canonicaliza payload antes de hashear y enviar HTTP', async () => {
        let payloadEnviado: PenaltyObservedPayload | undefined;
        const cache = new PenaltyObservedCache({
            fetcher: async p => {
                payloadEnviado = p;
                return { total_penalty: 0.1 };
            }
        });

        const desordenado = payload({
            horario: 'Mi:08:30-10:00|L:08:30-10:00|V:08:30-10:00',
            horarios_asignados_actuales: ['08:30-10:00']
        });

        await cache.getOrFetch(desordenado);

        expect(payloadEnviado?.horario).toBe('L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00');
        expect(payloadEnviado?.horarios_asignados_actuales).toEqual([
            'L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00'
        ]);
    });

    it('espera la respuesta ML real antes de resolver un miss', async () => {
        let respond!: (value: { total_penalty: number }) => void;
        const pending = new Promise<{ total_penalty: number }>(resolve => {
            respond = resolve;
        });

        const cache = new PenaltyObservedCache({
            fetcher: () => pending,
            watchdogMs: 1_000
        });

        let resolved = false;
        const promise = cache.getOrFetch(payload()).then(value => {
            resolved = true;
            return value;
        });

        await delay(10);
        expect(resolved).toBe(false);

        respond({ total_penalty: 0.25 });
        await expect(promise).resolves.toBe(0.25);
        expect(resolved).toBe(true);
    });

    it('reintenta y falla duro sin fallback cuando ML no responde validamente', async () => {
        const cache = new PenaltyObservedCache({
            maxAttempts: 2,
            retryBaseDelayMs: 1,
            fetcher: async () => {
                throw new Error('HTTP 500');
            }
        });

        await expect(cache.getOrFetch(payload(), { K: 1, Alpha: 0 })).rejects.toThrow(/failed after 2 attempts/);
        expect(cache.stats().retries).toBe(1);
        expect(cache.stats().errors).toBeGreaterThanOrEqual(1);
    });

    it('limita concurrencia y mantiene las llamadas sobrantes esperando turno', async () => {
        let active = 0;
        let maxActive = 0;

        const cache = new PenaltyObservedCache({
            maxConcurrentFetches: 2,
            fetcher: async p => {
                active++;
                maxActive = Math.max(maxActive, active);
                await delay(15);
                active--;
                return { total_penalty: Number(p.uea_prediccion) / 100 };
            }
        });

        const values = await Promise.all([
            cache.getOrFetch(payload({ uea_prediccion: '1' })),
            cache.getOrFetch(payload({ uea_prediccion: '2' })),
            cache.getOrFetch(payload({ uea_prediccion: '3' })),
            cache.getOrFetch(payload({ uea_prediccion: '4' })),
            cache.getOrFetch(payload({ uea_prediccion: '5' }))
        ]);

        expect(values).toEqual([0.01, 0.02, 0.03, 0.04, 0.05]);
        expect(maxActive).toBeLessThanOrEqual(2);
        expect(cache.stats().queued).toBe(0);
        expect(cache.stats().inFlight).toBe(0);
    });

    it('acota el LRU de entradas resueltas sin descartar requests pendientes', async () => {
        const cache = new PenaltyObservedCache({
            maxEntries: 2,
            fetcher: async p => ({ total_penalty: Number(p.uea_prediccion) })
        });

        await cache.getOrFetch(payload({ uea_prediccion: '1' }));
        await cache.getOrFetch(payload({ uea_prediccion: '2' }));
        await cache.getOrFetch(payload({ uea_prediccion: '3' }));

        expect(cache.stats().cacheSize).toBe(2);

        await cache.getOrFetch(payload({ uea_prediccion: '1' }));
        expect(cache.stats().misses).toBe(4);
    });

    it('clearCache vacia la cache en memoria y fuerza un recomputo (pase 0)', async () => {
        let fetches = 0;
        const cache = new PenaltyObservedCache({
            fetcher: async p => {
                fetches++;
                return { total_penalty: Number(p.uea_prediccion) };
            }
        });

        await cache.getOrFetch(payload({ uea_prediccion: '7' }));
        expect(cache.stats().cacheSize).toBe(1);
        expect(fetches).toBe(1);

        // Un segundo getOrFetch del mismo payload pega a memoria (sin fetch).
        await cache.getOrFetch(payload({ uea_prediccion: '7' }));
        expect(fetches).toBe(1);

        // Tras clearCache (gancho de pase 0), el mismo payload se recomputa.
        cache.clearCache();
        expect(cache.stats().cacheSize).toBe(0);
        await cache.getOrFetch(payload({ uea_prediccion: '7' }));
        expect(fetches).toBe(2);
    });

    it('lee hits exactos desde Redis antes de llamar HTTP', async () => {
        const p = payload({ horario: 'J:08:30-10:00' });
        const key = PenaltyObservedCache.keyForPayload(p);
        const redisData = new Map<string, string>([
            [key, JSON.stringify({ total_penalty: 0.77, load_probability: 0.5 })]
        ]);

        const cache = new PenaltyObservedCache({
            redisClient: {
                get: async (k: string) => redisData.get(k) ?? null,
                set: async () => 'OK'
            } as any,
            fetcher: async () => {
                throw new Error('HTTP should not be called on Redis hit');
            }
        });

        await expect(cache.getOrFetch(p)).resolves.toBe(0.77);
        await expect(cache.getOrFetchResponse(p)).resolves.toMatchObject({ load_probability: 0.5 });
        expect(cache.stats().redisHits).toBe(1);
        expect(cache.stats().requests).toBe(0);
    });

    it('persiste en Redis un miss HTTP exitoso antes de resolver', async () => {
        const writes: Array<{ key: string; value: string }> = [];
        const p = payload({ horario: 'V:08:30-10:00' });

        const cache = new PenaltyObservedCache({
            redisClient: {
                get: async () => null,
                set: async (key: string, value: string) => {
                    writes.push({ key, value });
                    return 'OK';
                }
            } as any,
            fetcher: async () => ({
                total_penalty: 0.42,
                load_probability: 0.8,
                load_probabilities: [1, 0.8],
                load_density_ratio: 0.9,
                load_density_ratios: [1, 0.9],
                projected_uea_count: 3
            })
        });

        await expect(cache.getOrFetch(p)).resolves.toBe(0.42);
        expect(writes).toHaveLength(1);
        expect(writes[0].key).toBe(PenaltyObservedCache.keyForPayload(p));
        expect(JSON.parse(writes[0].value)).toEqual({
            total_penalty: 0.42,
            load_probability: 0.8,
            load_probabilities: [1, 0.8],
            load_density_ratio: 0.9,
            load_density_ratios: [1, 0.9],
            projected_uea_count: 3
        });
        expect(cache.stats().redisWrites).toBe(1);
    });
});
