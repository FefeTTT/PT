import { IModeloML } from './IModeloML';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { KdeUnificadoCached } from './KdeUnificadoCached';
import type { BrowserScoreCacheReader } from './BrowserScoreCache';
import { canonicalizeHorario, sijhKey } from './CacheKeys';

export interface SijhValores {
    rhat: number;
    h_ih: number;
}

export class ModeloSijhCached implements IModeloML {
    private cacheInternaGRASP = new Map<string, SijhValores>();
    private gruposDict = new Map<number, GrupoDTO>();

    private _lambda_j: number;
    private _lambda_ih: number;

    private _cacheReader: BrowserScoreCacheReader;

    constructor(
        lambda_j: number = 1.0,
        lambda_ih: number = 1.0,
        _legacyKdeCached?: KdeUnificadoCached,
        cacheReader?: BrowserScoreCacheReader
    ) {
        this._lambda_j = lambda_j;
        this._lambda_ih = lambda_ih;
        this._cacheReader = cacheReader!;
    }

    /**
     * Inicializa el modelo cargando rhat desde Redis.
     * El cache key sigue siendo Sijh_{eco}_{uea}_{franja} para compatibilidad,
     * pero solo almacena rhat (h_ih ha sido reemplazado por KDE).
     */
    public async inicializar(
        profesores: ProfesorDTO[],
        grupos: GrupoDTO[],
        refrescarCacheDePython: boolean = false
    ): Promise<void> {
        this.cacheInternaGRASP.clear();
        this.gruposDict.clear();
        for (const g of grupos) {
            this.gruposDict.set(g.idUeaGrupo, g);
        }

        if (refrescarCacheDePython) {
            console.log("Se requirió repoblar Redis explícitamente desde Python. Ejecutando SijhCacheManager...");
        }

        console.log(`ModeloSijhCached: Iniciando Bulk Load MGET desde cache browser para Sijh:v2 semanal...`);
        const redisKeysSet: Set<string> = new Set();

        for (const prof of profesores) {
            for (const g of grupos) {
                if (!g.horarioStringRaw) continue;
                try {
                    redisKeysSet.add(sijhKey(prof.numeroEconomico, g.ueaClave, g.horarioStringRaw));
                } catch {
                    continue;
                }
            }
        }

        const redisKeysArr = Array.from(redisKeysSet);

        // ── Phase 1: Bulk MGET en chunks de 5000 ──
        const chunkSize = 5000;

        for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
            const chunk = redisKeysArr.slice(i, i + chunkSize);
            const resultados = await this._cacheReader.mget(...chunk);

            for (let j = 0; j < chunk.length; j++) {
                const redisRes = resultados[j];
                const key = chunk[j];

                if (redisRes) {
                    try {
                        const parsing = JSON.parse(redisRes);
                        // Se extraen tanto rhat como h_ih, este último reemplaza la consulta local a KDE
                        const rhat = typeof parsing.rhat === 'number' ? parsing.rhat : 0;
                        const h_ih = typeof parsing.h_ih === 'number' ? parsing.h_ih : 0;
                        this.cacheInternaGRASP.set(key, { rhat, h_ih });
                    } catch (e) {
                         this.cacheInternaGRASP.set(key, { rhat: 0, h_ih: 0 });
                    }
                } else {
                    this.cacheInternaGRASP.set(key, { rhat: 0, h_ih: 0 });
                }
            }
        }

        console.log(
            `ModeloSijhCached: Bulk load completado. ${this.cacheInternaGRASP.size} entradas Sijh cargadas.`
        );

    }

    /**
     * Extrae los detalles de score promediados a nivel de franja.
     * Retorna { score, h_ih, rhat }.
     */
    public getScoreDetails(profesorId: number, grupoId: number): { score: number, h_ih: number, rhat: number } {
        const grupo = this.gruposDict.get(grupoId);
        if (!grupo || !grupo.horarioStringRaw) return { score: 0.0, h_ih: 0.0, rhat: 0.0 };

        let rKey: string;
        try {
            rKey = sijhKey(profesorId, grupo.ueaClave, canonicalizeHorario(grupo.horarioStringRaw));
        } catch {
            return { score: 0.0, h_ih: 0.0, rhat: 0.0 };
        }

        const entry = this.cacheInternaGRASP.get(rKey);
        const rhat = entry ? entry.rhat : 0;
        const h_ih = entry ? entry.h_ih : 0;

        const scoreFinal = (this._lambda_j * rhat) + (this._lambda_ih * h_ih);
        const score = Math.round(scoreFinal * 1e8) / 1e8;

        return { score, h_ih, rhat };
    }

    /**
     * Score compuesto S_ijh = λ_j × avg(rhat) + λ_ih × avg(h_ih)
     *
     * El componente h_ih proviene directamente de la caché (precalculado por el backend como KDE Unificado).
     */
    public score(profesorId: number, grupoId: number): number {
        return this.getScoreDetails(profesorId, grupoId).score;
    }
}
