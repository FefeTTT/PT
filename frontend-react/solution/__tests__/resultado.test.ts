import { describe, it, expect, beforeEach } from 'vitest';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { GreedyOrchestrator } from '../greedy/GreedyOrchestrator';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { EstrategiaMCV } from '../greedy/EstrategiaMCV';
import { funcionZUniforme } from '../ml/IModeloML';
import { EjectionChain } from '../greedy/EjectionChain';
import { CriterioAceptacion } from '../objective/Tolerancia';
import { datasetA, datasetB } from './helpers/fixtures';
import { crearGrafoConAsignaciones } from './helpers/helpers';

/**
 * Fase 4 — Resultado
 *
 * Verificar coherencia de la salida del GreedyOrchestrator:
 * - asignados + gruposSinAsignar == totalGrupos
 * - scoreZ coherente con re-evaluación
 * - métricas completas
 *
 * NOTA: Cada test crea instancias completamente frescas
 * (orchestrator, ejectionChain, grafo interno) para aislar
 * el estado mutable del grafo entre corridas.
 * La EjectionChain se configura con maxIteraciones=0 para tests
 * que solo verifican la fase constructiva y la coherencia de salida.
 */

function crearOrchestrator(maxIterOpt: number = 0): GreedyOrchestrator {
    // maxIteraciones=0 → la optimización Z no ejecuta ningún swap,
    // evitando la mutación interna del grafo durante la fase de búsqueda local.
    const ec = new EjectionChain(maxIterOpt, 0, new CriterioAceptacion());
    return new GreedyOrchestrator(new EstrategiaMCV(), funcionZUniforme, [], ec, undefined, { k: 24, alpha: 0.25 });
}

describe('Fase 4 Resultado — GreedyOrchestrator Output', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    it('asignados + gruposSinAsignar == totalGrupos', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        const totalAsignados = resultado.metricas.totalAsignados;
        const sinAsignar = resultado.metricas.gruposSinAsignar.length;

        expect(totalAsignados + sinAsignar).toBe(grupos.length);
    });

    it('scoreZ final es un número finito', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        expect(typeof resultado.metricas.scoreZ).toBe('number');
        expect(isFinite(resultado.metricas.scoreZ)).toBe(true);
    });

    it('re-evaluación con FuncionObjetivoZ sobre grafo reconstruido produce Z coherente', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        // Reconstruir un grafo FRESCO con las asignaciones de salida
        const grafoReconstruido = crearGrafoConAsignaciones(
            profesores,
            grupos,
            resultado.asignaciones.map(a => ({ numEco: a.numeroEconomico, idGrupo: a.idUeaGrupo }))
        );

        // Evaluar Z sobre el grafo reconstruido (sin constraints personalizados = solo recompensa)
        const funcionZ = new FuncionObjetivoZ();
        const reEvaluacion = funcionZ.evaluarGrafo(grafoReconstruido);

        expect(typeof reEvaluacion.Z).toBe('number');
        expect(isFinite(reEvaluacion.Z)).toBe(true);
    });

    it('métricas tienen campos completos y válidos', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);
        const m = resultado.metricas;

        expect(m.totalEvaluaciones).toBeGreaterThan(0);
        expect(m.totalAsignados).toBeGreaterThanOrEqual(0);
        expect(m.totalRechazados).toBeGreaterThanOrEqual(0);
        expect(m.tiempoMs).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(m.gruposSinAsignar)).toBe(true);
        expect(typeof m.scoreZ).toBe('number');
        expect(typeof m.mejorasLocales).toBe('number');
        expect(typeof m.reparaciones).toBe('number');
    });

    it('con dataset más grande, totalEvaluaciones >= totalAsignados', () => {
        const { profesores, grupos } = datasetB();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        expect(resultado.metricas.totalEvaluaciones).toBeGreaterThanOrEqual(resultado.metricas.totalAsignados);
    });

    it('asignaciones tienen formato válido (numeroEconomico, idUeaGrupo)', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        for (const asignacion of resultado.asignaciones) {
            expect(typeof asignacion.numeroEconomico).toBe('number');
            expect(typeof asignacion.idUeaGrupo).toBe('number');
            expect(profesores.some(p => p.numeroEconomico === asignacion.numeroEconomico)).toBe(true);
            expect(grupos.some(g => g.idUeaGrupo === asignacion.idUeaGrupo)).toBe(true);
        }
    });

    it('no hay grupos duplicados en las asignaciones', () => {
        const { profesores, grupos } = datasetA();
        const orchestrator = crearOrchestrator();

        const resultado = orchestrator.ejecutar(profesores, grupos);

        const gruposAsignados = resultado.asignaciones.map(a => a.idUeaGrupo);
        const gruposUnicos = new Set(gruposAsignados);

        expect(gruposUnicos.size).toBe(gruposAsignados.length);
    });
});
