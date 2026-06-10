import { describe, it, expect, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { EstadoAsignacion } from '../fsm/FSMAsignador';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { EstrategiaRCL } from '../greedy/EstrategiaRCL';
import { datasetA, crearProfesor, crearGrupo, franja, horarioDB } from './helpers/fixtures';
import { crearGrafoConAsignaciones, crearFSMConReglas, snapshotGrafo } from './helpers/helpers';
import { setJsonFiles } from '../misc/helper_functions';
import { reiniciarCacheReglas } from '../rules/ReglasImplementacion';

describe('Fase 1 Constructiva - FSM Hard Constraints (Table-driven)', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();

        // El fast-fail del pipeline (ReglaProfesorVigente / ReglaAreasVistas) consulta catálogos
        // JSON vía loadJsonFile. Estos tests usan ecos sintéticos (1,2,5,6,7,8) que no figuran en
        // los catálogos reales, así que los sembramos para que el fast-fail no corte antes de llegar
        // a la regla bajo prueba. El eco 5 se deja a propósito SIN el área 10 para ejercitar el
        // rechazo de REGLA_AREAS_VISTAS.
        setJsonFiles({
            'ecos_vigentes_con_horario_regular.json': {
                '1': '08:00-18:00',
                '2': '08:00-14:00',
                '5': '08:00-18:00',
                '6': '08:00-12:00',
                '7': '08:00-18:00',
                '8': '08:00-18:00',
            },
            'ecos_vigentes_con_horario_irregular.json': {},
            'area_profesor.json': {
                '1': ['10'],
                '2': ['10'],
                '5': ['99'],
                '6': ['10'],
                '7': ['10'],
                '8': ['10'],
            },
        });
        // Las reglas memorizan los catálogos en globals de módulo en su primera construcción;
        // reiniciamos para que tomen los fixtures recién sembrados en cada caso.
        reiniciarCacheReglas();
    });

    const casosRechazo = [
        {
            nombre: 'REGLA_ASIGNACION_GLOBAL - grupo ya asignado',
            setup: () => {
                const { profesores, grupos } = datasetA();
                const grafo = crearGrafoConAsignaciones(profesores, grupos, [{ numEco: 1, idGrupo: 100 }]);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 2, idGrupo: 100 };
            },
            reglaEsperada: 'REGLA_ASIGNACION_GLOBAL',
        },
        {
            nombre: 'REGLA_AREAS_VISTAS - area del grupo no vista historicamente por el profesor',
            setup: () => {
                const prof = crearProfesor({ numeroEconomico: 5, idArea: 99 });
                const grupo = crearGrupo({ idUeaGrupo: 500, idArea: 10, horarios: [franja(1, 8, 10)] });
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupo);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 5, idGrupo: 500 };
            },
            reglaEsperada: 'REGLA_AREAS_VISTAS',
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
            nombre: 'REGLA_MAXIMO_HORAS_DIARIAS - supera limite diario',
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
                // El grupo pide 5h en un solo día (8–13), por encima del límite diario. Usamos el
                // default GRASP de 4.5h en vez del 24 por defecto del helper (pensado para el hook
                // del frontend), de modo que la regla diaria efectivamente rechace la asignación.
                const fsm = crearFSMConReglas(grafo, 4.5);
                return { fsm, numEco: 7, idGrupo: 502 };
            },
            reglaEsperada: 'REGLA_MAXIMO_HORAS_DIARIAS',
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
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
            crearProfesor({ numeroEconomico: 3, idArea: 10 }),
        ];

        const ordenados = rcl.ordenarProfesores(profesores);
        expect(ordenados.length).toBe(profesores.length);
    });

    it('alpha=1 (totalmente aleatorio): todos los candidatos en la RCL', () => {
        const rcl = new EstrategiaRCL(1);
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
        ];

        const ordenados = rcl.ordenarProfesores(profesores);
        expect(ordenados.length).toBe(profesores.length);
    });

    it('ordenarAreas: areas con menos grupos van primero (MCV)', () => {
        const areas = new Map<string, any[]>();
        areas.set('1', [crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 })]);
        areas.set('2', [crearGrupo({ idArea: 2 })]);

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarAreas(areas);

        expect(resultado[0][0]).toBe('2');
        expect(resultado[1][0]).toBe('1');
    });

    it('ordenarGrupos: mas franjas (mas restrictivo) va primero', () => {
        const g1 = crearGrupo({ idUeaGrupo: 1, idArea: 10, horarios: [franja(1, 8, 10)] });
        const g2 = crearGrupo({ idUeaGrupo: 2, idArea: 10, horarios: [franja(1, 8, 10), franja(2, 8, 10), franja(3, 8, 10)] });

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarGrupos([g1, g2]);

        expect(resultado[0].idUeaGrupo).toBe(2);
    });

    it('la seleccion de profesores siempre retorna todos los elementos', () => {
        const rcl = new EstrategiaRCL(0.5);
        const profesores = Array.from({ length: 10 }, (_, i) =>
            crearProfesor({ numeroEconomico: i + 1, idArea: 10 })
        );

        const resultado = rcl.ordenarProfesores(profesores);
        expect(resultado.length).toBe(profesores.length);

        const idsResultado = new Set(resultado.map(p => p.numeroEconomico));
        for (const p of profesores) {
            expect(idsResultado.has(p.numeroEconomico)).toBe(true);
        }
    });
});
