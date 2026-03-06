import { describe, it, expect, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { EstrategiaRCL } from '../greedy/EstrategiaRCL';
import { datasetA, crearProfesor, crearGrupo, franja, horarioDB } from './helpers/fixtures';
import { crearGrafoConAsignaciones, crearFSMConReglas, snapshotGrafo } from './helpers/helpers';

/**
 * Fase 1 — Constructiva (Greedy/RCL)
 *
 * Table-driven: cada regla FSM bloquea hard constraints.
 * Given-When-Then: RCL respeta límites α.
 */

describe('Fase 1 Constructiva — FSM Hard Constraints (Table-driven)', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    // ─── Table-driven: FSM rechaza correctamente ───

    const casosRechazo = [
        {
            nombre: 'INVARIANTE_COLISION — grupo ya asignado',
            setup: () => {
                const { profesores, grupos } = datasetA();
                const grafo = crearGrafoConAsignaciones(profesores, grupos, [{ numEco: 1, idGrupo: 100 }]);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 2, idGrupo: 100 }; // prof 2 intenta el grupo 100 que ya tiene prof 1
            },
            reglaEsperada: 'INVARIANTE_COLISION',
        },
        {
            nombre: 'REGLA_AREA — área del profesor no coincide con área del grupo',
            setup: () => {
                const prof = crearProfesor({ numeroEconomico: 5, idArea: 99 }); // área 99
                const grupo = crearGrupo({ idUeaGrupo: 500, idArea: 10, horarios: [franja(1, 8, 10)] }); // área 10
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupo);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 5, idGrupo: 500 };
            },
            reglaEsperada: 'REGLA_AREA',
        },
        {
            nombre: 'REGLA_HORARIOS_COMPATIBLES — horario fuera de contratación (traslape)',
            setup: () => {
                const prof = crearProfesor({
                    numeroEconomico: 6, idArea: 10,
                    horariosContratacion: [horarioDB('L-V', '08:00:00', '12:00:00')],
                });
                // Grupo con franja 14-16, fuera del horario 8-12
                const grupo = crearGrupo({ idUeaGrupo: 501, idArea: 10, horarios: [franja(1, 14, 16)] });
                const grafo = new GrafoBipartito();
                grafo.registrarProfesor(prof);
                grafo.registrarGrupo(grupo);
                const fsm = crearFSMConReglas(grafo);
                return { fsm, numEco: 6, idGrupo: 501 };
            },
            reglaEsperada: 'REGLA_HORARIOS_COMPATIBLES',
        },
        {
            nombre: 'REGLA_MAXIMO_N_HORAS_LABORALES — supera límite semanal',
            setup: () => {
                const prof = crearProfesor({ numeroEconomico: 7, idArea: 10 });
                // Grupo que requiere 5h × 5 días = 25h (supera el límite de 24)
                const grupoGrande = crearGrupo({
                    idUeaGrupo: 502, idArea: 10,
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
        // El grafo NO cambia cuando FSM rechaza
        expect(snapshotGrafo(fsm.grafoActual)).toBe(hashAntes);
    });

    // ─── FSM acepta asignación válida ───

    it('FSM acepta asignación que cumple todas las reglas', () => {
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

describe('Fase 1 Constructiva — EstrategiaRCL', () => {
    it('α=0 (greedy puro): solo el mejor candidato en la RCL', () => {
        const rcl = new EstrategiaRCL(0);
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
            crearProfesor({ numeroEconomico: 3, idArea: 10 }),
        ];

        // Con modelo uniforme (w=1 para todos), α=0 → RCL incluye solo los de w=wMax
        // Como todos tienen w=1, todos son "mejores" → RCL completa
        const ordenados = rcl.ordenarProfesores(profesores);
        expect(ordenados.length).toBe(profesores.length);
    });

    it('α=1 (totalmente aleatorio): todos los candidatos en la RCL', () => {
        const rcl = new EstrategiaRCL(1);
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10 }),
            crearProfesor({ numeroEconomico: 2, idArea: 10 }),
        ];

        const ordenados = rcl.ordenarProfesores(profesores);
        expect(ordenados.length).toBe(profesores.length);
    });

    it('ordenarAreas: áreas con menos grupos van primero (MCV)', () => {
        const areas = new Map<number, any[]>();
        areas.set(1, [crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 }), crearGrupo({ idArea: 1 })]);
        areas.set(2, [crearGrupo({ idArea: 2 })]);

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarAreas(areas);

        // Área 2 (1 grupo) antes de área 1 (3 grupos)
        expect(resultado[0][0]).toBe(2);
        expect(resultado[1][0]).toBe(1);
    });

    it('ordenarGrupos: más franjas (más restrictivo) va primero', () => {
        const g1 = crearGrupo({ idUeaGrupo: 1, idArea: 10, horarios: [franja(1, 8, 10)] });
        const g2 = crearGrupo({ idUeaGrupo: 2, idArea: 10, horarios: [franja(1, 8, 10), franja(2, 8, 10), franja(3, 8, 10)] });

        const rcl = new EstrategiaRCL(0.5);
        const resultado = rcl.ordenarGrupos([g1, g2]);

        expect(resultado[0].idUeaGrupo).toBe(2); // g2 tiene 3 franjas → primero
    });

    it('la selección de profesores siempre retorna todos los elementos', () => {
        const rcl = new EstrategiaRCL(0.5);
        const profesores = Array.from({ length: 10 }, (_, i) =>
            crearProfesor({ numeroEconomico: i + 1, idArea: 10 })
        );

        const resultado = rcl.ordenarProfesores(profesores);
        expect(resultado.length).toBe(profesores.length);

        // Verifica que todos están presentes (sin pérdida)
        const idsResultado = new Set(resultado.map(p => p.numeroEconomico));
        for (const p of profesores) {
            expect(idsResultado.has(p.numeroEconomico)).toBe(true);
        }
    });
});
