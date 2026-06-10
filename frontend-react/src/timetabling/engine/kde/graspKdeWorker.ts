/// <reference lib="webworker" />

import { JSONAssignmentAdapter } from '@solution/data/JSONAssignmentAdapter';
import { GreedyOrchestrator } from '@solution/greedy/GreedyOrchestrator';
import { EstrategiaUeaMenosVista } from '@solution/greedy/EstrategiaUeaMenosVista';
import { GrafoBipartito } from '@solution/models/GrafoBipartito';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { BlockedGroupKey, LockedAssignmentDTO } from './graspKdeTypes';
import { excluirGruposBloqueados } from './blockedGroups';
import { crearZScoreKDE } from '@solution/ml/ZScoreKDE';
import { ViabilidadHuecos, ViabilidadCargaConsecutiva } from '@solution/objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from '@solution/objective/ViabilidadPenalizacionCarga';
import { ModeloPenaltyCached } from '@solution/ml/ModeloPenaltyCached';
import { PenaltyObservedCache } from '@solution/ml/PenaltyObservedCache';
import type { ConstraintPonderada } from '@solution/objective/FuncionObjetivoZ';
import { setJsonFiles } from '@solution/misc/helper_functions';
import { sembrarAsignacionesBloqueadas, type SeededLockedAssignment } from './lockedSeeding';
import type {
    KdeRawInputs,
    KdeWorkerConfig,
    KdeWorkerEcoResumen,
    KdeWorkerInbound,
    KdeWorkerOutbound,
    KdeWorkerResult,
    KdeWorkerSurfaceData,
} from './graspKdeTypes';

const ctx: DedicatedWorkerGlobalScope = self as any;

function installLCG(seed: number): void {
    let state = seed >>> 0;
    Math.random = () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function emit(msg: KdeWorkerOutbound): void {
    ctx.postMessage(msg);
}

function progress(stage: string, detail?: string): void {
    emit({ type: 'progress', payload: { kind: 'stage', stage, detail } });
}

function turnoGrupo(grupo: GrupoDTO): 'manana' | 'medioDia' | 'tarde' {
    const minStart = Math.min(...grupo.horarios.map((h: { horaInicio: number }) => h.horaInicio));
    if (minStart < 12) return 'manana';
    if (minStart < 15) return 'medioDia';
    return 'tarde';
}

function resumirEco(
    eco: number,
    asignaciones: Array<{ numeroEconomico: number; idUeaGrupo: number }>,
    grupos: GrupoDTO[],
    evaluar: (eco: number, grupo: GrupoDTO) => any,
): KdeWorkerEcoResumen {
    const asignacionesEco = asignaciones.filter(a => a.numeroEconomico === eco);
    const resumen: KdeWorkerEcoResumen = {
        eco,
        totalUeas: asignacionesEco.length,
        manana: 0,
        medioDia: 0,
        tarde: 0,
        asignaciones: [],
        contradicciones: [],
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
            dayCoverage: score.dayCoverage,
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

async function run(
    inputs: KdeRawInputs,
    config: KdeWorkerConfig,
    lockedAssignments: LockedAssignmentDTO[] = [],
    completedEcos: number[] = [],
    blockedKeys: BlockedGroupKey[] = [],
): Promise<KdeWorkerResult> {
    installLCG(config.seed);
    progress('rng', `seed=${config.seed}`);

    if (config.withRhat || config.mode === 'legacy') {
        throw new Error('Modo legacy / --with-rhat requiere Redis + ModeloSijhCached; aún no soportado en el browser worker.');
    }
    // Modo con penalty (config.noPenalty === false): se cablea ViabilidadPenalizacionCarga
    // + ModeloPenaltyCached usando los proxies del dev server (/api/redis/mget y /py),
    // para igualar el flujo de testAsinacionKDE. Requiere Python(:8000)+Redis(:6379).

    progress('seed:helper_files');
    setJsonFiles({
        'ecos_vigentes_con_horario_regular.json': inputs.ecoHorarioRegular,
        'ecos_vigentes_con_horario_irregular.json': inputs.ecoHorarioIrregularVigente ?? {},
        'ecos_irregulares_inferidos.json': inputs.ecoHorarioIrregular ?? {},
        'area_profesor.json': inputs.areaProfesor,
        'programacion_vacia_26P.json': inputs.programacionVacia,
        'eco-nombre.json': inputs.ecoNombre,
    });

    progress('parse:profesores');
    const profesores = JSONAssignmentAdapter.parsearProfesoresDesdeObjeto(
        inputs.ecoHorarioRegular,
        inputs.areaProfesor,
        inputs.ecoHorarioIrregular ?? {},
    );

    // ConjuntoCompletado: ECOs marcados como "carga terminada". Siguen sembrados en el grafo
    // (su carga W cuenta para el KDE de los demas) pero se excluyen de la GENERACION de
    // candidatos, por lo que no reciben reasignaciones nuevas.
    const completedSet = new Set(completedEcos);
    const profesoresParaAsignar = profesores.filter((p: any) => !completedSet.has(p.numeroEconomico));

    // El parse es SIEMPRE sobre el workspace COMPLETO (también en pases N≥1): así los
    // `idUeaGrupo` del catálogo son los crudos, deterministas y estables entre pases. Los
    // grupos bloqueados se excluyen DESPUÉS, por contenido (blockedKeys); `filter` preserva
    // el orden de parse del resto, por lo que con 0 bloqueados el flujo es idéntico al pase 0.
    progress('parse:grupos', blockedKeys.length > 0 ? `${blockedKeys.length} grupos bloqueados a excluir` : undefined);
    const gruposCrudos = JSONAssignmentAdapter.parsearGruposDesdeObjeto(inputs.programacionVacia);
    const gruposIngesta = JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(gruposCrudos);
    const grupos = excluirGruposBloqueados(gruposIngesta, blockedKeys);
    JSONAssignmentAdapter.identificarMCV(grupos);

    progress('kde:factory', `${inputs.dfHist.length} filas históricas`);
    const zFactory = crearZScoreKDE({
        profesores,
        grupos,
        dfHist: inputs.dfHist,
        options: { mode: config.mode, ...config.options },
    });

    progress('kde:surface', `${config.targetEcos.length} ECOs target`);
    const surfaceData: KdeWorkerSurfaceData[] = config.targetEcos.map(eco => {
        const historicas = zFactory.obtenerUeasHistoricas(eco).slice(0, 18);
        const vigentes = [...new Set(
            grupos.filter((g: GrupoDTO) => g.idArea === String(historicas[0] ?? '').slice(0, 4)).map((g: GrupoDTO) => g.ueaClave),
        )].slice(0, 18);
        const ueas = [...new Set([...historicas, ...vigentes])].sort((a, b) => a - b).slice(0, 24);
        return {
            eco,
            l_mi_v: zFactory.generarSuperficieEco(eco, ueas, config.horasSuperficie, [1, 3, 5]),
            m_j: zFactory.generarSuperficieEco(eco, ueas, config.horasSuperficie, [2, 4]),
            l_m_mi_v: zFactory.generarSuperficieEco(eco, ueas, config.horasSuperficie, [1, 2, 3, 5]),
        };
    });

    if (config.renderOnly) {
        progress('done:render-only');
        return {
            surfaceData,
            asignaciones: [],
            metricas: {
                totalEvaluaciones: 0,
                totalAsignados: 0,
                totalRechazados: 0,
                tiempoMs: 0,
                gruposSinAsignar: [],
                scoreZ: 0,
                mejorasLocales: 0,
                reparaciones: 0,
                logsFase1: [],
                logsEjection: [],
            },
            summary: {
                mode: config.mode,
                seed: config.seed,
                k: config.k,
                alpha: config.alpha,
                totalAsignaciones: 0,
                totalGrupos: grupos.length,
                gruposSinAsignar: 0,
                scoreZ: 0,
                tiempoMs: 0,
                ecos: config.targetEcos.map(eco => ({
                    eco,
                    totalUeas: 0,
                    manana: 0,
                    medioDia: 0,
                    tarde: 0,
                    asignaciones: [],
                    contradicciones: [],
                })),
            },
            profesoresCount: profesores.length,
            gruposValidos: grupos,
            profesores,
        };
    }

    progress('grasp:run');
    const constraints: ConstraintPonderada[] = [
        { constraint: new ViabilidadHuecos(), lambda: 3.0 },
        { constraint: new ViabilidadCargaConsecutiva(), lambda: 1.0 },
    ];

    // Penalty ML (paridad con testAsinacionKDE): tercera constraint que ademas alimenta
    // el scoreRcl de la fase constructiva (GreedyOrchestrator.ejecutarAsync), por lo que
    // CAMBIA las asignaciones del pase, no solo el score mostrado.
    let modeloPenalty: ModeloPenaltyCached | undefined;
    let penaltyObservedCache: PenaltyObservedCache | undefined;
    if (!config.noPenalty) {
        const penaltyBaseUrl = `${ctx.location.origin}/py`;
        progress('penalty:init', `baseUrl=${penaltyBaseUrl}`);
        modeloPenalty = new ModeloPenaltyCached();
        await modeloPenalty.inicializarEstadisticos(profesores, grupos);
        penaltyObservedCache = new PenaltyObservedCache({
            baseUrl: penaltyBaseUrl,
            maxEntries: 50_000,
            maxConcurrentFetches: 8,
            requestTimeoutMs: 60_000,
            maxAttempts: 3,
            retryBaseDelayMs: 500,
            watchdogMs: 300_000,
        });
        constraints.push({
            constraint: new ViabilidadPenalizacionCarga(penaltyBaseUrl, modeloPenalty, penaltyObservedCache),
            lambda: 1.0,
        });
        const stats = modeloPenalty.estadisticosPenalty;
        progress('penalty:ready', `mean=${stats.mean.toFixed(3)} std=${stats.std.toFixed(3)}`);
    }

    const estrategia = new EstrategiaUeaMenosVista(grupos);
    const orquestador = new GreedyOrchestrator(
        estrategia,
        zFactory.funcionZ,
        constraints,
        undefined,
        modeloPenalty,
        { k: config.k, alpha: config.alpha },
    );

    // ConjuntoBloqueado: sembrar el grafoInicial con la carga W ya comprometida por cada ECO.
    // `ejecutarAsync` con grafoInicial lo clona y NO re-registra (GreedyOrchestrator.ts:430-434),
    // por lo que profesores + grupos (sin-asignar) + grupos bloqueados deben quedar ya dentro.
    // La siembra vive en sembrarAsignacionesBloqueadas (pura, testeable). Con ids unificados
    // (parse completo + exclusión por contenido) los bloqueados llegan con su id crudo, que NO
    // está registrado en `grupos` (fueron excluidos) → se registran sin colisión. El guard de
    // ids sintéticos queda como defensa para datos legacy/inconsistentes.
    let grafoInicial: GrafoBipartito | null = null;
    let seededLocked: SeededLockedAssignment[] = [];
    if (lockedAssignments.length > 0) {
        progress('grasp:seed', `${lockedAssignments.length} asignaciones ya asignadas`);
        grafoInicial = new GrafoBipartito();
        profesores.forEach((p: any) => grafoInicial!.registrarProfesor(p));
        grupos.forEach((g: GrupoDTO) => grafoInicial!.registrarGrupo(g));
        seededLocked = sembrarAsignacionesBloqueadas(grafoInicial, lockedAssignments);
    }

    const tInicio = performance.now();
    const resultado = await orquestador.ejecutarAsync(
        profesoresParaAsignar,
        grupos,
        grafoInicial,
        { K: config.k, Alpha: config.alpha, fase: 'web-worker-kde' },
    );
    if (penaltyObservedCache) {
        await penaltyObservedCache.waitForIdle({ fase: 'web-worker-kde' });
    }
    const tFin = performance.now();

    progress('grasp:done', `${resultado.asignaciones.length}/${grupos.length}`);

    // Catalogo aumentado: pase (sin-asignar) + grupos bloqueados, para que el resumen por ECO
    // y `gruposValidos` (siguiente pase) cuenten la carga bloqueada + nueva. Se usan los DTOs
    // EFECTIVOS de la siembra (id sintético incluido): así las asignaciones sembradas bajo id
    // sintético resuelven a su contenido real en buildCandidateRows y la fusión del driver.
    const gruposParaResumen: GrupoDTO[] = [...grupos];
    const idsExistentes = new Set(grupos.map((g: GrupoDTO) => g.idUeaGrupo));
    for (const seeded of seededLocked) {
        if (!idsExistentes.has(seeded.idEfectivo)) {
            gruposParaResumen.push(seeded.dto);
            idsExistentes.add(seeded.idEfectivo);
        }
    }

    const grafoResumen = new GrafoBipartito();
    profesores.forEach((p: any) => grafoResumen.registrarProfesor(p));
    gruposParaResumen.forEach((g: GrupoDTO) => grafoResumen.registrarGrupo(g));
    resultado.asignaciones.forEach((a: { numeroEconomico: number; idUeaGrupo: number }) => grafoResumen.asignarMutable(a.numeroEconomico, a.idUeaGrupo));

    // Scoring KDE universal: evaluar TODOS los ECOs con asignacion (no solo config.targetEcos),
    // para que cada relacion i·j / i·h pase por los kernels. `resultado.asignaciones` incluye los
    // bloqueados sembrados en el grafoInicial, y `grafoResumen` tiene la carga completa.
    const ecosConAsignacion = [...new Set(resultado.asignaciones.map(a => a.numeroEconomico))]
        .sort((a, b) => a - b);
    const resumen = ecosConAsignacion.map(eco =>
        resumirEco(eco, resultado.asignaciones, gruposParaResumen, (ecoEval, grupo) =>
            zFactory.evaluarGrupo(ecoEval, grupo, grafoResumen),
        ),
    );

    return {
        surfaceData,
        asignaciones: resultado.asignaciones,
        metricas: resultado.metricas,
        summary: {
            mode: config.mode,
            seed: config.seed,
            k: config.k,
            alpha: config.alpha,
            totalAsignaciones: resultado.asignaciones.length,
            totalGrupos: grupos.length,
            gruposSinAsignar: resultado.metricas.gruposSinAsignar.length,
            scoreZ: resultado.metricas.scoreZ,
            tiempoMs: Math.round(tFin - tInicio),
            ecos: resumen,
        },
        profesoresCount: profesores.length,
        gruposValidos: gruposParaResumen,
        profesores,
    };
}

ctx.addEventListener('message', async (event: MessageEvent<KdeWorkerInbound>) => {
    const data = event.data;
    if (data.type === 'run') {
        try {
            const result = await run(
                data.inputs,
                data.config,
                data.lockedAssignments ?? [],
                data.completedEcos ?? [],
                data.blockedKeys ?? [],
            );
            emit({ type: 'result', payload: result });
        } catch (err: any) {
            emit({ type: 'error', message: err?.message ?? String(err), stack: err?.stack });
        }
    } else if (data.type === 'cancel') {
        progress('cancel', 'cancel requested — worker will terminate from main thread');
    }
});
