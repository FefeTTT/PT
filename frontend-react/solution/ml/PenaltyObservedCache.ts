import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { canonicalizePenaltyPayload, serializePenaltyPayload } from './CacheKeys';

export interface PenaltyObservedPayload {
    eco: string;
    horario: string;
    ueas_asignadas_actuales: string[];
    horarios_asignados_actuales: string[];
    uea_prediccion: string;
    session_id?: string;
}

export interface PenaltyObservedResponse {
    total_penalty: number;
    loads?: number[];
    best_5?: any[];
    projected_uea_count?: number;
    load_probability?: number;
    load_probabilities?: number[];
    load_density_ratio?: number;
    load_density_ratios?: number[];
}

export interface PenaltyObservedContext {
    [key: string]: unknown;
}

export interface PenaltyObservedCacheOptions {
    baseUrl?: string;
    maxEntries?: number;
    maxConcurrentFetches?: number;
    requestTimeoutMs?: number;
    maxAttempts?: number;
    retryBaseDelayMs?: number;
    watchdogMs?: number;
    redis?: RedisOptions;
    redisClient?: Redis;
    redisKeyTtlSeconds?: number;
    batchSize?: number;
    fetcher?: (payload: PenaltyObservedPayload, timeoutMs: number) => Promise<PenaltyObservedResponse>;
}

export interface PenaltyObservedCacheStats {
    hits: number;
    memoryHits: number;
    redisHits: number;
    misses: number;
    redisMisses: number;
    redisWrites: number;
    requests: number;
    retries: number;
    errors: number;
    completed: number;
    cacheSize: number;
    queued: number;
    inFlight: number;
    lastCompletionAt: number;
}

interface QueueTask {
    key: string;
    payload: PenaltyObservedPayload;
    context?: PenaltyObservedContext;
    resolve: (value: PenaltyObservedResponse) => void;
    reject: (error: unknown) => void;
}

export class PenaltyObservedCacheError extends Error {
    constructor(
        message: string,
        public readonly key: string,
        public readonly context?: PenaltyObservedContext,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'PenaltyObservedCacheError';
    }
}

export class PenaltyObservedWatchdogError extends PenaltyObservedCacheError {
    constructor(
        message: string,
        key: string,
        context?: PenaltyObservedContext
    ) {
        super(message, key, context);
        this.name = 'PenaltyObservedWatchdogError';
    }
}

export class PenaltyObservedCache {
    private readonly _axiosClient: AxiosInstance;
    private readonly _fetcher: (payload: PenaltyObservedPayload, timeoutMs: number) => Promise<PenaltyObservedResponse>;
    private readonly _maxEntries: number;
    private readonly _maxConcurrentFetches: number;
    private readonly _requestTimeoutMs: number;
    private readonly _maxAttempts: number;
    private readonly _retryBaseDelayMs: number;
    private readonly _watchdogMs: number;
    private readonly _redis?: Redis;
    private readonly _ownsRedis: boolean;
    private readonly _redisKeyTtlSeconds?: number;

    private readonly _cache = new Map<string, PenaltyObservedResponse>();
    private readonly _queue: QueueTask[] = [];
    private readonly _pendingRejects = new Set<(error: unknown) => void>();

    private readonly _batchSize: number;
    private _batchFlushScheduled = false;

    private _inFlight = 0;
    private _abortedError: unknown = null;
    private _lastCompletionAt = Date.now();

    private _hits = 0;
    private _memoryHits = 0;
    private _redisHits = 0;
    private _misses = 0;
    private _redisMisses = 0;
    private _redisWrites = 0;
    private _requests = 0;
    private _retries = 0;
    private _errors = 0;
    private _completed = 0;

    constructor(options: PenaltyObservedCacheOptions = {}) {
        this._maxEntries = options.maxEntries ?? 50_000;
        this._maxConcurrentFetches = options.maxConcurrentFetches ?? 8;
        this._requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
        this._maxAttempts = options.maxAttempts ?? 3;
        this._retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
        this._watchdogMs = options.watchdogMs ?? 120_000;
        this._batchSize = options.batchSize ?? 1;
        this._redisKeyTtlSeconds = options.redisKeyTtlSeconds;

        this._axiosClient = axios.create({
            baseURL: options.baseUrl ?? 'http://127.0.0.1:8000',
            timeout: this._requestTimeoutMs
        });

        this._fetcher = options.fetcher ?? (async (payload, timeoutMs) => {
            const response = await this._axiosClient.post<PenaltyObservedResponse>(
                '/get_horario_penalty_finetuned',
                payload,
                { timeout: timeoutMs }
            );
            return response.data;
        });

        if (options.redisClient) {
            this._redis = options.redisClient;
            this._ownsRedis = false;
        } else if (options.redis) {
            this._redis = new Redis({
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                connectTimeout: 5_000,
                ...options.redis
            });
            this._ownsRedis = true;
        } else {
            this._ownsRedis = false;
        }
    }

    public static keyForPayload(payload: PenaltyObservedPayload): string {
        // v3: penalty reentrenado (carga = UEAs TOTALES); orfana las entradas v2.
        return `PenaltyObserved:v3:${createHash('sha1').update(this.serializePayload(payload)).digest('hex')}`;
    }

    public static serializePayload(payload: PenaltyObservedPayload): string {
        return serializePenaltyPayload(payload);
    }

    public async getOrFetch(payload: PenaltyObservedPayload, context?: PenaltyObservedContext): Promise<number> {
        const response = await this.getOrFetchResponse(payload, context);
        return response.total_penalty;
    }

    public async getOrFetchResponse(
        payload: PenaltyObservedPayload,
        context?: PenaltyObservedContext
    ): Promise<PenaltyObservedResponse> {
        if (this._abortedError) {
            throw this._abortedError;
        }

        const canonicalPayload = canonicalizePenaltyPayload(payload);
        const key = PenaltyObservedCache.keyForPayload(canonicalPayload);
        const cached = this._getFromCache(key);
        if (cached !== undefined) {
            this._hits++;
            this._memoryHits++;
            return cached;
        }

        const redisCached = await this._getFromRedis(key, context);
        if (redisCached !== undefined) {
            this._hits++;
            this._redisHits++;
            this._setCache(key, redisCached);
            return redisCached;
        }

        this._misses++;

        const taskPromise = new Promise<PenaltyObservedResponse>((resolve, reject) => {
            const trackedReject = (error: unknown) => {
                this._pendingRejects.delete(trackedReject);
                reject(error);
            };
            this._pendingRejects.add(trackedReject);
            this._queue.push({
                key,
                payload: canonicalPayload,
                context,
                resolve: value => {
                    this._pendingRejects.delete(trackedReject);
                    resolve(value);
                },
                reject: trackedReject
            });
            this._pumpQueue();
        });

        return this._withWatchdog(taskPromise, key, context);
    }

    public async waitForIdle(context?: PenaltyObservedContext): Promise<void> {
        if (this._abortedError) {
            throw this._abortedError;
        }

        while (this._queue.length > 0 || this._inFlight > 0) {
            await this._withWatchdog(this._delay(50), 'PenaltyObserved:idle', context);
            if (this._abortedError) {
                throw this._abortedError;
            }
        }
    }

    public async close(): Promise<void> {
        if (this._redis && this._ownsRedis) {
            await this._redis.quit();
        }
    }

    /**
     * Vacia la cache en memoria de penalizaciones. Se invoca en el pase 0 del GRASP
     * para descartar cualquier valor del modelo viejo y recomputar contra el nuevo.
     * No toca Redis (eso lo hace invalidateMlRedisCaches / el flush del backend).
     */
    public clearCache(): void {
        this._cache.clear();
    }

    public stats(): PenaltyObservedCacheStats {
        return {
            hits: this._hits,
            memoryHits: this._memoryHits,
            redisHits: this._redisHits,
            misses: this._misses,
            redisMisses: this._redisMisses,
            redisWrites: this._redisWrites,
            requests: this._requests,
            retries: this._retries,
            errors: this._errors,
            completed: this._completed,
            cacheSize: this._cache.size,
            queued: this._queue.length,
            inFlight: this._inFlight,
            lastCompletionAt: this._lastCompletionAt
        };
    }

    private _getFromCache(key: string): PenaltyObservedResponse | undefined {
        const value = this._cache.get(key);
        if (value === undefined) return undefined;

        this._cache.delete(key);
        this._cache.set(key, value);
        return this._cloneResponse(value);
    }

    private _setCache(key: string, value: PenaltyObservedResponse): void {
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }
        this._cache.set(key, this._cloneResponse(value));

        while (this._cache.size > this._maxEntries) {
            const oldest = this._cache.keys().next().value;
            if (oldest === undefined) break;
            this._cache.delete(oldest);
        }
    }

    private _pumpQueue(): void {
        if (this._abortedError || this._queue.length === 0) return;

        if (this._batchSize > 1) {
            if (!this._batchFlushScheduled) {
                this._batchFlushScheduled = true;
                setTimeout(() => this._flushBatches(), 15);
            }
            return;
        }

        while (this._inFlight < this._maxConcurrentFetches && this._queue.length > 0) {
            const task = this._queue.shift()!;
            this._runTask(task);
        }
    }

    private _runTask(task: QueueTask): void {
        this._inFlight++;

        // Inject session_id from context if available
        if (task.context && typeof task.context.fase === 'string') {
            task.payload.session_id = task.context.fase;
        }

        this._fetchWithRetries(task)
            .then(async value => {
                if (this._abortedError) return;
                await this._writeToRedis(task.key, value, task.context);
                this._setCache(task.key, value);
                task.resolve(value);
            })
            .catch(error => {
                const wrapped = error instanceof PenaltyObservedCacheError
                    ? error
                    : new PenaltyObservedCacheError(
                        `Penalty ML fetch failed for ${task.key}: ${this._errorMessage(error)}`,
                        task.key,
                        task.context,
                        error
                    );
                this._errors++;
                this._failHard(wrapped);
                task.reject(wrapped);
            })
            .finally(() => {
                this._inFlight--;
                this._pumpQueue();
            });
    }

    private _flushBatches(): void {
        this._batchFlushScheduled = false;

        while (!this._abortedError && this._inFlight < this._maxConcurrentFetches && this._queue.length > 0) {
            const chunk = this._queue.splice(0, this._batchSize);
            if (chunk.length === 1) {
                this._runTask(chunk[0]);
            } else {
                this._runBatch(chunk);
            }
        }
    }

    private _runBatch(tasks: QueueTask[]): void {
        this._inFlight++;

        const items = tasks.map(t => {
            const base = JSON.parse(PenaltyObservedCache.serializePayload(t.payload));
            base.id = t.key;
            return base;
        });

        const sessionId = (tasks[0]?.context?.fase as string) ?? undefined;

        this._fetchBatchWithRetries(items, sessionId)
            .then(async (batchResponse) => {
                if (this._abortedError) return;

                const resultMap = new Map<string, PenaltyObservedResponse>();
                for (const r of (batchResponse.results || [])) {
                    const normalized = this._normalizeResponse(r);
                    if (normalized) resultMap.set(r.id, normalized);
                }

                const errorMap = new Map<string, string>();
                for (const e of (batchResponse.errors || [])) {
                    errorMap.set(e.id, e.error);
                }

                for (const task of tasks) {
                    const result = resultMap.get(task.key);
                    if (result) {
                        await this._writeToRedis(task.key, result, task.context);
                        this._setCache(task.key, result);
                        task.resolve(result);
                    } else {
                        const errorMsg = errorMap.get(task.key) || 'Item not found in batch response';
                        const err = new PenaltyObservedCacheError(
                            `Batch item failed for ${task.key}: ${errorMsg}`,
                            task.key,
                            task.context
                        );
                        this._errors++;
                        task.reject(err);
                    }
                }
            })
            .catch(error => {
                const wrapped = error instanceof PenaltyObservedCacheError
                    ? error
                    : new PenaltyObservedCacheError(
                        `Penalty ML batch fetch failed: ${this._errorMessage(error)}`,
                        'batch',
                        tasks[0]?.context,
                        error
                    );
                this._errors++;
                this._failHard(wrapped);
                for (const task of tasks) {
                    task.reject(wrapped);
                }
            })
            .finally(() => {
                this._inFlight--;
                this._pumpQueue();
            });
    }

    private async _fetchBatchWithRetries(
        items: any[],
        sessionId?: string
    ): Promise<{ results: any[]; errors: any[] }> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= this._maxAttempts; attempt++) {
            this._requests++;
            try {
                const body: any = { items };
                if (sessionId) body.session_id = sessionId;

                const response = await this._axiosClient.post(
                    '/get_horario_penalty_finetuned_batch',
                    body,
                    { timeout: this._requestTimeoutMs * Math.max(2, Math.ceil(items.length / 16)) }
                );

                this._completed++;
                this._lastCompletionAt = Date.now();
                return response.data;
            } catch (error) {
                lastError = error;
                if (attempt < this._maxAttempts) {
                    this._retries++;
                    await this._delay(this._retryBaseDelayMs * attempt);
                }
            }
        }

        throw new PenaltyObservedCacheError(
            `Penalty ML batch fetch failed after ${this._maxAttempts} attempts: ${this._errorMessage(lastError)}`,
            'batch',
            undefined,
            lastError
        );
    }

    private async _fetchWithRetries(task: QueueTask): Promise<PenaltyObservedResponse> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= this._maxAttempts; attempt++) {
            this._requests++;
            try {
                const response = await this._fetcher(task.payload, this._requestTimeoutMs);
                const normalized = this._normalizeResponse(response);
                if (!normalized) {
                    throw new Error('Invalid ML response: total_penalty must be a finite number');
                }

                this._completed++;
                this._lastCompletionAt = Date.now();
                return normalized;
            } catch (error) {
                lastError = error;
                if (attempt < this._maxAttempts) {
                    this._retries++;
                    await this._delay(this._retryBaseDelayMs * attempt);
                }
            }
        }

        throw new PenaltyObservedCacheError(
            `Penalty ML fetch failed after ${this._maxAttempts} attempts for ${task.key}: ${this._errorMessage(lastError)}`,
            task.key,
            task.context,
            lastError
        );
    }

    private async _getFromRedis(
        key: string,
        context?: PenaltyObservedContext
    ): Promise<PenaltyObservedResponse | undefined> {
        if (!this._redis) return undefined;

        try {
            const raw = await this._redis.get(key);
            if (raw === null) {
                this._redisMisses++;
                return undefined;
            }

            const parsed = this._parseRedisValue(raw);
            if (parsed === undefined) {
                throw new Error(`Invalid Redis value for ${key}: total_penalty must be finite`);
            }

            return parsed;
        } catch (error) {
            const wrapped = new PenaltyObservedCacheError(
                `Penalty observed Redis read failed for ${key}: ${this._errorMessage(error)}`,
                key,
                context,
                error
            );
            this._errors++;
            this._failHard(wrapped);
            throw wrapped;
        }
    }

    private async _writeToRedis(
        key: string,
        value: PenaltyObservedResponse,
        context?: PenaltyObservedContext
    ): Promise<void> {
        if (!this._redis) return;

        try {
            const serialized = JSON.stringify(value);
            if (this._redisKeyTtlSeconds && this._redisKeyTtlSeconds > 0) {
                await this._redis.set(key, serialized, 'EX', this._redisKeyTtlSeconds);
            } else {
                await this._redis.set(key, serialized);
            }
            this._redisWrites++;
        } catch (error) {
            const wrapped = new PenaltyObservedCacheError(
                `Penalty observed Redis write failed for ${key}: ${this._errorMessage(error)}`,
                key,
                context,
                error
            );
            this._errors++;
            this._failHard(wrapped);
            throw wrapped;
        }
    }

    private _parseRedisValue(raw: string): PenaltyObservedResponse | undefined {
        const asNumber = Number(raw);
        if (Number.isFinite(asNumber)) return { total_penalty: asNumber };

        try {
            return this._normalizeResponse(JSON.parse(raw));
        } catch (e) {
            return undefined;
        }

        return undefined;
    }

    private _normalizeResponse(value: unknown): PenaltyObservedResponse | undefined {
        if (!value || typeof value !== 'object') return undefined;

        const candidate = value as {
            total_penalty?: unknown;
            loads?: unknown;
            best_5?: unknown;
            projected_uea_count?: unknown;
            load_probability?: unknown;
            load_probabilities?: unknown;
            load_density_ratio?: unknown;
            load_density_ratios?: unknown;
        };

        if (typeof candidate.total_penalty !== 'number' || !Number.isFinite(candidate.total_penalty)) {
            return undefined;
        }

        const normalized: PenaltyObservedResponse = {
            total_penalty: candidate.total_penalty
        };

        if (Array.isArray(candidate.loads)) {
            const loads = candidate.loads.filter(v => typeof v === 'number' && Number.isFinite(v));
            if (loads.length === candidate.loads.length) {
                normalized.loads = loads;
            }
        }

        if (Array.isArray(candidate.best_5)) {
            normalized.best_5 = candidate.best_5;
        }

        if (typeof candidate.projected_uea_count === 'number' && Number.isFinite(candidate.projected_uea_count)) {
            normalized.projected_uea_count = candidate.projected_uea_count;
        }

        if (typeof candidate.load_probability === 'number' && Number.isFinite(candidate.load_probability)) {
            normalized.load_probability = candidate.load_probability;
        }

        if (typeof candidate.load_density_ratio === 'number' && Number.isFinite(candidate.load_density_ratio)) {
            normalized.load_density_ratio = candidate.load_density_ratio;
        }

        if (Array.isArray(candidate.load_probabilities)) {
            const values = candidate.load_probabilities.filter(v => typeof v === 'number' && Number.isFinite(v));
            if (values.length === candidate.load_probabilities.length) {
                normalized.load_probabilities = values;
            }
        }

        if (Array.isArray(candidate.load_density_ratios)) {
            const values = candidate.load_density_ratios.filter(v => typeof v === 'number' && Number.isFinite(v));
            if (values.length === candidate.load_density_ratios.length) {
                normalized.load_density_ratios = values;
            }
        }

        return normalized;
    }

    private _cloneResponse(value: PenaltyObservedResponse): PenaltyObservedResponse {
        return {
            total_penalty: value.total_penalty,
            loads: value.loads ? [...value.loads] : undefined,
            best_5: value.best_5 ? [...value.best_5] : undefined,
            projected_uea_count: value.projected_uea_count,
            load_probability: value.load_probability,
            load_probabilities: value.load_probabilities ? [...value.load_probabilities] : undefined,
            load_density_ratio: value.load_density_ratio,
            load_density_ratios: value.load_density_ratios ? [...value.load_density_ratios] : undefined
        };
    }

    private async _withWatchdog<T>(promise: Promise<T>, key: string, context?: PenaltyObservedContext): Promise<T> {
        let timer: ReturnType<typeof setInterval> | null = null;

        const watchdog = new Promise<never>((_resolve, reject) => {
            timer = setInterval(() => {
                if (this._queue.length === 0 && this._inFlight === 0) return;

                const idleMs = Date.now() - this._lastCompletionAt;
                if (idleMs >= this._watchdogMs) {
                    const error = new PenaltyObservedWatchdogError(
                        `Penalty ML watchdog exceeded ${this._watchdogMs}ms without a completed request`,
                        key,
                        context
                    );
                    this._errors++;
                    this._failHard(error);
                    reject(error);
                }
            }, Math.min(1_000, Math.max(50, this._watchdogMs / 10)));
        });

        try {
            return await Promise.race([promise, watchdog]);
        } finally {
            if (timer) {
                clearInterval(timer);
            }
        }
    }

    private _failHard(error: unknown): void {
        if (this._abortedError) return;

        this._abortedError = error;
        while (this._queue.length > 0) {
            const task = this._queue.shift()!;
            task.reject(error);
        }

        for (const reject of Array.from(this._pendingRejects)) {
            reject(error);
        }
        this._pendingRejects.clear();
    }

    private _delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private _errorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        return String(error);
    }
}
