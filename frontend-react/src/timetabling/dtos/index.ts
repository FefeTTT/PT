import type {
    FranjaHorariaDTO,
    GrupoDTO,
    HorarioDB_DTO,
    ProfesorDTO,
} from '../../Code/types/FrontendTypes';

export type {
    FranjaHorariaDTO,
    GrupoDTO,
    HorarioDB_DTO,
    ProfesorDTO,
};

export type RequiredTimetablingFileKey =
    | 'ecoNombre'
    | 'claveUea'
    | 'areaProfesor'
    | 'horariosRegulares'
    | 'horariosIrregulares'
    | 'horariosIrregularesInferidos'
    | 'programacionVacia'
    | 'dfHist';

export interface RequiredTimetablingFileSpec {
    key: RequiredTimetablingFileKey;
    label: string;
    fileName: string;
    description: string;
    accept: string;
    requiredFor: Array<'kde' | 'legacy'>;
}

export const REQUIRED_TIMETABLING_FILES: RequiredTimetablingFileSpec[] = [
    {
        key: 'ecoNombre',
        label: 'Eco - nombre',
        fileName: 'eco-nombre.json',
        description: 'Mapa canonico de numero economico a nombre.',
        accept: '.json,application/json',
        requiredFor: ['kde', 'legacy'],
    },
    {
        // Opcional (requiredFor vacío): se carga del JSON unificado si está presente y solo sirve
        // para mostrar el nombre legible de la UEA. NO bloquea construir el workspace ni el modo KDE
        // si falta (la tabla cae a "UEA <clave>").
        key: 'claveUea',
        label: 'Clave - UEA',
        fileName: 'clave-uea.json',
        description: 'Mapa de clave de UEA a su nombre (para mostrar el nombre legible en la tabla).',
        accept: '.json,application/json',
        requiredFor: [],
    },
    {
        key: 'areaProfesor',
        label: 'Areas por profesor',
        fileName: 'area_profesor.json',
        description: 'Areas 1110, 1111, 1112 o 1113 que puede impartir cada eco.',
        accept: '.json,application/json',
        requiredFor: ['kde', 'legacy'],
    },
    {
        key: 'horariosRegulares',
        label: 'Horarios regulares',
        fileName: 'ecos_vigentes_con_horario_regular.json',
        description: 'Profesores vigentes con horario laboral en un solo bloque.',
        accept: '.json,application/json',
        requiredFor: ['kde', 'legacy'],
    },
    {
        key: 'horariosIrregulares',
        label: 'Horarios irregulares vigentes',
        fileName: 'ecos_vigentes_con_horario_irregular.json',
        description: 'Catálogo de vigencia para profesores con horario flexible (lo usa ReglaProfesorVigente).',
        accept: '.json,application/json',
        requiredFor: ['kde', 'legacy'],
    },
    {
        key: 'horariosIrregularesInferidos',
        label: 'Horarios irregulares inferidos',
        fileName: 'ecos_irregulares_inferidos.json',
        description: 'Franjas inferidas por trimestre para construir los horariosContratacion del modo KDE.',
        accept: '.json,application/json',
        requiredFor: ['kde'],
    },
    {
        key: 'programacionVacia',
        label: 'Programacion vacia',
        fileName: 'programacion_vacia_26P.json',
        description: 'Fuente canonica del trimestre a asignar.',
        accept: '.json,application/json',
        requiredFor: ['kde', 'legacy'],
    },
    {
        key: 'dfHist',
        label: 'Histórico (df_hist)',
        fileName: 'df_hist.json',
        description: 'Observaciones históricas por trimestre que alimentan el KDE (ECO, UEA, grupo, franjas).',
        accept: '.json,application/json',
        requiredFor: ['kde'],
    },
];

export type AssignmentOrigin = 'preasignacion' | 'grasp' | 'manual';
export type AssignmentState = 'pendiente' | 'preasignada' | 'asignada' | 'huerfana' | 'rechazada';
export type ScheduleKind = 'regular' | 'irregular' | 'desconocido';

export interface ScoreDTO {
    eco: number;
    ueaClave?: number;
    idUeaGrupo?: number;
    claveGrupo?: string;
    label: string;
    score: number;
    source: 'r_hat' | 'kde' | 'score_final';
}

export interface EcoProfileDTO {
    numeroEconomico: number;
    nombre: string;
    areas: number[];
    tipoHorario: ScheduleKind;
    profesor: ProfesorDTO;
    horarioRaw: string[];
    topRHat: ScoreDTO[];
    topKde: ScoreDTO[];
    assignments: AssignmentDTO[];
}

export interface GroupProfileDTO extends GrupoDTO {
    ueaNombre?: string;
    estadoAsignacion: AssignmentState;
    profesorAsignadoEco?: number;
    horarioStringRaw?: string | null;
    warnings: string[];
}

export interface AssignmentDTO {
    id: string;
    numeroEconomico: number;
    idUeaGrupo: number;
    claveGrupo: string;
    ueaClave: number;
    ueaNombre?: string;
    horarios: FranjaHorariaDTO[];
    rHat?: number;
    kde?: number;
    scoreFinal?: number;
    origen: AssignmentOrigin;
    estado: AssignmentState;
}

export interface SolutionDTO {
    id: string;
    nombre: string;
    createdAt: string;
    assignments: AssignmentDTO[];
    orphanGroups: GroupProfileDTO[];
    metrics: SolutionMetricsDTO;
    metadata?: PipelineMetadataDTO;
}

export interface SolutionMetricsDTO {
    asignados: number;
    huerfanos: number;
    preasignados: number;
    rechazados: number;
    scorePromedio?: number;
}

export type PipelineStageStatus =
    | 'idle'
    | 'ingesta'
    | 'fsm_inicial'
    | 'kde_warmup'
    | 'sijh_warmup'
    | 'penalty_warmup'
    | 'rcl'
    | 'greedy'
    | 'fsm_score'
    | 'repair'
    | 'ejection'
    | 'final_z'
    | 'export'
    | 'completed'
    | 'failed';

export interface PipelineStageDTO {
    name: PipelineStageStatus | string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    progress?: number;
    counters?: Record<string, number>;
    errors?: string[];
    startedAt?: string;
    finishedAt?: string;
}

export interface PipelineMetadataDTO {
    runId?: string;
    solutionId?: string;
    createdAt?: string;
    updatedAt?: string;
    estadoGlobal: PipelineStageStatus;
    pipelineConfig?: Record<string, unknown>;
    stages: PipelineStageDTO[];
    currentCandidate?: {
        numeroEconomico?: number;
        idUeaGrupo?: number;
        claveGrupo?: string;
        ueaClave?: number;
        horario?: FranjaHorariaDTO[];
        rHat?: number;
        kde?: number;
        scoreFinal?: number;
    };
    fsmTrace: {
        regla?: string;
        resultado?: 'OK' | 'FALLO' | string;
        motivo?: string;
    }[];
    metrics: Partial<SolutionMetricsDTO> & Record<string, unknown>;
    errors: string[];
}

export interface GraphEdgeDTO {
    numeroEconomico: number;
    idUeaGrupos: number[];
}

export interface InverseAssignmentDTO {
    idUeaGrupo: number;
    numeroEconomico: number;
}

export interface PreassignmentLockDTO {
    idUeaGrupo: number;
    numeroEconomico: number;
    origen: 'oficio' | 'peticion_informal' | 'pipeline' | string;
    locked: boolean;
    prioridad?: number;
    notas?: string;
}

export interface PreassignmentsArtifactDTO {
    version: string;
    profesores: ProfesorDTO[];
    grupos: GrupoDTO[];
    adyacencias: GraphEdgeDTO[];
    asignacionesInversas: InverseAssignmentDTO[];
    locks: PreassignmentLockDTO[];
}

export interface ValidationIssueDTO {
    path: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface WorkspaceDTO {
    profesores: EcoProfileDTO[];
    grupos: GroupProfileDTO[];
    warnings: ValidationIssueDTO[];
    sourceFiles: Record<RequiredTimetablingFileKey, string>;
}

export interface BackendConfigDTO {
    connectionMode: 'viteProxy' | 'direct';
    pythonHost: string;
    pythonPort: string;
    redisHost: string;
    redisPort: string;
}
