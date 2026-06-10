import { GrafoBipartito } from '../models/GrafoBipartito';
import { EstadoAsignacion } from '../fsm/FSMAsignador';
import { FSMFactory } from '../fsm/FSMFactory';
import { ReglaBase } from '../rules/ReglaBase';
import { ProfesorDTO } from '../types/AssignmentTypes';
import { NodoCadena, CadenaEyeccion, DiagnosticoRechazoFSM } from './EjectionChainTypes';

interface EstadoBFS {
    profesorEyectado: number;
    grupoQueOcupa: number;
    caminoRecorrido: NodoCadena[];
    gruposVisitados: Set<number>;
}

export class BFSEjectionChain {
    private readonly _reglasPipeline: readonly ReglaBase[];
    private readonly _profundidadMaxima: number;

    constructor(reglasPipeline: readonly ReglaBase[], profundidadMaxima: number = 5) {
        this._reglasPipeline = reglasPipeline;
        this._profundidadMaxima = profundidadMaxima;
    }

    public buscarCadenaMinima(
        grafo: GrafoBipartito,
        profesorOrigen: number,
        grupoDestino: number,
        registroRechazosFSM: DiagnosticoRechazoFSM[],
        iteracionActual: number
    ): CadenaEyeccion | null {
        const grupoYaLibre = !grafo.asignacionesInversas.has(grupoDestino);
        if (grupoYaLibre) {
            return { nodos: [{ profesorEyectado: profesorOrigen, grupoQueDesea: grupoDestino }], longitudTotal: 1 };
        }

        const grupoEstaFueraDelDominioDeFSM = !this._fsmAceptaAsignacion(
            grafo, profesorOrigen, grupoDestino, registroRechazosFSM, iteracionActual
        );
        if (grupoEstaFueraDelDominioDeFSM) return null;

        const cola: EstadoBFS[] = [];
        const estadosVisitados = new Set<string>();

        const profesorQueOcupaGrupoDestino = grafo.asignacionesInversas.get(grupoDestino)!;
        const estadoInicial: EstadoBFS = {
            profesorEyectado: profesorQueOcupaGrupoDestino,
            grupoQueOcupa: grupoDestino,
            caminoRecorrido: [{ profesorEyectado: profesorOrigen, grupoQueDesea: grupoDestino }],
            gruposVisitados: new Set([grupoDestino])
        };

        cola.push(estadoInicial);
        estadosVisitados.add(this._claveDeEstado(profesorQueOcupaGrupoDestino, grupoDestino));

        while (cola.length > 0) {
            const estadoActual = cola.shift()!;

            if (estadoActual.caminoRecorrido.length > this._profundidadMaxima) continue;

            const gruposAlcanzablesPorEyectado = this._calcularDominioEfectivoPorFSM(
                grafo,
                estadoActual.profesorEyectado,
                estadoActual.gruposVisitados,
                registroRechazosFSM,
                iteracionActual
            );

            for (const grupoCandidate of gruposAlcanzablesPorEyectado) {
                const nuevoCamino: NodoCadena[] = [
                    ...estadoActual.caminoRecorrido,
                    { profesorEyectado: estadoActual.profesorEyectado, grupoQueDesea: grupoCandidate }
                ];

                const grupoEstaLibre = !grafo.asignacionesInversas.has(grupoCandidate);
                if (grupoEstaLibre) {
                    return { nodos: nuevoCamino, longitudTotal: nuevoCamino.length };
                }

                const profesorQueOcupaElSiguienteGrupo = grafo.asignacionesInversas.get(grupoCandidate)!;
                const claveEstadoSiguiente = this._claveDeEstado(profesorQueOcupaElSiguienteGrupo, grupoCandidate);

                if (estadosVisitados.has(claveEstadoSiguiente)) continue;
                estadosVisitados.add(claveEstadoSiguiente);

                cola.push({
                    profesorEyectado: profesorQueOcupaElSiguienteGrupo,
                    grupoQueOcupa: grupoCandidate,
                    caminoRecorrido: nuevoCamino,
                    gruposVisitados: new Set([...estadoActual.gruposVisitados, grupoCandidate])
                });
            }
        }

        return null;
    }

    private _calcularDominioEfectivoPorFSM(
        grafo: GrafoBipartito,
        profesorEyectado: number,
        gruposYaVisitadosEnCadena: Set<number>,
        registroRechazosFSM: DiagnosticoRechazoFSM[],
        iteracionActual: number
    ): number[] {
        const dominio: number[] = [];

        for (const idGrupo of grafo.grupos.keys()) {
            if (gruposYaVisitadosEnCadena.has(idGrupo)) continue;

            const grupoEsLaAsignacionActualDelProfesor = grafo.asignacionesInversas.get(idGrupo) === profesorEyectado;
            if (grupoEsLaAsignacionActualDelProfesor) continue;

            const fsmAceptaEsteMov = this._fsmAceptaAsignacion(
                grafo, profesorEyectado, idGrupo, registroRechazosFSM, iteracionActual
            );
            if (fsmAceptaEsteMov) {
                dominio.push(idGrupo);
            }
        }

        return dominio;
    }

    private _fsmAceptaAsignacion(
        grafo: GrafoBipartito,
        profesorNumEco: number,
        idGrupo: number,
        registroRechazosFSM: DiagnosticoRechazoFSM[],
        iteracionActual: number
    ): boolean {
        const fsm = FSMFactory.crear(grafo, this._reglasPipeline);
        const resultado = fsm.procesarAsignacion(profesorNumEco, idGrupo);

        if (resultado.estado !== EstadoAsignacion.ASIGNACION_OK && resultado.error) {
            registroRechazosFSM.push({
                iteracion: iteracionActual,
                profesorVictima: profesorNumEco,
                profesorCandidato: profesorNumEco,
                idGrupoAfectado: idGrupo,
                reglaQueRechazo: resultado.error.reglaFallo,
                motivoDetallado: resultado.error.motivo
            });
        }

        return resultado.estado === EstadoAsignacion.ASIGNACION_OK;
    }

    private _claveDeEstado(profesorNumEco: number, idGrupo: number): string {
        return `${profesorNumEco}:${idGrupo}`;
    }

    public calcularDominioInicialDelProfesor(
        grafo: GrafoBipartito,
        profesorNumEco: number
    ): number[] {
        const grupoActualDelProfesor = grafo.adyacencias.get(profesorNumEco) ?? [];
        const gruposAsignadosAlProfesor = new Set(grupoActualDelProfesor);
        const registroDesechable: DiagnosticoRechazoFSM[] = [];

        const dominio: number[] = [];
        for (const idGrupo of grafo.grupos.keys()) {
            if (gruposAsignadosAlProfesor.has(idGrupo)) continue;

            const fsmAcepta = this._fsmAceptaAsignacion(grafo, profesorNumEco, idGrupo, registroDesechable, 0);
            if (fsmAcepta) {
                dominio.push(idGrupo);
            }
        }
        return dominio;
    }

    public aplicarCadenaEnGrafo(
        grafo: GrafoBipartito,
        cadena: CadenaEyeccion
    ): void {
        for (let paso = cadena.nodos.length - 1; paso >= 0; paso--) {
            const nodo = cadena.nodos[paso];

            const grupoTieneAsignacionActual = grafo.asignacionesInversas.has(nodo.grupoQueDesea);
            if (grupoTieneAsignacionActual) {
                grafo.desasignarMutable(nodo.grupoQueDesea);
            }

            grafo.asignarMutable(nodo.profesorEyectado, nodo.grupoQueDesea);
        }
    }

    public revertirCadenaEnGrafo(
        grafo: GrafoBipartito,
        cadena: CadenaEyeccion,
        asignacionesOriginalesAntesDeCadena: Map<number, number>
    ): void {
        const gruposAfectados = new Set(cadena.nodos.map(n => n.grupoQueDesea));

        for (const idGrupo of gruposAfectados) {
            if (grafo.asignacionesInversas.has(idGrupo)) {
                grafo.desasignarMutable(idGrupo);
            }
        }

        for (const [idGrupo, profesorOriginal] of asignacionesOriginalesAntesDeCadena) {
            if (gruposAfectados.has(idGrupo)) {
                grafo.asignarMutable(profesorOriginal, idGrupo);
            }
        }
    }

    public capturarAsignacionesAfectadasPorCadena(
        grafo: GrafoBipartito,
        cadena: CadenaEyeccion
    ): Map<number, number> {
        const snapshot = new Map<number, number>();
        for (const nodo of cadena.nodos) {
            const profesorActual = grafo.asignacionesInversas.get(nodo.grupoQueDesea);
            if (profesorActual !== undefined) {
                snapshot.set(nodo.grupoQueDesea, profesorActual);
            }
        }
        return snapshot;
    }

    public static seleccionarProfesorInicialPonderadoPorPotencial(
        grafo: GrafoBipartito,
        modelo: { score(eco: number, idGrupo: number): number },
        profesoresDelGrafo: ProfesorDTO[]
    ): ProfesorDTO | null {
        const pesos: { profesor: ProfesorDTO; deltaPotencial: number }[] = [];

        for (const profesor of profesoresDelGrafo) {
            const gruposActuales = grafo.adyacencias.get(profesor.numeroEconomico) ?? [];
            if (gruposActuales.length === 0) continue;

            let scoreMaximoPosible = 0;
            let scoreActualPromedio = 0;

            for (const idGrupo of grafo.grupos.keys()) {
                const scoreHipotetico = modelo.score(profesor.numeroEconomico, idGrupo);
                if (scoreHipotetico > scoreMaximoPosible) scoreMaximoPosible = scoreHipotetico;
            }

            for (const idGrupo of gruposActuales) {
                scoreActualPromedio += modelo.score(profesor.numeroEconomico, idGrupo);
            }
            scoreActualPromedio /= gruposActuales.length;

            const deltaPotencial = scoreMaximoPosible - scoreActualPromedio;
            if (deltaPotencial > 0) {
                pesos.push({ profesor, deltaPotencial });
            }
        }

        if (pesos.length === 0) return null;

        const sumaPesos = pesos.reduce((acc, p) => acc + p.deltaPotencial, 0);
        let umbralAleatorio = Math.random() * sumaPesos;

        for (const entrada of pesos) {
            umbralAleatorio -= entrada.deltaPotencial;
            if (umbralAleatorio <= 0) return entrada.profesor;
        }

        return pesos[pesos.length - 1].profesor;
    }
}
