import axios from 'axios';
import type { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import type { PenaltyObservedPayload, PenaltyObservedResponse } from './PenaltyObservedCache';
import { canonicalizeHorario } from './CacheKeys';

export interface BrowserScoreCacheReader {
    get(key: string): Promise<string | null>;
    mget(...keys: string[]): Promise<Array<string | null>>;
    set(key: string, value: string): Promise<void>;
}

export interface WarmupProgress {
    stage: 'sijh_warmup' | 'kde_warmup' | 'penalty_warmup';
    processed: number;
    total: number;
    errors: number;
}

export interface BrowserScoreWarmupOptions {
    baseUrl: string;
    concurrency?: number;
    cleanCache?: boolean;
    onProgress?: (progress: WarmupProgress) => void;
}

export interface ScoreWarmupResult {
    rhatKeys: number;
    kdeKeys: number;
    penaltyKeys: number;
    errors: number;
}

export interface KdeRedisEntry {
    score: number;
    tipo_eco: 'regular' | 'irregular' | string;
}

export interface PenaltyPrediction {
    total_penalty: number;
    loads: number[];
    best_5: Array<{ pattern: string; frequency: number }> | unknown[];
    projected_uea_count?: number;
    load_probability?: number;
    load_probabilities?: number[];
    load_density_ratio?: number;
    load_density_ratios?: number[];
}





export class BrowserScoreCacheStore implements BrowserScoreCacheReader {
    private readonly cache = new Map<string, string>();

    public clear(): void {
        this.cache.clear();
    }

    public async get(key: string): Promise<string | null> {
        return this.cache.get(key) ?? null;
    }

    public async mget(...keys: string[]): Promise<Array<string | null>> {
        try {
            const response = await fetch('/api/redis/mget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys })
            });
            if (response.ok) {
                const results = await response.json();
                return results;
            }
        } catch (e) {
            console.warn('redis proxy failed, falling back to local memory cache', e);
        }
        return keys.map((key) => this.cache.get(key) ?? null);
    }

    public async set(key: string, value: string): Promise<void> {
        this.cache.set(key, value);
    }

    public setSync(key: string, value: string): void {
        this.cache.set(key, value);
    }
}

export async function warmupBrowserScoreCache(
    store: BrowserScoreCacheStore,
    _profesores: ProfesorDTO[],
    _grupos: GrupoDTO[],
    options: BrowserScoreWarmupOptions
): Promise<ScoreWarmupResult> {
    if (options.cleanCache) {
        store.clear();
    }

    // El warmup lento HTTP ha sido desactivado. Ahora se utiliza el proxy de Redis
    // en vite.config.ts para realizar consultas bulk mget directamente.
    options.onProgress?.({ stage: 'sijh_warmup', processed: 100, total: 100, errors: 0 });
    options.onProgress?.({ stage: 'kde_warmup', processed: 100, total: 100, errors: 0 });
    options.onProgress?.({ stage: 'penalty_warmup', processed: 100, total: 100, errors: 0 });

    return {
        rhatKeys: 0,
        kdeKeys: 0,
        penaltyKeys: 0,
        errors: 0,
    };
}

export async function fetchObservedPenalty(
    baseUrl: string,
    payload: PenaltyObservedPayload,
    timeoutMs: number
): Promise<PenaltyObservedResponse> {
    return fetchPenalty(baseUrl, payload, timeoutMs);
}

export function createBaselinePenaltyPayload(eco: number, group: GrupoDTO): PenaltyObservedPayload {
    return {
        eco: String(eco),
        horario: canonicalizeHorario(group.horarioStringRaw),
        ueas_asignadas_actuales: [],
        horarios_asignados_actuales: [],
        uea_prediccion: String(group.ueaClave),
    };
}

export function penaltyWarmupKey(eco: number, horario: string): string {
    // v3: alineado con el bump de namespace del penalty reentrenado (carga = UEAs TOTALES).
    return `Penalty:v3:${eco}:${canonicalizeHorario(horario)}`;
}



async function fetchPenalty(
    baseUrl: string,
    payload: PenaltyObservedPayload,
    timeoutMs = 10_000
): Promise<PenaltyPrediction> {
    const response = await axios.post(`${baseUrl}/get_horario_penalty_finetuned`, payload, { timeout: timeoutMs });
    return {
        total_penalty: readNumber(response.data, ['total_penalty', 'penalty', 'score']),
        loads: Array.isArray(response.data?.loads) ? response.data.loads : [],
        best_5: Array.isArray(response.data?.best_5) ? response.data.best_5 : [],
        projected_uea_count: readOptionalNumber(response.data, ['projected_uea_count']),
        load_probability: readOptionalNumber(response.data, ['load_probability']),
        load_probabilities: readOptionalNumberArray(response.data, 'load_probabilities'),
        load_density_ratio: readOptionalNumber(response.data, ['load_density_ratio']),
        load_density_ratios: readOptionalNumberArray(response.data, 'load_density_ratios'),
    };
}





function readNumber(input: unknown, keys: string[]): number {
    if (!input || typeof input !== 'object') return 0;
    const record = input as Record<string, unknown>;
    for (const key of keys) {
        const value = record[key];
        const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function readOptionalNumber(input: unknown, keys: string[]): number | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const record = input as Record<string, unknown>;
    for (const key of keys) {
        const value = record[key];
        const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function readOptionalNumberArray(input: unknown, key: string): number[] | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const value = (input as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return undefined;
    const numbers = value.filter(item => typeof item === 'number' && Number.isFinite(item));
    return numbers.length === value.length ? numbers : undefined;
}


