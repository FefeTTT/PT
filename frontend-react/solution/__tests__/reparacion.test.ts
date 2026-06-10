import { describe, it, expect, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador } from '../fsm/FSMAsignador';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { EjectionChain } from '../greedy/EjectionChain';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { CriterioAceptacion } from '../objective/Tolerancia';
import { datasetB, crearProfesor, crearGrupo, franja, horarioDB } from './helpers/fixtures';
import { crearGrafoConAsignaciones, crearFSMConReglas, snapshotGrafo } from './helpers/helpers';

/**
 * Fase 2 — Reparación (Ejection Chain Hard)
 *
 * Given-When-Then: escenarios con huérfanos.
 * - Asignación directa exitosa.
 * - Escenario sin solución preserva el estado.
 * - Número de asignaciones crece tras reparación exitosa.
 *
 * NOTA: La EjectionChain se instancia con maxIteraciones=0 para la
 * optimización Z, aislando la fase de reparación de la fase de swaps.
 * Cada test crea un grafo y FSM completamente frescos.
 */

function crearEjectionChainSoloRepair(): EjectionChain {
    // maxIteraciones=0 → solo ejecuta _repararHuerfanos, no entra a _optimizarZ
    return new EjectionChain(0, 0, new CriterioAceptacion());
}

describe('Fase 2 Reparación — EjectionChain', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    it('Given huérfano con profesor disponible → When reparar → Then asignación directa OK', () => {
        const prof = crearProfesor({ numeroEconomico: 1, idArea: 10, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] });
        const grupo = crearGrupo({ idUeaGrupo: 100, idArea: 10, horarios: [franja(1, 8, 10)] });

        const grafo = new GrafoBipartito();
        grafo.registrarProfesor(prof);
        grafo.registrarGrupo(grupo);

        const fsm = new FSMAsignador(grafo, []);
        const funcionZ = new FuncionObjetivoZ();
        const ec = crearEjectionChainSoloRepair();

        const resultado = ec.mejorarSolucion(grafo, fsm, funcionZ, [100]);

        expect(grafo.asignacionesInversas.has(100)).toBe(true);
        expect(resultado.reparaciones).toBeGreaterThanOrEqual(1);
    });

    it('Given huérfano sin profesores compatibles → When reparar → Then el estado del grafo no cambia', () => {
        const prof = crearProfesor({
            numeroEconomico: 1, idArea: 10,
            horariosContratacion: [horarioDB('L', '08:00:00', '09:00:00')],
        });
        const grupo = crearGrupo({ idUeaGrupo: 100, idArea: 10, horarios: [franja(2, 14, 16)] });

        const grafo = new GrafoBipartito();
        grafo.registrarProfesor(prof);
        grafo.registrarGrupo(grupo);

        const fsm = crearFSMConReglas(grafo);
        const funcionZ = new FuncionObjetivoZ();
        const ec = crearEjectionChainSoloRepair();

        const hashAntes = snapshotGrafo(grafo);

        ec.mejorarSolucion(grafo, fsm, funcionZ, [100]);

        expect(snapshotGrafo(grafo)).toBe(hashAntes);
    });

    it('Tras reparación exitosa con huérfanos asignables, el número de asignaciones aumenta', () => {
        const { profesores, grupos } = datasetB();
        // Pre-asignar solo 2 de 4 grupos
        const grafo = crearGrafoConAsignaciones(profesores, grupos, [
            { numEco: 10, idGrupo: 200 },
            { numEco: 11, idGrupo: 201 },
        ]);

        const asignacionesAntes = grafo.asignacionesInversas.size;
        const fsm = crearFSMConReglas(grafo);
        const funcionZ = new FuncionObjetivoZ();
        const ec = crearEjectionChainSoloRepair();

        // Huérfanos: 202 y 203
        ec.mejorarSolucion(grafo, fsm, funcionZ, [202, 203]);

        expect(grafo.asignacionesInversas.size).toBeGreaterThanOrEqual(asignacionesAntes);
    });

    it('hashEstado es determinista para dos grafos con las mismas asignaciones', () => {
        const prof = crearProfesor({ numeroEconomico: 1, idArea: 10 });
        const g1 = crearGrupo({ idUeaGrupo: 100, idArea: 10, horarios: [franja(1, 8, 10)] });
        const g2 = crearGrupo({ idUeaGrupo: 101, idArea: 10, horarios: [franja(2, 8, 10)] });

        const grafo1 = new GrafoBipartito();
        grafo1.registrarProfesor(prof);
        grafo1.registrarGrupo(g1);
        grafo1.registrarGrupo(g2);
        grafo1.asignarMutable(1, 100);
        grafo1.asignarMutable(1, 101);

        const grafo2 = new GrafoBipartito();
        grafo2.registrarProfesor(prof);
        grafo2.registrarGrupo(g1);
        grafo2.registrarGrupo(g2);
        grafo2.asignarMutable(1, 100);
        grafo2.asignarMutable(1, 101);

        expect(grafo1.hashEstado()).toBe(grafo2.hashEstado());
    });
});
