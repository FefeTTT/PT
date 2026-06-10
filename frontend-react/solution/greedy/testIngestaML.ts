import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { JSONAssignmentAdapter } from '../data/JSONAssignmentAdapter';
import { JSONAssignmentAdapterIO } from '../data/JSONAssignmentAdapterIO';
import { ModeloSijhCached } from '../ml/ModeloSijhCached';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';
import { PenaltyObservedCache } from '../ml/PenaltyObservedCache';

import { KdeCacheManager } from '../ml/KdeCacheManager';
import { ViabilidadHuecos } from '../objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from '../objective/ViabilidadPenalizacionCarga';
import { GRASPSolutionToXLSIO } from '../data/GRASPSolutionToXLSIO';
import { EstrategiaUeaMenosVista } from '../greedy/EstrategiaUeaMenosVista';
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

async function run() {
    let penaltyObservedCache: PenaltyObservedCache | null = null;
    console.log("=== INICIANDO VALIDACIÓN DE INGESTA JSON & ML CACHED ===\n");

    try {
        const basePath = path.join(__dirname, '..', 'ml', 'files');
        const profFile = path.join(basePath, 'ecos_vigentes_con_horario_regular.json');
        const irregularesFile = path.join(basePath, 'ecos_irregulares_inferidos.json');
        const areaFile = path.join(basePath, 'area_profesor.json');
        const grupoFile = path.join(basePath, 'programacion_vacia_26P.json');
        const ecoNombreFile = path.join(basePath, 'eco-nombre.json');

        console.log("1. Parseando Profesores y Nombres...");
        const profesores = JSONAssignmentAdapterIO.parsearProfesores(profFile, areaFile, irregularesFile);
        const ecoNombre = JSON.parse(fs.readFileSync(ecoNombreFile, 'utf-8'));
        console.log(`${profesores.length} profesores parseados.`);

        console.log("\n2. Parseando Grupos...");
        const gruposCrudos = JSONAssignmentAdapterIO.parsearGrupos(grupoFile);
        const grupos = JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(gruposCrudos);
        console.log(`${grupos.length} grupos validos de ${gruposCrudos.length} parseados.`);

        console.log("\n3. Calculando MCV...");
        JSONAssignmentAdapter.identificarMCV(grupos);

        console.log("\n4. Inicializando KDE Unificado...");

        // 4.0 Warmup KDE en Redis (si no existe ya)
        console.log("   4.0 Warmup KDE Redis...");
        const redisKde = new Redis({ host: '127.0.0.1', port: 6379 });
        const ecos = profesores.map(p => p.numeroEconomico.toString());
        const horariosUnicos = KdeCacheManager.extraerHorariosUnicos(
            grupos.map((g: any) => ({ horario: g.horarioStringRaw }))
        );
        const cleanCache = process.argv.includes('--clean');
        await KdeCacheManager.preCargarKde(redisKde, ecos, horariosUnicos, cleanCache);
        await redisKde.quit();

        // 4.1 Cargar KDE en memoria
        console.log("Cargando KDE en memoria...");
        // KdeUnificadoCached ya no se requiere para ModeloSijhCached

        console.log("Cargando modelo y validando contra cache Redis...");
        const modelo = new ModeloSijhCached(1.0, 1.0);
        await modelo.inicializar(profesores, grupos, false);

        console.log("\n4.3 Inicializando Modelo Penalty ML observado...");
        const modeloPenalty = new ModeloPenaltyCached();
        await modeloPenalty.inicializarEstadisticos(profesores, grupos);

        const penaltyBaseUrl = leerTextoEnv('PENALTY_ML_BASE_URL', 'http://127.0.0.1:8000');
        penaltyObservedCache = new PenaltyObservedCache({
            baseUrl: penaltyBaseUrl,
            maxEntries: leerEnteroEnv('PENALTY_LRU_MAX_ENTRIES', 50_000),
            maxConcurrentFetches: leerEnteroEnv('PENALTY_ML_CONCURRENCY', 8),
            requestTimeoutMs: leerEnteroEnv('PENALTY_ML_TIMEOUT_MS', 60_000),
            maxAttempts: leerEnteroEnv('PENALTY_ML_ATTEMPTS', 3),
            retryBaseDelayMs: leerEnteroEnv('PENALTY_ML_RETRY_BASE_MS', 500),
            watchdogMs: leerEnteroEnv('PENALTY_ML_WATCHDOG_MS', 300_000),
            redis: {
                host: '127.0.0.1',
                port: 6379
            }
        });

        const constraints = [
            { constraint: new ViabilidadHuecos(), lambda: 3.0 },
            { constraint: new ViabilidadPenalizacionCarga(penaltyBaseUrl, modeloPenalty, penaltyObservedCache!), lambda: 1.0 }
        ];

        console.log("\n5. Instanciando y Ejecutando GRASP completo...");
        const { GreedyOrchestrator } = await import('./GreedyOrchestrator');

        const estrategia = new EstrategiaUeaMenosVista(grupos);
        const rclConfig = { k: 48, alpha: 0.25 };

        const orquestador = new GreedyOrchestrator(
            estrategia,
            (eco, g) => modelo.getScoreDetails(eco, g),
            constraints,
            undefined,
            modeloPenalty,
            rclConfig
        );

        const tInicio = performance.now();
        const resultado = await orquestador.ejecutarAsync(
            profesores,
            grupos,
            null,
            { K: rclConfig.k, Alpha: rclConfig.alpha, fase: 'grasp-produccion' }
        );
        await penaltyObservedCache.waitForIdle({ fase: 'post-grasp-produccion' });
        const tFin = performance.now();

        console.log(`\n=== RESULTADO GRASP ===`);
        console.log(`Tiempo de ejecución: ${(tFin - tInicio).toFixed(3)} ms`);
        console.log(`Asignaciones exitosas: ${resultado.asignaciones.length} de ${grupos.length} grupos totales.`);
        console.log(`Grupos rechazados: ${resultado.metricas.totalRechazados}`);
        console.log(`Mejoras por Ejection Chain: ${resultado.metricas.mejorasLocales}`);
        console.log(`Score Z Total (Recompensa + Viabilidad): ${resultado.metricas.scoreZ.toFixed(3)}`);

        console.log("\n6. Exportando Mapeo JSON de Asignaciones y Debug Logs...");

        // Mapeo eco -> { uea: [horarios] }
        const ecoAGrupos = new Map<number, Map<number, string[]>>();
        for (const asig of resultado.asignaciones) {
            const grupoInfo = grupos.find((g: any) => g.idUeaGrupo === asig.idUeaGrupo);
            if (!grupoInfo) continue;

            if (!ecoAGrupos.has(asig.numeroEconomico)) {
                ecoAGrupos.set(asig.numeroEconomico, new Map<number, string[]>());
            }

            const ecoMap = ecoAGrupos.get(asig.numeroEconomico)!;
            if (!ecoMap.has(grupoInfo.ueaClave)) {
                ecoMap.set(grupoInfo.ueaClave, []);
            }
            ecoMap.get(grupoInfo.ueaClave)!.push(grupoInfo.horarioStringRaw);
        }

        const outAsig: any = {};
        for (const [eco, ecoMap] of ecoAGrupos) {
            outAsig[eco] = {};
            for (const [uea, horarios] of ecoMap) {
                outAsig[eco][uea] = horarios;
            }
        }

        const asignacionesFile = path.join(__dirname, 'asignaciones_eco_grupo.json');
        const debugFase1File = path.join(__dirname, 'debug_grasp_fase1.json');
        const debugEjectionFile = path.join(__dirname, 'debug_grasp_ejection.json');

        fs.writeFileSync(asignacionesFile, JSON.stringify(outAsig, null, 2));
        fs.writeFileSync(debugFase1File, JSON.stringify(resultado.metricas.logsFase1, null, 2));
        fs.writeFileSync(debugEjectionFile, JSON.stringify(resultado.metricas.logsEjection, null, 2));

        console.log(` - Archivos exportados en ${__dirname}:`);
        console.log(` - asignaciones_eco_grupo.json`);
        console.log(` - debug_grasp_fase1.json`);
        console.log(` - debug_grasp_ejection.json`);

        console.log("\n7. Generando Excel (XLSX) de programación reconstruida...");
        const xlsxFile = path.join(__dirname, 'programacion_reconstruida.xlsx');
        const issuesFile = path.join(__dirname, 'programacion_reconstruida_issues.json');

        GRASPSolutionToXLSIO.export(
            resultado.asignaciones,
            grupos,
            ecoNombre,
            xlsxFile,
            issuesFile
        );

        console.log(` - programacion_reconstruida.xlsx`);
        console.log(` - programacion_reconstruida_issues.json`);

        console.log("\nPipeline completo GRASP+ML probado exitosamente.");
    } catch (e) {
        console.error("Error durante la ejecución:");
        console.error(e);
    } finally {
        if (penaltyObservedCache) {
            await penaltyObservedCache.close();
        }
    }
}

run();
