import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildEcoProfiles,
    buildGroupProfiles,
    buildTimetablingWorkspace,
} from '../utils/buildWorkspace';
import {
    parsePipelineMetadata,
    parsePreassignmentsArtifact,
    summarizeMetadata,
} from '../utils/artifacts';
import {
    buildSolutionFromAssignments,
    parseGraspSolutionRows,
} from '../utils/solutionParser';
import { runLocalGraspPipeline } from '../engine/localGraspEngine';
import type { RequiredTimetablingFileKey } from '../dtos';

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
    },
}));

const mockedAxios = vi.mocked(axios);

afterEach(() => {
    vi.mocked(mockedAxios.post).mockReset();
});

const sourceFiles: Record<RequiredTimetablingFileKey, string> = {
    ecoNombre: 'eco-nombre.json',
    claveUea: 'clave-uea.json',
    areaProfesor: 'area_profesor.json',
    horariosRegulares: 'ecos_vigentes_con_horario_regular.json',
    horariosIrregulares: 'ecos_vigentes_con_horario_irregular.json',
    horariosIrregularesInferidos: 'ecos_irregulares_inferidos.json',
    programacionVacia: 'programacion_vacia_26P.json',
    dfHist: 'df_hist.json',
};

describe('timetabling workspace parsing', () => {
    it('parses programacion_vacia_26P.json into GrupoDTO compatible rows', () => {
        const result = buildGroupProfiles({
            '1111013': [
                { grupo: 'CCB01', horario: 'L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00' },
                { grupo: 'CSAI01', horario: null },
            ],
        });

        expect(result.grupos).toHaveLength(2);
        expect(result.grupos[0]).toMatchObject({
            idUeaGrupo: 1,
            idGrupo: 1,
            claveGrupo: 'CCB01',
            idArea: 1111,
            ueaClave: 1111013,
        });
        expect(result.grupos[0].horarios).toHaveLength(3);
        expect(result.grupos[1].horarios).toHaveLength(0);
        expect(result.issues.some((issue) => issue.message.includes('sin horario'))).toBe(true);
    });

    it('builds ProfesorDTO profiles without requiring ecos_irregulares_inferidos.json', () => {
        const result = buildEcoProfiles(
            { '28650': 'PROFESOR REGULAR', '4377': 'PROFESOR IRREGULAR' },
            { '28650': ['1111', '1112'], '4377': ['1113'] },
            { '28650': '10:00-18:00' },
            { '4377': { horario: ['*', '14:00-18:00'] } }
        );

        expect(result.profesores).toHaveLength(2);
        expect(result.profesores.find((profesor) => profesor.numeroEconomico === 28650)?.profesor).toMatchObject({
            numeroEconomico: 28650,
            idArea: 1111,
        });
        expect(result.profesores.find((profesor) => profesor.numeroEconomico === 4377)?.tipoHorario).toBe('irregular');
    });

    it('builds a complete workspace from only the five required inputs', () => {
        const result = buildTimetablingWorkspace({
            ecoNombre: { '28650': 'PROFESOR REGULAR' },
            areaProfesor: { '28650': ['1111'] },
            horariosRegulares: { '28650': '10:00-18:00' },
            horariosIrregulares: {},
            programacionVacia: {
                '1111013': [{ grupo: 'CCB01', horario: 'L:08:30-10:00' }],
            },
        }, sourceFiles);

        expect(result.workspace?.profesores).toHaveLength(1);
        expect(result.workspace?.grupos).toHaveLength(1);
        expect(result.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    });
});

describe('pipeline artifacts', () => {
    it('validates preasignaciones.json as a reconstructable graph artifact', () => {
        const result = parsePreassignmentsArtifact({
            version: '1',
            profesores: [
                {
                    numeroEconomico: 28650,
                    idArea: 1111,
                    horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '10:00:00', horaFin: '18:00:00' }],
                },
            ],
            grupos: [
                {
                    idUeaGrupo: 1,
                    idGrupo: 1,
                    claveGrupo: 'CCB01',
                    idArea: 1111,
                    ueaClave: 1111013,
                    horarios: [{ dia: 1, horaInicio: 8.5, horaFin: 10 }],
                },
            ],
            adyacencias: [{ numeroEconomico: 28650, idUeaGrupos: [1] }],
            asignacionesInversas: [{ idUeaGrupo: 1, numeroEconomico: 28650 }],
            locks: [{ idUeaGrupo: 1, numeroEconomico: 28650, origen: 'oficio', locked: true }],
        });

        expect(result.data?.adyacencias[0].idUeaGrupos).toEqual([1]);
        expect(result.issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    });

    it('renders partial metadata safely through the metadata summary model', () => {
        const result = parsePipelineMetadata({
            estadoGlobal: 'greedy',
            stages: [
                { name: 'ingesta', status: 'completed' },
                { name: 'greedy', status: 'running', progress: 35 },
            ],
            metrics: { asignados: 12, huerfanos: 2 },
        });

        expect(result.data?.fsmTrace).toEqual([]);
        expect(result.data?.errors).toEqual([]);
        expect(summarizeMetadata(result.data)).toMatchObject({
            title: 'greedy',
            progress: 35,
            activeStage: 'greedy',
        });
    });
});

describe('solution parsing', () => {
    it('parses GRASP XLSX rows into assignments and detects orphan groups', () => {
        const groups = buildGroupProfiles({
            '1111013': [
                { grupo: 'CCB01', horario: 'L:08:30-10:00' },
                { grupo: 'CCB02', horario: 'L:10:00-11:30' },
            ],
        }).grupos;
        const assignments = parseGraspSolutionRows([
            {
                eco: 28650,
                grupo: 'CCB01',
                uea: 1111013,
                r_hat: 0.91,
                kde: 0.82,
                score: 0.87,
            },
        ], groups);
        const solution = buildSolutionFromAssignments('s1', 'Solucion 1', assignments, groups);

        expect(assignments).toHaveLength(1);
        expect(assignments[0]).toMatchObject({
            numeroEconomico: 28650,
            claveGrupo: 'CCB01',
            ueaClave: 1111013,
        });
        expect(solution.orphanGroups).toHaveLength(1);
        expect(solution.metrics.huerfanos).toBe(1);
    });
});

describe('local GRASP runner', () => {
    it('runs the local TypeScript pipeline and emits solution metadata artifacts', async () => {
        vi.mocked(mockedAxios.post).mockImplementation(async (url: string) => {
            if (url.includes('/S_ijh')) {
                return { data: { rhat: 0.8, h_ih: 1.2 } };
            }
            if (url.includes('/predecir_kde_unificado')) {
                return { data: { score: 1.2, tipo_eco: 'regular' } };
            }
            if (url.includes('/get_horario_penalty_finetuned')) {
                return { data: { total_penalty: 0.1, loads: [], best_5: [] } };
            }
            return { data: {} };
        });

        const workspace = buildTimetablingWorkspace({
            ecoNombre: { '28650': 'PROFESOR REGULAR' },
            areaProfesor: { '28650': ['1111'] },
            horariosRegulares: { '28650': '07:00-15:00' },
            horariosIrregulares: {},
            programacionVacia: {
                '1111013': [{ grupo: 'CCB01', horario: 'L:08:30-10:00' }],
            },
        }, sourceFiles).workspace;

        expect(workspace).toBeDefined();

        const result = await runLocalGraspPipeline(workspace!, {
            config: {
                connectionMode: 'viteProxy',
                pythonHost: '127.0.0.1',
                pythonPort: '8000',
                redisHost: '127.0.0.1',
                redisPort: '6379',
            },
            k: 2,
            alpha: 0.2,
        });

        expect(result.solution.assignments).toHaveLength(1);
        expect(result.metadata.estadoGlobal).toBe('completed');
        expect(result.preasignaciones.asignacionesInversas).toEqual([
            { idUeaGrupo: 1, numeroEconomico: 28650 },
        ]);
    });

    it('uses penalty in scoreRcl to avoid overloading one eco with multiple UEAs', async () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
        vi.mocked(mockedAxios.post).mockImplementation(async (url: string, payload?: unknown) => {
            if (url.includes('/S_ijh')) {
                return { data: { rhat: 0.8, h_ih: 1.2 } };
            }
            if (url.includes('/predecir_kde_unificado')) {
                return { data: { score: 1.2, tipo_eco: 'regular' } };
            }
            if (url.includes('/get_horario_penalty_finetuned')) {
                const body = payload as { ueas_asignadas_actuales?: string[] };
                const isOverloadCandidate = (body.ueas_asignadas_actuales ?? []).length > 0;
                return {
                    data: {
                        total_penalty: isOverloadCandidate ? -10 : 0.1,
                        loads: [],
                        best_5: [],
                    },
                };
            }
            return { data: {} };
        });

        const workspace = buildTimetablingWorkspace({
            ecoNombre: {
                '28650': 'PROFESOR A',
                '4377': 'PROFESOR B',
            },
            areaProfesor: {
                '28650': ['1111'],
                '4377': ['1111'],
            },
            horariosRegulares: {
                '28650': '07:00-15:00',
                '4377': '07:00-15:00',
            },
            horariosIrregulares: {},
            programacionVacia: {
                '1111013': [
                    { grupo: 'CCB01', horario: 'L:08:30-10:00' },
                    { grupo: 'CCB02', horario: 'M:10:00-11:30' },
                ],
            },
        }, sourceFiles).workspace;

        const result = await runLocalGraspPipeline(workspace!, {
            config: {
                connectionMode: 'viteProxy',
                pythonHost: '127.0.0.1',
                pythonPort: '8000',
                redisHost: '127.0.0.1',
                redisPort: '6379',
            },
            k: 4,
            alpha: 0,
        });

        const assignmentsByEco = new Map<number, number>();
        result.solution.assignments.forEach((assignment) => {
            assignmentsByEco.set(
                assignment.numeroEconomico,
                (assignmentsByEco.get(assignment.numeroEconomico) ?? 0) + 1
            );
        });

        expect(result.solution.assignments).toHaveLength(2);
        expect(Math.max(...assignmentsByEco.values())).toBe(1);
        expect(result.metadata.metrics.logsFase1).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    candidatosTentados: expect.arrayContaining([
                        expect.objectContaining({
                            penaltyRaw: -10,
                            penaltyBlocked: true,
                            penaltyBlockReason: expect.stringContaining('PENALTY_TOTAL_FUERA_DOMINIO'),
                            estado: 'RECHAZADO',
                        }),
                    ]),
                }),
            ])
        );

        randomSpy.mockRestore();
    });
});
