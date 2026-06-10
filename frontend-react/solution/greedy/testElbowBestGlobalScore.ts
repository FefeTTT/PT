import path from 'path';
import { fileURLToPath } from 'url';
import { JSONAssignmentAdapter } from '../data/JSONAssignmentAdapter';
import { JSONAssignmentAdapterIO } from '../data/JSONAssignmentAdapterIO';
import { ModeloSijhCached } from '../ml/ModeloSijhCached';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';
import { PenaltyObservedCache } from '../ml/PenaltyObservedCache';

import { KdeCacheManager } from '../ml/KdeCacheManager';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function leerEnteroEnv(nombre: string, defecto: number): number {
    const raw = process.env[nombre];
    if (!raw) return defecto;

    const valor = Number.parseInt(raw, 10);
    return Number.isFinite(valor) && valor > 0 ? valor : defecto;
}

function leerTextoEnv(nombre: string, defecto: string): string {
    const raw = process.env[nombre];
    return raw && raw.trim().length > 0 ? raw.trim() : defecto;
}

function formatearDuracion(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return 'calculando';

    const totalSegundos = Math.ceil(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    if (horas > 0) return `${horas}h ${minutos}m ${segundos}s`;
    if (minutos > 0) return `${minutos}m ${segundos}s`;
    return `${segundos}s`;
}

async function runElbowTest() {
    console.log("=== INICIANDO BUSQUEDA DEL CODO (ELBOW METHOD) PARA GRASP RCL ===\n");

    let penaltyObservedCache: PenaltyObservedCache | null = null;

    try {
        const basePath = path.join(__dirname, '..', 'ml', 'files');
        const profFile = path.join(basePath, 'ecos_vigentes_con_horario_regular.json');
        const irregularesFile = path.join(basePath, 'ecos_irregulares_inferidos.json');
        const areaFile = path.join(basePath, 'area_profesor.json');
        const grupoFile = path.join(basePath, 'programacion_vacia_26P.json');

        const profesores = JSONAssignmentAdapterIO.parsearProfesores(profFile, areaFile, irregularesFile);
        const gruposCrudos = JSONAssignmentAdapterIO.parsearGrupos(grupoFile);
        const grupos = JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(gruposCrudos);
        console.log(`Grupos validos tras FSM ingesta: ${grupos.length} de ${gruposCrudos.length}`);

        console.log("Redis Bulk Load KDE Warmup...");
        const redisKde = new Redis({ host: '127.0.0.1', port: 6379 });
        const ecos = profesores.map(p => p.numeroEconomico.toString());
        const horariosUnicos = KdeCacheManager.extraerHorariosUnicos(
            grupos.map((g: any) => ({ horario: g.horarioStringRaw }))
        );
        const cleanCache = process.argv.includes('--clean');
        await KdeCacheManager.preCargarKde(redisKde, ecos, horariosUnicos, cleanCache);
        await redisKde.quit();

        console.log("Cargando KDE en memoria...");
        const modelo = new ModeloSijhCached(1.0, 1.0);
        await modelo.inicializar(profesores, grupos, false);

        console.log("Redis Stats Load Penalty...");
        const modeloPenalty = new ModeloPenaltyCached();
        await modeloPenalty.inicializarEstadisticos(profesores, grupos);

        const penaltyBaseUrl = leerTextoEnv('PENALTY_ML_BASE_URL', 'http://127.0.0.1:8000');
        const penaltyMaxEntries = leerEnteroEnv('PENALTY_LRU_MAX_ENTRIES', 50_000);
        const penaltyConcurrency = leerEnteroEnv('PENALTY_ML_CONCURRENCY', 32);
        const penaltyTimeoutMs = leerEnteroEnv('PENALTY_ML_TIMEOUT_MS', 10_000);
        const penaltyMaxAttempts = leerEnteroEnv('PENALTY_ML_ATTEMPTS', 3);
        const penaltyRetryBaseMs = leerEnteroEnv('PENALTY_ML_RETRY_BASE_MS', 500);
        const penaltyWatchdogMs = leerEnteroEnv('PENALTY_ML_WATCHDOG_MS', 300_000);
        const penaltyBatchSize = leerEnteroEnv('PENALTY_BATCH_SIZE', 64);

        console.log(
            `Penalty ML config: url=${penaltyBaseUrl} timeout=${penaltyTimeoutMs}ms attempts=${penaltyMaxAttempts} concurrency=${penaltyConcurrency} batchSize=${penaltyBatchSize} watchdog=${penaltyWatchdogMs}ms`
        );

        penaltyObservedCache = new PenaltyObservedCache({
            baseUrl: penaltyBaseUrl,
            maxEntries: penaltyMaxEntries,
            maxConcurrentFetches: penaltyConcurrency,
            requestTimeoutMs: penaltyTimeoutMs,
            maxAttempts: penaltyMaxAttempts,
            retryBaseDelayMs: penaltyRetryBaseMs,
            watchdogMs: penaltyWatchdogMs,
            batchSize: penaltyBatchSize,
            redis: {
                host: '127.0.0.1',
                port: 6379
            }
        });

        console.log("Comenzando pruebas de parametros RCL...");
        const { WorkerPool } = await import('./wrapperMultihilo');

        const kValores = Array.from({ length: 30 }, (_, i) => i + 40);
        const alphaValores = Array.from({ length: 4 }, (_, i) => parseFloat((i * 0.25 + 0.25).toFixed(2)));
        const iteracionesPorConfig = 16;

        const numWorkers = 32//Math.min(Math.max(1, Math.floor(iteracionesPorConfig / 2)), 16);

        console.log(`Evaluando K: ${kValores.join(', ')}`);
        console.log(`Evaluando Alpha: ${alphaValores.join(', ')}`);
        console.log(`Iteraciones por configuracion: ${iteracionesPorConfig}`);
        console.log(`Workers multihilo activos: ${numWorkers}\n`);

        const pool = new WorkerPool(numWorkers, penaltyObservedCache);
        await pool.inicializar(profesores, grupos);

        const resultados: any[] = [];
        const totalConfiguraciones = kValores.reduce(
            (total, k) => total + alphaValores.filter(alpha => !(k === 1 && alpha > 0.0)).length,
            0
        );
        const inicioElbow = performance.now();
        let configuracionesEvaluadas = 0;

        for (const k of kValores) {
            for (const alpha of alphaValores) {
                if (k === 1 && alpha > 0.0) continue;

                let sumScoreZ = 0;
                let sumSinAsignar = 0;
                let sumTiempo = 0;
                const scoresZ: number[] = [];

                let sumCacheHits = 0;
                let sumRedisHits = 0;
                let sumMisses = 0;
                let sumRedisMisses = 0;
                let sumWrites = 0;
                let sumRetries = 0;
                let sumErrors = 0;

                process.stdout.write(`Prueba [K=${k}, Alpha=${alpha.toFixed(3)}]: `);

                const promesas: Promise<any>[] = [];
                for (let i = 0; i < iteracionesPorConfig; i++) {
                    const promesa = pool.ejecutarIteracion(k, alpha, i + 1).then(met => {
                        if (met.error) {
                            process.stdout.write('E');
                        } else {
                            process.stdout.write('.');
                        }
                        return met;
                    });
                    promesas.push(promesa);
                }

                const resultadosIteracion = await Promise.all(promesas);

                for (const met of resultadosIteracion) {
                    if (met.error) {
                        continue;
                    }
                    sumScoreZ += met.scoreZ;
                    scoresZ.push(met.scoreZ);
                    sumSinAsignar += met.gruposSinAsignar.length;
                    sumTiempo += met.tiempoMs;

                    if (met.cacheStatsDelta) {
                        sumCacheHits += met.cacheStatsDelta.hits || 0;
                        sumRedisHits += met.cacheStatsDelta.redisHits || 0;
                        sumMisses += met.cacheStatsDelta.misses || 0;
                        sumRedisMisses += met.cacheStatsDelta.redisMisses || 0;
                        sumWrites += met.cacheStatsDelta.redisWrites || 0;
                        sumRetries += met.cacheStatsDelta.retries || 0;
                        sumErrors += met.cacheStatsDelta.errors || 0;
                    }
                }

                await penaltyObservedCache.waitForIdle({ K: k, Alpha: alpha, fase: 'post-config' });

                const avgScoreZ = sumScoreZ / iteracionesPorConfig;
                const varianzaScoreZ = scoresZ.reduce((acc, z) => acc + ((z - avgScoreZ) ** 2), 0) / scoresZ.length;
                const stdScoreZ = Math.sqrt(varianzaScoreZ);
                const bestScoreZ = Math.max(...scoresZ);
                const worstScoreZ = Math.min(...scoresZ);
                const avgSinAsignar = sumSinAsignar / iteracionesPorConfig;
                const avgTiempo = sumTiempo / iteracionesPorConfig;
                configuracionesEvaluadas++;
                const tiempoTranscurridoElbow = performance.now() - inicioElbow;
                const tiempoPromedioPorConfig = tiempoTranscurridoElbow / configuracionesEvaluadas;
                const configuracionesRestantes = totalConfiguraciones - configuracionesEvaluadas;
                const etaMs = tiempoPromedioPorConfig * configuracionesRestantes;

                console.log(` Zavg=${avgScoreZ.toFixed(2)} | Zstd=${stdScoreZ.toFixed(2)} | Zbest=${bestScoreZ.toFixed(2)} | Zworst=${worstScoreZ.toFixed(2)} | SinAsig=${avgSinAsignar.toFixed(1)} | t=${avgTiempo.toFixed(0)}ms | Cache hits=${sumCacheHits} redis=${sumRedisHits} misses=${sumMisses} redisMiss=${sumRedisMisses} writes=${sumWrites} retry=${sumRetries} err=${sumErrors} | ETA ${formatearDuracion(etaMs)} (${configuracionesEvaluadas}/${totalConfiguraciones})`);

                resultados.push({
                    K: k,
                    Alpha: alpha,
                    ScoreZPromedio: avgScoreZ,
                    ScoreZStd: stdScoreZ,
                    ScoreZMejor: bestScoreZ,
                    ScoreZPeor: worstScoreZ,
                    SinAsignar: avgSinAsignar,
                    TiempoMs: avgTiempo
                });
            }
        }

        console.log("\n=== RESUMEN DE LA CURVA DEL CODO ===");
        console.table(resultados.map(r => ({
            'K (RCL Size)': r.K,
            'Alpha': r.Alpha.toFixed(3),
            'Score Z Prom': r.ScoreZPromedio.toFixed(2),
            'Score Z Std': r.ScoreZStd.toFixed(2),
            'Score Z Mejor': r.ScoreZMejor.toFixed(2),
            'Score Z Peor': r.ScoreZPeor.toFixed(2),
            'Sin Asignar': r.SinAsignar.toFixed(1),
            'Tiempo Prom (ms)': r.TiempoMs.toFixed(0)
        })));

        const mejorConfig = resultados.reduce((prev, current) => (prev.ScoreZPromedio > current.ScoreZPromedio) ? prev : current);
        console.log(`\nMejor configuracion encontrada: K=${mejorConfig.K}, Alpha=${mejorConfig.Alpha.toFixed(3)} (Score Z promedio = ${mejorConfig.ScoreZPromedio.toFixed(2)}, std = ${mejorConfig.ScoreZStd.toFixed(2)}, mejor = ${mejorConfig.ScoreZMejor.toFixed(2)}, peor = ${mejorConfig.ScoreZPeor.toFixed(2)})`);

        pool.cerrar();
        await penaltyObservedCache.close();
        process.exit(0);
    } catch (e) {
        console.error("Error durante la ejecucion:");
        console.error(e);
        if (penaltyObservedCache) {
            await penaltyObservedCache.close();
        }
        process.exit(1);
    }
}

runElbowTest();
