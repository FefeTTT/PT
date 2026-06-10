import { Redis } from 'ioredis';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { PenaltyPrediction } from './PenaltyCacheManager';

export class ModeloPenaltyCached {
    private cachePenaltyBase = new Map<string, number>(); // key: eco_horario -> total_penalty
    private cacheLoads = new Map<number, number[]>(); // key: eco -> loads[]
    private cacheBest5 = new Map<number, any[]>(); // key: eco -> best_5[]

    private _penalty_mean: number = 0;
    private _penalty_std: number = 1;
    private _statsInicializados: boolean = false;

    public get estadisticosPenalty(): { mean: number; std: number } {
        return { mean: this._penalty_mean, std: this._penalty_std };
    }

    public get tieneEstadisticosPenalty(): boolean {
        return this._statsInicializados;
    }

    /**
     * Carga desde Redis los valores baseline de penalty para el conjunto de profesores y grupos.
     */
    public async inicializar(
        profesores: ProfesorDTO[],
        grupos: GrupoDTO[]
    ): Promise<void> {
        this.cachePenaltyBase.clear();
        this.cacheLoads.clear();
        this.cacheBest5.clear();
        this._statsInicializados = false;

        const redis = new Redis({ host: '127.0.0.1', port: 6379 });
        const redisKeysArr = this._crearRedisKeys(profesores, grupos);
        const chunkSize = 5000;
        const penaltyValues: number[] = [];

        console.log(`ModeloPenaltyCached: Cargando ${redisKeysArr.length} predicciones baseline...`);

        for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
            const chunk = redisKeysArr.slice(i, i + chunkSize);
            const resultados = await redis.mget(...chunk);

            for (let j = 0; j < chunk.length; j++) {
                const res = resultados[j];
                if (!res) continue;

                try {
                    const data: PenaltyPrediction = JSON.parse(res);
                    const keyParts = chunk[j].split('_');
                    const eco = parseInt(keyParts[1]);
                    const horario = keyParts.slice(2).join('_');

                    if (typeof data.total_penalty !== 'number' || !Number.isFinite(data.total_penalty)) {
                        continue;
                    }

                    this.cachePenaltyBase.set(`${eco}_${horario}`, data.total_penalty);
                    penaltyValues.push(data.total_penalty);

                    if (!this.cacheLoads.has(eco)) {
                        this.cacheLoads.set(eco, data.loads);
                        this.cacheBest5.set(eco, data.best_5);
                    }
                } catch (e) {
                    // ignore malformed cache entries
                }
            }
        }

        this._actualizarEstadisticos(penaltyValues);

        await redis.quit();
        console.log(`ModeloPenaltyCached: Inicializacion completada. Memoria: ${this.cachePenaltyBase.size} entradas.`);
    }

    /**
     * Carga solo estadisticos reales desde Redis, sin guardar entradas baseline.
     * Uso recomendado para el elbow observado: normaliza con distribucion real,
     * pero no mantiene el producto eco x horario en el heap de Node.
     */
    public async inicializarEstadisticos(
        profesores: ProfesorDTO[],
        grupos: GrupoDTO[]
    ): Promise<void> {
        this.cachePenaltyBase.clear();
        this.cacheLoads.clear();
        this.cacheBest5.clear();
        this._statsInicializados = false;

        const redis = new Redis({ host: '127.0.0.1', port: 6379 });
        const redisKeysArr = this._crearRedisKeys(profesores, grupos);
        const chunkSize = 5000;
        const penaltyValues: number[] = [];

        console.log(`ModeloPenaltyCached: Cargando estadisticos desde ${redisKeysArr.length} predicciones baseline...`);

        for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
            const chunk = redisKeysArr.slice(i, i + chunkSize);
            const resultados = await redis.mget(...chunk);

            for (const res of resultados) {
                if (!res) continue;

                try {
                    const data: PenaltyPrediction = JSON.parse(res);
                    if (typeof data.total_penalty === 'number' && Number.isFinite(data.total_penalty)) {
                        penaltyValues.push(data.total_penalty);
                    }
                } catch (e) {
                    // ignore malformed cache entries
                }
            }
        }

        this._actualizarEstadisticos(penaltyValues);
        await redis.quit();
    }

    public getPenaltyBase(eco: number, horarioRaw: string): number | null {
        return this.cachePenaltyBase.get(`${eco}_${horarioRaw}`) ?? null;
    }

    public getLoads(eco: number): number[] | null {
        return this.cacheLoads.get(eco) ?? null;
    }

    public getBest5(eco: number): any[] | null {
        return this.cacheBest5.get(eco) ?? null;
    }

    private _crearRedisKeys(profesores: ProfesorDTO[], grupos: GrupoDTO[]): string[] {
        const redisKeysSet = new Set<string>();

        for (const prof of profesores) {
            for (const g of grupos) {
                if (!g.horarioStringRaw) continue;
                const rKey = `Penalty_${prof.numeroEconomico}_${g.horarioStringRaw}`;
                redisKeysSet.add(rKey);
            }
        }

        return Array.from(redisKeysSet);
    }

    private _actualizarEstadisticos(penaltyValues: number[]): void {
        if (penaltyValues.length === 0) {
            throw new Error('ModeloPenaltyCached: no hay predicciones baseline reales para calcular estadisticos.');
        }

        const sum = penaltyValues.reduce((a, b) => a + b, 0);
        this._penalty_mean = sum / penaltyValues.length;
        const sqDiffs = penaltyValues.map(v => (v - this._penalty_mean) ** 2);
        const variance = sqDiffs.reduce((a, b) => a + b, 0) / penaltyValues.length;
        this._penalty_std = Math.sqrt(variance);
        if (this._penalty_std < 1e-9) this._penalty_std = 1.0;
        this._statsInicializados = true;

        console.log(
            `ModeloPenaltyCached: z-score params - mean=${this._penalty_mean.toFixed(4)}, std=${this._penalty_std.toFixed(4)}, n=${penaltyValues.length}`
        );
    }
}
