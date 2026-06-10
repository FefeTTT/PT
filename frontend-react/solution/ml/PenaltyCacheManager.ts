import axios from 'axios';
import { Redis } from 'ioredis';

import http from 'http';
import type { CandidatoFiltrado } from './SijhCacheManager';

const KEYS_PER_MGET = 5000;
const SETS_PER_PIPELINE = 500;

export interface PenaltyPrediction {
    total_penalty: number;
    loads: number[];
    best_5: Array<{ pattern: string; frequency: number }>;
}

export class PenaltyCacheManager {

    /**
     * Llena Redis con las predicciones de penalty finetuneado,
     * usando los candidatos ya filtrados por la FSM.
     *
     * Deduplicado por key Penalty_{eco}_{horario} (un eco con el mismo
     * horario en distintas UEAs solo se cachea una vez).
     */
    static async preCargarPenaltyFiltrado(
        redis: Redis,
        candidatosFSM: CandidatoFiltrado[],
        cleanCache: boolean = false
    ): Promise<void> {
        if (cleanCache) {
            console.log("Limpiando caché de Redis para Penalty");
            const keys = await redis.keys('Penalty_*');
            if (keys.length > 0) await redis.del(...keys);
        }

        // Deduplicar por eco+horario (Penalty no depende de la UEA)
        const candidatosMap = new Map<string, { eco: string; uea: string; horario: string; key: string }>();
        for (const c of candidatosFSM) {
            const key = `Penalty_${c.eco}_${c.horario}`;
            if (!candidatosMap.has(key)) {
                candidatosMap.set(key, {
                    eco: c.eco,
                    uea: c.uea,
                    horario: c.horario,
                    key,
                });
            }
        }

        const candidatos = Array.from(candidatosMap.values());

        const total = candidatos.length;
        let errores = 0;
        let procesados = 0;

        console.log(`\nWarm-up penalty para ${total} entradas (deduplicadas de ${candidatosFSM.length} candidatos FSM)`);

        const axiosClient = axios.create({
            baseURL: "http://127.0.0.1:8000",
            timeout: 10_000,
            httpAgent: new http.Agent({ keepAlive: true, maxSockets: 50 }),
        });

        // Phase 1: MGET
        const existentes = new Set<number>();
        try {
            for (let i = 0; i < candidatos.length; i += KEYS_PER_MGET) {
                const chunk = candidatos.slice(i, i + KEYS_PER_MGET);
                const resultados = await redis.mget(...chunk.map(c => c.key));
                resultados.forEach((res, idx) => {
                    if (res !== null) existentes.add(i + idx);
                });
            }
        } catch (err) {
            console.error("Error crítico en Redis MGET:", (err as Error).message);
        }

        console.log(`   Redis: ${existentes.size} keys ya cacheadas, ${total - existentes.size} por obtener`);

        // Phase 2: HTTP Fetch
        const pendientes: any[] = [];
        for (let i = 0; i < candidatos.length; i++) {
            if (existentes.has(i)) {
                procesados++;
                continue;
            }
            const c = candidatos[i];
            try {
                const res = await axiosClient.post("/get_horario_penalty_finetuned", {
                    eco: c.eco,
                    horario: c.horario,
                    ueas_asignadas_actuales: [],
                    horarios_asignados_actuales: [],
                    uea_prediccion: c.uea
                });

                if (res.data && res.data.total_penalty !== undefined) {
                    pendientes.push({
                        key: c.key,
                        data: res.data
                    });
                }
            } catch (err) {
                errores++;
                if (errores <= 5) {
                    console.error(`Error HTTP para ${c.key}:`, (err as any).message || err);
                }
            }

            procesados++;
            if (procesados % 100 === 0 || procesados === total) {
                this._imprimirProgreso(procesados, total, errores);
            }
        }

        // Phase 3: Pipeline SET
        if (pendientes.length > 0) {
            let pipelineErrores = 0;
            for (let i = 0; i < pendientes.length; i += SETS_PER_PIPELINE) {
                const chunk = pendientes.slice(i, i + SETS_PER_PIPELINE);
                const pipeline = redis.pipeline();
                chunk.forEach(p => pipeline.set(p.key, JSON.stringify(p.data)));
                try {
                    await pipeline.exec();
                } catch (err) {
                    pipelineErrores++;
                    if (pipelineErrores <= 5) {
                        console.error("Error crítico en Redis Pipeline SET:", (err as Error).message);
                    }
                }
            }
            if (pipelineErrores > 0) {
                errores += pipelineErrores * SETS_PER_PIPELINE;
                console.log(`   ⚠️ Pipeline Redis falló en ${pipelineErrores} chunks.`);
            }
        }

        console.log(`Warm-up penalty completado. Errores: ${errores}`);
    }


    private static _imprimirProgreso(actual: number, total: number, errores: number): void {
        const p = total === 0 ? 100 : Math.round((actual / total) * 100);
        if (typeof process !== "undefined" && process.stdout && process.stdout.clearLine) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`[Penalty] ${p}% (${actual}/${total}) | Errores: ${errores}`);
            if (actual === total) process.stdout.write('\n');
        } else {
            if (actual === total || actual % Math.max(1, Math.floor(total / 10)) === 0) {
                console.log(`[Penalty] ${p}% (${actual}/${total}) | Errores: ${errores}`);
            }
        }
    }
}
