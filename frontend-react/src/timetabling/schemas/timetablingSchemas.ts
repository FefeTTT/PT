import { z } from 'zod';

export const numberishSchema = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() !== '') {
        return Number(value);
    }
    return value;
}, z.number().finite());

export const franjaHorariaSchema = z.object({
    dia: numberishSchema,
    horaInicio: numberishSchema,
    horaFin: numberishSchema,
}).strict();

export const horarioDbSchema = z.object({
    idDiasDeTrabajo: z.string().min(1),
    horaInicio: z.string().min(1),
    horaFin: z.string().min(1),
}).strict();

export const profesorSchema = z.object({
    numeroEconomico: numberishSchema,
    idArea: numberishSchema,
    horariosContratacion: z.array(horarioDbSchema),
}).strict();

export const grupoSchema = z.object({
    idUeaGrupo: numberishSchema,
    idGrupo: numberishSchema,
    claveGrupo: z.string().min(1),
    idArea: numberishSchema,
    ueaClave: numberishSchema,
    horarios: z.array(franjaHorariaSchema),
}).strict();

export const ecoNombreSchema = z.record(z.string(), z.string());

export const areaProfesorSchema = z.record(
    z.string(),
    z.array(z.union([z.string(), z.number()]))
);

export const horariosRegularesSchema = z.record(
    z.string(),
    z.string().regex(/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/)
);

export const horariosIrregularesSchema = z.record(
    z.string(),
    z.object({
        horario: z.array(z.string()),
    }).passthrough()
);

/**
 * `ecos_irregulares_inferidos.json` — usado por el modo KDE para construir horariosContratacion.
 * Tolerante: la estructura real tiene `{ inferido: [{ dia, inicio, fin, ... }], horario_original }` u otras claves auxiliares.
 */
export const horariosIrregularesInferidosSchema = z.record(
    z.string(),
    z.object({
        inferido: z.array(
            z.object({
                dia: z.string().min(1),
                inicio: z.string().min(1),
                fin: z.string().min(1),
            }).passthrough()
        ).optional(),
    }).passthrough()
);

/**
 * `df_hist.json` — array de filas históricas trimestre × eco × uea × grupo con franjas L-V.
 * Schema laxo (passthrough) porque el KDE consume el shape original sin transformar.
 */
export const dfHistRowSchema = z.object({
    eco: numberishSchema.optional(),
    uea: numberishSchema.optional(),
    grupo: z.union([z.string(), z.number()]).optional(),
    tri_num: numberishSchema.optional(),
    tri: z.union([z.string(), z.number()]).optional(),
}).passthrough();

export const dfHistSchema = z.array(dfHistRowSchema);

export const programacionVaciaSchema = z.record(
    z.string(),
    z.array(
        z.object({
            grupo: z.union([z.string(), z.number()]),
            horario: z.string().nullable().optional(),
        }).passthrough()
    )
);

export const graphEdgeSchema = z.object({
    numeroEconomico: numberishSchema,
    idUeaGrupos: z.array(numberishSchema),
}).strict();

export const inverseAssignmentSchema = z.object({
    idUeaGrupo: numberishSchema,
    numeroEconomico: numberishSchema,
}).strict();

export const preassignmentLockSchema = z.object({
    idUeaGrupo: numberishSchema,
    numeroEconomico: numberishSchema,
    origen: z.string().min(1),
    locked: z.boolean(),
    prioridad: numberishSchema.optional(),
    notas: z.string().optional(),
}).passthrough();

export const preassignmentsArtifactSchema = z.object({
    version: z.string().min(1),
    profesores: z.array(profesorSchema),
    grupos: z.array(grupoSchema),
    adyacencias: z.array(graphEdgeSchema),
    asignacionesInversas: z.array(inverseAssignmentSchema),
    locks: z.array(preassignmentLockSchema).default([]),
}).strict();

export const pipelineStageStatusSchema = z.enum([
    'idle',
    'ingesta',
    'fsm_inicial',
    'rcl',
    'greedy',
    'fsm_score',
    'repair',
    'ejection',
    'export',
    'completed',
    'failed',
]);

export const pipelineStageSchema = z.object({
    name: z.union([pipelineStageStatusSchema, z.string().min(1)]),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    progress: numberishSchema.optional(),
    counters: z.record(z.string(), numberishSchema).optional(),
    errors: z.array(z.string()).optional(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
}).passthrough();

export const pipelineMetadataSchema = z.object({
    runId: z.string().optional(),
    solutionId: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    estadoGlobal: pipelineStageStatusSchema.default('idle'),
    pipelineConfig: z.record(z.string(), z.unknown()).optional(),
    stages: z.array(pipelineStageSchema).default([]),
    currentCandidate: z.object({
        numeroEconomico: numberishSchema.optional(),
        idUeaGrupo: numberishSchema.optional(),
        claveGrupo: z.string().optional(),
        ueaClave: numberishSchema.optional(),
        horario: z.array(franjaHorariaSchema).optional(),
        rHat: numberishSchema.optional(),
        kde: numberishSchema.optional(),
        scoreFinal: numberishSchema.optional(),
    }).passthrough().optional(),
    fsmTrace: z.array(
        z.object({
            regla: z.string().optional(),
            resultado: z.string().optional(),
            motivo: z.string().optional(),
        }).passthrough()
    ).default([]),
    metrics: z.record(z.string(), z.unknown()).default({}),
    errors: z.array(z.string()).default([]),
}).passthrough();

export type EcoNombreInput = z.infer<typeof ecoNombreSchema>;
export type AreaProfesorInput = z.infer<typeof areaProfesorSchema>;
export type HorariosRegularesInput = z.infer<typeof horariosRegularesSchema>;
export type HorariosIrregularesInput = z.infer<typeof horariosIrregularesSchema>;
export type HorariosIrregularesInferidosInput = z.infer<typeof horariosIrregularesInferidosSchema>;
export type ProgramacionVaciaInput = z.infer<typeof programacionVaciaSchema>;
export type DfHistInput = z.infer<typeof dfHistSchema>;
