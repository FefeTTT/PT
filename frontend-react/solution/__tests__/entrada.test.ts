import { describe, it, expect, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { datasetA, crearProfesor, franja, horarioDB } from './helpers/fixtures';

/**
 * Fase Entrada — Four-Phase Tests
 *
 * Verifican la inicialización correcta de las estructuras base:
 * - SemanaLaboral (caché singleton)
 * - GrafoBipartito (nodos y aristas)
 */

describe('Fase Entrada — SemanaLaboral Caché', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    it('invalidarCache() limpia instancias previamente almacenadas', () => {
        const datos = [horarioDB('L-V', '08:00:00', '18:00:00')];

        // Crear y cachear
        const primera = SemanaLaboral.obtenerOCrear(1, datos);
        const segunda = SemanaLaboral.obtenerOCrear(1, datos);
        expect(primera).toBe(segunda); // misma referencia

        // Invalidar
        SemanaLaboral.invalidarCache();

        // Recrear
        const tercera = SemanaLaboral.obtenerOCrear(1, datos);
        expect(tercera).not.toBe(primera); // nueva instancia
    });

    it('invalidarProfesor() solo invalida la entrada específica', () => {
        const datos = [horarioDB('L-V', '08:00:00', '14:00:00')];

        const s1 = SemanaLaboral.obtenerOCrear(100, datos);
        const s2 = SemanaLaboral.obtenerOCrear(200, datos);

        SemanaLaboral.invalidarProfesor(100);

        const s1b = SemanaLaboral.obtenerOCrear(100, datos);
        const s2b = SemanaLaboral.obtenerOCrear(200, datos);

        expect(s1b).not.toBe(s1); // se recreó
        expect(s2b).toBe(s2);     // sigue cacheado
    });

    it('intentarAsignarFranja detecta disponibilidad correctamente', () => {
        SemanaLaboral.invalidarCache();
        const semana = new SemanaLaboral([horarioDB('L-V', '08:00:00', '14:00:00')]);

        // Dentro de rango
        expect(semana.intentarAsignarFranja(franja(1, 8, 10)).asignable).toBe(true);

        // Fuera de rango
        expect(semana.intentarAsignarFranja(franja(1, 14, 16)).asignable).toBe(false);
    });
});

describe('Fase Entrada — GrafoBipartito Creación', () => {
    it('grafo vacío tiene 0 profesores, 0 grupos, 0 aristas', () => {
        const grafo = new GrafoBipartito();

        expect(grafo.profesores.size).toBe(0);
        expect(grafo.grupos.size).toBe(0);
        expect(grafo.adyacencias.size).toBe(0);
        expect(grafo.asignacionesInversas.size).toBe(0);
    });

    it('registrar nodos crea exactamente |P|+|G| nodos esperados', () => {
        const { profesores, grupos } = datasetA();
        const grafo = new GrafoBipartito();

        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        expect(grafo.profesores.size).toBe(profesores.length);
        expect(grafo.grupos.size).toBe(grupos.length);
    });

    it('no existen aristas de asignación tras solo registrar nodos', () => {
        const { profesores, grupos } = datasetA();
        const grafo = new GrafoBipartito();

        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        expect(grafo.asignacionesInversas.size).toBe(0);

        // Adyacencias existen pero vacías
        for (const [, lista] of grafo.adyacencias) {
            expect(lista.length).toBe(0);
        }
    });

    it('registrarProfesor inicializa lista de adyacencia vacía', () => {
        const grafo = new GrafoBipartito();
        const prof = crearProfesor({ numeroEconomico: 999, idArea: 1 });

        grafo.registrarProfesor(prof);

        expect(grafo.adyacencias.has(999)).toBe(true);
        expect(grafo.adyacencias.get(999)!.length).toBe(0);
    });

    it('asignarMutable crea arista bidireccional correcta', () => {
        const { profesores, grupos } = datasetA();
        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        grafo.asignarMutable(1, 100);

        expect(grafo.adyacencias.get(1)).toContain(100);
        expect(grafo.asignacionesInversas.get(100)).toBe(1);
    });

    it('desasignarMutable revierte la asignación correctamente', () => {
        const { profesores, grupos } = datasetA();
        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        grafo.asignarMutable(1, 100);
        grafo.desasignarMutable(100);

        expect(grafo.adyacencias.get(1)).not.toContain(100);
        expect(grafo.asignacionesInversas.has(100)).toBe(false);
    });

    it('hashEstado es determinista para el mismo estado', () => {
        const { profesores, grupos } = datasetA();
        const g1 = new GrafoBipartito();
        const g2 = new GrafoBipartito();

        profesores.forEach(p => { g1.registrarProfesor(p); g2.registrarProfesor(p); });
        grupos.forEach(g => { g1.registrarGrupo(g); g2.registrarGrupo(g); });

        g1.asignarMutable(1, 100);
        g2.asignarMutable(1, 100);

        expect(g1.hashEstado()).toBe(g2.hashEstado());
    });
});
