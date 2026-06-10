import { describe, it, expect, beforeEach } from 'vitest';
import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import { SemanaLaboral } from '@solution/models/SemanaLaboral';
import type { CandidateRow } from '../engine/kde/candidateRow';
import type { KdeRawInputs } from '../engine/kde/graspKdeTypes';
import {
    EstadoAsignacion,
    seedReglasJson,
    crearPipelineManual,
    construirGrafoActual,
    crearContextoManualAsignacion,
    validarAsignacion,
} from '../engine/kde/manualAssignmentFsm';

const profesor: ProfesorDTO = {
    numeroEconomico: 100,
    idArea: ['1111'],
    horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '07:00:00', horaFin: '22:00:00' }],
};

// Grupo A: área del profe, L/Mi/V 07:00-08:30.
const grupoA: GrupoDTO = {
    idUeaGrupo: 10, idGrupo: 10, claveGrupo: 'CB01', idArea: '1111', ueaClave: 1111001,
    horarios: [
        { dia: 1, horaInicio: 7, horaFin: 8.5 },
        { dia: 3, horaInicio: 7, horaFin: 8.5 },
        { dia: 5, horaInicio: 7, horaFin: 8.5 },
    ],
    horarioStringRaw: 'L:07:00-08:30|Mi:07:00-08:30|V:07:00-08:30',
};

// Grupo B: misma área, choca con A el lunes (07:30-09:00).
const grupoB: GrupoDTO = {
    idUeaGrupo: 11, idGrupo: 11, claveGrupo: 'CB02', idArea: '1111', ueaClave: 1111002,
    horarios: [{ dia: 1, horaInicio: 7.5, horaFin: 9 }],
    horarioStringRaw: 'L:07:30-09:00',
};

// Grupo C: área NO vista por el profe.
const grupoC: GrupoDTO = {
    idUeaGrupo: 12, idGrupo: 12, claveGrupo: 'CB03', idArea: '9999', ueaClave: 9999001,
    horarios: [{ dia: 2, horaInicio: 10, horaFin: 11.5 }],
    horarioStringRaw: 'Ma:10:00-11:30',
};

const grupos = [grupoA, grupoB, grupoC];

const profesorContratoCorto: ProfesorDTO = {
    ...profesor,
    horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '07:00:00', horaFin: '15:00:00' }],
};

const grupoD: GrupoDTO = {
    idUeaGrupo: 13, idGrupo: 13, claveGrupo: 'CB04', idArea: '1111', ueaClave: 1111004,
    horarios: [{ dia: 2, horaInicio: 16, horaFin: 17.5 }],
    horarioStringRaw: 'Ma:16:00-17:30',
};

const inputs: KdeRawInputs = {
    ecoHorarioRegular: { '100': 'L:07:00-22:00' },
    ecoHorarioIrregularVigente: {},
    ecoHorarioIrregular: {},
    areaProfesor: { '100': ['1111'] },
    programacionVacia: {},
    ecoNombre: { '100': 'Profe Test' },
    dfHist: [],
};

const candRow = (idUeaGrupo: number): CandidateRow => ({
    numeroEconomico: 100, idUeaGrupo, uea: 0, claveGrupo: '', horarioStringRaw: '',
    turno: 'manana', locked: true, passIndex: 0,
});

beforeEach(() => {
    SemanaLaboral.invalidarCache();
    seedReglasJson(inputs); // inyecta catálogos + reinicia cache de reglas
});

describe('construirGrafoActual', () => {
    it('registra profesores/grupos y reaplica la carga actual', () => {
        const grafo = construirGrafoActual([profesor], grupos, [candRow(10)]);
        expect(grafo.profesores.get(100)).toBeDefined();
        expect(grafo.grupos.get(10)).toBeDefined();
        expect(grafo.asignacionesInversas.get(10)).toBe(100);
        expect(grafo.adyacencias.get(100)).toContain(10);
    });

    it('ignora filas con grupo ausente o ya tomado (no lanza)', () => {
        const grafo = construirGrafoActual([profesor], grupos, [candRow(10), candRow(10), candRow(999)]);
        expect(grafo.asignacionesInversas.get(10)).toBe(100);
        expect(grafo.asignacionesInversas.has(999)).toBe(false);
    });
});

describe('validarAsignacion (FSM fast-fail + reglas del GRASP)', () => {
    it('acepta una asignación viable', () => {
        const grafo = construirGrafoActual([profesor], grupos, []);
        const res = validarAsignacion(grafo, 100, grupoA.idUeaGrupo, crearPipelineManual());
        expect(res.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
        expect(res.nuevoGrafo).toBeDefined();
    });

    it('rechaza un área no vista por el profe (REGLA_AREAS_VISTAS)', () => {
        const grafo = construirGrafoActual([profesor], grupos, []);
        const res = validarAsignacion(grafo, 100, grupoC.idUeaGrupo, crearPipelineManual());
        expect(res.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(res.error?.reglaFallo).toBe('REGLA_AREAS_VISTAS');
    });

    it('rechaza un traslape de horario con la carga actual (REGLA_TRASLAPE_UEA)', () => {
        const grafo = construirGrafoActual([profesor], grupos, [candRow(10)]); // A ya asignado
        const res = validarAsignacion(grafo, 100, grupoB.idUeaGrupo, crearPipelineManual());
        expect(res.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(res.error?.reglaFallo).toBe('REGLA_TRASLAPE_UEA');
    });

    it('aplica la excepcion manual de horario laboral solo con mutuo acuerdo', () => {
        const detallesScoreBajo = { score: 0.001, h_ih: 0.001, rhat: 0, kde_ih_raw: 0.001 };
        const pipeline = crearPipelineManual();

        const sinMutuoAcuerdo = validarAsignacion(
            construirGrafoActual([profesorContratoCorto], [...grupos, grupoD], []),
            100,
            grupoD.idUeaGrupo,
            pipeline,
            crearContextoManualAsignacion(detallesScoreBajo, false),
        );
        const conMutuoAcuerdo = validarAsignacion(
            construirGrafoActual([profesorContratoCorto], [...grupos, grupoD], []),
            100,
            grupoD.idUeaGrupo,
            pipeline,
            crearContextoManualAsignacion(detallesScoreBajo, true),
        );

        expect(sinMutuoAcuerdo.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(sinMutuoAcuerdo.error?.reglaFallo).toBe('REGLA_HORARIO_LABORAL');
        expect(conMutuoAcuerdo.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
        expect(conMutuoAcuerdo.subestado).toBe('EXCEPCION_HORARIO_LABORAL');
        expect(conMutuoAcuerdo.excepcionesAplicadas).toContain('EXCEPCION_HORARIO_LABORAL');
    });
});
