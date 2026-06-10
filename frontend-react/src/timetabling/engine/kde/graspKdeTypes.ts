import type { AsignacionInput, MetricasGreedy } from '@solution/greedy/GreedyTypes';
import type { FranjaHorariaDTO, GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import type { KdeSurfacePoint, ZScoreKDEMode, ZScoreKDEOptions } from '@solution/ml/ZScoreKDE';
import type { CandidateRowMetadata } from './candidateRow';

/**
 * Clave por CONTENIDO de un grupo físico bloqueado. El worker parsea SIEMPRE el workspace
 * completo (ids crudos estables) y EXCLUYE del catálogo del pase los grupos que matcheen
 * estas claves — nunca por `idUeaGrupo`, que históricamente se renumeraba entre pases.
 */
export interface BlockedGroupKey {
    uea: number;
    claveGrupo: string;
}

/**
 * Asignacion bloqueada (locked) que se inyecta al worker como carga existente para el pase.
 * Lleva todo lo necesario para construir el `GrupoDTO` y registrarlo en el `grafoInicial`,
 * porque los grupos bloqueados se EXCLUYEN del catálogo del pase (post-parse, por contenido
 * via `blockedKeys`) y por tanto no están registrados en el grafo.
 */
export interface LockedAssignmentDTO {
    numeroEconomico: number;
    idUeaGrupo: number;
    idGrupo: number;
    ueaClave: number;
    claveGrupo: string;
    idArea: string;
    horarioStringRaw: string;
    horarios: FranjaHorariaDTO[];
    kde_ih_raw?: number;
    metadata?: CandidateRowMetadata;
}

export interface KdeRawInputs {
    /** `ecos_vigentes_con_horario_regular.json` — fuente principal de horarios contratuales. */
    ecoHorarioRegular: Record<string, string>;
    /** `ecos_irregulares_inferidos.json` — usado por el script para construir horariosContratacion. */
    ecoHorarioIrregular?: Record<string, unknown>;
    /** `ecos_vigentes_con_horario_irregular.json` — catálogo independiente usado por ReglaProfesorVigente. */
    ecoHorarioIrregularVigente?: Record<string, string>;
    areaProfesor: Record<string, string[] | number[]>;
    programacionVacia: Record<string, Array<{ grupo: string; horario: string | null }>>;
    ecoNombre: Record<string, string>;
    /** `clave-uea.json` — mapa clave de UEA → nombre legible. Opcional (solo display en la tabla). */
    claveUea?: Record<string, string>;
    dfHist: unknown[];
}

export interface KdeWorkerConfig {
    mode: ZScoreKDEMode;
    seed: number;
    k: number;
    alpha: number;
    renderOnly: boolean;
    noPenalty: boolean;
    withRhat: boolean;
    options: ZScoreKDEOptions;
    targetEcos: number[];
    horasSuperficie: number[];
    penaltyBaseUrl?: string;
}

export interface KdeWorkerSurfaceData {
    eco: number;
    l_mi_v: KdeSurfacePoint[];
    m_j: KdeSurfacePoint[];
    l_m_mi_v: KdeSurfacePoint[];
}

export interface KdeWorkerEcoResumen {
    eco: number;
    totalUeas: number;
    manana: number;
    medioDia: number;
    tarde: number;
    asignaciones: Array<{
        uea: number;
        grupo: string;
        horario: string;
        turno: 'manana' | 'medioDia' | 'tarde';
        score?: number;
        kde_ij?: number;
        kde_ih?: number;
        kde_ih_raw?: number;
        kde_plan?: number;
        zBase?: number;
        projectedPlanCount?: number;
        dayCoverage?: number;
    }>;
    contradicciones: string[];
}

export interface KdeWorkerSummary {
    mode: ZScoreKDEMode;
    seed: number;
    k: number;
    alpha: number;
    totalAsignaciones: number;
    totalGrupos: number;
    gruposSinAsignar: number;
    scoreZ: number;
    tiempoMs: number;
    ecos: KdeWorkerEcoResumen[];
}

export interface KdeWorkerResult {
    surfaceData: KdeWorkerSurfaceData[];
    asignaciones: AsignacionInput[];
    metricas: MetricasGreedy;
    summary: KdeWorkerSummary;
    profesoresCount: number;
    gruposValidos: GrupoDTO[];
    profesores: ProfesorDTO[];
}

export type KdeWorkerProgress =
    | { kind: 'stage'; stage: string; detail?: string }
    | { kind: 'metric'; key: string; value: number | string }
    | { kind: 'heartbeat'; ts: number };

export type KdeWorkerInbound =
    | {
        type: 'run';
        /** archivos_requeridos COMPLETOS del workspace (también en pases N≥1: el worker parsea
         *  todo para que los ids crudos sean estables y excluye bloqueados via `blockedKeys`). */
        inputs: KdeRawInputs;
        config: KdeWorkerConfig;
        lockedAssignments?: LockedAssignmentDTO[];
        completedEcos?: number[];
        /** Grupos bloqueados a EXCLUIR del catálogo del pase, identificados por contenido. */
        blockedKeys?: BlockedGroupKey[];
    }
    | { type: 'cancel' };

export type KdeWorkerOutbound =
    | { type: 'progress'; payload: KdeWorkerProgress }
    | { type: 'result'; payload: KdeWorkerResult }
    | { type: 'error'; message: string; stack?: string };
