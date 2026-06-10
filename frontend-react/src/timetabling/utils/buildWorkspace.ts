import type {
    EcoProfileDTO,
    FranjaHorariaDTO,
    GroupProfileDTO,
    HorarioDB_DTO,
    ProfesorDTO,
    RequiredTimetablingFileKey,
    ValidationIssueDTO,
    WorkspaceDTO,
} from '../dtos';
import {
    areaProfesorSchema,
    ecoNombreSchema,
    horariosIrregularesSchema,
    horariosRegularesSchema,
    programacionVaciaSchema,
    type AreaProfesorInput,
    type EcoNombreInput,
    type HorariosIrregularesInput,
    type HorariosRegularesInput,
    type ProgramacionVaciaInput,
} from '../schemas/timetablingSchemas';
import { buildFlexibleHorarioDb, buildHorarioDbFromRange, parseHorarioString } from './schedule';
import { error, parseWithIssues, warning } from './validation';

export interface TimetablingRawInputs {
    ecoNombre: unknown;
    areaProfesor: unknown;
    horariosRegulares: unknown;
    horariosIrregulares: unknown;
    horariosIrregularesInferidos?: unknown;
    programacionVacia: unknown;
    dfHist?: unknown;
}

export interface WorkspaceBuildResult {
    workspace?: WorkspaceDTO;
    issues: ValidationIssueDTO[];
}

const RANGE_PATTERN = /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/;

export function buildTimetablingWorkspace(
    inputs: TimetablingRawInputs,
    sourceFiles: Record<RequiredTimetablingFileKey, string>
): WorkspaceBuildResult {
    const ecoNombre = parseWithIssues(ecoNombreSchema, inputs.ecoNombre, 'eco-nombre.json');
    const areaProfesor = parseWithIssues(areaProfesorSchema, inputs.areaProfesor, 'area_profesor.json');
    const regulares = parseWithIssues(
        horariosRegularesSchema,
        inputs.horariosRegulares,
        'ecos_vigentes_con_horario_regular.json'
    );
    const irregulares = parseWithIssues(
        horariosIrregularesSchema,
        inputs.horariosIrregulares,
        'ecos_vigentes_con_horario_irregular.json'
    );
    const programacion = parseWithIssues(
        programacionVaciaSchema,
        inputs.programacionVacia,
        'programacion_vacia_26P.json'
    );

    const issues = [
        ...ecoNombre.issues,
        ...areaProfesor.issues,
        ...regulares.issues,
        ...irregulares.issues,
        ...programacion.issues,
    ];

    if (!ecoNombre.data || !areaProfesor.data || !regulares.data || !irregulares.data || !programacion.data) {
        return { issues };
    }

    const professorsResult = buildEcoProfiles(
        ecoNombre.data,
        areaProfesor.data,
        regulares.data,
        irregulares.data
    );
    const groupsResult = buildGroupProfiles(programacion.data);

    return {
        workspace: {
            profesores: professorsResult.profesores,
            grupos: groupsResult.grupos,
            warnings: [...professorsResult.issues, ...groupsResult.issues],
            sourceFiles,
        },
        issues: [...issues, ...professorsResult.issues, ...groupsResult.issues],
    };
}

export function buildEcoProfiles(
    ecoNombre: EcoNombreInput,
    areaProfesor: AreaProfesorInput,
    regulares: HorariosRegularesInput,
    irregulares: HorariosIrregularesInput
): { profesores: EcoProfileDTO[]; issues: ValidationIssueDTO[] } {
    const issues: ValidationIssueDTO[] = [];
    const vigentes = new Set<number>();

    Object.keys(regulares).forEach((eco) => vigentes.add(Number(eco)));
    Object.keys(irregulares).forEach((eco) => vigentes.add(Number(eco)));

    const profesores = Array.from(vigentes)
        .filter(Number.isFinite)
        .sort((a, b) => a - b)
        .map((numeroEconomico) => {
            const ecoKey = String(numeroEconomico);
            const areas = normalizeAreas(areaProfesor[ecoKey] ?? []);
            const regularRange = regulares[ecoKey];
            const irregularData = irregulares[ecoKey];
            const horariosContratacion: HorarioDB_DTO[] = [];
            const horarioRaw: string[] = [];

            if (regularRange) {
                try {
                    horariosContratacion.push(buildHorarioDbFromRange(regularRange));
                    horarioRaw.push(regularRange);
                } catch (buildError) {
                    issues.push(error(`profesores.${ecoKey}.horario`, String(buildError)));
                }
            }

            if (irregularData) {
                irregularData.horario.forEach((fragment, index) => {
                    horarioRaw.push(fragment);
                    if (fragment === '*' || fragment === '**') {
                        horariosContratacion.push(buildFlexibleHorarioDb(fragment));
                        return;
                    }
                    if (RANGE_PATTERN.test(fragment)) {
                        try {
                            horariosContratacion.push(buildHorarioDbFromRange(fragment));
                        } catch (buildError) {
                            issues.push(error(`profesores.${ecoKey}.horario.${index}`, String(buildError)));
                        }
                        return;
                    }
                    issues.push(warning(`profesores.${ecoKey}.horario.${index}`, `Horario irregular no reconocido: ${fragment}`));
                });
            }

            if (areas.length === 0) {
                issues.push(warning(`profesores.${ecoKey}.areas`, 'Profesor vigente sin area registrada.'));
            }

            const profesor: ProfesorDTO = {
                numeroEconomico,
                idArea: areas[0] ?? 0,
                horariosContratacion,
            };

            return {
                numeroEconomico,
                nombre: ecoNombre[ecoKey] ?? `Eco ${ecoKey}`,
                areas,
                tipoHorario: irregularData ? 'irregular' : 'regular',
                profesor,
                horarioRaw,
                topRHat: [],
                topKde: [],
                assignments: [],
            } satisfies EcoProfileDTO;
        });

    return { profesores, issues };
}

export function buildGroupProfiles(
    programacion: ProgramacionVaciaInput
): { grupos: GroupProfileDTO[]; issues: ValidationIssueDTO[] } {
    const issues: ValidationIssueDTO[] = [];
    const grupos: GroupProfileDTO[] = [];
    let idCounter = 1;

    Object.entries(programacion).forEach(([ueaClaveRaw, rows]) => {
        const ueaClave = Number(ueaClaveRaw);
        const idArea = Number(ueaClaveRaw.slice(0, 4));

        rows.forEach((row, index) => {
            const idUeaGrupo = idCounter;
            idCounter += 1;

            let horarios: FranjaHorariaDTO[] = [];
            const groupWarnings: string[] = [];

            try {
                horarios = parseHorarioString(row.horario);
            } catch (parseError) {
                const message = String(parseError);
                issues.push(error(`programacion.${ueaClaveRaw}.${index}.horario`, message));
                groupWarnings.push(message);
            }

            if (horarios.length === 0) {
                const message = 'Grupo sin horario programado.';
                issues.push(warning(`programacion.${ueaClaveRaw}.${index}.horario`, message));
                groupWarnings.push(message);
            }

            grupos.push({
                idUeaGrupo,
                idGrupo: idUeaGrupo,
                claveGrupo: String(row.grupo),
                idArea,
                ueaClave,
                horarios,
                horarioStringRaw: row.horario ?? null,
                estadoAsignacion: 'pendiente',
                warnings: groupWarnings,
            });
        });
    });

    return { grupos, issues };
}

function normalizeAreas(rawAreas: Array<string | number>): number[] {
    return rawAreas
        .map((area) => Number(area))
        .filter((area) => Number.isFinite(area));
}
