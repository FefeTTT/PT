import axios from 'axios';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { WarmupPayloadSchema, HorarioValidoSchema } from '../schemas/s_ijh_schema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { canonicalizeHorario, sijhKey } from './CacheKeys';
import { invalidateMlRedisCaches } from './RedisCacheInvalidation';


let _redisClient: Redis | null = null;
type RedisPipeline = ReturnType<Redis['pipeline']>;

function getRedis(): Redis {
    if (!_redisClient) {
        _redisClient = new Redis({
            host: '127.0.0.1',
            port: 6379,
            enableOfflineQueue: false, // falla rápido si Redis no responde
        });
    }
    return _redisClient;
}


const KEYS_PER_MGET = 5000;  // MGET chunk size
const SETS_PER_PIPELINE = 500; // cuántos SET buffereamos antes de flush al pipeline


function imprimirProgreso(actual: number, total: number, errores: number = 0, ultimoError: string = ""): void {
    const p = Math.round((actual / total) * 100);
    const barraSize = 20;
    const progreso = Math.round((p / 100) * barraSize);
    const barra = '█'.repeat(progreso) + '░'.repeat(barraSize - progreso);

    if (typeof process !== "undefined" && process.stdout && process.stdout.clearLine) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        let texto = `[${barra}] ${p}% (${actual}/${total})`;
        if (errores > 0) {
            texto += ` | Errores: ${errores} ${ultimoError}`;
        }
        process.stdout.write(texto);

        if (actual === total) {
            process.stdout.write('\n');
            console.log("Warm-up de Caché completado exitosamente.");
        }
    } else {
        if (actual === total || actual % Math.max(1, Math.floor(total / 10)) === 0) {
            console.log(`Procesando Cache: [${barra}] ${p}% (${actual}/${total}) - Errores: ${errores}`);
        }
    }
}

export interface SijhPrediction {
    rhat: number;
    h_ih: number;
}

export interface CandidatoFiltrado {
    eco: string;
    uea: string;
    horario: string;
    key: string;
}

// ── Resultado de un chunk de pipeline ──

interface PipelineFlushResult {
    written: number;
    failed: number;
    lastError: string;
}

export class SijhCacheManager {

    /**
     * Llena Redis con las predicciones del backend de Python.
     *
     * Estrategia 3-phase con pipeline + journal:
     *
     *   Phase 1 — Bulk MGET: consulta todas las keys en chunks de 5k.
     *     Una sola ronda de red por chunk. Las keys ya existentes se saltan.
     *
     *   Phase 2 — HTTP fetch: para las keys faltantes, llama a POST /S_ijh.
     *     Almacena rhat y h_ih para el horario semanal canonico.
     *     Las respuestas válidas se bufferean en memoria.
     *
     *   Phase 3 — Pipeline SET: cada 500 SETs buffereados, se hace flush
     *     del pipeline a Redis. Redis ejecuta cada SET de forma independiente
     *     (journal-style: un fallo en una key no revierte las demás).
     *     Si el pipeline devuelve error en algún comando, se registra pero
     *     no detiene el progreso del resto del chunk.
     *
     * Esto es preferible a MSET porque:
     *   - MSET envía todo en un solo comando; si falla a medio camino no
     *     hay granularidad para saber qué keys se escribieron.
     *   - Pipeline con SETs individuales da aislamiento por key + batch
     *     de envío eficiente (una sola ronda de red por chunk).
     *
     * @param payload      JSON validado con Zod: { profesores_vigentes, programacion }
     * @param cleanCache   Si true, invalida solo namespaces ML conocidos.
     */
    static async preCargarDirectorio(payload: unknown, cleanCache: boolean = false): Promise<void> {
        const data = WarmupPayloadSchema.parse(payload);
        const redis = getRedis();

        if (cleanCache) {
            console.log("Limpiando caché de Redis");
            const deleted = await invalidateMlRedisCaches(redis);
            console.log(`Caches ML invalidadas: ${deleted} keys eliminadas`);
        }

        const { profesores_vigentes, programacion } = data;

        // ── Construir producto cartesiano ──
        const candidatos: Array<{ eco: string; uea: string; horario: string; key: string }> = [];

        for (const eco of profesores_vigentes) {
            for (const prog of programacion) {
                for (const horarioRaw of prog.grupos) {
                    const horario = canonicalizeHorario(horarioRaw);
                    candidatos.push({
                        eco,
                        uea: prog.uea,
                        horario,
                        key: sijhKey(eco, prog.uea, horario),
                    });
                }
            }
        }

        const total = candidatos.length;
        let errores = 0;
        let ultimoError = "";
        let procesados = 0;

        console.log(`\n🧠 Iniciando warm-up rhat para ${total} entradas del producto cartesiano ijh`);

        const axiosClient = axios.create({
            baseURL: "http://127.0.0.1:8000",
            timeout: 10_000,
        });

        // ─────────────────────────────────────────────────────────────
        // Phase 1 — Bulk MGET: detectar keys existentes
        // ─────────────────────────────────────────────────────────────

        const existentes = new Set<number>(); // índices de candidatos ya en Redis

        for (let i = 0; i < candidatos.length; i += KEYS_PER_MGET) {
            const chunk = candidatos.slice(i, i + KEYS_PER_MGET);
            const keysChunk = chunk.map(c => c.key);

            const resultadosMget = await redis.mget(...keysChunk);

            for (let j = 0; j < resultadosMget.length; j++) {
                if (resultadosMget[j] !== null) {
                    existentes.add(i + j);
                }
            }
        }

        const faltantes = candidatos.length - existentes.size;
        console.log(`   Redis: ${existentes.size} keys ya cacheadas, ${faltantes} por obtener de Python`);

        // ─────────────────────────────────────────────────────────────
        // Phase 2 — HTTP fetch: solo para keys faltantes
        // ─────────────────────────────────────────────────────────────

        const pendientes: Array<{
            index: number;
            eco: string;
            uea: string;
            horario: string;
            key: string;
            rhat?: number;
            h_ih?: number;
        }> = [];

        for (let i = 0; i < candidatos.length; i++) {
            if (existentes.has(i)) {
                procesados++;
                continue;
            }
            const c = candidatos[i];
            try {
                const res = await axiosClient.post("/S_ijh", {
                    eco: c.eco,
                    uea: c.uea,
                    horario: c.horario,
                });

                const resData = res.data;
                if (resData && typeof resData.rhat === "number" && typeof resData.h_ih === "number") {
                    pendientes.push({
                        index: i,
                        eco: c.eco,
                        uea: c.uea,
                        horario: c.horario,
                        key: c.key,
                        rhat: resData.rhat,
                        h_ih: resData.h_ih,
                    });
                }
            } catch (err) {
                errores++;
                const msg = (err as Error).message || String(err);
                ultimoError = `[HTTP fail: eco ${c.eco} uea ${c.uea} — ${msg.slice(0, 80)}]`;
            }

            procesados++;
            if (procesados % 100 === 0 || procesados === total) {
                imprimirProgreso(procesados, total, errores, ultimoError);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Phase 3 — Pipeline SET: journal-style batch writes
        // ─────────────────────────────────────────────────────────────
        // Cada SET es un comando independiente dentro del pipeline.
        // Redis ejecuta cada uno por separado. Si uno falla (ej. OOM en
        // esa key específica), el pipeline reporta el error en ese comando
        // pero el resto del chunk se persiste. El loop continúa con el
        // siguiente chunk sin perder progreso acumulado.

        if (pendientes.length > 0) {
            console.log(`\n   Escribiendo ${pendientes.length} entradas nuevas a Redis (pipeline ×${SETS_PER_PIPELINE})...`);

            let pipelineErrores = 0;

            for (let i = 0; i < pendientes.length; i += SETS_PER_PIPELINE) {
                const chunkPendientes = pendientes.slice(i, i + SETS_PER_PIPELINE);
                const pipeline = redis.pipeline();

                for (const p of chunkPendientes) {
                    pipeline.set(p.key, JSON.stringify({
                        rhat: p.rhat,
                        h_ih: p.h_ih,
                    }));
                }

                const flushResult = await this._flushPipeline(pipeline, chunkPendientes.length);

                pipelineErrores += flushResult.failed;
                if (flushResult.failed > 0) {
                    errores += flushResult.failed;
                    ultimoError = flushResult.lastError;
                }

                if (i + SETS_PER_PIPELINE < pendientes.length) {
                    imprimirProgreso(
                        existentes.size + i + chunkPendientes.length,
                        total,
                        errores,
                        ultimoError
                    );
                }
            }

            if (pipelineErrores > 0) {
                console.log(`   ⚠️  ${pipelineErrores} keys fallaron al escribir en Redis (el resto persiste).`);
            } else {
                console.log(`   ✅ ${pendientes.length} keys escritas exitosamente.`);
            }
        }

        // Progreso final
        imprimirProgreso(total, total, errores, ultimoError);
    }

    /**
     * Ejecuta un pipeline y clasifica el resultado.
     * Retorna cuántos comandos fallaron y el último mensaje de error.
     *
     * El pipeline de ioredis.exec() devuelve Array<[Error | null, any]>.
     * Cada tupla corresponde a un comando en orden. Si el primer elemento
     * es no-null, ese comando falló. Los demás comandos del pipeline no se
     * ven afectados (journal semantics).
     */
    private static async _flushPipeline(
        pipeline: RedisPipeline,
        expected: number,
    ): Promise<PipelineFlushResult> {
        const results = await pipeline.exec();

        if (!results) {
            return {
                written: 0,
                failed: expected,
                lastError: "Pipeline exec returned null (connection lost)",
            };
        }

        let failed = 0;
        let lastError = "";

        for (const [err] of results) {
            if (err) {
                failed++;
                lastError = err.message.slice(0, 100);
            }
        }

        return {
            written: expected - failed,
            failed,
            lastError,
        };
    }

    // ─── getRhat (consulta individual con cache-through) ───

    static async getRhat(eco: string, uea: string, horario: string): Promise<SijhPrediction | null> {
        const horarioCanonico = canonicalizeHorario(horario);
        const key = sijhKey(eco, uea, horarioCanonico);
        const redis = getRedis();

        try {
            const cached = await redis.get(key);
            if (cached) {
                return JSON.parse(cached) as SijhPrediction;
            }

            const res = await axios.post<{ rhat: number, h_ih: number }>(
                "http://127.0.0.1:8000/S_ijh",
                { eco, uea, horario: horarioCanonico },
                { timeout: 5_000 },
            );
            const data = res.data;

            if (data && data.rhat !== undefined && data.h_ih !== undefined) {
                const toCache: SijhPrediction = { rhat: data.rhat, h_ih: data.h_ih };
                await redis.set(key, JSON.stringify(toCache));
                return toCache;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    // ─── ejecutarWarmupDesdeArchivos ───

    static async ejecutarWarmupDesdeArchivos(
        rutaEco: string,
        rutaProg: string,
        cleanCache: boolean = false,
    ): Promise<void> {
        console.log("Leyendo datos de profesores y programación...");
        const rawEco = JSON.parse(fs.readFileSync(rutaEco, 'utf-8'));
        const rawProg = JSON.parse(fs.readFileSync(rutaProg, 'utf-8'));

        const profesores_vigentes = Object.keys(rawEco);

        const programacion = ParserDeProgramacion.parsear(rawProg)
            .filter(p => /^(1100|1111|1112|1113)/.test(p.uea));

        const payload = {
            profesores_vigentes,
            programacion,
        };

        await this.preCargarDirectorio(payload, cleanCache);
        await this.disconnect();
    }

    // ─── disconnect ───

    static async disconnect(): Promise<void> {
        if (_redisClient) {
            await _redisClient.quit();
            _redisClient = null;
        }
    }
}

// ─────────────────────────────────────────────────────────────
// Parser de Programación (sin cambios)
// ─────────────────────────────────────────────────────────────

export const RawProgramacionSchema = z.record(
    z.string(),
    z.array(
        z.object({
            grupo: z.string(),
            horario: z.string().nullable(),
        }),
    ),
);

export class ParserDeProgramacion {
    static parsear(rawData: unknown): { uea: string; grupos: string[] }[] {
        const dataValidada = RawProgramacionSchema.parse(rawData);
        const result: { uea: string; grupos: string[] }[] = [];

        for (const [uea, clases] of Object.entries(dataValidada)) {
            const horasSet = new Set<string>();

            for (const clase of clases) {
                if (!clase.horario) continue;

                try {
                    const horarioCanonico = canonicalizeHorario(clase.horario);
                    if (HorarioValidoSchema.safeParse(horarioCanonico).success) {
                        horasSet.add(horarioCanonico);
                    }
                } catch {
                    continue;
                }
            }

            if (horasSet.size === 0) continue;

            result.push({
                uea,
                grupos: Array.from(horasSet),
            });
        }

        return result;
    }
}

// ── CLI entry point ──
if (process.argv[1] && process.argv[1].endsWith('SijhCacheManager.ts')) {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const ecoPath = path.join(dir, 'files', 'eco-nombre.json');
    const progPath = path.join(dir, 'files', 'programacion_vacia_26P.json');

    console.log("Iniciando SijhCacheManager desde CLI...");
    SijhCacheManager.ejecutarWarmupDesdeArchivos(ecoPath, progPath, true)
        .then(() => {
            console.log("Proceso de cache completado exitosamente.");
            process.exit(0);
        })
        .catch(err => {
            console.error("Error crítico en warmup:", err);
            process.exit(1);
        });
}
