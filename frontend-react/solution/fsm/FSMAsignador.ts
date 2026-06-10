import { GrafoBipartito } from '../models/GrafoBipartito';
import { ContextoRegla, ReglaBase, type SubestadoRegla } from '../rules/ReglaBase';

export enum EstadoAsignacion {
    INICIO = 'INICIO',
    EVALUANDO = 'EVALUANDO',
    ASIGNACION_OK = 'ASIGNACION_OK',
    ERROR_REGLA = 'ERROR_REGLA',
}

export interface ResultadoAsignacion {
    estado: EstadoAsignacion;
    nuevoGrafo?: GrafoBipartito;
    subestado?: SubestadoRegla;
    excepcionesAplicadas?: SubestadoRegla[];
    error?: {
        reglaFallo: string;
        motivo: string;
        numeroEconomico: number;
        idUeaGrupo: number;
    };
}

/**
 * FSM que ejecuta los intentos de asignación grupo, uea a profesor.
 */
export class FSMAsignador {
    protected _grafoFijo: GrafoBipartito;
    protected _pipelineReglas: ReglaBase[];

    constructor(grafoActual: GrafoBipartito, reglas: ReglaBase[] = []) {
        this._grafoFijo = grafoActual; // El grafo que sirvió de snapshot inicial
        this._pipelineReglas = reglas;
    }

    /** Reemplaza el grafo interno para la siguiente evaluación. */
    public actualizarGrafo(nuevoGrafo: GrafoBipartito): void {
        this._grafoFijo = nuevoGrafo;
    }

    /** Lectura del estado actual del grafo. */
    public get grafoActual(): GrafoBipartito {
        return this._grafoFijo;
    }

    public procesarAsignacion(numeroEconomico: number, idUeaGrupo: number, contexto?: ContextoRegla): ResultadoAsignacion { //Intenta mutar el estado. Devuelve Éxito+NuevoGrafo O Fallo+Motivo.
        let estadoActual = EstadoAsignacion.INICIO;
        const excepcionesAplicadas: SubestadoRegla[] = [];

        const profesor = this._grafoFijo.profesores.get(numeroEconomico);
        const grupo = this._grafoFijo.grupos.get(idUeaGrupo);

        if (!profesor || !grupo) {
            return {
                estado: EstadoAsignacion.ERROR_REGLA,
                error: {
                    reglaFallo: 'INTEGRIDAD_GRAFO',
                    motivo: 'El profesor o el grupo solitado no existen en el grafo.',
                    numeroEconomico, idUeaGrupo
                }
            };
        }

        estadoActual = EstadoAsignacion.EVALUANDO;

        // Ejecutar pipeline de reglas inyectadas
        for (const regla of this._pipelineReglas) {
            const evaluacion = regla.evaluar(profesor, grupo, this._grafoFijo, contexto);

            if (!evaluacion.resultadoExitoso) {
                estadoActual = EstadoAsignacion.ERROR_REGLA;
                return {
                    estado: estadoActual,
                    error: {
                        reglaFallo: regla.nombreRegla,
                        motivo: evaluacion.motivo || 'Regla fallida sin motivo especificado.',
                        numeroEconomico,
                        idUeaGrupo
                    }
                };
            }
            if (evaluacion.subestado && !excepcionesAplicadas.includes(evaluacion.subestado)) {
                excepcionesAplicadas.push(evaluacion.subestado);
            }
            for (const excepcion of evaluacion.excepcionesAplicadas ?? []) {
                if (!excepcionesAplicadas.includes(excepcion)) excepcionesAplicadas.push(excepcion);
            }
        }

        estadoActual = EstadoAsignacion.ASIGNACION_OK; // <- Pasaron todas las reglas

        try {// Computar nueva instancia inmutable del grafo
            const nuevoEstadoGrafo = this._grafoFijo.asignar(numeroEconomico, idUeaGrupo);
            return {
                estado: estadoActual,
                nuevoGrafo: nuevoEstadoGrafo,
                subestado: excepcionesAplicadas[0],
                excepcionesAplicadas: excepcionesAplicadas.length > 0 ? excepcionesAplicadas : undefined,
            };
        } catch (err: any) {// fallo del proceso estructural del grafo
            return {
                estado: EstadoAsignacion.ERROR_REGLA,
                error: {
                    reglaFallo: 'FATAL_MUTACION',
                    motivo: err.message,
                    numeroEconomico, idUeaGrupo
                }
            };
        }
    }
}
