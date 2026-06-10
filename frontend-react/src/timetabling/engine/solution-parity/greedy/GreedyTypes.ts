import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';

/** Estructura de un emparejamiento profesor-grupo. Contrato de salida del Greedy. */
export interface AsignacionInput {
    numeroEconomico: number;
    idUeaGrupo: number;
}

export interface RCLConfig {
    k: number;
    alpha: number;
    disableLogs?: boolean;
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
    logsFase1?: DebugFSMRechazo[];
    logsEjection?: DebugEjectionRechazo[];
    logsFirstFSM?: any[];
}

export interface DebugFSMRechazo {
    idUeaGrupo?: number;
    uea: number;
    claveGrupo?: string;
    horario: string;
    ecoElegido?: number;
    resolucion: string;
    candidatosTentados: {
        eco: number;
        puntajeSijh: number;
        viabilidadPenalty?: number;
        penaltyRaw?: number;
        scoreRcl?: number;
        loadPenalty?: number;
        loadProbability?: number;
        penaltyProbability?: number;
        loadDensityRatio?: number;
        projectedUeaCount?: number;
        penaltyBlocked?: boolean;
        penaltyBlockReason?: string;
        estado: 'ELEGIDO' | 'RECHAZADO';
        ultimoErrorFSM?: string;
    }[];
}

export interface DebugEjectionRechazo {
    ecoVictima: number;
    ecoCandidato: number;
    idUeaGrupo: number;
    tipo: 'FSM_ERROR' | 'PENALTY_DOMAIN_BLOCK' | 'RUIDO_NUMERICO' | 'RECHAZADA_POR_UMBRAL' | 'SIN_MEJORA';
    detalle: string;
    penaltyRaw?: number;
    loadPenalty?: number;
    loadProbability?: number;
    penaltyProbability?: number;
    loadDensityRatio?: number;
    projectedUeaCount?: number;
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
    ordenarAreas(areas: Map<string, GrupoDTO[]>): [string, GrupoDTO[]][];

    /** Ordena los grupos dentro de un área por prioridad. */
    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[];

    /** 
     * Ordena los profesores dentro de un área por prioridad.
     * @param grupoId  Grupo actual para el que se evalúan los profesores.
     *                Permite calcular scores dependientes del grupo (RCL, MCV).
     */
    ordenarProfesores(profesores: ProfesorDTO[], grupoId?: number): ProfesorDTO[];
}
