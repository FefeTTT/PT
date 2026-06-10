import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';

/** Estructura de un emparejamiento profesor-grupo. Contrato de salida del Greedy. */
export interface AsignacionInput {
    numeroEconomico: number;
    idUeaGrupo: number;
}

export interface CandidatoProfesor {
    profesor: ProfesorDTO;
    grupo: GrupoDTO;
    scoreML: number;
    penalizacionConsecutiva: number;
    scoreRCL: number;
}

/** Metricas de la ejecucion del Greedy. */
export interface MetricasGreedy {
    totalEvaluaciones: number;
    totalAsignados: number;
    totalRechazados: number;
    tiempoMs: number;
    gruposSinAsignar: number[];
    scoreZ: number;
    mejorasLocales: number;
    reparaciones: number;
}

/** Resultado completo de una ejecucion del Greedy. */
export interface ResultadoGreedy {
    asignaciones: AsignacionInput[];
    metricas: MetricasGreedy;
}

/**
 * Strategy Pattern: define como ordenar areas/grupos y como seleccionar
 * profesor desde candidatos factibles del grupo actual.
 */
export interface EstrategiaOrdenamiento {
    ordenarAreas(areas: Map<number, GrupoDTO[]>): [number, GrupoDTO[]][];
    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[];
    seleccionarProfesorParaGrupo(candidatos: CandidatoProfesor[], grupo: GrupoDTO): CandidatoProfesor | null;
}
