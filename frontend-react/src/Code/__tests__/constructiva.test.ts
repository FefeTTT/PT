import { describe, it, expect, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { EstadoAsignacion } from '../fsm/FSMAsignador';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { EstrategiaRCL } from '../greedy/EstrategiaRCL';
import { EstrategiaMCV } from '../greedy/EstrategiaMCV';
import { GreedyOrchestrator } from '../greedy/GreedyOrchestrator';
import { EjectionChain } from '../greedy/EjectionChain';
import { CriterioAceptacion } from '../objective/Tolerancia';
import { IModeloML } from '../ml/IModeloML';
import { PESO_PENALIZACION_CONSECUTIVA } from '../ml/PerfilCargaConsecutiva';
import { datasetA, crearProfesor, crearGrupo, franja, horarioDB } from './helpers/fixtures';
import { crearGrafoConAsignaciones, crearFSMConReglas, snapshotGrafo } from './helpers/helpers';
import { CandidatoProfesor } from '../greedy/GreedyTypes';

class ModeloTabla implements IModeloML {
    constructor(private readonly scores: Record<string, number>) { }

    score(profesorId: number, grupoId: number): number {
        return this.scores[`${profesorId}:${grupoId}`] ?? 0;
    }
}

function crearCandidato(
    profesorEco: number,
    grupoId: number,
    scoreML: number,
    penalizacionConsecutiva: number
): CandidatoProfesor {
    const profesor = crearProfesor({ numeroEconomico: profesorEco, idArea: 10 });
    const grupo = crearGrupo({ idUeaGrupo: grupoId, idArea: 10 });

    return {
        profesor,
        grupo,
        scoreML,
        penalizacionConsecutiva,
        scoreRCL: scoreML - PESO_PENALIZACION_CONSECUTIVA * penalizacionConsecutiva
    };
}

describe('Fase 1 Constructiva - FSM Hard Constraints (Table-driven)', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    const casosRechazo = [
        {
            nombre: 'INVARIANTE_COLISION - grupo ya asignado',
            setup: () => {
                const { profesores, grupos } = datasetA();
                const grafo = crearGrafoConAsignaciones(profesores, grupos, [{ numEco: 1, idGrupo: 100 }]);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 2, idGrupo: 100 };
            },
            reglaEsperada: 'INVARIANTE_COLISION',
        },
        {
            nombre: 'REGLA_AREA - area del profesor no coincide con area del grupo',
            setup: () => {
                const prof = crearProfesor({ numeroEconomico: 5, idArea: 99 });
                const grupo = crearGrupo({ idUeaGrupo: 500, idArea: 10, horarios: [franja(1, 8, 10)] });
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupo);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 5, idGrupo: 500 };
            },
            reglaEsperada: 'REGLA_AREA',
        },
        {
            nombre: 'REGLA_HORARIO_LABORAL - horario fuera de contratacion',
            setup: () => {
                const prof = crearProfesor({
                    numeroEconomico: 6,
                    idArea: 10,
                    horariosContratacion: [horarioDB('L-V', '08:00:00', '12:00:00')],
                });
                const grupo = crearGrupo({ idUeaGrupo: 501, idArea: 10, horarios: [franja(1, 14, 16)] });
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupo);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 6, idGrupo: 501 };
            },
            reglaEsperada: 'REGLA_HORARIO_LABORAL',
        },
        {
            nombre: 'REGLA_TRASLAPE_UEA - traslape con grupo ya asignado al profesor',
            setup: () => {
                const prof = crearProfesor({
                    numeroEconomico: 8,
                    idArea: 10,
                    horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')],
                });
                const grupoAsignado = crearGrupo({
                    idUeaGrupo: 503,
                    idArea: 10,
                    horarios: [franja(1, 8, 10)]
                });
                const grupoTraslapado = crearGrupo({
                    idUeaGrupo: 504,
                    idArea: 10,
                    horarios: [franja(1, 9, 11)]
                });
                const grafo = crearGrafoConAsignaciones(
                    [prof],
                    [grupoAsignado, grupoTraslapado],
                    [{ numEco: 8, idGrupo: 503 }]
                );
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 8, idGrupo: 504 };
            },
            reglaEsperada: 'REGLA_TRASLAPE_UEA',
        },
        {
            nombre: 'REGLA_MAXIMO_N_HORAS_LABORALES - supera limite semanal',
            setup: () => {
                const prof = crearProfesor({ numeroEconomico: 7, idArea: 10 });
                const grupoGrande = crearGrupo({
                    idUeaGrupo: 502,
                    idArea: 10,
                    horarios: [franja(1, 8, 13), franja(2, 8, 13), franja(3, 8, 13), franja(4, 8, 13), franja(5, 8, 13)],
                });
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupoGrande);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 7, idGrupo: 502 };
            },
            reglaEsperada: 'REGLA_MAXIMO_N_HORAS_LABORALES',
        },
    ];

    it.each(casosRechazo)('$nombre', ({ setup, reglaEsperada }) => {
        const { fsm, numEco, idGrupo } = setup();
        const hashAntes = snapshotGrafo(fsm.grafoActual);

        const resultado = fsm.procesarAsignacion(numEco, idGrupo);

        expect(resultado.estado).toBe(EstadoAsignacion.ERROR_REGLA);
        expect(resultado.error?.reglaFallo).toBe(reglaEsperada);
        expect(snapshotGrafo(fsm.grafoActual)).toBe(hashAntes);
    });

    it('FSM acepta asignacion que cumple todas las reglas', () => {
        const { profesores, grupos } = datasetA();
        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));
        const fsm = crearFSMConReglas(grafo);

        const resultado = fsm.procesarAsignacion(1, 100);

        expect(resultado.estado).toBe(EstadoAsignacion.ASIGNACION_OK);
        expect(resultado.nuevoGrafo).toBeDefined();
        expect(resultado.nuevoGrafo!.asignacionesInversas.get(100)).toBe(1);
    });
});

describe('Fase 1 Constructiva - EstrategiaRCL', () => {
    it('alpha=0 (greedy puro): solo el mejor candidato en la RCL', () => {
        const rcl = new EstrategiaRCL(0);
        const grupo = crearGrupo({ idUeaGrupo: 900, idArea: 10 });
        const candidatos = [
            crearCandidato(1, 900, 0.4, 0),
            crearCandidato(2, 900, 0.9, 0),
            crearCandidato(3, 900, 0.7, 0),
        ];

        const elegido = rcl.seleccionarProfesorParaGrupo(candidatos, grupo);
        expect(elegido?.profesor.numeroEconomico).toBe(2);
    });

    it('alpha=1 (totalmente aleatorio): todos los candidatos en la RCL', () => {
        const rcl = new EstrategiaRCL(1);
        const grupo = crearGrupo({ idUeaGrupo: 901, idArea: 10 });
        const candidatos = [
            crearCandidato(1, 901, 0.1, 0),
            crearCandidato(2, 901, 0.9, 0),
        ];

        const elegido = rcl.seleccionarProfesorParaGrupo(candidatos, grupo);
        expect(elegido).not.toBeNull();
        expect([1, 2]).toContain(elegido!.profesor.numeroEconomico);
    });

    it('ordenarAreas: areas con menos grupos van primero (MCV)', () => {
        const areas = new Map<number, any[]>();
        areas.set(1, [crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 })]);
        areas.set(2, [crearGrupo({ idArea: 2 })]);

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarAreas(areas);

        expect(resultado[0][0]).toBe(2);
        expect(resultado[1][0]).toBe(1);
    });

    it('ordenarGrupos: mas franjas (mas restrictivo) va primero', () => {
        const g1 = crearGrupo({ idUeaGrupo: 1, idArea: 10, horarios: [franja(1, 8, 10)] });
        const g2 = crearGrupo({ idUeaGrupo: 2, idArea: 10, horarios: [franja(1, 8, 10), franja(2, 8, 10), franja(3, 8, 10)] });

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarGrupos([g1, g2]);

        expect(resultado[0].idUeaGrupo).toBe(2);
    });

    it('scoreRCL reduce candidatos con penalizacion historica de carga consecutiva', () => {
        const rcl = new EstrategiaRCL(0.5);
        const grupo = crearGrupo({ idUeaGrupo: 902, idArea: 10 });
        const candidatoSinPenalizacion = crearCandidato(1, 902, 0.8, 0);
        const candidatoPenalizado = crearCandidato(2, 902, 0.8, 1);

        const elegido = rcl.seleccionarProfesorParaGrupo(
            [candidatoPenalizado, candidatoSinPenalizacion],
            grupo
        );

        expect(elegido?.profesor.numeroEconomico).toBe(1);
    });

    it('el orquestador evalua todos los factibles y no asigna al primer profesor por rigidez', () => {
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
        ];
        const grupos = [
            crearGrupo({ idUeaGrupo: 910, idArea: 10, horarios: [franja(1, 8, 10)] })
        ];
        const modelo = new ModeloTabla({
            '1:910': 0.1,
            '2:910': 0.9,
        });
        const ec = new EjectionChain(0, 0, new CriterioAceptacion());
        const orchestrator = new GreedyOrchestrator(new EstrategiaMCV(), 24, modelo, undefined, ec);

        const resultado = orchestrator.ejecutar(profesores, grupos);

        expect(resultado.asignaciones).toEqual([{ numeroEconomico: 2, idUeaGrupo: 910 }]);
        expect(resultado.metricas.totalEvaluaciones).toBe(2);
    });

    it('claveGrupo repetida no fusiona grupos UEA-horario independientes', () => {
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
        ];
        const grupos = [
            crearGrupo({
                idUeaGrupo: 920,
                idGrupo: 1,
                claveGrupo: 'CAT01',
                ueaClave: 1112013,
                idArea: 10,
                horarios: [franja(1, 8, 10)]
            }),
            crearGrupo({
                idUeaGrupo: 921,
                idGrupo: 1,
                claveGrupo: 'CAT01',
                ueaClave: 1112014,
                idArea: 10,
                horarios: [franja(2, 8, 10)]
            }),
        ];
        const ec = new EjectionChain(0, 0, new CriterioAceptacion());
        const orchestrator = new GreedyOrchestrator(new EstrategiaMCV(), 24, undefined, undefined, ec);

        const resultado = orchestrator.ejecutar(profesores, grupos);
        const idsAsignados = new Set(resultado.asignaciones.map(a => a.idUeaGrupo));

        expect(idsAsignados.has(920)).toBe(true);
        expect(idsAsignados.has(921)).toBe(true);
    });
});
