import { GrafoBipartito } from '../models/GrafoBipartito';
import { ReglaBase } from '../rules/ReglaBase';

export enum EstadoAsignacion {
    INICIO = 'INICIO',
    EVALUANDO = 'EVALUANDO',
    ASIGNACION_OK = 'ASIGNACION_OK',
    ERROR_REGLA = 'ERROR_REGLA',
}

export interface ResultadoAsignacion {
    estado: EstadoAsignacion;
    nuevoGrafo?: GrafoBipartito;
    error?: {
        reglaFallo: string;
        motivo: string;
        numeroEconomico: number;
        idUeaGrupo: number;
    };
}

export class FSMAsignador {
    private _grafoFijo: GrafoBipartito;
    private _pipelineReglas: ReglaBase[];

    constructor(grafoActual: GrafoBipartito, reglas: ReglaBase[] = []) {
        this._grafoFijo = grafoActual; // El grafo que sirvió de snapshot inicial
        this._pipelineReglas = reglas;
    }

    public procesarAsignacion(numeroEconomico: number, idUeaGrupo: number): ResultadoAsignacion { //Intenta mutar el estado. Devuelve Éxito+NuevoGrafo O Fallo+Motivo.
        let estadoActual = EstadoAsignacion.INICIO;

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

        if (this._grafoFijo.asignacionesInversas.has(idUeaGrupo)) {
            const colision = this._grafoFijo.asignacionesInversas.get(idUeaGrupo);
            return {
                estado: EstadoAsignacion.ERROR_REGLA,
                error: {
                    reglaFallo: 'INVARIANTE_COLISION',
                    motivo: `El grupo ya ha sido asignado al profesor ${colision}.`,
                    numeroEconomico, idUeaGrupo
                }
            };
        }

        estadoActual = EstadoAsignacion.EVALUANDO;

        for (const regla of this._pipelineReglas) {
            const evaluacion = regla.evaluar(profesor, grupo, this._grafoFijo);

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
        }

        estadoActual = EstadoAsignacion.ASIGNACION_OK; // <- Pasaron todas las reglas

        try {// Computar nueva instancia inmutable del grafo
            const nuevoEstadoGrafo = this._grafoFijo.asignar(numeroEconomico, idUeaGrupo);
            return {
                estado: estadoActual,
                nuevoGrafo: nuevoEstadoGrafo
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
