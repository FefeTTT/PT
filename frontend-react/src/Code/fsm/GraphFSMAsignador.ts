import { GrafoBipartito } from '../models/GrafoBipartito';
import { ReglaBase } from '../rules/ReglaBase';
import { EstadoAsignacion } from './FSMAsignador';
import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { FSMAsignador } from './FSMAsignador';

export interface StepSnapshot {
    stepIndex: number;
    estadoAsignacion: EstadoAsignacion;
    reglaNombre?: string;
    resultadoRegla?: boolean;
    motivo?: string;
    grafoSnapshot: GrafoBipartito;
    profesorInfo?: ProfesorDTO;
    grupoInfo?: GrupoDTO;
}

export class GraphFSMAsignador extends FSMAsignador {
    private _historialPasos: StepSnapshot[] = [];

    constructor(grafoInicial: GrafoBipartito, reglas: ReglaBase[] = []) {
        super(grafoInicial, reglas);
    }

    public procesarAsignacionStepByStep(numeroEconomico: number, idUeaGrupo: number): StepSnapshot[] {
        this._historialPasos = [];
        let stepCount = 0;

        const profesor = this._grafoFijo.profesores.get(numeroEconomico);
        const grupo = this._grafoFijo.grupos.get(idUeaGrupo);

        const addSnapshot = (
            estado: EstadoAsignacion,
            regla?: string,
            res?: boolean,
            motivoStr?: string,
            grafoMutado?: GrafoBipartito
        ) => {
            this._historialPasos.push({
                stepIndex: stepCount++,
                estadoAsignacion: estado,
                reglaNombre: regla,
                resultadoRegla: res,
                motivo: motivoStr,
                grafoSnapshot: grafoMutado || this._grafoFijo, // Asume inmutabilidad si se pasa uno nuevo
                profesorInfo: profesor,
                grupoInfo: grupo
            });
        };

        // Snapshot 0: Inicio
        addSnapshot(EstadoAsignacion.INICIO, 'INICIO', undefined, 'Iniciando validación de asignación');

        if (!profesor || !grupo) {
            addSnapshot(
                EstadoAsignacion.ERROR_REGLA,
                'INTEGRIDAD_GRAFO',
                false,
                'El profesor o el grupo solitado no existen en el grafo.'
            );
            return this._historialPasos;
        }

        if (this._grafoFijo.asignacionesInversas.has(idUeaGrupo)) {
            const colision = this._grafoFijo.asignacionesInversas.get(idUeaGrupo);
            addSnapshot(
                EstadoAsignacion.ERROR_REGLA,
                'INVARIANTE_COLISION',
                false,
                `El grupo ya ha sido asignado al profesor ${colision}.`
            );
            return this._historialPasos;
        }

        addSnapshot(EstadoAsignacion.EVALUANDO, 'EVALUANDO', undefined, 'Comenzando evaluación de reglas');

        for (const regla of this._pipelineReglas) {
            const evaluacion = regla.evaluar(profesor, grupo, this._grafoFijo);

            addSnapshot(
                evaluacion.resultadoExitoso ? EstadoAsignacion.EVALUANDO : EstadoAsignacion.ERROR_REGLA,
                regla.nombreRegla,
                evaluacion.resultadoExitoso,
                evaluacion.motivo || (evaluacion.resultadoExitoso ? `Regla ${regla.nombreRegla} superada exitosamente.` : 'Regla fallida sin motivo especificado.')
            );

            if (!evaluacion.resultadoExitoso) {
                return this._historialPasos;
            }
        }

        // Si pasamos todas las reglas, intentamos mutar el grafo local
        try {
            const nuevoEstadoGrafo = this._grafoFijo.asignar(numeroEconomico, idUeaGrupo);
            this._grafoFijo = nuevoEstadoGrafo; // Actualizamos para futuras ejecuciones si las hay
            addSnapshot(
                EstadoAsignacion.ASIGNACION_OK,
                'ASIGNACION_OK',
                true,
                'Asignación completada con éxito y grafo actualizado.',
                nuevoEstadoGrafo
            );
        } catch (err: any) {
            addSnapshot(
                EstadoAsignacion.ERROR_REGLA,
                'FATAL_MUTACION',
                false,
                err.message
            );
        }

        return this._historialPasos;
    }

    public get currentGrafo(): GrafoBipartito {
        return this._grafoFijo;
    }
}
