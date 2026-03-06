import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';

/** Estructura de un emparejamiento profesor-grupo. Contrato de salida del Greedy. */
export interface AsignacionInput {
    numeroEconomico: number;
    idUeaGrupo: number;
}

/** Métricas de la ejecución del Greedy. */
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

/** Resultado completo de una ejecución del Greedy. */
export interface ResultadoGreedy {
    asignaciones: AsignacionInput[];
    metricas: MetricasGreedy;
}

/**
 * Strategy Pattern: Define cómo ordenar las áreas y los grupos antes de la iteración.
 * Permite inyectar distintas heurísticas sin modificar el Orquestador.
 */
export interface EstrategiaOrdenamiento {
    /** Ordena las áreas por prioridad (las primeras se procesan primero). */
    ordenarAreas(areas: Map<number, GrupoDTO[]>): [number, GrupoDTO[]][];

    /** Ordena los grupos dentro de un área por prioridad. */
    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[];

    /** Ordena los profesores dentro de un área por prioridad. */
    ordenarProfesores(profesores: ProfesorDTO[]): ProfesorDTO[];
}
