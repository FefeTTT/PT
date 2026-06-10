import type {
    AssignmentDTO,
    AssignmentOrigin,
    GroupProfileDTO,
    SolutionDTO,
    SolutionMetricsDTO,
} from '../dtos';
import { parseHorarioString } from './schedule';

type NormalizedRow = Map<string, unknown>;

export function parseGraspSolutionRows(
    rows: Record<string, unknown>[],
    groups: GroupProfileDTO[]
): AssignmentDTO[] {
    const groupsById = new Map(groups.map((group) => [group.idUeaGrupo, group]));
    const groupsByPair = new Map(groups.map((group) => [`${group.claveGrupo}|${group.ueaClave}`, group]));

    return rows
        .map((row, index) => parseAssignmentRow(row, index, groupsById, groupsByPair))
        .filter((assignment): assignment is AssignmentDTO => Boolean(assignment));
}

export function buildSolutionFromAssignments(
    id: string,
    nombre: string,
    assignments: AssignmentDTO[],
    groups: GroupProfileDTO[]
): SolutionDTO {
    const orphanGroups = findOrphanGroups(groups, assignments);

    return {
        id,
        nombre,
        createdAt: new Date().toISOString(),
        assignments,
        orphanGroups,
        metrics: computeSolutionMetrics(assignments, orphanGroups),
    };
}

export function findOrphanGroups(
    groups: GroupProfileDTO[],
    assignments: AssignmentDTO[]
): GroupProfileDTO[] {
    const assignedGroupIds = new Set(assignments.map((assignment) => assignment.idUeaGrupo));
    return groups
        .filter((group) => !assignedGroupIds.has(group.idUeaGrupo))
        .map((group) => ({
            ...group,
            estadoAsignacion: 'huerfana',
        }));
}

export function computeSolutionMetrics(
    assignments: AssignmentDTO[],
    orphanGroups: GroupProfileDTO[]
): SolutionMetricsDTO {
    const scored = assignments.filter((assignment) => typeof assignment.scoreFinal === 'number');
    const scorePromedio = scored.length > 0
        ? scored.reduce((sum, assignment) => sum + (assignment.scoreFinal ?? 0), 0) / scored.length
        : undefined;

    return {
        asignados: assignments.filter((assignment) => assignment.estado === 'asignada').length,
        huerfanos: orphanGroups.length,
        preasignados: assignments.filter((assignment) => assignment.estado === 'preasignada').length,
        rechazados: assignments.filter((assignment) => assignment.estado === 'rechazada').length,
        scorePromedio,
    };
}

function parseAssignmentRow(
    row: Record<string, unknown>,
    index: number,
    groupsById: Map<number, GroupProfileDTO>,
    groupsByPair: Map<string, GroupProfileDTO>
): AssignmentDTO | undefined {
    const normalized = normalizeRow(row);
    const numeroEconomico = pickNumber(normalized, ['eco', 'numeroeconomico', 'noeconomico', 'profesoreco']);
    const idUeaGrupo = pickNumber(normalized, ['idueagrupo', 'idgrupo_uea', 'nodo', 'grupoId']);
    const claveGrupo = pickString(normalized, ['grupo', 'clavegrupo', 'clave']);
    const ueaClave = pickNumber(normalized, ['uea', 'claveuea', 'ueaclave']);

    if (!numeroEconomico || (!idUeaGrupo && (!claveGrupo || !ueaClave))) {
        return undefined;
    }

    const group = idUeaGrupo
        ? groupsById.get(idUeaGrupo)
        : groupsByPair.get(`${claveGrupo}|${ueaClave}`);

    const rowHorario = pickString(normalized, ['horario', 'horarios']);
    const horarios = group?.horarios ?? parseHorarioString(rowHorario);
    const finalIdUeaGrupo = group?.idUeaGrupo ?? idUeaGrupo ?? index + 1;
    const finalClaveGrupo = group?.claveGrupo ?? claveGrupo ?? `G-${finalIdUeaGrupo}`;
    const finalUeaClave = group?.ueaClave ?? ueaClave ?? 0;
    const origen = normalizeOrigin(pickString(normalized, ['origen', 'source']));

    return {
        id: `sol-${numeroEconomico}-${finalIdUeaGrupo}-${index}`,
        numeroEconomico,
        idUeaGrupo: finalIdUeaGrupo,
        claveGrupo: finalClaveGrupo,
        ueaClave: finalUeaClave,
        ueaNombre: group?.ueaNombre,
        horarios,
        rHat: pickNumber(normalized, ['rhat', 'r_hat']),
        kde: pickNumber(normalized, ['kde', 'kdeih', 'kde_ih']),
        scoreFinal: pickNumber(normalized, ['scorefinal', 'score', 'z']),
        origen,
        estado: origen === 'preasignacion' ? 'preasignada' : 'asignada',
    };
}

function normalizeRow(row: Record<string, unknown>): NormalizedRow {
    const normalized = new Map<string, unknown>();
    Object.entries(row).forEach(([key, value]) => {
        normalized.set(normalizeKey(key), value);
    });
    return normalized;
}

function normalizeKey(key: string): string {
    return key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function pickString(row: NormalizedRow, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = row.get(normalizeKey(key));
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return String(value);
        }
    }
    return undefined;
}

function pickNumber(row: NormalizedRow, keys: string[]): number | undefined {
    const raw = pickString(row, keys);
    if (!raw) {
        return undefined;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

function normalizeOrigin(value?: string): AssignmentOrigin {
    if (!value) {
        return 'grasp';
    }
    const normalized = normalizeKey(value);
    if (normalized.includes('pre')) {
        return 'preasignacion';
    }
    if (normalized.includes('manual')) {
        return 'manual';
    }
    return 'grasp';
}
