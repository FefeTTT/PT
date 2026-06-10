import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { CriterioAceptacion, ClasificacionDelta } from '../objective/Tolerancia';
import { ProfesorDTO } from '../types/AssignmentTypes';
import { EvaluationContext } from '../objective/SoftConstraints';
import { DebugEjectionRechazo } from './GreedyTypes';
import { ContextoRegla } from '../rules/ReglaBase';
import { ZScoreDetails } from '../ml/IModeloML';

interface TuplaDominioEyectado {
    numEco: number;
    idGrupo: number;
    uea: number;
    horario: string;
}

export interface TelemetriaOptimizacion {
    aceptadasPorMejora: number;
    rechazadasPorRuido: number;
    rechazadasPorUmbral: number;
    rechazadasSinMejora: number;
    deltaZAcumulado: number;
}

export interface ResultadoMejora {
    grafo: GrafoBipartito;
    reparaciones: number;
    mejoras: number;
    iteracionesEjecutadas: number;
    telemetria: TelemetriaOptimizacion;
}

/**
 * Ejection Chain — Búsqueda Local para GRASP (inspirada en KHE14 algorithm).
 *
 * Fase 1 — Reparación (hard constraints):
 *   Para cada grupo sin asignar, intenta ejectar una asignación existente
 *   del mismo área y reasignar al profesor eyectado a otro grupo,
 *   liberando espacio para el grupo huérfano. Toda reasignación se valida con FSM.
 *
 * Fase 2 — Optimización (soft constraints):
 *   Sobre las asignaciones ya válidas, intenta swaps entre profesores
 *   del mismo área. Acepta el cambio solo si ΔZ supera tolerancia numérica + umbral.
 *   Para cuando no hay mejora en N iteraciones consecutivas.
 */
export class EjectionChain {
    private _maxIteraciones: number;
    private _maxIteracionesSinMejora: number;
    private _criterio: CriterioAceptacion;

    constructor(
        maxIteraciones: number = 100,
        maxIteracionesSinMejora: number = 20,
        criterio?: CriterioAceptacion
    ) {
        this._maxIteraciones = maxIteraciones;
        this._maxIteracionesSinMejora = maxIteracionesSinMejora;
        this._criterio = criterio ?? new CriterioAceptacion();
    }

    public mejorarSolucion(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        gruposSinAsignar: number[] = [],
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[] = []
    ): ResultadoMejora {
        const reparaciones = this._repararHuerfanos(grafo, fsm, gruposSinAsignar);
        const optimizacion = this._optimizarZ(grafo, fsm, funcionZ, logsEjection);

        return {
            grafo,
            reparaciones,
            mejoras: optimizacion.mejoras,
            iteracionesEjecutadas: optimizacion.iteraciones,
            telemetria: optimizacion.telemetria
        };
    }

    public mejorar(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        gruposSinAsignar: number[] = [],
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[] = []
    ): ResultadoMejora {
        return this.mejorarSolucion(grafo, fsm, funcionZ, gruposSinAsignar, logsEjection);
    }

    public async mejorarSolucionAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        gruposSinAsignar: number[] = [],
        logsEjection: DebugEjectionRechazo[] = [],
        context?: EvaluationContext
    ): Promise<ResultadoMejora> {
        const reparaciones = await this._repararHuerfanosAsync(
            grafo,
            fsm,
            funcionZ,
            gruposSinAsignar,
            logsEjection,
            context
        );
        const optimizacion = await this._optimizarZAsync(grafo, fsm, funcionZ, logsEjection, context);

        return {
            grafo,
            reparaciones,
            mejoras: optimizacion.mejoras,
            iteracionesEjecutadas: optimizacion.iteraciones,
            telemetria: optimizacion.telemetria
        };
    }

    public async mejorarAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        gruposSinAsignar: number[] = [],
        logsEjection: DebugEjectionRechazo[] = [],
        context?: EvaluationContext
    ): Promise<ResultadoMejora> {
        return this.mejorarSolucionAsync(grafo, fsm, funcionZ, gruposSinAsignar, logsEjection, context);
    }

    // ── Fase 1 ─────────────────────────────────────────

    private _repararHuerfanos(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        gruposSinAsignar: number[]
    ): number {
        let reparaciones = 0;
        const pendientes = [...gruposSinAsignar];

        for (const idGrupoHuerfano of pendientes) {
            if (this._grupoYaAsignado(grafo, idGrupoHuerfano)) continue;
            if (!this._grupoExiste(grafo, idGrupoHuerfano)) continue;

            const reparado = this._intentarReparacionPorEyeccion(grafo, fsm, idGrupoHuerfano);

            if (reparado) {
                reparaciones++;
                continue;
            }

            const reparadoDirecto = this._intentarAsignacionDirecta(grafo, fsm, idGrupoHuerfano);
            if (reparadoDirecto) {
                reparaciones++;
            }
        }

        return reparaciones;
    }

    private async _repararHuerfanosAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        gruposSinAsignar: number[],
        logsEjection: DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<number> {
        let reparaciones = 0;
        const pendientes = [...gruposSinAsignar];
        let zActual = (await funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: 'ejection:repair:init' })).Z;

        for (const idGrupoHuerfano of pendientes) {
            if (this._grupoYaAsignado(grafo, idGrupoHuerfano)) continue;
            if (!this._grupoExiste(grafo, idGrupoHuerfano)) continue;

            const reparado = await this._intentarReparacionPorEyeccionAsync(
                grafo,
                fsm,
                funcionZ,
                idGrupoHuerfano,
                zActual,
                logsEjection,
                context
            );

            if (reparado) {
                reparaciones++;
                zActual = (await funcionZ.evaluarGrafoAsync(grafo, {
                    ...context,
                    fase: 'ejection:repair:accepted',
                    idUeaGrupo: idGrupoHuerfano
                })).Z;
                continue;
            }

            const reparadoDirecto = await this._intentarAsignacionDirectaAsync(
                grafo,
                fsm,
                funcionZ,
                idGrupoHuerfano,
                zActual,
                logsEjection,
                context
            );

            if (reparadoDirecto) {
                reparaciones++;
                zActual = (await funcionZ.evaluarGrafoAsync(grafo, {
                    ...context,
                    fase: 'ejection:repair:accepted',
                    idUeaGrupo: idGrupoHuerfano
                })).Z;
            }
        }

        return reparaciones;
    }

    private _grupoYaAsignado(grafo: GrafoBipartito, idGrupo: number): boolean {
        return grafo.asignacionesInversas.has(idGrupo);
    }

    private _grupoExiste(grafo: GrafoBipartito, idGrupo: number): boolean {
        return grafo.grupos.has(idGrupo);
    }

    private _obtenerAreaDelGrupo(grafo: GrafoBipartito, idGrupo: number): string {
        return grafo.grupos.get(idGrupo)!.idArea;
    }

    private _buscarAsignacionesMismaArea(
        grafo: GrafoBipartito,
        idArea: string
    ): { idGrupo: number; numEco: number }[] {
        const resultado: { idGrupo: number; numEco: number }[] = [];
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            const grupo = grafo.grupos.get(idGrupo);
            if (grupo && grupo.idArea === idArea) {
                resultado.push({ idGrupo, numEco });
            }
        }
        return resultado;
    }

    private _buscarProfesoresDelAreaExcluyendo(
        grafo: GrafoBipartito,
        idArea: string,
        excluirNumEco: number
    ): ProfesorDTO[] {
        return Array.from(grafo.profesores.values())
            .filter(p => p.idArea.includes(idArea) && p.numeroEconomico !== excluirNumEco);
    }

    private _buscarProfesoresDelArea(grafo: GrafoBipartito, idArea: string): ProfesorDTO[] {
        return Array.from(grafo.profesores.values())
            .filter(p => p.idArea.includes(idArea));
    }

    private _intentarReparacionPorEyeccion(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        idGrupoHuerfano: number
    ): boolean {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const victimas = this._buscarAsignacionesMismaArea(grafo, idArea);

        for (const victima of victimas) {
            const cadenaExitosa = this._ejecutarCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
            if (cadenaExitosa) return true;
        }

        return false;
    }

    private async _intentarReparacionPorEyeccionAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        idGrupoHuerfano: number,
        zActual: number,
        logsEjection: DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<boolean> {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const victimas = this._buscarAsignacionesMismaArea(grafo, idArea);

        for (const victima of victimas) {
            const cadenaExitosa = await this._ejecutarCadenaEyeccionAsync(
                grafo,
                fsm,
                funcionZ,
                idGrupoHuerfano,
                victima,
                zActual,
                logsEjection,
                context
            );
            if (cadenaExitosa) return true;
        }

        return false;
    }

    private _ejecutarCadenaEyeccion(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        idGrupoHuerfano: number,
        victima: { idGrupo: number; numEco: number }
    ): boolean {
        this._eyectarAsignacion(grafo, fsm, victima.idGrupo);

        const huerfanoAsignadoAVictima = this._intentarAsignacionFSM(
            grafo, fsm, victima.numEco, idGrupoHuerfano
        );

        if (!huerfanoAsignadoAVictima) {
            this._restaurarAsignacion(grafo, fsm, victima.numEco, victima.idGrupo);
            return false;
        }

        grafo.asignarMutable(victima.numEco, idGrupoHuerfano);

        const victimaReasignada = this._intentarReasignarVictima(
            grafo, fsm, victima, idGrupoHuerfano
        );

        if (victimaReasignada) return true;

        this._revertirCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
        return false;
    }

    private async _ejecutarCadenaEyeccionAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        idGrupoHuerfano: number,
        victima: { idGrupo: number; numEco: number },
        zActual: number,
        logsEjection: DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<boolean> {
        const dominio = this._construirDominioSubconjuntoEyectado(grafo, idGrupoHuerfano, victima);
        const huerfanoParaVictima = dominio.find(t =>
            t.numEco === victima.numEco && t.idGrupo === idGrupoHuerfano
        );

        if (!huerfanoParaVictima) {
            return false;
        }

        this._eyectarAsignacion(grafo, fsm, victima.idGrupo);

        const huerfanoAsignadoAVictima = await this._intentarAsignacionDominioAsync(
            grafo,
            fsm,
            funcionZ,
            huerfanoParaVictima,
            logsEjection,
            { idGrupoOrig: victima.idGrupo, numEcoOrig: victima.numEco },
            {
                ...context,
                fase: 'ejection:repair:huerfano',
                idUeaGrupo: idGrupoHuerfano,
                ecoCandidato: victima.numEco
            }
        );

        if (!huerfanoAsignadoAVictima) {
            this._restaurarAsignacion(grafo, fsm, victima.numEco, victima.idGrupo);
            return false;
        }

        grafo.asignarMutable(victima.numEco, idGrupoHuerfano);
        fsm.actualizarGrafo(grafo);

        const victimaReasignada = await this._intentarReasignarVictimaAsync(
            grafo,
            fsm,
            funcionZ,
            victima,
            idGrupoHuerfano,
            zActual,
            logsEjection,
            context
        );

        if (victimaReasignada) return true;

        this._revertirCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
        return false;
    }

    private _construirDominioSubconjuntoEyectado(
        grafo: GrafoBipartito,
        idGrupoHuerfano: number,
        victima: { idGrupo: number; numEco: number }
    ): TuplaDominioEyectado[] {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const gruposEyectados = [idGrupoHuerfano, victima.idGrupo];
        const profesoresCompatibles = this._buscarProfesoresDelArea(grafo, idArea);
        const dominio: TuplaDominioEyectado[] = [];

        for (const idGrupo of gruposEyectados) {
            const grupo = grafo.grupos.get(idGrupo);
            if (!grupo) continue;

            for (const profesor of profesoresCompatibles) {
                if (idGrupo === idGrupoHuerfano && profesor.numeroEconomico !== victima.numEco) {
                    continue;
                }

                if (idGrupo === victima.idGrupo && profesor.numeroEconomico === victima.numEco) {
                    continue;
                }

                dominio.push({
                    numEco: profesor.numeroEconomico,
                    idGrupo,
                    uea: grupo.ueaClave,
                    horario: grupo.horarioStringRaw
                });
            }
        }

        return dominio;
    }

    private _eyectarAsignacion(grafo: GrafoBipartito, fsm: FSMAsignador, idGrupo: number): void {
        grafo.desasignarMutable(idGrupo);
        fsm.actualizarGrafo(grafo);
    }

    private _intentarAsignacionFSM(
        _grafo: GrafoBipartito,
        fsm: FSMAsignador,
        numEco: number,
        idGrupo: number,
        logsEjection?: import('./GreedyTypes').DebugEjectionRechazo[],
        vitimaContext?: { idGrupoOrig: number; numEcoOrig: number },
        contextoReglas?: ContextoRegla
    ): boolean {
        const resultado = fsm.procesarAsignacion(numEco, idGrupo, contextoReglas);
        if (resultado.estado !== EstadoAsignacion.ASIGNACION_OK && logsEjection && vitimaContext) {
            logsEjection.push({
                ecoVictima: vitimaContext.numEcoOrig,
                ecoCandidato: numEco,
                idUeaGrupo: idGrupo,
                tipo: 'FSM_ERROR',
                detalle: resultado.error ? `${resultado.error.reglaFallo} - ${resultado.error.motivo}` : 'Error Indeterminado'
            });
        }
        return resultado.estado === EstadoAsignacion.ASIGNACION_OK;
    }

    private async _intentarAsignacionDominioAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        tupla: TuplaDominioEyectado,
        logsEjection: DebugEjectionRechazo[],
        victimaContext: { idGrupoOrig: number; numEcoOrig: number },
        context?: EvaluationContext
    ): Promise<boolean> {
        const detallesZ = funcionZ.obtenerDetallesCandidato(grafo, tupla.numEco, tupla.idGrupo);
        if (!this._intentarAsignacionFSM(
            grafo,
            fsm,
            tupla.numEco,
            tupla.idGrupo,
            logsEjection,
            victimaContext,
            this._contextoReglasDesdeZ(detallesZ)
        )) {
            return false;
        }

        const dominio = await funcionZ.evaluarDominioCandidatoAsync(
            grafo,
            tupla.numEco,
            tupla.idGrupo,
            {
                ...context,
                uea: tupla.uea,
                horario: tupla.horario
            }
        );

        if (!dominio.permitido) {
            logsEjection.push({
                ecoVictima: victimaContext.numEcoOrig,
                ecoCandidato: tupla.numEco,
                idUeaGrupo: tupla.idGrupo,
                tipo: this._tipoRechazoDominio(dominio.rechazos),
                detalle: dominio.rechazos.join(' | ')
            });
            return false;
        }

        return true;
    }

    private _restaurarAsignacion(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        numEco: number,
        idGrupo: number
    ): void {
        grafo.asignarMutable(numEco, idGrupo);
        fsm.actualizarGrafo(grafo);
    }

    private _intentarReasignarVictima(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        victima: { idGrupo: number; numEco: number },
        idGrupoHuerfano: number
    ): boolean {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const candidatos = this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, victima.numEco);

        fsm.actualizarGrafo(grafo);

        for (const cand of candidatos) {
            if (this._intentarAsignacionFSM(grafo, fsm, cand.numeroEconomico, victima.idGrupo)) {
                grafo.asignarMutable(cand.numeroEconomico, victima.idGrupo);
                fsm.actualizarGrafo(grafo);
                return true;
            }
        }

        return false;
    }

    private async _intentarReasignarVictimaAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        victima: { idGrupo: number; numEco: number },
        idGrupoHuerfano: number,
        zActual: number,
        logsEjection: DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<boolean> {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const grupoVictima = grafo.grupos.get(victima.idGrupo);
        if (!grupoVictima) return false;

        const candidatos = this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, victima.numEco);

        fsm.actualizarGrafo(grafo);

        for (const cand of candidatos) {
            const tupla: TuplaDominioEyectado = {
                numEco: cand.numeroEconomico,
                idGrupo: victima.idGrupo,
                uea: grupoVictima.ueaClave,
                horario: grupoVictima.horarioStringRaw
            };

            const candidatoValido = await this._intentarAsignacionDominioAsync(
                grafo,
                fsm,
                funcionZ,
                tupla,
                logsEjection,
                { idGrupoOrig: victima.idGrupo, numEcoOrig: victima.numEco },
                {
                    ...context,
                    fase: 'ejection:repair:victima',
                    idUeaGrupo: victima.idGrupo,
                    ecoCandidato: cand.numeroEconomico
                }
            );

            if (!candidatoValido) continue;

            grafo.asignarMutable(cand.numeroEconomico, victima.idGrupo);
            fsm.actualizarGrafo(grafo);

            const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, {
                ...context,
                fase: 'ejection:repair:z',
                idUeaGrupo: victima.idGrupo,
                ecoCandidato: cand.numeroEconomico
            })).Z;

            if (this._aceptaNoDegradacion(zNuevo, zActual)) {
                return true;
            }

            logsEjection.push({
                ecoVictima: victima.numEco,
                ecoCandidato: cand.numeroEconomico,
                idUeaGrupo: victima.idGrupo,
                tipo: 'SIN_MEJORA',
                detalle: `Reasignacion de victima fuera de dominio Z. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${zActual.toFixed(2)}`
            });
            grafo.desasignarMutable(victima.idGrupo);
            fsm.actualizarGrafo(grafo);
        }

        return false;
    }

    private _revertirCadenaEyeccion(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        idGrupoHuerfano: number,
        victima: { idGrupo: number; numEco: number }
    ): void {
        grafo.desasignarMutable(idGrupoHuerfano);
        grafo.asignarMutable(victima.numEco, victima.idGrupo);
        fsm.actualizarGrafo(grafo);
    }

    private _intentarAsignacionDirecta(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        idGrupoHuerfano: number
    ): boolean {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const profesores = this._buscarProfesoresDelArea(grafo, idArea);

        fsm.actualizarGrafo(grafo);

        for (const prof of profesores) {
            if (this._intentarAsignacionFSM(grafo, fsm, prof.numeroEconomico, idGrupoHuerfano)) {
                grafo.asignarMutable(prof.numeroEconomico, idGrupoHuerfano);
                fsm.actualizarGrafo(grafo);
                return true;
            }
        }

        return false;
    }

    private async _intentarAsignacionDirectaAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        idGrupoHuerfano: number,
        zActual: number,
        logsEjection: DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<boolean> {
        const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
        const grupo = grafo.grupos.get(idGrupoHuerfano);
        if (!grupo) return false;

        const profesores = this._buscarProfesoresDelArea(grafo, idArea);

        fsm.actualizarGrafo(grafo);

        for (const prof of profesores) {
            const tupla: TuplaDominioEyectado = {
                numEco: prof.numeroEconomico,
                idGrupo: idGrupoHuerfano,
                uea: grupo.ueaClave,
                horario: grupo.horarioStringRaw
            };

            const candidatoValido = await this._intentarAsignacionDominioAsync(
                grafo,
                fsm,
                funcionZ,
                tupla,
                logsEjection,
                { idGrupoOrig: idGrupoHuerfano, numEcoOrig: prof.numeroEconomico },
                {
                    ...context,
                    fase: 'ejection:repair:directa',
                    idUeaGrupo: idGrupoHuerfano,
                    ecoCandidato: prof.numeroEconomico
                }
            );

            if (!candidatoValido) continue;

            grafo.asignarMutable(prof.numeroEconomico, idGrupoHuerfano);
            fsm.actualizarGrafo(grafo);

            const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, {
                ...context,
                fase: 'ejection:repair:directa:z',
                idUeaGrupo: idGrupoHuerfano,
                ecoCandidato: prof.numeroEconomico
            })).Z;

            if (this._aceptaNoDegradacion(zNuevo, zActual)) {
                return true;
            }

            logsEjection.push({
                ecoVictima: prof.numeroEconomico,
                ecoCandidato: prof.numeroEconomico,
                idUeaGrupo: idGrupoHuerfano,
                tipo: 'SIN_MEJORA',
                detalle: `Asignacion directa no preserva Z. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${zActual.toFixed(2)}`
            });
            grafo.desasignarMutable(idGrupoHuerfano);
            fsm.actualizarGrafo(grafo);
        }

        return false;
    }

    private _tipoRechazoDominio(rechazos: string[]): 'PENALTY_DOMAIN_BLOCK' | 'Z_DOMAIN_BLOCK' {
        return rechazos.some(rechazo => rechazo.startsWith('FUNCION_Z:'))
            ? 'Z_DOMAIN_BLOCK'
            : 'PENALTY_DOMAIN_BLOCK';
    }

    // ── Fase 2 ─────────────────────────────────────────

    private _contextoReglasDesdeZ(detalles: ZScoreDetails): ContextoRegla {
        return {
            hayAcuerdoHorarioLaboral: {
                revisarAcuerdo: 1,
                umbral: 0.02,
                score: detalles.kde_ih_raw ?? detalles.kde_ih ?? detalles.h_ih ?? 0
            }
        };
    }

    private _aceptaNoDegradacion(zNuevo: number, zActual: number): boolean {
        return zNuevo + 1e-9 >= zActual;
    }

    private _optimizarZ(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[]
    ): { mejoras: number; iteraciones: number; telemetria: TelemetriaOptimizacion } {
        const estado = this._crearEstadoOptimizacion(funcionZ.evaluarGrafo(grafo).Z);

        while (this._debeContinuarOptimizacion(estado)) {
            estado.iteracion++;

            const movimiento = this._seleccionarMovimientoAleatorio(grafo);
            if (!movimiento) break;

            const candidatos = this._obtenerCandidatosSwap(grafo, movimiento);
            if (candidatos.length === 0) {
                estado.sinMejora++;
                continue;
            }

            this._ejecutarIteracionSwap(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection);
        }

        return {
            mejoras: estado.telemetria.aceptadasPorMejora,
            iteraciones: estado.iteracion,
            telemetria: estado.telemetria
        };
    }

    private async _optimizarZAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<{ mejoras: number; iteraciones: number; telemetria: TelemetriaOptimizacion }> {
        const estado = this._crearEstadoOptimizacion((await funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: 'ejection:init' })).Z);

        while (this._debeContinuarOptimizacion(estado)) {
            estado.iteracion++;

            const movimiento = this._seleccionarMovimientoAleatorio(grafo);
            if (!movimiento) break;

            const candidatos = this._obtenerCandidatosSwap(grafo, movimiento);
            if (candidatos.length === 0) {
                estado.sinMejora++;
                continue;
            }

            await this._ejecutarIteracionSwapAsync(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection, {
                ...context,
                fase: 'ejection:swap',
                iteracionEjection: estado.iteracion,
                idUeaGrupo: movimiento.idGrupo,
                ecoOriginal: movimiento.numEcoOriginal
            });
        }

        return {
            mejoras: estado.telemetria.aceptadasPorMejora,
            iteraciones: estado.iteracion,
            telemetria: estado.telemetria
        };
    }

    private _crearEstadoOptimizacion(zInicial: number): EstadoOptimizacion {
        return {
            zActual: zInicial,
            sinMejora: 0,
            iteracion: 0,
            telemetria: {
                aceptadasPorMejora: 0,
                rechazadasPorRuido: 0,
                rechazadasPorUmbral: 0,
                rechazadasSinMejora: 0,
                deltaZAcumulado: 0
            }
        };
    }

    private _debeContinuarOptimizacion(estado: EstadoOptimizacion): boolean {
        return estado.iteracion < this._maxIteraciones
            && estado.sinMejora < this._maxIteracionesSinMejora;
    }

    private _seleccionarMovimientoAleatorio(
        grafo: GrafoBipartito
    ): { idGrupo: number; numEcoOriginal: number } | null {
        const asignaciones = Array.from(grafo.asignacionesInversas.entries());
        if (asignaciones.length === 0) return null;

        const idx = Math.floor(Math.random() * asignaciones.length);
        const [idGrupo, numEcoOriginal] = asignaciones[idx];

        if (!this._grupoExiste(grafo, idGrupo)) return null;

        return { idGrupo, numEcoOriginal };
    }

    private _obtenerCandidatosSwap(
        grafo: GrafoBipartito,
        movimiento: { idGrupo: number; numEcoOriginal: number }
    ): ProfesorDTO[] {
        const idArea = this._obtenerAreaDelGrupo(grafo, movimiento.idGrupo);
        return this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, movimiento.numEcoOriginal);
    }

    private _barajarCandidatos(candidatos: ProfesorDTO[]): ProfesorDTO[] {
        const barajados = [...candidatos];
        for (let i = barajados.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
        }
        return barajados;
    }

    private _ejecutarIteracionSwap(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        movimiento: { idGrupo: number; numEcoOriginal: number },
        candidatos: ProfesorDTO[],
        estado: EstadoOptimizacion,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[]
    ): void {
        this._eyectarAsignacion(grafo, fsm, movimiento.idGrupo);
        const candidatosBarajados = this._barajarCandidatos(candidatos);

        let swapRealizado = false;

        for (const candidato of candidatosBarajados) {
            const detallesZ = funcionZ.obtenerDetallesCandidato(grafo, candidato.numeroEconomico, movimiento.idGrupo);
            if (!this._intentarAsignacionFSM(
                grafo,
                fsm,
                candidato.numeroEconomico,
                movimiento.idGrupo,
                logsEjection,
                { idGrupoOrig: movimiento.idGrupo, numEcoOrig: movimiento.numEcoOriginal },
                this._contextoReglasDesdeZ(detallesZ)
            )) {
                continue;
            }

            grafo.asignarMutable(candidato.numeroEconomico, movimiento.idGrupo);
            fsm.actualizarGrafo(grafo);

            swapRealizado = this._evaluarYDecidirSwap(
                grafo, fsm, funcionZ, movimiento, candidato.numeroEconomico, estado, logsEjection
            );
            if (swapRealizado) break;
        }

        if (!swapRealizado) {
            this._restaurarAsignacion(grafo, fsm, movimiento.numEcoOriginal, movimiento.idGrupo);
            estado.sinMejora++;
        }
    }

    private async _ejecutarIteracionSwapAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        movimiento: { idGrupo: number; numEcoOriginal: number },
        candidatos: ProfesorDTO[],
        estado: EstadoOptimizacion,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<void> {
        this._eyectarAsignacion(grafo, fsm, movimiento.idGrupo);
        const candidatosBarajados = this._barajarCandidatos(candidatos);

        let swapRealizado = false;

        for (const candidato of candidatosBarajados) {
            if (!this._intentarAsignacionFSM(grafo, fsm, candidato.numeroEconomico, movimiento.idGrupo, logsEjection, { idGrupoOrig: movimiento.idGrupo, numEcoOrig: movimiento.numEcoOriginal })) {
                continue;
            }

            const grupo = grafo.grupos.get(movimiento.idGrupo);
            const dominio = await funcionZ.evaluarDominioCandidatoAsync(
                grafo,
                candidato.numeroEconomico,
                movimiento.idGrupo,
                {
                    ...context,
                    fase: 'ejection:swap:dominio',
                    ecoCandidato: candidato.numeroEconomico,
                    uea: grupo?.ueaClave,
                    horario: grupo?.horarioStringRaw
                }
            );

            if (!dominio.permitido) {
                logsEjection.push({
                    ecoVictima: movimiento.numEcoOriginal,
                    ecoCandidato: candidato.numeroEconomico,
                    idUeaGrupo: movimiento.idGrupo,
                    tipo: this._tipoRechazoDominio(dominio.rechazos),
                    detalle: dominio.rechazos.join(' | ')
                });
                continue;
            }

            grafo.asignarMutable(candidato.numeroEconomico, movimiento.idGrupo);
            fsm.actualizarGrafo(grafo);

            swapRealizado = await this._evaluarYDecidirSwapAsync(
                grafo,
                fsm,
                funcionZ,
                movimiento,
                candidato.numeroEconomico,
                estado,
                logsEjection,
                { ...context, ecoCandidato: candidato.numeroEconomico }
            );
            if (swapRealizado) break;
        }

        if (!swapRealizado) {
            this._restaurarAsignacion(grafo, fsm, movimiento.numEcoOriginal, movimiento.idGrupo);
            estado.sinMejora++;
        }
    }

    private _evaluarYDecidirSwap(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        movimiento: { idGrupo: number; numEcoOriginal: number },
        numEcoCandidatoInfo: number,
        estado: EstadoOptimizacion,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[]
    ): boolean {
        const zNuevo = funcionZ.evaluarGrafo(grafo).Z;
        const clasificacion = this._criterio.clasificarDelta(zNuevo, estado.zActual);

        if (clasificacion === ClasificacionDelta.MEJORA_SIGNIFICATIVA) {
            this._aceptarSwap(estado, zNuevo);
            return true;
        }

        // Registrar Rechazo
        logsEjection.push({
            ecoVictima: movimiento.numEcoOriginal,
            ecoCandidato: numEcoCandidatoInfo,
            idUeaGrupo: movimiento.idGrupo,
            tipo: clasificacion as any,
            detalle: `Evaluó la Z iterativa y no superó el umbral. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${estado.zActual.toFixed(2)}`
        });

        this._rechazarSwap(grafo, fsm, movimiento, estado, clasificacion);
        return false;
    }

    private async _evaluarYDecidirSwapAsync(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ,
        movimiento: { idGrupo: number; numEcoOriginal: number },
        numEcoCandidatoInfo: number,
        estado: EstadoOptimizacion,
        logsEjection: import('./GreedyTypes').DebugEjectionRechazo[],
        context?: EvaluationContext
    ): Promise<boolean> {
        const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, context)).Z;
        const clasificacion = this._criterio.clasificarDelta(zNuevo, estado.zActual);

        if (clasificacion === ClasificacionDelta.MEJORA_SIGNIFICATIVA) {
            this._aceptarSwap(estado, zNuevo);
            return true;
        }

        logsEjection.push({
            ecoVictima: movimiento.numEcoOriginal,
            ecoCandidato: numEcoCandidatoInfo,
            idUeaGrupo: movimiento.idGrupo,
            tipo: clasificacion as any,
            detalle: `Evaluo la Z iterativa y no supero el umbral. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${estado.zActual.toFixed(2)}`
        });

        this._rechazarSwap(grafo, fsm, movimiento, estado, clasificacion);
        return false;
    }

    private _aceptarSwap(estado: EstadoOptimizacion, zNuevo: number): void {
        estado.telemetria.deltaZAcumulado += zNuevo - estado.zActual;
        estado.zActual = zNuevo;
        estado.telemetria.aceptadasPorMejora++;
        estado.sinMejora = 0;
    }

    private _rechazarSwap(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        movimiento: { idGrupo: number; numEcoOriginal: number },
        estado: EstadoOptimizacion,
        clasificacion: ClasificacionDelta
    ): void {
        grafo.desasignarMutable(movimiento.idGrupo);
        fsm.actualizarGrafo(grafo);
        this._contabilizarRechazo(estado.telemetria, clasificacion);
    }

    private _contabilizarRechazo(
        telemetria: TelemetriaOptimizacion,
        clasificacion: ClasificacionDelta
    ): void {
        switch (clasificacion) {
            case ClasificacionDelta.RUIDO_NUMERICO:
                telemetria.rechazadasPorRuido++;
                break;
            case ClasificacionDelta.RECHAZADA_POR_UMBRAL:
                telemetria.rechazadasPorUmbral++;
                break;
            case ClasificacionDelta.SIN_MEJORA:
                telemetria.rechazadasSinMejora++;
                break;
        }
    }
}

interface EstadoOptimizacion {
    zActual: number;
    sinMejora: number;
    iteracion: number;
    telemetria: TelemetriaOptimizacion;
}
