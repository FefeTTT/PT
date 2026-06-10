import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';

export type SubestadoRegla = 'EXCEPCION_HORARIO_LABORAL' | 'EXCEPCION_GRUPO_IGNORADO';

export interface EvaluacionRegla {
    resultadoExitoso: boolean;
    motivo?: string;
    subestado?: SubestadoRegla;
    excepcionesAplicadas?: SubestadoRegla[];
}

export interface ContextoRegla {
    modoAsignacion?: 'automatic' | 'manual';
    hayAcuerdoHorarioLaboral?: {
        revisarAcuerdo?: 0 | 1 | boolean;
        umbral?: number;
        score?: number;
        hayMutuoAcuerdo?: boolean;
    };
    /**
     * Excepción MANUAL de ReglaIgnorarGrupos (grupos SAI/CPRO): solo aplica cuando
     * `modoAsignacion === 'manual'` y `asignarManualmente === true`. El GRASP nunca la usa.
     */
    asignacionGruposIgnorados?: {
        asignarManualmente?: boolean;
    };
}

export abstract class ReglaBase {
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
