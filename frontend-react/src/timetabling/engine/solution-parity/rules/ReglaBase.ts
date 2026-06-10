import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';

export type SubestadoRegla = 'EXCEPCION_HORARIO_LABORAL' | 'EXCEPCION_GRUPO_IGNORADO';

export interface EvaluacionRegla {
    resultadoExitoso: boolean;
    motivo?: string;
    subestado?: SubestadoRegla;
    excepcionesAplicadas?: SubestadoRegla[];
}

/** Espejo de solution/rules/ReglaBase.ts. El FSM de paridad no inyecta contexto (Modo Legacy
 *  no tiene asignación manual), pero el tipo se mantiene en paridad con `@solution`. */
export interface ContextoRegla {
    modoAsignacion?: 'automatic' | 'manual';
    hayAcuerdoHorarioLaboral?: {
        revisarAcuerdo?: 0 | 1 | boolean;
        umbral?: number;
        score?: number;
        hayMutuoAcuerdo?: boolean;
    };
    asignacionGruposIgnorados?: {
        asignarManualmente?: boolean;
    };
}

export abstract class ReglaBase { // Clase padre de la cual heredan todas las reglas de la asignación para la FSM
    public readonly nombreRegla: string;

    constructor(nombre: string) {
        this.nombreRegla = nombre;
    }

    abstract evaluar(
        profesor: ProfesorDTO,
        grupo: GrupoDTO,
        grafo: GrafoBipartito,
        contexto?: ContextoRegla
    ): EvaluacionRegla;
}
