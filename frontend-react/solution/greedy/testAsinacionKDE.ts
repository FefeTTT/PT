import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { JSONAssignmentAdapter } from '../data/JSONAssignmentAdapter';
import { JSONAssignmentAdapterIO } from '../data/JSONAssignmentAdapterIO';
import { GRASPSolutionToXLSIO } from '../data/GRASPSolutionToXLSIO';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';
import { ModeloSijhCached } from '../ml/ModeloSijhCached';
import { PenaltyObservedCache } from '../ml/PenaltyObservedCache';
import { invalidateStalePenaltyRedisOncePass0 } from '../ml/PenaltyPass0Invalidation';
import { crearZScoreKDE, ZScoreKDEMode } from '../ml/ZScoreKDE';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { ConstraintPonderada } from '../objective/FuncionObjetivoZ';
import { ViabilidadCargaConsecutiva, ViabilidadHuecos } from '../objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from '../objective/ViabilidadPenalizacionCarga';
import { GrupoDTO } from '../types/AssignmentTypes';
import { EstrategiaUeaMenosVista } from './EstrategiaUeaMenosVista';
import { GreedyOrchestrator } from './GreedyOrchestrator';
import { AsignacionInput, RCLConfig } from './GreedyTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_ECOS = [19834, 28650, 14416] as const;
const EXTRA_ARGS = (process.env.TEST_ASIGNACION_KDE_ARGS ?? '').split(/\s+/).filter(Boolean);
const CLI_ARGS = [...process.argv, ...EXTRA_ARGS];

interface EcoResumen {
    eco: number;
    totalUeas: number;
    manana: number;
    medioDia: number;
    tarde: number;
    asignaciones: Array<{
        uea: number;
        grupo: string;
        horario: string;
        turno: string;
        score?: number;
        kde_ij?: number;
        kde_ih?: number;
        kde_ih_raw?: number;
        kde_plan?: number;
        zBase?: number;
        projectedPlanCount?: number;
        dayCoverage?: number;
    }>;
    contradicciones: string[];
}

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

function hasArg(name: string): boolean {
    return CLI_ARGS.includes(name);
}

function getArgValue(name: string, fallback: string): string {
    const prefix = `${name}=`;
    const found = CLI_ARGS.find(arg => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
}

function instalarRandomSeed(seed: number): void {
    let state = seed >>> 0;
    Math.random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function turnoGrupo(grupo: GrupoDTO): 'manana' | 'medioDia' | 'tarde' {
    const minStart = Math.min(...grupo.horarios.map(h => h.horaInicio));
    if (minStart < 12) return 'manana';
    if (minStart < 15) return 'medioDia';
    return 'tarde';
}

function resumirEco(
    eco: number,
    asignaciones: AsignacionInput[],
    grupos: GrupoDTO[],
    evaluar: (eco: number, grupo: GrupoDTO) => { score: number; kde_ij?: number; kde_ih?: number; kde_ih_raw?: number; kde_plan?: number; zBase?: number; projectedPlanCount?: number; dayCoverage?: number }
): EcoResumen {
    const asignacionesEco = asignaciones.filter(a => a.numeroEconomico === eco);
    const resumen: EcoResumen = {
        eco,
        totalUeas: asignacionesEco.length,
        manana: 0,
        medioDia: 0,
        tarde: 0,
        asignaciones: [],
        contradicciones: []
    };

    for (const asignacion of asignacionesEco) {
        const grupo = grupos.find(g => g.idUeaGrupo === asignacion.idUeaGrupo);
        if (!grupo) continue;

        const turno = turnoGrupo(grupo);
        if (turno === 'manana') resumen.manana++;
        if (turno === 'medioDia') resumen.medioDia++;
        if (turno === 'tarde') resumen.tarde++;

        const score = evaluar(eco, grupo);
        resumen.asignaciones.push({
            uea: grupo.ueaClave,
            grupo: grupo.claveGrupo,
            horario: grupo.horarioStringRaw,
            turno,
            score: score.score,
            kde_ij: score.kde_ij,
            kde_ih: score.kde_ih,
            kde_ih_raw: score.kde_ih_raw,
            kde_plan: score.kde_plan,
            zBase: score.zBase,
            projectedPlanCount: score.projectedPlanCount,
            dayCoverage: score.dayCoverage
        });
    }

    if (eco === 19834) {
        if (resumen.totalUeas !== 2) resumen.contradicciones.push(`19834 debe quedar con 2 UEA, obtuvo ${resumen.totalUeas}.`);
        if (resumen.manana > 0) resumen.contradicciones.push(`19834 no debe concentrarse en manana, obtuvo ${resumen.manana}.`);
    }

    if (eco === 28650) {
        if (resumen.totalUeas < 2 || resumen.totalUeas > 3) {
            resumen.contradicciones.push(`28650 debe quedar con 2 o maximo 3 UEA, obtuvo ${resumen.totalUeas}.`);
        }
        if (resumen.manana > 0) resumen.contradicciones.push(`28650 debe tender a medio dia/tarde, obtuvo ${resumen.manana} manana.`);
    }

    if (eco === 14416) {
        if (resumen.totalUeas !== 2) resumen.contradicciones.push(`14416 debe quedar con 2 UEA, obtuvo ${resumen.totalUeas}.`);
        if (resumen.manana !== 2 || resumen.tarde > 0) {
            resumen.contradicciones.push(`14416 debe quedar con 2 UEA en manana y 0 tarde; obtuvo manana=${resumen.manana}, tarde=${resumen.tarde}.`);
        }
    }

    return resumen;
}

function leerSupervisado26P(supervisadoPath: string) {
    const wb = XLSX.readFile(supervisadoPath);
    const rows: any[] = [];
    for (const sheetName of wb.SheetNames) {
        if (sheetName.toUpperCase().includes('DIAGNOSTICO')) continue;
        const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: false });
        rows.push(...sheetRows);
    }

    return TARGET_ECOS.map(eco => ({
        eco,
        asignaciones: rows
            .filter(row => Number(String(row.ECO ?? '').trim()) === eco)
            .map(row => ({
                clave: String(row.CLAVE ?? '').trim(),
                grupo: String(row.GRUPO ?? '').trim(),
                l: String(row.L_I ?? '').trim(),
                m: String(row.M_I ?? '').trim(),
                mi: String(row.MI_I ?? '').trim(),
                j: String(row.J_I ?? '').trim(),
                v: String(row.V_I ?? '').trim()
            }))
    }));
}

export async function runTestAsignacionKDE() {
    let penaltyObservedCache: PenaltyObservedCache | null = null;

    const seed = Number.parseInt(getArgValue('--seed', '20260526'), 10);
    instalarRandomSeed(Number.isFinite(seed) ? seed : 20260526);

    const mode = (hasArg('--legacy') ? 'legacy' : getArgValue('--mode', 'kde_ij')) as ZScoreKDEMode;
    const usarPenalty = !hasArg('--no-penalty');
    const cargarLegacy = mode === 'legacy' || hasArg('--with-rhat');
    const soloRender = hasArg('--render-only');
    const rclConfig: RCLConfig = {
        k: Number.parseInt(getArgValue('--k', '48'), 10),
        alpha: Number.parseFloat(getArgValue('--alpha', '0.25'))
    };

    const basePath = path.join(__dirname, '..', 'ml', 'files');
    const profFile = path.join(basePath, 'ecos_vigentes_con_horario_regular.json');
    const irregularesFile = path.join(basePath, 'ecos_irregulares_inferidos.json');
    const areaFile = path.join(basePath, 'area_profesor.json');
    const grupoFile = path.join(basePath, 'programacion_vacia_26P.json');
    const dfHistFile = path.join(basePath, 'df_hist.json');
    const ecoNombreFile = path.join(basePath, 'eco-nombre.json');
    const supervisadoPath = path.resolve(__dirname, '..', '..', '..', '..', 'horario_supervisado_26P.xlsx');
    const artifactsDir = path.join(__dirname, '..', 'diagnosticos', 'kde_asignacion');
    fs.mkdirSync(artifactsDir, { recursive: true });

    console.log('=== testAsinacionKDE: GRASP con ZScoreFunction inyectable ===');
    console.log(`Modo=${mode} K=${rclConfig.k} alpha=${rclConfig.alpha} seed=${seed}`);
    console.log('horario_supervisado_26P.xlsx se usa solo al final como evaluacion holdout, nunca para ajustar KDE.');

    try {
        const profesores = JSONAssignmentAdapterIO.parsearProfesores(profFile, areaFile, irregularesFile);
        const ecoNombre = JSON.parse(fs.readFileSync(ecoNombreFile, 'utf-8'));
        const gruposCrudos = JSONAssignmentAdapterIO.parsearGrupos(grupoFile);
        const grupos = JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(gruposCrudos);
        JSONAssignmentAdapter.identificarMCV(grupos);

        const dfHist = JSON.parse(fs.readFileSync(dfHistFile, 'utf-8'));
        let modeloSijh: ModeloSijhCached | undefined;
        if (cargarLegacy) {
            console.log('Cargando r_hat/h_ih legacy desde Redis para comparar o usar --legacy...');
            modeloSijh = new ModeloSijhCached(1.0, 1.0);
            await modeloSijh.inicializar(profesores, grupos, false);
        }

        const zFactory = crearZScoreKDE({
            profesores,
            grupos,
            dfHist,
            legacyProvider: modeloSijh,
            options: {
                mode,
                steepPower: Number.parseFloat(getArgValue('--steep-power', '2')),
                halfLife: Number.parseFloat(getArgValue('--half-life', '8')),
                bandwidthUea: Number.parseFloat(getArgValue('--bandwidth-uea', '8')),
                bandwidthHour: Number.parseFloat(getArgValue('--bandwidth-hour', '1.25')),
                minKdeIj: Number.parseFloat(getArgValue('--min-kde-ij', '0.02')),
                minKdeIh: Number.parseFloat(getArgValue('--min-kde-ih', '0.05')),
                minKdePlan: Number.parseFloat(getArgValue('--min-kde-plan', '0.05'))
            }
        });

        const horas = Array.from({ length: 29 }, (_, i) => 7 + (i * 0.5));
        const ueasSuperficie = new Map<number, number[]>();
        for (const eco of TARGET_ECOS) {
            const historicas = zFactory.obtenerUeasHistoricas(eco).slice(0, 18);
            const vigentes = [...new Set(grupos.filter(g => g.idArea === String(historicas[0] ?? '').slice(0, 4)).map(g => g.ueaClave))].slice(0, 18);
            ueasSuperficie.set(eco, [...new Set([...historicas, ...vigentes])].sort((a, b) => a - b).slice(0, 24));
        }

        const surfaceData = TARGET_ECOS.map(eco => ({
            eco,
            l_mi_v: zFactory.generarSuperficieEco(eco, ueasSuperficie.get(eco) ?? [], horas, [1, 3, 5]),
            m_j: zFactory.generarSuperficieEco(eco, ueasSuperficie.get(eco) ?? [], horas, [2, 4]),
            l_m_mi_v: zFactory.generarSuperficieEco(eco, ueasSuperficie.get(eco) ?? [], horas, [1, 2, 3, 5])
        }));
        const surfaceFile = path.join(artifactsDir, 'kde_surface_points.json');
        fs.writeFileSync(surfaceFile, JSON.stringify(surfaceData, null, 2));
        console.log(`Surface data: ${surfaceFile}`);

        if (soloRender) {
            console.log('Render-only activo; no se ejecuta GRASP.');
            return;
        }

        const constraints: ConstraintPonderada[] = [
            { constraint: new ViabilidadHuecos(), lambda: 3.0 },
            { constraint: new ViabilidadCargaConsecutiva(), lambda: 1.0 }
        ];

        let modeloPenalty: ModeloPenaltyCached | undefined;
        if (usarPenalty) {
            console.log('Inicializando penalty KDE/loss observado para RCL...');
            modeloPenalty = new ModeloPenaltyCached();
            await modeloPenalty.inicializarEstadisticos(profesores, grupos);

            const penaltyBaseUrl = leerTextoEnv('PENALTY_ML_BASE_URL', 'http://127.0.0.1:8000');
            penaltyObservedCache = new PenaltyObservedCache({
                baseUrl: penaltyBaseUrl,
                maxEntries: leerEnteroEnv('PENALTY_LRU_MAX_ENTRIES', 50_000),
                maxConcurrentFetches: leerEnteroEnv('PENALTY_ML_CONCURRENCY', 8),
                requestTimeoutMs: leerEnteroEnv('PENALTY_ML_TIMEOUT_MS', 60_000),
                maxAttempts: leerEnteroEnv('PENALTY_ML_ATTEMPTS', 3),
                retryBaseDelayMs: leerEnteroEnv('PENALTY_ML_RETRY_BASE_MS', 500),
                watchdogMs: leerEnteroEnv('PENALTY_ML_WATCHDOG_MS', 300_000)
            });
            // PASE 0 (esta corrida es de un solo pase): invalidar la cache del modelo
            // de penalizacion VIEJO. Vacia la cache en memoria y purga las claves
            // Penalty:v2:*/PenaltyObserved:v2:* en Redis para que se recompute fresco
            // contra el modelo nuevo y recachee bajo v3. Idempotente y degradable.
            const invalidacion = await invalidateStalePenaltyRedisOncePass0({ cache: penaltyObservedCache });
            console.log(
                `Pase 0: invalidacion penalty (redis=${invalidacion.redisAvailable}, eliminadas=${invalidacion.deleted}).`
            );
            constraints.push({
                constraint: new ViabilidadPenalizacionCarga(penaltyBaseUrl, modeloPenalty, penaltyObservedCache),
                lambda: 1.0
            });
        }

        console.log('Ejecutando GRASP con ZScoreFunction KDE...');
        const estrategia = new EstrategiaUeaMenosVista(grupos);
        const orquestador = new GreedyOrchestrator(
            estrategia,
            zFactory.funcionZ,
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
            { K: rclConfig.k, Alpha: rclConfig.alpha, fase: 'test-kde' }
        );
        if (penaltyObservedCache) {
            await penaltyObservedCache.waitForIdle({ fase: 'post-test-kde' });
        }
        const tFin = performance.now();

        const fase1File = path.join(__dirname, 'debug_grasp_kde_fase1.json');
        const ejectionFile = path.join(__dirname, 'debug_grasp_kde_ejection.json');
        fs.writeFileSync(fase1File, JSON.stringify(resultado.metricas.logsFase1 ?? [], null, 2));
        fs.writeFileSync(ejectionFile, JSON.stringify(resultado.metricas.logsEjection ?? [], null, 2));

        const grafoResumen = new GrafoBipartito();
        profesores.forEach(profesor => grafoResumen.registrarProfesor(profesor));
        grupos.forEach(grupo => grafoResumen.registrarGrupo(grupo));
        resultado.asignaciones.forEach(asignacion => {
            grafoResumen.asignarMutable(asignacion.numeroEconomico, asignacion.idUeaGrupo);
        });

        const resumen = TARGET_ECOS.map(eco => resumirEco(
            eco,
            resultado.asignaciones,
            grupos,
            (ecoEval, grupo) => zFactory.evaluarGrupo(ecoEval, grupo, grafoResumen)
        ));

        const supervisado = fs.existsSync(supervisadoPath) ? leerSupervisado26P(supervisadoPath) : [];
        const summary = {
            mode,
            seed,
            k: rclConfig.k,
            alpha: rclConfig.alpha,
            totalAsignaciones: resultado.asignaciones.length,
            totalGrupos: grupos.length,
            gruposSinAsignar: resultado.metricas.gruposSinAsignar.length,
            scoreZ: resultado.metricas.scoreZ,
            tiempoMs: Math.round(tFin - tInicio),
            ecos: resumen,
            supervisado26P_holdout: supervisado,
            files: {
                surfaceFile,
                fase1File,
                ejectionFile
            }
        };

        const summaryFile = path.join(artifactsDir, 'testAsinacionKDE_summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

        const solucionFile = path.join(artifactsDir, 'solucion_asignacion.json');
        fs.writeFileSync(solucionFile, JSON.stringify(resultado.asignaciones, null, 2));

        const xlsxFile = path.join(__dirname, 'programacion_reconstruida_kde.xlsx');
        const issuesFile = path.join(__dirname, 'programacion_reconstruida_kde_issues.json');
        GRASPSolutionToXLSIO.export(resultado.asignaciones, grupos, ecoNombre, xlsxFile, issuesFile);

        console.log('=== RESULTADO GRASP KDE ===');
        console.log(`Tiempo: ${Math.round(tFin - tInicio)} ms`);
        console.log(`Asignaciones: ${resultado.asignaciones.length} de ${grupos.length}`);
        console.log(`Sin asignar: ${resultado.metricas.gruposSinAsignar.length}`);
        for (const eco of resumen) {
            console.log(
                `ECO ${eco.eco}: total=${eco.totalUeas} manana=${eco.manana} medioDia=${eco.medioDia} tarde=${eco.tarde}`
            );
            for (const asig of eco.asignaciones) {
                console.log(
                    `  - ${asig.uea} ${asig.grupo} ${asig.horario} turno=${asig.turno} score=${asig.score?.toFixed(4)} kde_ij=${asig.kde_ij?.toFixed(4)} kde_ih=${asig.kde_ih?.toFixed(4)} kde_plan=${asig.kde_plan?.toFixed(4)} planCount=${asig.projectedPlanCount} day=${asig.dayCoverage?.toFixed(2)}`
                );
            }
            for (const contradiccion of eco.contradicciones) {
                console.log(`  CONTRAEJEMPLO ${contradiccion}`);
            }
        }

        console.log(`Summary: ${summaryFile}`);
        console.log(`Debug fase 1: ${fase1File}`);
        console.log(`Debug ejection: ${ejectionFile}`);
        console.log(`Excel: ${xlsxFile}`);
        console.log(`Issues: ${issuesFile}`);
    } finally {
        if (penaltyObservedCache) {
            try {
                await penaltyObservedCache.close();
            } catch (closeError) {
                console.warn('No se pudo cerrar PenaltyObservedCache limpiamente:', closeError);
            }
        }
    }
}

if (!process.env.VITEST) {
    runTestAsignacionKDE().catch(error => {
        console.error('Error durante testAsinacionKDE:', error);
        process.exitCode = 1;
    });
}
