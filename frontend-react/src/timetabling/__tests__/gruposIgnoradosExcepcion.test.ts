import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import { GrafoBipartito } from '@solution/models/GrafoBipartito';
import { FSMAsignador } from '@solution/fsm/FSMAsignador';
import { SemanaLaboral } from '@solution/models/SemanaLaboral';
import { ReglaIgnorarGrupos } from '@solution/rules/ReglasImplementacion';
import { ReglasPipeline } from '@solution/rules/ReglasPipeline';
import type { CandidateRow } from '../engine/kde/candidateRow';
import type { KdeRawInputs, KdeWorkerConfig, LockedAssignmentDTO } from '../engine/kde/graspKdeTypes';
import { fusionarLockedYNuevas, mapLockedRowsToDTO, type IterativeRunState } from '../engine/kde/runKdeGraspIterative';
import { sembrarAsignacionesBloqueadas, SYNTHETIC_LOCKED_ID_BASE } from '../engine/kde/lockedSeeding';
import { buildSetAssignationSnapshot } from '../hooks/useSetAssignation';
import {
    EstadoAsignacion,
    seedReglasJson,
    crearPipelineManual,
    construirGrafoActual,
    crearContextoManualAsignacion,
    asegurarGrupoEnGrafo,
    validarAsignacion,
} from '../engine/kde/manualAssignmentFsm';

const profesor: ProfesorDTO = {
    numeroEconomico: 100,
    idArea: ['1111'],
    horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '07:00:00', horaFin: '22:00:00' }],
};

// Segundo profesor (dueño original en los tests de Tomar/Intercambiar).
const profesor200: ProfesorDTO = {
    numeroEconomico: 200,
    idArea: ['1111'],
    horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '07:00:00', horaFin: '22:00:00' }],
};

// Grupo normal: área del profe, L 07:00-08:30.
const grupoNormal: GrupoDTO = {
    idUeaGrupo: 10, idGrupo: 10, claveGrupo: 'CB01', idArea: '1111', ueaClave: 1111001,
    horarios: [{ dia: 1, horaInicio: 7, horaFin: 8.5 }],
    horarioStringRaw: 'L:07:00-08:30',
};

// Grupo SAI: misma área, Ma 10:00-11:30 (clave contiene "SAI").
const grupoSai: GrupoDTO = {
    idUeaGrupo: 11, idGrupo: 11, claveGrupo: 'CSAI81', idArea: '1111', ueaClave: 1111002,
    horarios: [{ dia: 2, horaInicio: 10, horaFin: 11.5 }],
    horarioStringRaw: 'Ma:10:00-11:30',
};

// Grupo CPRO: misma área, J 10:00-11:30 (clave contiene "PRO").
const grupoCpro: GrupoDTO = {
    idUeaGrupo: 12, idGrupo: 12, claveGrupo: 'CPRO81', idArea: '1111', ueaClave: 1111003,
    horarios: [{ dia: 4, horaInicio: 10, horaFin: 11.5 }],
    horarioStringRaw: 'J:10:00-11:30',
};

// Grupo que se TRASLAPA con grupoSai (Ma 10:30-12:00), para probar visibilidad de carga.
const grupoTraslapaSai: GrupoDTO = {
    idUeaGrupo: 13, idGrupo: 13, claveGrupo: 'CB02', idArea: '1111', ueaClave: 1111004,
    horarios: [{ dia: 2, horaInicio: 10.5, horaFin: 12 }],
    horarioStringRaw: 'Ma:10:30-12:00',
};

const inputs: KdeRawInputs = {
    ecoHorarioRegular: { '100': 'L:07:00-22:00', '200': 'L:07:00-22:00' },
    ecoHorarioIrregularVigente: {},
    ecoHorarioIrregular: {},
    areaProfesor: { '100': ['1111'], '200': ['1111'] },
    programacionVacia: {},
    ecoNombre: { '100': 'Profe Test', '200': 'Profe Dueño' },
    dfHist: [],
};

const detalles = { score: 0.5, h_ih: 0.5, rhat: 0, kde_ih_raw: 0.5 };

const candRow = (grupo: GrupoDTO, eco = 100): CandidateRow => ({
    numeroEconomico: eco,
    idUeaGrupo: grupo.idUeaGrupo,
    uea: grupo.ueaClave,
    claveGrupo: grupo.claveGrupo,
    horarioStringRaw: grupo.horarioStringRaw,
    turno: 'manana',
    locked: true,
    passIndex: 0,
});

function grafoCon(grupos: GrupoDTO[]): GrafoBipartito {
    const grafo = new GrafoBipartito();
    grafo.registrarProfesor(profesor);
    for (const g of grupos) grafo.registrarGrupo(g);
    return grafo;
}

beforeEach(() => {
    SemanaLaboral.invalidarCache();
    seedReglasJson(inputs);
});

describe('ReglaIgnorarGrupos (excepción manual SAI/CPRO)', () => {
    const grafo = new GrafoBipartito();

    it('default: rechaza grupos SAI/PRO sin contexto y en modo automatic', () => {
        const regla = new ReglaIgnorarGrupos();
        expect(regla.evaluar(profesor, grupoSai, grafo).resultadoExitoso).toBe(false);
        expect(regla.evaluar(profesor, grupoCpro, grafo).resultadoExitoso).toBe(false);
        expect(regla.evaluar(profesor, grupoSai, grafo, { modoAsignacion: 'automatic' }).resultadoExitoso).toBe(false);
    });

    it('default: rechaza en modo manual SIN el flag asignarManualmente', () => {
        const regla = new ReglaIgnorarGrupos();
        const sinFlag = regla.evaluar(profesor, grupoSai, grafo, { modoAsignacion: 'manual' });
        expect(sinFlag.resultadoExitoso).toBe(false);
        const flagFalse = regla.evaluar(profesor, grupoSai, grafo, {
            modoAsignacion: 'manual',
            asignacionGruposIgnorados: { asignarManualmente: false },
        });
        expect(flagFalse.resultadoExitoso).toBe(false);
    });

    it('manual + asignarManualmente=true: pasa con subestado EXCEPCION_GRUPO_IGNORADO', () => {
        const regla = new ReglaIgnorarGrupos();
        const res = regla.evaluar(profesor, grupoSai, grafo, {
            modoAsignacion: 'manual',
            asignacionGruposIgnorados: { asignarManualmente: true },
        });
        expect(res.resultadoExitoso).toBe(true);
        expect(res.subestado).toBe('EXCEPCION_GRUPO_IGNORADO');
        expect(res.excepcionesAplicadas).toContain('EXCEPCION_GRUPO_IGNORADO');
    });

    it('el flag asignarManualmente NO aplica fuera del modo manual', () => {
        const regla = new ReglaIgnorarGrupos();
        const res = regla.evaluar(profesor, grupoSai, grafo, {
            modoAsignacion: 'automatic',
            asignacionGruposIgnorados: { asignarManualmente: true },
        });
        expect(res.resultadoExitoso).toBe(false);
    });

    it('constructor asignarAutomaticamente=true: pasa sin contexto y sin subestado', () => {
        const regla = new ReglaIgnorarGrupos({ asignarAutomaticamente: true });
        const res = regla.evaluar(profesor, grupoSai, grafo);
        expect(res.resultadoExitoso).toBe(true);
        expect(res.subestado).toBeUndefined();
    });

    it('no afecta grupos normales en ninguna configuración', () => {
        expect(new ReglaIgnorarGrupos().evaluar(profesor, grupoNormal, grafo).resultadoExitoso).toBe(true);
        expect(new ReglaIgnorarGrupos({ asignarAutomaticamente: true }).evaluar(profesor, grupoNormal, grafo).resultadoExitoso).toBe(true);
        const conContexto = new ReglaIgnorarGrupos().evaluar(profesor, grupoNormal, grafo, {
            modoAsignacion: 'manual',
            asignacionGruposIgnorados: { asignarManualmente: true },
        });
        expect(conContexto.resultadoExitoso).toBe(true);
        expect(conContexto.subestado).toBeUndefined();
    });
});

describe('ReglasPipeline con grupos SAI/CPRO', () => {
    it('getReglasIngestaGrupos default sigue filtrando SAI; con asignarAutomaticamente lo deja pasar', () => {
        const grafo = grafoCon([grupoSai]);
        const porDefecto = new FSMAsignador(grafo, [...ReglasPipeline.getReglasIngestaGrupos()])
            .procesarAsignacion(100, grupoSai.idUeaGrupo);
        expect(porDefecto.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(porDefecto.error?.reglaFallo).toBe('REGLA_IGNORAR_GRUPOS');

        const conOptIn = new FSMAsignador(grafoCon([grupoSai]), [...ReglasPipeline.getReglasIngestaGrupos({ asignarAutomaticamente: true })])
            .procesarAsignacion(100, grupoSai.idUeaGrupo);
        expect(conOptIn.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
    });

    it('getReglasFastFail default rechaza SAI; con asignarAutomaticamente lo deja pasar', () => {
        const porDefecto = new FSMAsignador(grafoCon([grupoSai]), [...ReglasPipeline.getReglasFastFail()])
            .procesarAsignacion(100, grupoSai.idUeaGrupo);
        expect(porDefecto.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(porDefecto.error?.reglaFallo).toBe('REGLA_IGNORAR_GRUPOS');

        const conOptIn = new FSMAsignador(grafoCon([grupoSai]), [...ReglasPipeline.getReglasFastFail({ asignarAutomaticamente: true })])
            .procesarAsignacion(100, grupoSai.idUeaGrupo);
        expect(conOptIn.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
    });

    it('getReglasRestantes ahora rechaza SAI por default (defensa en profundidad)', () => {
        const res = new FSMAsignador(grafoCon([grupoSai]), [...ReglasPipeline.getReglasRestantes()])
            .procesarAsignacion(100, grupoSai.idUeaGrupo);
        expect(res.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(res.error?.reglaFallo).toBe('REGLA_IGNORAR_GRUPOS');

        // Y sigue dejando pasar grupos normales.
        const normal = new FSMAsignador(grafoCon([grupoNormal]), [...ReglasPipeline.getReglasRestantes()])
            .procesarAsignacion(100, grupoNormal.idUeaGrupo);
        expect(normal.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
    });

    it('el pipeline manual completo permite SAI solo con contexto manual + flag', () => {
        const pipeline = crearPipelineManual();

        const sinContexto = validarAsignacion(
            construirGrafoActual([profesor], [grupoSai], []),
            100,
            grupoSai.idUeaGrupo,
            pipeline,
        );
        expect(sinContexto.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(sinContexto.error?.reglaFallo).toBe('REGLA_IGNORAR_GRUPOS');

        const sinFlag = validarAsignacion(
            construirGrafoActual([profesor], [grupoSai], []),
            100,
            grupoSai.idUeaGrupo,
            pipeline,
            crearContextoManualAsignacion(detalles, false),
        );
        expect(sinFlag.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(sinFlag.error?.reglaFallo).toBe('REGLA_IGNORAR_GRUPOS');

        const conFlag = validarAsignacion(
            construirGrafoActual([profesor], [grupoSai], []),
            100,
            grupoSai.idUeaGrupo,
            pipeline,
            crearContextoManualAsignacion(detalles, false, { asignarManualmenteGruposIgnorados: true }),
        );
        expect(conFlag.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
        expect(conFlag.subestado).toBe('EXCEPCION_GRUPO_IGNORADO');
        expect(conFlag.excepcionesAplicadas).toEqual(['EXCEPCION_GRUPO_IGNORADO']);
    });
});

describe('construirGrafoActual con gruposFallback', () => {
    it('registra la carga de filas fuera de catálogo y la FSM detecta el traslape', () => {
        // grupoSai NO está en el catálogo del pase; vive solo en el fallback (catálogo crudo).
        const gruposPase = [grupoNormal, grupoTraslapaSai];
        const grafo = construirGrafoActual([profesor], gruposPase, [candRow(grupoSai)], [grupoNormal, grupoSai]);
        expect(grafo.grupos.has(grupoSai.idUeaGrupo)).toBe(true);
        expect(grafo.asignacionesInversas.get(grupoSai.idUeaGrupo)).toBe(100);

        // El traslape Ma 10:00-11:30 vs Ma 10:30-12:00 ahora es visible para la FSM.
        const res = validarAsignacion(grafo, 100, grupoTraslapaSai.idUeaGrupo, crearPipelineManual());
        expect(res.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(res.error?.reglaFallo).toBe('REGLA_TRASLAPE_UEA');
    });

    it('sin fallback la carga fuera de catálogo sigue siendo invisible (comportamiento previo)', () => {
        const gruposPase = [grupoNormal, grupoTraslapaSai];
        const grafo = construirGrafoActual([profesor], gruposPase, [candRow(grupoSai)]);
        expect(grafo.grupos.has(grupoSai.idUeaGrupo)).toBe(false);
        const res = validarAsignacion(grafo, 100, grupoTraslapaSai.idUeaGrupo, crearPipelineManual());
        expect(res.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
    });

    it('NO registra desde el fallback si el DTO no coincide con la fila (colisión de id)', () => {
        const impostor: GrupoDTO = { ...grupoSai, claveGrupo: 'CB99', ueaClave: 9999009 };
        const grafo = construirGrafoActual([profesor], [grupoNormal], [candRow(grupoSai)], [impostor]);
        expect(grafo.grupos.has(grupoSai.idUeaGrupo)).toBe(false);
        expect(grafo.asignacionesInversas.has(grupoSai.idUeaGrupo)).toBe(false);
    });
});

describe('mapLockedRowsToDTO (blindaje de siembra)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resuelve por gruposValidos cuando el id y el DTO coinciden', () => {
        const rows = [candRow(grupoNormal)];
        const result = mapLockedRowsToDTO(rows, [grupoNormal, grupoTraslapaSai]);
        expect(result).toHaveLength(1);
        expect(result[0].claveGrupo).toBe('CB01');
        expect(result[0].idUeaGrupo).toBe(grupoNormal.idUeaGrupo);
    });

    it('cae al catálogo crudo cuando el id apunta a OTRO grupo en gruposValidos', () => {
        // En el catálogo del pase, el id de grupoSai está ocupado por un grupo distinto.
        const otroGrupoMismoId: GrupoDTO = { ...grupoTraslapaSai, idUeaGrupo: grupoSai.idUeaGrupo };
        const rows = [candRow(grupoSai)];
        const result = mapLockedRowsToDTO(rows, [otroGrupoMismoId], [grupoNormal, grupoSai]);
        expect(result).toHaveLength(1);
        expect(result[0].claveGrupo).toBe('CSAI81');
        expect(result[0].ueaClave).toBe(grupoSai.ueaClave);
    });

    it('omite la fila con console.warn cuando no coincide en ningún catálogo', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const otroGrupoMismoId: GrupoDTO = { ...grupoTraslapaSai, idUeaGrupo: grupoSai.idUeaGrupo };
        const impostorCrudo: GrupoDTO = { ...grupoSai, claveGrupo: 'CB99' };
        const rows = [candRow(grupoSai)];
        const result = mapLockedRowsToDTO(rows, [otroGrupoMismoId], [impostorCrudo]);
        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0][0])).toContain('CSAI81');
    });

    it('sin catálogo crudo se comporta como antes (omite ids no resolubles) pero avisa', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const rows = [candRow(grupoSai)];
        const result = mapLockedRowsToDTO(rows, [grupoNormal]);
        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('resuelve por clave estable cuando el id está renumerado en AMBOS catálogos (locks de pases N≥1)', () => {
        // La fila se bloqueó en un pase viejo: su id (999) ya no existe ni en gruposValidos
        // (apunta a otro grupo) ni en el crudo por id; solo la clave estable la encuentra.
        const row: CandidateRow = { ...candRow(grupoSai), idUeaGrupo: 999 };
        const otroConEseId: GrupoDTO = { ...grupoTraslapaSai, idUeaGrupo: 999 };
        const result = mapLockedRowsToDTO([row], [otroConEseId], [grupoNormal, grupoSai]);
        expect(result).toHaveLength(1);
        expect(result[0].claveGrupo).toBe('CSAI81');
        expect(result[0].ueaClave).toBe(grupoSai.ueaClave);
        // Conserva el id ORIGINAL de la fila (su candidateKey/lock); contenido del DTO resuelto.
        expect(result[0].idUeaGrupo).toBe(999);
        expect(result[0].idGrupo).toBe(grupoSai.idGrupo);
    });

    it('la clave estable exige también el horario: si difiere, omite con warn', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const row: CandidateRow = { ...candRow(grupoSai), idUeaGrupo: 999, horarioStringRaw: 'J:07:00-08:30' };
        const result = mapLockedRowsToDTO([row], [], [grupoNormal, grupoSai]);
        expect(result).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });
});

describe('asegurarGrupoEnGrafo (registro explícito en Tomar/Intercambiar)', () => {
    it('reproduce el bug A: sin registro explícito la pierna take da INTEGRIDAD_GRAFO', () => {
        // grafoLiberado del swap: catálogo del pase SIN el grupo SAI objetivo (y sin las filas
        // involucradas) — la FSM falla ANTES de evaluar reglas, aun con la excepción manual.
        const pipeline = crearPipelineManual();
        const grafo = construirGrafoActual([profesor, profesor200], [grupoNormal], []);
        const res = validarAsignacion(
            grafo, 100, grupoSai.idUeaGrupo, pipeline,
            crearContextoManualAsignacion(detalles, false, { asignarManualmenteGruposIgnorados: true }),
        );
        expect(res.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(res.error?.reglaFallo).toBe('INTEGRIDAD_GRAFO');
    });

    it('con registro explícito el take es viable con excepción SAI/CPRO y nuevoGrafo conserva los registros para la 2ª pierna', () => {
        const pipeline = crearPipelineManual();
        const grafo = construirGrafoActual([profesor, profesor200], [grupoNormal], []);
        asegurarGrupoEnGrafo(grafo, grupoSai);    // grupo objetivo (SAI, fuera de gruposValidos)
        asegurarGrupoEnGrafo(grafo, grupoNormal); // replaceGrupo: no-op, ya estaba registrado

        const take = validarAsignacion(
            grafo, 100, grupoSai.idUeaGrupo, pipeline,
            crearContextoManualAsignacion(detalles, false, { asignarManualmenteGruposIgnorados: true }),
        );
        expect(take.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
        expect(take.excepcionesAplicadas).toContain('EXCEPCION_GRUPO_IGNORADO');

        // `asignar()` propaga el map de grupos: los registros sobreviven en nuevoGrafo.
        const grafoTrasTake = take.nuevoGrafo!;
        expect(grafoTrasTake.grupos.has(grupoSai.idUeaGrupo)).toBe(true);
        expect(grafoTrasTake.grupos.has(grupoNormal.idUeaGrupo)).toBe(true);

        // Segunda pierna: el dueño original (eco 200) recibe el replaceGrupo sobre el grafo del take.
        const owner = validarAsignacion(grafoTrasTake, 200, grupoNormal.idUeaGrupo, pipeline);
        expect(owner.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
    });

    it('colisión de id: reemplaza el registro solo si el id NO tiene asignación vigente', () => {
        const impostor: GrupoDTO = { ...grupoTraslapaSai, idUeaGrupo: grupoSai.idUeaGrupo };

        const libre = new GrafoBipartito();
        libre.registrarProfesor(profesor);
        libre.registrarGrupo(impostor);
        asegurarGrupoEnGrafo(libre, grupoSai);
        expect(libre.grupos.get(grupoSai.idUeaGrupo)?.claveGrupo).toBe('CSAI81');

        const ocupado = new GrafoBipartito();
        ocupado.registrarProfesor(profesor);
        ocupado.registrarGrupo(impostor);
        ocupado.asignarMutable(100, impostor.idUeaGrupo);
        asegurarGrupoEnGrafo(ocupado, grupoSai);
        expect(ocupado.grupos.get(grupoSai.idUeaGrupo)?.claveGrupo).toBe('CB02');
    });
});

describe('fusionarLockedYNuevas (fusión por contenido físico)', () => {
    const lockedBase: CandidateRow = {
        ...candRow(grupoSai),
        passIndex: 0,
        metadata: { origin: 'manual' },
    };

    it('una fila nueva con id sintético y mismo contenido físico NO duplica a la locked y le presta sus scores', () => {
        const freshSintetica: CandidateRow = {
            ...candRow(grupoSai),
            idUeaGrupo: SYNTHETIC_LOCKED_ID_BASE,
            locked: false,
            passIndex: 2,
            score: 0.9,
            kde_ij: 0.8,
        };
        const otraNueva: CandidateRow = { ...candRow(grupoNormal, 200), locked: false, passIndex: 2 };
        const out = fusionarLockedYNuevas([lockedBase], [freshSintetica, otraNueva]);

        expect(out).toHaveLength(2);
        const lockedOut = out.find(r => r.numeroEconomico === 100 && r.claveGrupo === 'CSAI81')!;
        expect(lockedOut.idUeaGrupo).toBe(lockedBase.idUeaGrupo); // conserva id/candidateKey original
        expect(lockedOut.locked).toBe(true);
        expect(lockedOut.passIndex).toBe(0);
        expect(lockedOut.metadata?.origin).toBe('manual');
        expect(lockedOut.score).toBe(0.9);                        // adopta los scores frescos
        expect(lockedOut.kde_ij).toBe(0.8);
        // La fila sintética NO re-entra como fila nueva.
        expect(out.filter(r => r.claveGrupo === 'CSAI81')).toHaveLength(1);
    });

    it('una fila nueva con el MISMO candidateKey pero OTRO grupo físico (colisión) no presta scores', () => {
        const colision: CandidateRow = {
            ...candRow(grupoTraslapaSai),
            idUeaGrupo: lockedBase.idUeaGrupo, // mismo eco|id que la locked, grupo físico distinto
            locked: false,
            passIndex: 2,
            score: 0.7,
        };
        const out = fusionarLockedYNuevas([lockedBase], [colision]);
        expect(out).toHaveLength(1);
        expect(out[0].claveGrupo).toBe('CSAI81');
        expect(out[0].score).toBeUndefined(); // no adopta scores de otro grupo físico
    });

    it('con 0 locks es identidad sobre las filas nuevas (paridad pase 0)', () => {
        const nuevas = [candRow(grupoNormal, 200), candRow(grupoCpro, 300)].map(r => ({ ...r, locked: false }));
        expect(fusionarLockedYNuevas([], nuevas)).toEqual(nuevas);
    });
});

describe('sembrarAsignacionesBloqueadas (guard anti-colisión del worker)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const lockedDTO = (grupo: GrupoDTO, eco = 100): LockedAssignmentDTO => ({
        numeroEconomico: eco,
        idUeaGrupo: grupo.idUeaGrupo,
        idGrupo: grupo.idGrupo,
        ueaClave: grupo.ueaClave,
        claveGrupo: grupo.claveGrupo,
        idArea: grupo.idArea,
        horarioStringRaw: grupo.horarioStringRaw,
        horarios: grupo.horarios,
    });

    it('siembra normal: registra el grupo ausente y asigna la carga al eco', () => {
        const grafo = grafoCon([grupoNormal]);
        const seeded = sembrarAsignacionesBloqueadas(grafo, [lockedDTO(grupoSai)]);
        expect(seeded).toHaveLength(1);
        expect(seeded[0].sintetico).toBe(false);
        expect(seeded[0].idEfectivo).toBe(grupoSai.idUeaGrupo);
        expect(grafo.grupos.get(grupoSai.idUeaGrupo)?.claveGrupo).toBe('CSAI81');
        expect(grafo.asignacionesInversas.get(grupoSai.idUeaGrupo)).toBe(100);
    });

    it('id ocupado por el MISMO grupo físico: no duplica registro y asigna ahí', () => {
        const grafo = grafoCon([grupoNormal, grupoSai]);
        const seeded = sembrarAsignacionesBloqueadas(grafo, [lockedDTO(grupoSai)]);
        expect(seeded[0].sintetico).toBe(false);
        expect(grafo.asignacionesInversas.get(grupoSai.idUeaGrupo)).toBe(100);
    });

    it('colisión de renumeración: registra bajo id sintético, asigna ahí y deja intacto el grupo del pase', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const grafo = grafoCon([{ ...grupoTraslapaSai, idUeaGrupo: grupoSai.idUeaGrupo }]);
        const seeded = sembrarAsignacionesBloqueadas(grafo, [lockedDTO(grupoSai)]);

        expect(seeded[0].sintetico).toBe(true);
        expect(seeded[0].idEfectivo).toBeGreaterThanOrEqual(SYNTHETIC_LOCKED_ID_BASE);
        expect(seeded[0].dto.claveGrupo).toBe('CSAI81');
        expect(grafo.grupos.get(seeded[0].idEfectivo)?.claveGrupo).toBe('CSAI81');
        expect(grafo.asignacionesInversas.get(seeded[0].idEfectivo)).toBe(100);
        // El grupo del pase con el id original queda intacto y SIN la carga equivocada.
        expect(grafo.grupos.get(grupoSai.idUeaGrupo)?.claveGrupo).toBe('CB02');
        expect(grafo.asignacionesInversas.has(grupoSai.idUeaGrupo)).toBe(false);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('dos colisiones reciben ids sintéticos distintos', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const grafo = grafoCon([
            { ...grupoTraslapaSai, idUeaGrupo: grupoSai.idUeaGrupo },
            { ...grupoNormal, idUeaGrupo: grupoCpro.idUeaGrupo },
        ]);
        const seeded = sembrarAsignacionesBloqueadas(grafo, [lockedDTO(grupoSai), lockedDTO(grupoCpro)]);
        expect(seeded[0].sintetico).toBe(true);
        expect(seeded[1].sintetico).toBe(true);
        expect(seeded[0].idEfectivo).not.toBe(seeded[1].idEfectivo);
        expect(grafo.asignacionesInversas.get(seeded[0].idEfectivo)).toBe(100);
        expect(grafo.asignacionesInversas.get(seeded[1].idEfectivo)).toBe(100);
    });

    it('con 0 locks es no-op (paridad pase 0)', () => {
        const grafo = grafoCon([grupoNormal]);
        const hashAntes = grafo.hashEstado();
        expect(sembrarAsignacionesBloqueadas(grafo, [])).toEqual([]);
        expect(grafo.hashEstado()).toBe(hashAntes);
    });
});

describe('buildSetAssignationSnapshot (catálogo crudo hacia el runner)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const configStub: KdeWorkerConfig = {
        mode: 'kde_ij',
        seed: 100,
        k: 48,
        alpha: 0.25,
        renderOnly: false,
        noPenalty: true,
        withRhat: false,
        options: {},
        targetEcos: [],
        horasSuperficie: [],
    };

    const makeState = (candidates: CandidateRow[], gruposValidos: GrupoDTO[]): IterativeRunState => ({
        pass: 1,
        candidates,
        history: [],
        converged: false,
        lastResult: { gruposValidos } as unknown as IterativeRunState['lastResult'],
    });

    it('propaga gruposCatalogo a la siembra y NORMALIZA ids legacy al espacio crudo', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const lockedRow: CandidateRow = { ...candRow(grupoSai), idUeaGrupo: 999 };
        const snapshot = buildSetAssignationSnapshot(
            makeState([lockedRow], [{ ...grupoTraslapaSai, idUeaGrupo: 999 }]),
            configStub,
            inputs,
            new Set<number>(),
            [grupoNormal, grupoSai],
        );
        expect(snapshot.lockedAssignments).toHaveLength(1);
        expect(snapshot.lockedAssignments?.[0].claveGrupo).toBe('CSAI81');
        // Ids unificados: el id legacy 999 se re-mapea al id CRUDO del catálogo (antes se
        // conservaba 999 y el guard de ids sintéticos resolvía la colisión en el worker).
        expect(snapshot.lockedAssignments?.[0].idUeaGrupo).toBe(grupoSai.idUeaGrupo);
        // El payload lleva los archivos COMPLETOS + la exclusión por contenido.
        expect(snapshot.inputs).toBe(inputs);
        expect(snapshot.blockedKeys).toEqual([{ uea: grupoSai.ueaClave, claveGrupo: 'CSAI81' }]);
    });

    it('sin catálogo explícito lo deriva de rawInputs.programacionVacia (antes: lock omitido con warn)', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const lockedRow: CandidateRow = { ...candRow(grupoNormal), idUeaGrupo: 999 };
        const rawConProgramacion: KdeRawInputs = {
            ...inputs,
            programacionVacia: { '1111001': [{ grupo: 'CB01', horario: 'L:07:00-08:30' }] },
        };
        const snapshot = buildSetAssignationSnapshot(
            makeState([lockedRow], [{ ...grupoTraslapaSai, idUeaGrupo: 999 }]),
            configStub,
            rawConProgramacion,
            new Set<number>(),
        );
        expect(snapshot.lockedAssignments).toHaveLength(1);
        expect(snapshot.lockedAssignments?.[0].claveGrupo).toBe('CB01');
        expect(snapshot.lockedAssignments?.[0].ueaClave).toBe(1111001);
        // Id normalizado al crudo del catálogo derivado (CB01 es el primer grupo parseado → 1)
        // y programación COMPLETA en el payload (el grupo bloqueado viaja en blockedKeys).
        expect(snapshot.lockedAssignments?.[0].idUeaGrupo).toBe(1);
        expect(snapshot.inputs.programacionVacia).toEqual(rawConProgramacion.programacionVacia);
        expect(snapshot.blockedKeys).toEqual([{ uea: 1111001, claveGrupo: 'CB01' }]);
    });
});
