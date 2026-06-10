import axios from 'axios';
import { Redis } from 'ioredis';
import http from 'http';
import { canonicalizeHorario, kdeKey } from './CacheKeys';
import { deleteRedisKeysByPattern } from './RedisCacheInvalidation';

const KEYS_PER_MGET = 5000;
const SETS_PER_PIPELINE = 500;

export interface KdeRedisEntry {
    score: number;
    tipo_eco: "regular" | "irregular";
}

export interface KdeCandidato {
    eco: string;
    horario: string;
    key: string;
}

/**
 * KdeCacheManager — Warmup de Redis para scores del modelo KDE Unificado.
 *
 * Patrón idéntico a PenaltyCacheManager:
 *   Phase 1 — Bulk MGET: detectar keys existentes.
 *   Phase 2 — HTTP fetch: POST /predecir_kde_unificado para keys faltantes.
 *   Phase 3 — Pipeline SET: escritura journal-style.
 *
 * Key de Redis: KDE:{eco}:{horario} → JSON {score, tipo_eco}
 *
 * Deduplicado por (eco, horario): un mismo par solo se cachea una vez
 * independientemente de la UEA.
 */
export class KdeCacheManager {

    /**
     * Precarga Redis con scores KDE para los candidatos dados.
     *
     * @param redis         Cliente Redis activo.
     * @param ecos          Lista de ECOs vigentes.
     * @param horarios      Lista de horarios únicos (formato Dia:HH:MM-HH:MM).
     * @param cleanCache    Si true, elimina keys KDE_* antes de comenzar.
     */
    static async preCargarKde(
        redis: Redis,
        ecos: string[],
        horarios: string[],
        cleanCache: boolean = false
    ): Promise<void> {
        if (cleanCache) {
            console.log("Limpiando caché de Redis para KDE");
            await deleteRedisKeysByPattern(redis, 'KDE:*');
            await deleteRedisKeysByPattern(redis, 'KDE:v1:*');
            await deleteRedisKeysByPattern(redis, 'KDE:v2:*');
        }

        // Deduplicar por eco+horario
        const candidatosMap = new Map<string, KdeCandidato>();
        for (const eco of ecos) {
            for (const horarioRaw of horarios) {
                const horario = canonicalizeHorario(horarioRaw);
                const key = kdeKey(eco, horario);
                if (!candidatosMap.has(key)) {
                    candidatosMap.set(key, { eco, horario, key });
                }
            }
        }

        const candidatos = Array.from(candidatosMap.values());
        const total = candidatos.length;
        let errores = 0;
        let procesados = 0;

        console.log(`\n🧠 Iniciando warm-up KDE Unificado para ${total} entradas (eco × horario)`);

        const axiosClient = axios.create({
            baseURL: "http://127.0.0.1:8000",
            timeout: 10_000,
            httpAgent: new http.Agent({ keepAlive: true, maxSockets: 50 }),
        });

        // ─────────────────────────────────────────────────────────────
        // Phase 1 — Bulk MGET: detectar keys existentes
        // ─────────────────────────────────────────────────────────────

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
            console.error("Error crítico en Redis MGET (KDE):", (err as Error).message);
        }

        console.log(`   Redis: ${existentes.size} keys KDE ya cacheadas, ${total - existentes.size} por obtener`);

        // ─────────────────────────────────────────────────────────────
        // Phase 2 — HTTP fetch: POST /predecir_kde_unificado
        // ─────────────────────────────────────────────────────────────

        const pendientes: Array<{ key: string; data: KdeRedisEntry }> = [];
        const startTimeMs = Date.now();

        for (let i = 0; i < candidatos.length; i++) {
            if (existentes.has(i)) {
                procesados++;
                continue;
            }

            const c = candidatos[i];
            try {
                const res = await axiosClient.post("/predecir_kde_unificado", {
                    eco: c.eco,
                    horario: c.horario,
                });

                const resData = res.data;
                if (resData && typeof resData.score === "number" && resData.tipo_eco) {
                    pendientes.push({
                        key: c.key,
                        data: {
                            score: resData.score,
                            tipo_eco: resData.tipo_eco,
                        },
                    });
                }
            } catch (err) {
                errores++;
                if (errores <= 5) {
                    console.error(`Error HTTP KDE para ${c.key}:`, (err as any).message || err);
                }
            }

            procesados++;
            if (procesados % 100 === 0 || procesados === total) {
                this._imprimirProgreso(procesados, total, errores, startTimeMs);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Phase 3 — Pipeline SET: journal-style batch writes
        // ─────────────────────────────────────────────────────────────

        if (pendientes.length > 0) {
            console.log(`\n   Escribiendo ${pendientes.length} entradas KDE a Redis (pipeline ×${SETS_PER_PIPELINE})...`);

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
                        console.error("Error crítico en Redis Pipeline SET (KDE):", (err as Error).message);
                    }
                }
            }

            if (pipelineErrores > 0) {
                console.log(`   ⚠️ Pipeline Redis KDE falló en ${pipelineErrores} chunks.`);
            } else {
                console.log(`   ✅ ${pendientes.length} keys KDE escritas exitosamente.`);
            }
        }

        console.log(`Warm-up KDE completado. Errores: ${errores}`);
    }

    /**
     * Extrae los horarios únicos (franjas con prefijo de día) de una lista de candidatos FSM.
     */
    static extraerHorariosUnicos(candidatosFSM: Array<{ horario: string }>): string[] {
        const horariosSet = new Set<string>();
        for (const c of candidatosFSM) {
            try {
                horariosSet.add(canonicalizeHorario(c.horario));
            } catch {
                continue;
            }
        }
        return Array.from(horariosSet);
    }

    private static _imprimirProgreso(actual: number, total: number, errores: number, startTimeMs: number): void {
        const p = total === 0 ? 100 : Math.round((actual / total) * 100);
        const barraSize = 20;
        const progreso = Math.round((p / 100) * barraSize);
        const barra = '█'.repeat(progreso) + '░'.repeat(barraSize - progreso);

        let etaStr = "N/A";
        if (actual > 0) {
            const elapsedMs = Date.now() - startTimeMs;
            const msPerItem = elapsedMs / actual;
            const remainingItems = total - actual;
            const etaS = Math.round((msPerItem * remainingItems) / 1000);
            etaStr = `${etaS}s`;
        }

        const texto = `[KDE] [${barra}] ${p}% (${actual}/${total}) | ETA: ${etaStr} | Errores: ${errores}`;

        if (typeof process !== "undefined" && process.stdout && process.stdout.clearLine) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(texto);
            if (actual === total) process.stdout.write('\n');
        } else {
            if (actual === total || actual % Math.max(1, Math.floor(total / 10)) === 0) {
                console.log(texto);
            }
        }
    }
}
