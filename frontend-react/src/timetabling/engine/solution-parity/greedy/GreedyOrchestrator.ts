import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { EstadoAsignacion } from '../fsm/FSMAsignador';
import { FSMFactory } from '../fsm/FSMFactory';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { AsignacionInput, ResultadoGreedy, MetricasGreedy, EstrategiaOrdenamiento, DebugFSMRechazo, DebugEjectionRechazo, RCLConfig } from './GreedyTypes';
import { FirstFSMLogger } from './FirstFSMLogger';
import { EstrategiaMCV } from './EstrategiaMCV';
import { IModeloML, ModeloMLUniforme } from '../ml/IModeloML';
import { FuncionObjetivoZ, ConstraintPonderada } from '../objective/FuncionObjetivoZ';
import { ViabilidadHuecos } from '../objective/SoftConstraints';
import { EvaluationContext } from '../objective/SoftConstraints';
import { ViabilidadPenalizacionCarga } from '../objective/ViabilidadPenalizacionCarga';
import { EjectionChain } from './EjectionChain';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';

/**
 * GreedyOrchestrator — GRASP (Greedy Randomized Adaptive Search Procedure).
 *
 * Clase pura (sin dependencias React/DOM).
 * Recibe catálogos crudos de profesores y grupos, genera combinaciones,
 * las valida con FSMAsignador, y produce un AsignacionInput[] con los
 * emparejamientos exitosos.
 *
 * Fases del GRASP:
 * 1. Fase Constructiva: Greedy con RCL probabilístico (o MCV determinista).
 * 2. Evaluación: Función objetivo Z (recompensa ML − penalización suave).
 * 3. Búsqueda Local: Ejection Chains (KHE14) para mejora iterativa.
 *
 * Diseñada para instanciar tanto en el hilo principal como en un Web Worker.
 */
export class GreedyOrchestrator {
    private _estrategia: EstrategiaOrdenamiento;
    private _modelo: IModeloML;
    private _funcionZ: FuncionObjetivoZ;
    private _ejectionChain: EjectionChain;
    private _rclConfig: RCLConfig;
    private _penaltyRcl?: ViabilidadPenalizacionCarga;
    private _lambdaPenaltyRcl: number = 1.0;

    constructor(
        estrategia: EstrategiaOrdenamiento = new EstrategiaMCV(),
        modelo?: IModeloML,
        constraintsPersonalizados?: ConstraintPonderada[],
        ejectionChain?: EjectionChain,
        modeloPenalty?: ModeloPenaltyCached,
        rclConfig?: RCLConfig
    ) {
        this._estrategia = estrategia;
        this._modelo = modelo ?? new ModeloMLUniforme();
        this._rclConfig = rclConfig ?? { k: 1, alpha: 0.0 }; // Por defecto 1 candidato, Greedy estricto

        // Constraints por defecto si no se proporcionan
        const constraints = constraintsPersonalizados ?? [
            { constraint: new ViabilidadHuecos(), lambda: 2.0 },
            { constraint: new ViabilidadPenalizacionCarga('http://127.0.0.1:8000', modeloPenalty), lambda: 1.0 }
        ];
        const penaltyConstraint = constraints.find(cp => 
            cp.constraint.nombre === 'VIABILIDAD_PENALIZACION_CARGA' || 
            cp.constraint instanceof ViabilidadPenalizacionCarga
        );
        if (penaltyConstraint) {
            this._penaltyRcl = penaltyConstraint.constraint as ViabilidadPenalizacionCarga;
            this._lambdaPenaltyRcl = penaltyConstraint.lambda;
        }

        this._funcionZ = new FuncionObjetivoZ(constraints, this._modelo);
        this._ejectionChain = ejectionChain ?? new EjectionChain();
    }

    /**
     * Ejecuta el algoritmo GRASP sobre los catálogos proporcionados.
     *
     * @param profesores Lista completa de profesores disponibles.
     * @param grupos Lista completa de grupos a asignar.
     * @param grafoInicial Opcional. Grafo pre-asignado a utilizar como base.
     * @returns ResultadoGreedy con asignaciones exitosas, métricas y scoreZ.
     */
    public ejecutar(profesores: ProfesorDTO[], grupos: GrupoDTO[], grafoInicial: GrafoBipartito | null = null): ResultadoGreedy {
        const inicio = performance.now();

        SemanaLaboral.invalidarCache();

        const grafo = grafoInicial ? grafoInicial.clonar() : new GrafoBipartito();
        if (!grafoInicial) {
            profesores.forEach(p => grafo.registrarProfesor(p));
            grupos.forEach(g => grafo.registrarGrupo(g));
        }

        const reglasFast = ReglasPipeline.getReglasFastFail();
        const reglasRestantes = ReglasPipeline.getReglasRestantes();
        const fsmFilter = FSMFactory.crear(grafo, reglasFast);
        const fsmRegular = FSMFactory.crear(grafo, reglasRestantes);
        const loggerFirstFSM = new FirstFSMLogger();

        const gruposPorArea = this._agruparPorArea(grupos);
        const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
        const profesoresPorArea = this._agruparProfesoresPorArea(profesores);

        const disableLogs = this._rclConfig.disableLogs === true;
        const gruposAsignados = new Set<number>();
        let totalEvaluaciones = 0;
        let totalRechazados = 0;


        
        const logsFase1: DebugFSMRechazo[] = [];
        const logsEjection: DebugEjectionRechazo[] = [];

        for (const [idArea, gruposDelArea] of areasOrdenadas) {
            const profesoresDelArea = profesoresPorArea.get(idArea) || [];
            if (profesoresDelArea.length === 0) continue;
            const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);
            const gruposDelAreaPendientes = new Set(gruposOrdenados.map(g => g.idUeaGrupo).filter(id => !gruposAsignados.has(id)));

            type CandidatoGlobal = {
                eco: number;
                grupo: GrupoDTO;
                scoreSijh: number;
                estadoFSM: EstadoAsignacion;
                ultimoErrorFSM?: string;
            };

            let candidatosGlobales: CandidatoGlobal[] = [];
            const candidatosTentadosPorGrupo = new Map<number, DebugFSMRechazo['candidatosTentados']>();

            for (const grupo of gruposOrdenados) {
                if (gruposAsignados.has(grupo.idUeaGrupo)) continue;
                candidatosTentadosPorGrupo.set(grupo.idUeaGrupo, []);

                const profesoresParaGrupo = this._estrategia.ordenarProfesores(profesoresDelArea, grupo.idUeaGrupo);
                let validosGrupo: CandidatoGlobal[] = [];

                for (const profesor of profesoresParaGrupo) {
                    totalEvaluaciones++;
                    const resultadoFilter = fsmFilter.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);

                    if (resultadoFilter.estado !== EstadoAsignacion.ASIGNACION_OK) {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = resultadoFilter.error ? `${resultadoFilter.error.reglaFallo} - ${resultadoFilter.error.motivo}` : 'Fallo Filter FSM';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoFilter.error?.reglaFallo || 'UNKNOWN', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: 0, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                        continue;
                    }

                    const scoreSijh = this._modelo.score(profesor.numeroEconomico, grupo.idUeaGrupo);
                    if (scoreSijh === 0.0) {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = 'CACHE_MISS - Combinación sin predicción ML en Redis';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, 'CACHE_MISS', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: 0, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                        continue;
                    }

                    const resultadoRegular = fsmRegular.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);
                    if (resultadoRegular.estado === EstadoAsignacion.ASIGNACION_OK) {
                        validosGrupo.push({
                            eco: profesor.numeroEconomico,
                            grupo: grupo,
                            scoreSijh: scoreSijh,
                            estadoFSM: EstadoAsignacion.ASIGNACION_OK
                        });
                    } else {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = resultadoRegular.error ? `${resultadoRegular.error.reglaFallo} - ${resultadoRegular.error.motivo}` : 'Fallo Regular FSM';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoRegular.error?.reglaFallo || 'UNKNOWN', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                    }
                }

                if (validosGrupo.length > this._rclConfig.k && this._rclConfig.k > 0) {
                    validosGrupo.sort((a, b) => b.scoreSijh - a.scoreSijh);
                    const descartados = validosGrupo.slice(this._rclConfig.k);
                    validosGrupo = validosGrupo.slice(0, this._rclConfig.k);

                    if (!disableLogs) {
                        for (const desc of descartados) {
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: desc.eco, puntajeSijh: desc.scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: 'Fuera del Top K base del grupo'
                            });
                        }
                    }
                }

                candidatosGlobales.push(...validosGrupo);
            }

            while (gruposDelAreaPendientes.size > 0 && candidatosGlobales.length > 0) {
                candidatosGlobales.sort((a, b) => b.scoreSijh - a.scoreSijh);

                let candidatosFiltrados = candidatosGlobales;
                if (this._rclConfig.k > 0) {
                    candidatosFiltrados = candidatosFiltrados.slice(0, this._rclConfig.k);
                }

                const maxScore = candidatosFiltrados[0].scoreSijh;
                const minScore = candidatosFiltrados[candidatosFiltrados.length - 1].scoreSijh;
                
                if (this._rclConfig.alpha > 0) {
                    const umbral = maxScore - this._rclConfig.alpha * (maxScore - minScore);
                    candidatosFiltrados = candidatosFiltrados.filter(c => c.scoreSijh >= umbral);
                } else {
                    candidatosFiltrados = candidatosFiltrados.filter(c => c.scoreSijh === maxScore);
                }

                const elegido = candidatosFiltrados[Math.floor(Math.random() * candidatosFiltrados.length)];

                grafo.asignarMutable(elegido.eco, elegido.grupo.idUeaGrupo);
                gruposAsignados.add(elegido.grupo.idUeaGrupo);
                gruposDelAreaPendientes.delete(elegido.grupo.idUeaGrupo);

                if (!disableLogs) {
                    const tentados = candidatosTentadosPorGrupo.get(elegido.grupo.idUeaGrupo) || [];
                    const grupoCandidatos = candidatosGlobales.filter(c => c.grupo.idUeaGrupo === elegido.grupo.idUeaGrupo);
                    for (const cand of grupoCandidatos) {
                        tentados.push({
                            eco: cand.eco,
                            puntajeSijh: cand.scoreSijh,
                            estado: cand.eco === elegido.eco ? 'ELEGIDO' : 'RECHAZADO',
                            ultimoErrorFSM: cand.eco === elegido.eco ? undefined : 'No seleccionado en RCL Global'
                        });
                    }
                    this._registrarLogFase1(logsFase1, elegido.grupo, tentados, tentados.find(t => t.estado === 'ELEGIDO'));
                }

                candidatosGlobales = candidatosGlobales.filter(c => c.grupo.idUeaGrupo !== elegido.grupo.idUeaGrupo);

                for (const cand of candidatosGlobales.filter(c => c.eco === elegido.eco)) {
                    const res = fsmRegular.procesarAsignacion(cand.eco, cand.grupo.idUeaGrupo);
                    if (res.estado !== EstadoAsignacion.ASIGNACION_OK) {
                        cand.estadoFSM = res.estado;
                        cand.ultimoErrorFSM = res.error ? `${res.error.reglaFallo} - ${res.error.motivo}` : 'Fallo FSM por nueva carga';
                        if (!disableLogs) {
                            candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo)!.push({
                                eco: cand.eco, puntajeSijh: cand.scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: cand.ultimoErrorFSM
                            });
                        }
                    }
                }

                candidatosGlobales = candidatosGlobales.filter(c => c.estadoFSM === EstadoAsignacion.ASIGNACION_OK);
            }

            if (!disableLogs) {
                for (const idGrupoHuerfano of gruposDelAreaPendientes) {
                    const grupo = gruposOrdenados.find(g => g.idUeaGrupo === idGrupoHuerfano)!;
                    const tentados = candidatosTentadosPorGrupo.get(idGrupoHuerfano) || [];
                    logsFase1.push({
                        idUeaGrupo: grupo.idUeaGrupo,
                        uea: grupo.ueaClave,
                        claveGrupo: grupo.claveGrupo,
                        horario: grupo.horarioStringRaw,
                        resolucion: `Ninguno de los ${tentados.length} candidatos logró sortear la FSM. Terminó huérfano.`,
                        candidatosTentados: tentados
                    });
                }
            }
        }

        // Computar huérfanos pre-búsqueda local para Fase 1 de reparación
        const todosLosGrupoIds = grupos.map(g => g.idUeaGrupo);
        const huerfanosPreRepair = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const dummyLogsEjection: DebugEjectionRechazo[] = [];
        const resultadoMejora = this._ejectionChain.mejorarSolucion(grafo, fsmRegular, this._funcionZ, huerfanosPreRepair, disableLogs ? dummyLogsEjection : logsEjection);
        const resultadoZ = this._funcionZ.evaluarGrafo(grafo);
        const asignaciones: AsignacionInput[] = [];
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            asignaciones.push({
                numeroEconomico: numEco,
                idUeaGrupo: idGrupo
            });
        }

        // Re-computar grupos sin asignar después de la fase de mejora
        const gruposSinAsignar = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const fin = performance.now();

        const metricas: MetricasGreedy = {
            totalEvaluaciones,
            totalAsignados: asignaciones.length,
            totalRechazados,
            tiempoMs: Math.round(fin - inicio),
            gruposSinAsignar,
            scoreZ: resultadoZ.Z,
            mejorasLocales: resultadoMejora.mejoras,
            reparaciones: resultadoMejora.reparaciones,
            logsFase1,
            logsEjection,
            logsFirstFSM: loggerFirstFSM.obtenerReporte()
        };

        return { asignaciones, metricas };
    }

    /**
     * Variante async para evaluaciones que deben esperar restricciones ML reales.
     * Mantiene la fase constructiva sincrona y hace bloqueantes las evaluaciones Z.
     */

    public async ejecutarAsync(
        profesores: ProfesorDTO[],
        grupos: GrupoDTO[],
        grafoInicial: GrafoBipartito | null = null,
        context: EvaluationContext = {}
    ): Promise<ResultadoGreedy> {
        const inicio = performance.now();

        SemanaLaboral.invalidarCache();

        const grafo = grafoInicial ? grafoInicial.clonar() : new GrafoBipartito();
        if (!grafoInicial) {
            profesores.forEach(p => grafo.registrarProfesor(p));
            grupos.forEach(g => grafo.registrarGrupo(g));
        }

        const reglasFast = ReglasPipeline.getReglasFastFail();
        const reglasRestantes = ReglasPipeline.getReglasRestantes();
        const fsmFilter = FSMFactory.crear(grafo, reglasFast);
        const fsmRegular = FSMFactory.crear(grafo, reglasRestantes);
        const loggerFirstFSM = new FirstFSMLogger();

        const gruposPorArea = this._agruparPorArea(grupos);
        const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
        const profesoresPorArea = this._agruparProfesoresPorArea(profesores);

        const disableLogs = this._rclConfig.disableLogs === true;
        const gruposAsignados = new Set<number>();
        let totalEvaluaciones = 0;
        let totalRechazados = 0;

        const logsFase1: DebugFSMRechazo[] = [];
        const logsEjection: DebugEjectionRechazo[] = [];
        const usePenalty = !!this._penaltyRcl;

        for (const [idArea, gruposDelArea] of areasOrdenadas) {
            const profesoresDelArea = profesoresPorArea.get(idArea) || [];
            if (profesoresDelArea.length === 0) continue;

            const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);
            const gruposDelAreaPendientes = new Set(gruposOrdenados.map(g => g.idUeaGrupo).filter(id => !gruposAsignados.has(id)));

            type CandidatoGlobal = {
                eco: number;
                grupo: GrupoDTO;
                scoreSijh: number;
                estadoFSM: EstadoAsignacion;
                ultimoErrorFSM?: string;
                viabilidadPenalty?: number;
                penaltyRaw?: number;
                loadPenalty?: number;
                loadProbability?: number;
                penaltyProbability?: number;
                loadDensityRatio?: number;
                projectedUeaCount?: number;
                penaltyBlocked?: boolean;
                penaltyBlockReason?: string;
                scoreRcl?: number;
            };

            let candidatosGlobales: CandidatoGlobal[] = [];
            const candidatosTentadosPorGrupo = new Map<number, DebugFSMRechazo['candidatosTentados']>();

            for (const grupo of gruposOrdenados) {
                if (gruposAsignados.has(grupo.idUeaGrupo)) continue;
                candidatosTentadosPorGrupo.set(grupo.idUeaGrupo, []);

                const profesoresParaGrupo = this._estrategia.ordenarProfesores(profesoresDelArea, grupo.idUeaGrupo);
                let validosGrupo: CandidatoGlobal[] = [];

                for (const profesor of profesoresParaGrupo) {
                    totalEvaluaciones++;
                    const resultadoFilter = fsmFilter.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);

                    if (resultadoFilter.estado !== EstadoAsignacion.ASIGNACION_OK) {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = resultadoFilter.error ? `${resultadoFilter.error.reglaFallo} - ${resultadoFilter.error.motivo}` : 'Fallo Filter FSM';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoFilter.error?.reglaFallo || 'UNKNOWN', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: 0, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                        continue;
                    }

                    const detalles = typeof (this._modelo as any).getScoreDetails === 'function'
                        ? (this._modelo as any).getScoreDetails(profesor.numeroEconomico, grupo.idUeaGrupo)
                        : null;
                    const scoreSijh = detalles ? detalles.score : this._modelo.score(profesor.numeroEconomico, grupo.idUeaGrupo);

                    if (detalles && detalles.h_ih < 0.05) {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = 'PODA_KDE - h_ih (densidad KDE) por debajo del umbral 0.05';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, 'PODA_KDE', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                        continue;
                    }

                    if (scoreSijh === 0.0) {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = 'CACHE_MISS - Combinacion sin prediccion ML en Redis';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, 'CACHE_MISS', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: 0, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                        continue;
                    }

                    const resultadoRegular = fsmRegular.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);
                    if (resultadoRegular.estado === EstadoAsignacion.ASIGNACION_OK) {
                        validosGrupo.push({
                            eco: profesor.numeroEconomico,
                            grupo: grupo,
                            scoreSijh: scoreSijh,
                            estadoFSM: EstadoAsignacion.ASIGNACION_OK,
                            scoreRcl: scoreSijh
                        });
                    } else {
                        totalRechazados++;
                        if (!disableLogs) {
                            const errorMsg = resultadoRegular.error ? `${resultadoRegular.error.reglaFallo} - ${resultadoRegular.error.motivo}` : 'Fallo Regular FSM';
                            loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoRegular.error?.reglaFallo || 'UNKNOWN', errorMsg);
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: profesor.numeroEconomico, puntajeSijh: scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: errorMsg
                            });
                        }
                    }
                }

                if (validosGrupo.length > this._rclConfig.k && this._rclConfig.k > 0) {
                    validosGrupo.sort((a, b) => b.scoreSijh - a.scoreSijh);
                    const descartados = validosGrupo.slice(this._rclConfig.k);
                    validosGrupo = validosGrupo.slice(0, this._rclConfig.k);

                    if (!disableLogs) {
                        for (const desc of descartados) {
                            candidatosTentadosPorGrupo.get(grupo.idUeaGrupo)!.push({
                                eco: desc.eco, puntajeSijh: desc.scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: 'Fuera del Top K base del grupo'
                            });
                        }
                    }
                }

                candidatosGlobales.push(...validosGrupo);
            }

            if (usePenalty) {
                await Promise.all(candidatosGlobales.map(async cand => {
                    const penalty = await this._penaltyRcl!.evaluarCandidatoAsync(grafo, cand.eco, cand.grupo.idUeaGrupo, {
                        ...context,
                        fase: 'constructiva:rcl',
                        idUeaGrupo: cand.grupo.idUeaGrupo,
                        uea: cand.grupo.ueaClave,
                        claveGrupo: cand.grupo.claveGrupo
                    });
                    cand.viabilidadPenalty = penalty.viabilidad;
                    cand.penaltyRaw = penalty.penalty;
                    cand.loadPenalty = penalty.loadPenalty;
                    cand.loadProbability = penalty.loadProbability;
                    cand.penaltyProbability = penalty.penaltyProbability;
                    cand.loadDensityRatio = penalty.loadDensityRatio;
                    cand.projectedUeaCount = penalty.projectedUeaCount;
                    cand.penaltyBlocked = penalty.blocked;
                    cand.penaltyBlockReason = penalty.blockReason;
                    cand.scoreRcl = cand.scoreSijh + (this._lambdaPenaltyRcl * penalty.viabilidad);
                }));

                if (!disableLogs) {
                    for (const cand of candidatosGlobales.filter(c => c.penaltyBlocked)) {
                        candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo)!.push({
                            eco: cand.eco,
                            puntajeSijh: cand.scoreSijh,
                            viabilidadPenalty: cand.viabilidadPenalty,
                            penaltyRaw: cand.penaltyRaw,
                            scoreRcl: cand.scoreRcl,
                            loadPenalty: cand.loadPenalty,
                            loadProbability: cand.loadProbability,
                            penaltyProbability: cand.penaltyProbability,
                            loadDensityRatio: cand.loadDensityRatio,
                            projectedUeaCount: cand.projectedUeaCount,
                            penaltyBlocked: true,
                            penaltyBlockReason: cand.penaltyBlockReason,
                            estado: 'RECHAZADO',
                            ultimoErrorFSM: cand.penaltyBlockReason ?? 'PENALTY_DOMAIN_BLOCK'
                        });
                    }
                }

                totalRechazados += candidatosGlobales.filter(c => c.penaltyBlocked).length;
                candidatosGlobales = candidatosGlobales.filter(c => !c.penaltyBlocked);
            }

            while (gruposDelAreaPendientes.size > 0 && candidatosGlobales.length > 0) {
                candidatosGlobales.sort((a, b) => b.scoreRcl! - a.scoreRcl!);

                let candidatosFiltrados = candidatosGlobales;
                if (this._rclConfig.k > 0) {
                    candidatosFiltrados = candidatosFiltrados.slice(0, this._rclConfig.k);
                }

                const maxScore = candidatosFiltrados[0].scoreRcl!;
                const minScore = candidatosFiltrados[candidatosFiltrados.length - 1].scoreRcl!;
                
                if (this._rclConfig.alpha > 0) {
                    const umbral = maxScore - this._rclConfig.alpha * (maxScore - minScore);
                    candidatosFiltrados = candidatosFiltrados.filter(c => c.scoreRcl! >= umbral);
                } else {
                    candidatosFiltrados = candidatosFiltrados.filter(c => c.scoreRcl! === maxScore);
                }

                const elegido = candidatosFiltrados[Math.floor(Math.random() * candidatosFiltrados.length)];

                grafo.asignarMutable(elegido.eco, elegido.grupo.idUeaGrupo);
                gruposAsignados.add(elegido.grupo.idUeaGrupo);
                gruposDelAreaPendientes.delete(elegido.grupo.idUeaGrupo);

                if (!disableLogs) {
                    const tentados = candidatosTentadosPorGrupo.get(elegido.grupo.idUeaGrupo) || [];
                    const grupoCandidatos = candidatosGlobales.filter(c => c.grupo.idUeaGrupo === elegido.grupo.idUeaGrupo);
                    for (const cand of grupoCandidatos) {
                        tentados.push({
                            eco: cand.eco,
                            puntajeSijh: cand.scoreSijh,
                            viabilidadPenalty: cand.viabilidadPenalty,
                            penaltyRaw: cand.penaltyRaw,
                            scoreRcl: cand.scoreRcl,
                            loadPenalty: cand.loadPenalty,
                            loadProbability: cand.loadProbability,
                            penaltyProbability: cand.penaltyProbability,
                            loadDensityRatio: cand.loadDensityRatio,
                            projectedUeaCount: cand.projectedUeaCount,
                            penaltyBlocked: cand.penaltyBlocked,
                            penaltyBlockReason: cand.penaltyBlockReason,
                            estado: cand.eco === elegido.eco ? 'ELEGIDO' : 'RECHAZADO',
                            ultimoErrorFSM: cand.eco === elegido.eco ? undefined : 'No seleccionado en RCL Global'
                        });
                    }
                    this._registrarLogFase1(logsFase1, elegido.grupo, tentados, tentados.find(t => t.estado === 'ELEGIDO'));
                }

                candidatosGlobales = candidatosGlobales.filter(c => c.grupo.idUeaGrupo !== elegido.grupo.idUeaGrupo);

                const promesasActualizacion = candidatosGlobales
                    .filter(c => c.eco === elegido.eco)
                    .map(async cand => {
                        const res = fsmRegular.procesarAsignacion(cand.eco, cand.grupo.idUeaGrupo);
                        if (res.estado !== EstadoAsignacion.ASIGNACION_OK) {
                            cand.estadoFSM = res.estado;
                            cand.ultimoErrorFSM = res.error ? `${res.error.reglaFallo} - ${res.error.motivo}` : 'Fallo FSM por nueva carga';
                            if (!disableLogs) {
                                candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo)!.push({
                                    eco: cand.eco, puntajeSijh: cand.scoreSijh, estado: 'RECHAZADO', ultimoErrorFSM: cand.ultimoErrorFSM
                                });
                            }
                        } else if (usePenalty) {
                            const penalty = await this._penaltyRcl!.evaluarCandidatoAsync(grafo, cand.eco, cand.grupo.idUeaGrupo, {
                                ...context,
                                fase: 'constructiva:rcl',
                                idUeaGrupo: cand.grupo.idUeaGrupo,
                                uea: cand.grupo.ueaClave,
                                claveGrupo: cand.grupo.claveGrupo
                            });
                            cand.viabilidadPenalty = penalty.viabilidad;
                            cand.penaltyRaw = penalty.penalty;
                            cand.loadPenalty = penalty.loadPenalty;
                            cand.loadProbability = penalty.loadProbability;
                            cand.penaltyProbability = penalty.penaltyProbability;
                            cand.loadDensityRatio = penalty.loadDensityRatio;
                            cand.projectedUeaCount = penalty.projectedUeaCount;
                            cand.penaltyBlocked = penalty.blocked;
                            cand.penaltyBlockReason = penalty.blockReason;
                            cand.scoreRcl = cand.scoreSijh + (this._lambdaPenaltyRcl * penalty.viabilidad);
                            if (cand.penaltyBlocked) {
                                totalRechazados++;
                                if (!disableLogs) {
                                    candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo)!.push({
                                        eco: cand.eco,
                                        puntajeSijh: cand.scoreSijh,
                                        viabilidadPenalty: cand.viabilidadPenalty,
                                        penaltyRaw: cand.penaltyRaw,
                                        scoreRcl: cand.scoreRcl,
                                        loadPenalty: cand.loadPenalty,
                                        loadProbability: cand.loadProbability,
                                        penaltyProbability: cand.penaltyProbability,
                                        loadDensityRatio: cand.loadDensityRatio,
                                        projectedUeaCount: cand.projectedUeaCount,
                                        penaltyBlocked: true,
                                        penaltyBlockReason: cand.penaltyBlockReason,
                                        estado: 'RECHAZADO',
                                        ultimoErrorFSM: cand.penaltyBlockReason ?? 'PENALTY_DOMAIN_BLOCK'
                                    });
                                }
                            }
                        }
                    });
                
                await Promise.all(promesasActualizacion);

                candidatosGlobales = candidatosGlobales.filter(c =>
                    c.estadoFSM === EstadoAsignacion.ASIGNACION_OK && !c.penaltyBlocked
                );
            }

            if (!disableLogs) {
                for (const idGrupoHuerfano of gruposDelAreaPendientes) {
                    const grupo = gruposOrdenados.find(g => g.idUeaGrupo === idGrupoHuerfano)!;
                    const tentados = candidatosTentadosPorGrupo.get(idGrupoHuerfano) || [];
                    logsFase1.push({
                        idUeaGrupo: grupo.idUeaGrupo,
                        uea: grupo.ueaClave,
                        claveGrupo: grupo.claveGrupo,
                        horario: grupo.horarioStringRaw,
                        resolucion: `Ninguno de los ${tentados.length} candidatos logro sortear la FSM. Termino huerfano.`,
                        candidatosTentados: tentados
                    });
                }
            }
        }

        const todosLosGrupoIds = grupos.map(g => g.idUeaGrupo);
        const huerfanosPreRepair = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const dummyLogsEjection: DebugEjectionRechazo[] = [];
        const resultadoMejora = await this._ejectionChain.mejorarSolucionAsync(
            grafo,
            fsmRegular,
            this._funcionZ,
            huerfanosPreRepair,
            disableLogs ? dummyLogsEjection : logsEjection,
            { ...context, fase: 'ejection' }
        );
        const resultadoZ = await this._funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: 'final-z' });
        const asignaciones: AsignacionInput[] = [];
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            asignaciones.push({
                numeroEconomico: numEco,
                idUeaGrupo: idGrupo
            });
        }

        const gruposSinAsignar = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const fin = performance.now();

        const metricas: MetricasGreedy = {
            totalEvaluaciones,
            totalAsignados: asignaciones.length,
            totalRechazados,
            tiempoMs: Math.round(fin - inicio),
            gruposSinAsignar,
            scoreZ: resultadoZ.Z,
            mejorasLocales: resultadoMejora.mejoras,
            reparaciones: resultadoMejora.reparaciones,
            logsFase1,
            logsEjection,
            logsFirstFSM: loggerFirstFSM.obtenerReporte()
        };

        return { asignaciones, metricas };
    }


    private _agruparPorArea(grupos: GrupoDTO[]): Map<string, GrupoDTO[]> {
        const mapa = new Map<string, GrupoDTO[]>();
        for (const grupo of grupos) {
            if (!mapa.has(grupo.idArea)) {
                mapa.set(grupo.idArea, []);
            }
            mapa.get(grupo.idArea)!.push(grupo);
        }
        return mapa;
    }

    private _agruparProfesoresPorArea(profesores: ProfesorDTO[]): Map<string, ProfesorDTO[]> {
        const mapa = new Map<string, ProfesorDTO[]>();
        for (const profesor of profesores) {
            for (const area of profesor.idArea) {
                if (!mapa.has(area)) {
                    mapa.set(area, []);
                }
                mapa.get(area)!.push(profesor);
            }
        }
        return mapa;
    }

    private _registrarLogFase1(
        logsFase1: DebugFSMRechazo[],
        grupo: GrupoDTO,
        candidatosTentados: DebugFSMRechazo['candidatosTentados'],
        elegido?: DebugFSMRechazo['candidatosTentados'][number]
    ): void {
        logsFase1.push({
            idUeaGrupo: grupo.idUeaGrupo,
            uea: grupo.ueaClave,
            claveGrupo: grupo.claveGrupo,
            horario: grupo.horarioStringRaw,
            ecoElegido: elegido?.eco,
            resolucion: elegido
                ? `Asignado en fase 1 a ${elegido.eco}. Candidatos registrados: ${candidatosTentados.length}.`
                : `Ninguno de los ${candidatosTentados.length} candidatos logro sortear la FSM. Termino huerfano.`,
            candidatosTentados
        });
    }
}
