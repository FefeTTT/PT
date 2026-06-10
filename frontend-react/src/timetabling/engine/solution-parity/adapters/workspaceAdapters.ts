import type {
    AssignmentDTO,
    GroupProfileDTO,
    PipelineMetadataDTO,
    PreassignmentsArtifactDTO,
    SolutionDTO,
    WorkspaceDTO,
} from '../../../dtos';
import { buildSolutionFromAssignments } from '../../../utils/solutionParser';
import type { ResultadoGreedy } from '../greedy/GreedyTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import type { GrupoDTO, ProfesorDTO } from '../types/AssignmentTypes';

export interface SolutionCatalogs {
    ecosVigentesRegular: Record<string, string>;
    ecosVigentesIrregular: Record<string, string>;
    areaProfesor: Record<string, string[]>;
}

export function workspaceToSolutionProfesores(workspace: WorkspaceDTO): ProfesorDTO[] {
    return workspace.profesores.map((profile) => ({
        numeroEconomico: profile.numeroEconomico,
        idArea: profile.areas.map(String),
        horariosContratacion: profile.profesor.horariosContratacion,
    }));
}

export function workspaceToSolutionGrupos(workspace: WorkspaceDTO): GrupoDTO[] {
    return workspace.grupos.map((group) => ({
        idUeaGrupo: group.idUeaGrupo,
        idGrupo: group.idGrupo,
        claveGrupo: group.claveGrupo,
        idArea: String(group.idArea),
        ueaClave: group.ueaClave,
        horarios: group.horarios,
        horarioStringRaw: group.horarioStringRaw ?? '',
    }));
}

export function workspaceToSolutionCatalogs(workspace: WorkspaceDTO): SolutionCatalogs {
    const catalogs: SolutionCatalogs = {
        ecosVigentesRegular: {},
        ecosVigentesIrregular: {},
        areaProfesor: {},
    };

    for (const profile of workspace.profesores) {
        const eco = String(profile.numeroEconomico);
        catalogs.areaProfesor[eco] = profile.areas.map(String);
        if (profile.tipoHorario === 'irregular') {
            catalogs.ecosVigentesIrregular[eco] = profile.horarioRaw.join('|') || 'irregular';
        } else {
            catalogs.ecosVigentesRegular[eco] = profile.horarioRaw.join('|') || 'regular';
        }
    }

    return catalogs;
}

export function filterGroupsByIngestaFSM(
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[],
    metadata: PipelineMetadataDTO
): GrupoDTO[] {
    const dummyProfesor: ProfesorDTO = {
        numeroEconomico: -1,
        idArea: [],
        horariosContratacion: [],
    };
    const grafo = new GrafoBipartito();
    grafo.registrarProfesor(dummyProfesor);
    profesores.forEach((profesor) => grafo.registrarProfesor(profesor));
    grupos.forEach((grupo) => grafo.registrarGrupo(grupo));

    return grupos.filter((grupo) => {
        if (!grupo.horarios || grupo.horarios.length === 0) {
            metadata.fsmTrace.push({
                regla: 'REGLA_GRUPO_TIENE_PROGRAMACION',
                resultado: 'FALLO',
                motivo: `Grupo ${grupo.claveGrupo} sin programacion.`,
            });
            return false;
        }

        const label = grupo.claveGrupo.trim().toUpperCase();
        if (label.includes('SAI') || label.includes('PRO')) {
            metadata.fsmTrace.push({
                regla: 'REGLA_IGNORAR_GRUPOS',
                resultado: 'FALLO',
                motivo: `Grupo ${grupo.claveGrupo} ignorado por contener SAI/PRO.`,
            });
            return false;
        }

        return true;
    });
}

export function resultToSolutionDTO(
    runId: string,
    resultado: ResultadoGreedy,
    grupos: GroupProfileDTO[],
    solutionGrupos: GrupoDTO[],
    metadata: PipelineMetadataDTO,
    scoreFor: (eco: number, idUeaGrupo: number) => number
): SolutionDTO {
    const groupProfiles = new Map(grupos.map((grupo) => [grupo.idUeaGrupo, grupo]));
    const solutionGroupMap = new Map(solutionGrupos.map((grupo) => [grupo.idUeaGrupo, grupo]));
    const assignments = resultado.asignaciones.reduce<AssignmentDTO[]>((acc, assignment) => {
            const profileGroup = groupProfiles.get(assignment.idUeaGrupo);
            const solutionGroup = solutionGroupMap.get(assignment.idUeaGrupo);
            if (!profileGroup || !solutionGroup) return acc;

            const scoreFinal = scoreFor(assignment.numeroEconomico, assignment.idUeaGrupo);
            acc.push({
                id: `local-${assignment.numeroEconomico}-${assignment.idUeaGrupo}`,
                numeroEconomico: assignment.numeroEconomico,
                idUeaGrupo: assignment.idUeaGrupo,
                claveGrupo: solutionGroup.claveGrupo,
                ueaClave: solutionGroup.ueaClave,
                ueaNombre: profileGroup.ueaNombre,
                horarios: solutionGroup.horarios,
                scoreFinal,
                origen: 'grasp',
                estado: 'asignada',
            });
            return acc;
        }, []);

    const solution = buildSolutionFromAssignments(
        runId,
        `GRASP local ${new Date().toLocaleTimeString()}`,
        assignments,
        grupos
    );

    return { ...solution, metadata };
}

export function graphToPreassignmentsArtifact(grafo: GrafoBipartito): PreassignmentsArtifactDTO {
    return {
        version: 'solution-parity-browser-1',
        profesores: Array.from(grafo.profesores.values()).map((profesor) => ({
            numeroEconomico: profesor.numeroEconomico,
            idArea: Number(profesor.idArea[0] ?? 0),
            horariosContratacion: profesor.horariosContratacion,
        })),
        grupos: Array.from(grafo.grupos.values()).map((grupo) => ({
            idUeaGrupo: grupo.idUeaGrupo,
            idGrupo: grupo.idGrupo,
            claveGrupo: grupo.claveGrupo,
            idArea: Number(grupo.idArea),
            ueaClave: grupo.ueaClave,
            horarios: grupo.horarios,
        })),
        adyacencias: Array.from(grafo.adyacencias.entries()).map(([numeroEconomico, idUeaGrupos]) => ({
            numeroEconomico,
            idUeaGrupos: [...idUeaGrupos],
        })),
        asignacionesInversas: Array.from(grafo.asignacionesInversas.entries()).map(([idUeaGrupo, numeroEconomico]) => ({
            idUeaGrupo,
            numeroEconomico,
        })),
        locks: [],
    };
}
