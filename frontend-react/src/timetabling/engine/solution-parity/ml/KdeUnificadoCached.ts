import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import type { BrowserScoreCacheReader, KdeRedisEntry } from './BrowserScoreCache';
import { canonicalizeHorario, kdeKey } from './CacheKeys';

/**
 * KdeUnificadoCached — Modelo KDE Unificado cacheado en memoria para el GRASP.
 *
 * Carga bulk desde Redis las predicciones KDE y las mantiene en un Map<string, number>
 * para O(1) lookup durante la ejecución del GRASP.
 *
 * Incluye normalización z-score con sigmoid para mapear a [0, 1] y diagnósticos
 * de contraste entre candidatos.
 */
export class KdeUnificadoCached {
    /** key: "eco_horario" → score KDE crudo */
    private cacheInterna = new Map<string, number>();

    /** Estadísticos z-score para normalización */
    private _kde_mean: number = 0;
    private _kde_std: number = 1;
    private _inicializado: boolean = false;

    /** Diagnóstico de contraste */
    private _min_score: number = Infinity;
    private _max_score: number = -Infinity;
    private _count: number = 0;
    private readonly _cacheReader: BrowserScoreCacheReader;

    constructor(cacheReader: BrowserScoreCacheReader) {
        this._cacheReader = cacheReader;
    }

    public get estadisticosKde(): { mean: number; std: number } {
        return { mean: this._kde_mean, std: this._kde_std };
    }

    public get tieneEstadisticos(): boolean {
        return this._inicializado;
    }

    public get totalKdeScores(): number {
        return this._count;
    }

    /**
     * Carga masiva desde Redis. Lee todas las keys KDE:{eco}:{horario}
     * para el producto cartesiano de profesores × franjas de grupos.
     *
     * @throws Error si no se encuentran predicciones KDE en Redis.
     */
    public async inicializar(
        profesores: ProfesorDTO[],
        grupos: GrupoDTO[]
    ): Promise<void> {
        this.cacheInterna.clear();
        this._inicializado = false;
        this._min_score = Infinity;
        this._max_score = -Infinity;
        this._count = 0;

        // Construir keys únicas KDE:{eco}:{franja}
        const redisKeysSet = new Set<string>();
        for (const prof of profesores) {
            for (const g of grupos) {
                if (!g.horarioStringRaw) continue;
                try {
                    redisKeysSet.add(kdeKey(prof.numeroEconomico, g.horarioStringRaw));
                } catch {
                    continue;
                }
            }
        }

        const redisKeysArr = Array.from(redisKeysSet);
        const chunkSize = 5000;
        const kdeValues: number[] = [];

        console.log(`KdeUnificadoCached: Iniciando Bulk Load MGET desde cache browser para ${redisKeysArr.length} keys KDE...`);

        let keysEncontradas = 0;

        for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
            const chunk = redisKeysArr.slice(i, i + chunkSize);
            const resultados = await this._cacheReader.mget(...chunk);

            for (let j = 0; j < chunk.length; j++) {
                const redisRes = resultados[j];
                const key = chunk[j];

                const parsedKey = key.match(/^KDE(?::v\d+)?:([^:]+):(.+)$/);
                if (!parsedKey) continue;
                const eco = parsedKey[1];
                const horario = parsedKey[2];
                const cacheKey = `${eco}_${horario}`;

                if (redisRes) {
                    try {
                        const parsed: KdeRedisEntry = JSON.parse(redisRes);
                        const score = parsed.score;
                        this.cacheInterna.set(cacheKey, score);
                        kdeValues.push(score);
                        keysEncontradas++;

                        if (score < this._min_score) this._min_score = score;
                        if (score > this._max_score) this._max_score = score;
                    } catch (e) {
                        // Ignore malformed entries
                    }
                }
            }
        }

        if (kdeValues.length === 0) {
            throw new Error(
                'KdeUnificadoCached: No se encontraron predicciones KDE en cache browser. ' +
                'Asegúrese de ejecutar el warmup de KDE (KdeCacheManager) antes de inicializar el modelo.'
            );
        }

        // Calcular estadísticos z-score
        const sum = kdeValues.reduce((a, b) => a + b, 0);
        this._kde_mean = sum / kdeValues.length;
        const sqDiffs = kdeValues.map(v => (v - this._kde_mean) ** 2);
        const variance = sqDiffs.reduce((a, b) => a + b, 0) / kdeValues.length;
        this._kde_std = Math.sqrt(variance);
        if (this._kde_std < 1e-9) this._kde_std = 1.0;
        this._count = kdeValues.length;
        this._inicializado = true;

        console.log(
            `KdeUnificadoCached: z-score params — μ_kde=${this._kde_mean.toFixed(4)}, ` +
            `σ_kde=${this._kde_std.toFixed(4)}, n=${kdeValues.length}`
        );
        console.log(
            `KdeUnificadoCached: rango de scores — min=${this._min_score.toFixed(4)}, ` +
            `max=${this._max_score.toFixed(4)}, rango=${(this._max_score - this._min_score).toFixed(4)}`
        );

        // Diagnóstico de contraste
        this._diagnosticarContraste(kdeValues);

        console.log(
            `KdeUnificadoCached: Inicialización completada. ` +
            `${keysEncontradas} scores cargados de ${redisKeysArr.length} keys consultadas.`
        );
    }

    /**
     * Retorna el score KDE crudo para un par (eco, horarioRaw).
     * El horarioRaw debe ser una franja individual: Dia:HH:MM-HH:MM.
     *
     * @returns score crudo o null si no existe.
     */
    public getKdeScore(eco: number, horarioRaw: string): number | null {
        try {
            return this.cacheInterna.get(`${eco}_${canonicalizeHorario(horarioRaw)}`) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Normaliza un score KDE crudo via sigmoid(z-score) → [0, 1].
     *
     * @throws Error si no hay estadísticos inicializados.
     */
    public normalizarKde(scoreRaw: number): number {
        if (!this._inicializado) {
            throw new Error('KdeUnificadoCached: No hay estadísticos para normalizar. Ejecute inicializar() primero.');
        }

        const z = (scoreRaw - this._kde_mean) / this._kde_std;
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /**
     * Diagnóstico de contraste entre candidatos.
     * Detecta si la normalización z-score produce demasiada compresión.
     */
    private _diagnosticarContraste(values: number[]): void {
        if (values.length < 2) return;

        const rango = this._max_score - this._min_score;
        const coefVariacion = this._kde_std / Math.abs(this._kde_mean || 1);

        // Normalizar extremos para ver el rango efectivo post-sigmoid
        const normMin = this.normalizarKde(this._min_score);
        const normMax = this.normalizarKde(this._max_score);
        const rangoNormalizado = normMax - normMin;

        console.log(
            `KdeUnificadoCached: diagnóstico de contraste — ` +
            `CV=${coefVariacion.toFixed(4)}, ` +
            `rango_crudo=${rango.toFixed(4)}, ` +
            `rango_normalizado=[${normMin.toFixed(4)}, ${normMax.toFixed(4)}] (Δ=${rangoNormalizado.toFixed(4)})`
        );

        // Alertas de compresión
        if (rangoNormalizado < 0.15) {
            console.warn(
                `⚠️  KdeUnificadoCached: BAJO CONTRASTE DETECTADO — El rango normalizado (${rangoNormalizado.toFixed(4)}) ` +
                `es menor a 0.15. La normalización z-score+sigmoid está comprimiendo demasiado los scores. ` +
                `Esto puede reducir la discriminación entre candidatos en el GRASP. ` +
                `Considere ajustar los parámetros del modelo KDE o la estrategia de normalización.`
            );
        }

        if (rangoNormalizado < 0.30) {
            console.log(
                `KdeUnificadoCached: ⚡ Contraste moderado (Δ=${rangoNormalizado.toFixed(4)}). ` +
                `Los scores normalizados tienen una discriminación aceptable pero limitada.`
            );
        }

        // Percentiles para información adicional
        const sorted = [...values].sort((a, b) => a - b);
        const p10 = sorted[Math.floor(sorted.length * 0.10)];
        const p50 = sorted[Math.floor(sorted.length * 0.50)];
        const p90 = sorted[Math.floor(sorted.length * 0.90)];

        console.log(
            `KdeUnificadoCached: percentiles — P10=${p10.toFixed(4)}, ` +
            `P50=${p50.toFixed(4)}, P90=${p90.toFixed(4)}, ` +
            `norm(P10)=${this.normalizarKde(p10).toFixed(4)}, ` +
            `norm(P50)=${this.normalizarKde(p50).toFixed(4)}, ` +
            `norm(P90)=${this.normalizarKde(p90).toFixed(4)}`
        );
    }
}
