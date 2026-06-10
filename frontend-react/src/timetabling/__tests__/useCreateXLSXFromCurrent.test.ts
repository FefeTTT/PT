import { describe, expect, it } from 'vitest';
import type { KdeWorkerConfig } from '../engine/kde/graspKdeTypes';
import {
    buildCurrentXlsxRows,
    CURRENT_XLSX_HEADERS,
} from '../hooks/useCreateXLSXFromCurrent';
import type { SaveAssignationSolutionPayload } from '../hooks/useSaveAssignationSolution';

const config = {
    mode: 'kde_ij',
    seed: 20260526,
    k: 48,
    alpha: 0.25,
    renderOnly: false,
    noPenalty: false,
    withRhat: false,
    options: {},
    targetEcos: [],
    horasSuperficie: [],
} as KdeWorkerConfig;

describe('useCreateXLSXFromCurrent', () => {
    it('convierte el JSON de Ctrl+S a las columnas esperadas del XLSX', () => {
        const payload: SaveAssignationSolutionPayload = {
            version: 1,
            savedAt: 1,
            snapshot: {
                version: 2,
                savedAt: 1,
                pase: 0,
                paseSiguiente: 1,
                type: 'run',
                inputs: {
                    ecoHorarioRegular: {},
                    areaProfesor: {},
                    programacionVacia: {
                        '1111013': [
                            { grupo: 'CCB01', horario: 'L:08:30-10:00', cupo: 45 },
                        ],
                    } as any,
                    ecoNombre: { '28650': 'PROFESOR PRUEBA' },
                    claveUea: { '1111013': 'ALGEBRA LINEAL' },
                    dfHist: [],
                },
                config,
                lockedAssignments: [],
                completedEcos: [],
            },
            candidatos: [],
            GRASPSolutionToXLS: {
                asignaciones: [{ numeroEconomico: 28650, idUeaGrupo: 1 }],
                grupos: [
                    {
                        idUeaGrupo: 1,
                        idGrupo: 10,
                        claveGrupo: 'CCB01',
                        idArea: 'CBI',
                        ueaClave: 1111013,
                        horarios: [],
                        horarioStringRaw: 'L:8:30-10:00|Mi:13:00-14:30|V:15:00:00-16:30:00',
                    },
                ],
                ecoNombre: { '28650': 'PROFESOR PRUEBA' },
                claveUea: { '1111013': 'ALGEBRA LINEAL' },
                programacionVacia: {
                    '1111013': [
                        { grupo: 'CCB01', horario: 'L:08:30-10:00', cupo: 45 },
                    ],
                } as any,
            },
        };

        const rows = buildCurrentXlsxRows([payload]);

        expect(CURRENT_XLSX_HEADERS).toEqual([
            'U.E.A.', '', 'CUPO', 'Grupo', 'LUNES', 'LUNES_F', '', 'MARTES', 'MARTES_F', '',
            'MIERCOLES', 'MIERCOLES_F', 'JUEVES', 'JUEVES_F', 'VIERNES', 'VIERNES_F', '',
            'NO. ECO.', 'PROFESOR PROPUESTO',
        ]);
        expect(rows).toEqual([
            [
                1111013,
                'ALGEBRA LINEAL',
                45,
                'CCB01',
                '08:30',
                '10:00',
                '',
                '',
                '',
                '',
                '13:00',
                '14:30',
                '',
                '',
                '15:00',
                '16:30',
                '',
                28650,
                'PROFESOR PRUEBA',
            ],
        ]);
    });
});
