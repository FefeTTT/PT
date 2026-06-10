import type {
    AssignmentDTO,
    GroupProfileDTO,
    PipelineMetadataDTO,
    PreassignmentsArtifactDTO,
    ValidationIssueDTO,
} from '../dtos';
import {
    pipelineMetadataSchema,
    preassignmentsArtifactSchema,
} from '../schemas/timetablingSchemas';
import { error, parseWithIssues, warning } from './validation';

export interface ArtifactParseResult<T> {
    data?: T;
    issues: ValidationIssueDTO[];
}

export interface MetadataSummary {
    title: string;
    progress: number;
    statusText: string;
    errorCount: number;
    activeStage?: string;
}

export function parsePreassignmentsArtifact(input: unknown): ArtifactParseResult<PreassignmentsArtifactDTO> {
    const parsed = parseWithIssues(
        preassignmentsArtifactSchema,
        input,
        'preasignaciones.json'
    );

    if (!parsed.data) {
        return { issues: parsed.issues };
    }

    const artifact = parsed.data as PreassignmentsArtifactDTO;
    const issues = validateGraphConsistency(artifact);
    return { data: artifact, issues: [...parsed.issues, ...issues] };
}

export function parsePipelineMetadata(input: unknown): ArtifactParseResult<PipelineMetadataDTO> {
    const parsed = parseWithIssues(
        pipelineMetadataSchema,
        input,
        'metadata-solucion.json'
    );

    if (!parsed.data) {
        return { issues: parsed.issues };
    }

    return {
        data: parsed.data as PipelineMetadataDTO,
        issues: parsed.issues,
    };
}

export function validateGraphConsistency(artifact: PreassignmentsArtifactDTO): ValidationIssueDTO[] {
    const issues: ValidationIssueDTO[] = [];
    const professorIds = new Set(artifact.profesores.map((profesor) => profesor.numeroEconomico));
    const groupIds = new Set(artifact.grupos.map((grupo) => grupo.idUeaGrupo));
    const inverseByGroup = new Map<number, number>();

    artifact.asignacionesInversas.forEach((assignment, index) => {
        if (!professorIds.has(assignment.numeroEconomico)) {
            issues.push(error(`asignacionesInversas.${index}.numeroEconomico`, 'Eco inexistente en profesores.'));
        }
        if (!groupIds.has(assignment.idUeaGrupo)) {
            issues.push(error(`asignacionesInversas.${index}.idUeaGrupo`, 'Grupo inexistente en grupos.'));
        }
        if (inverseByGroup.has(assignment.idUeaGrupo)) {
            issues.push(error(`asignacionesInversas.${index}.idUeaGrupo`, 'Grupo asignado mas de una vez.'));
        }
        inverseByGroup.set(assignment.idUeaGrupo, assignment.numeroEconomico);
    });

    artifact.adyacencias.forEach((edge, index) => {
        if (!professorIds.has(edge.numeroEconomico)) {
            issues.push(error(`adyacencias.${index}.numeroEconomico`, 'Eco inexistente en profesores.'));
        }

        edge.idUeaGrupos.forEach((idUeaGrupo) => {
            if (!groupIds.has(idUeaGrupo)) {
                issues.push(error(`adyacencias.${index}.idUeaGrupos`, `Grupo inexistente: ${idUeaGrupo}.`));
                return;
            }

            const inverseEco = inverseByGroup.get(idUeaGrupo);
            if (inverseEco !== edge.numeroEconomico) {
                issues.push(error(
                    `adyacencias.${index}.idUeaGrupos`,
                    `Adyacencia ${edge.numeroEconomico}-${idUeaGrupo} no coincide con asignacionesInversas.`
                ));
            }
        });
    });

    artifact.locks.forEach((lock, index) => {
        if (!inverseByGroup.has(lock.idUeaGrupo)) {
            issues.push(warning(`locks.${index}.idUeaGrupo`, 'Lock sin asignacion inversa asociada.'));
        }
    });

    return issues;
}

export function assignmentsFromPreassignments(
    artifact: PreassignmentsArtifactDTO,
    groupProfiles: GroupProfileDTO[]
): AssignmentDTO[] {
    const groups = new Map(groupProfiles.map((group) => [group.idUeaGrupo, group]));
    const assignments: AssignmentDTO[] = [];

    artifact.asignacionesInversas.forEach((assignment) => {
        const group = groups.get(assignment.idUeaGrupo);
        if (!group) {
            return;
        }

        assignments.push({
            id: `pre-${assignment.numeroEconomico}-${assignment.idUeaGrupo}`,
            numeroEconomico: assignment.numeroEconomico,
            idUeaGrupo: assignment.idUeaGrupo,
            claveGrupo: group.claveGrupo,
            ueaClave: group.ueaClave,
            ueaNombre: group.ueaNombre,
            horarios: group.horarios,
            origen: 'preasignacion',
            estado: 'preasignada',
        });
    });

    return assignments;
}

export function mergeAssignmentsIntoGroups(
    groups: GroupProfileDTO[],
    assignments: AssignmentDTO[]
): GroupProfileDTO[] {
    const assignmentByGroup = new Map(assignments.map((assignment) => [assignment.idUeaGrupo, assignment]));

    return groups.map((group) => {
        const assignment = assignmentByGroup.get(group.idUeaGrupo);
        if (!assignment) {
            return group;
        }

        return {
            ...group,
            estadoAsignacion: assignment.estado,
            profesorAsignadoEco: assignment.numeroEconomico,
        };
    });
}

export function summarizeMetadata(metadata?: PipelineMetadataDTO): MetadataSummary {
    if (!metadata) {
        return {
            title: 'Sin metadata',
            progress: 0,
            statusText: 'El pipeline aun no ha emitido metadata-solucion.json.',
            errorCount: 0,
        };
    }

    const runningStage = metadata.stages.find((stage) => stage.status === 'running');
    const completedStages = metadata.stages.filter((stage) => stage.status === 'completed').length;
    const progressFromStages = metadata.stages.length > 0
        ? Math.round((completedStages / metadata.stages.length) * 100)
        : 0;
    const progress = runningStage?.progress ?? progressFromStages;

    return {
        title: metadata.estadoGlobal,
        progress: Math.max(0, Math.min(100, progress)),
        statusText: runningStage
            ? `Ejecutando ${runningStage.name}`
            : `Estado global: ${metadata.estadoGlobal}`,
        errorCount: metadata.errors.length + metadata.stages.reduce((sum, stage) => sum + (stage.errors?.length ?? 0), 0),
        activeStage: runningStage?.name,
    };
}
