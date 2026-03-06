import { describe, it, expect } from 'vitest';
import { CriterioAceptacion, ClasificacionDelta } from '../objective/Tolerancia';

/**
 * Fase 3 — Optimización (Ejection Chain Soft vía Z)
 *
 * Table-driven: CriterioAceptacion.clasificarDelta() es una función pura
 * que clasifica un ΔZ en una categoría de telemetría.
 *
 * Cada clasificación es una salida legítima (no un "error"):
 *   - MEJORA_SIGNIFICATIVA  → la telemetría la cuenta como mejora aceptada
 *   - RUIDO_NUMERICO        → la telemetría la cuenta como ruido filtrado
 *   - RECHAZADA_POR_UMBRAL  → la telemetría la cuenta como insuficiente
 *   - SIN_MEJORA            → la telemetría la cuenta como empeoramiento
 */

describe('Fase 3 Optimización — CriterioAceptacion.clasificarDelta (Table-driven)', () => {

    // epsAbs=0.01, epsRel=0, alfa=0.1 → tol = 0.01, umbralMov = 0.1*numCambios
    const criterio = new CriterioAceptacion(0.01, 0, 0.1);

    const casosClasificacion = [
        {
            nombre: 'ΔZ > tol + α·n → clasifica como MEJORA_SIGNIFICATIVA',
            zActual: 10,
            zNuevo: 10.2,     // ΔZ = 0.2 > tol(0.01) + α·1(0.1) = 0.11
            numCambios: 1,
            esperado: ClasificacionDelta.MEJORA_SIGNIFICATIVA,
        },
        {
            nombre: '|ΔZ| ≤ tol → clasifica como RUIDO_NUMERICO',
            zActual: 10,
            zNuevo: 10.005,   // |ΔZ| = 0.005 ≤ tol(0.01)
            numCambios: 1,
            esperado: ClasificacionDelta.RUIDO_NUMERICO,
        },
        {
            nombre: 'tol < ΔZ ≤ tol + α·n → clasifica como RECHAZADA_POR_UMBRAL',
            zActual: 10,
            zNuevo: 10.05,    // ΔZ = 0.05, tol(0.01) < 0.05 ≤ 0.11
            numCambios: 1,
            esperado: ClasificacionDelta.RECHAZADA_POR_UMBRAL,
        },
        {
            nombre: 'ΔZ < −tol (negativo significativo) → clasifica como SIN_MEJORA',
            zActual: 10,
            zNuevo: 9.5,      // ΔZ = −0.5
            numCambios: 1,
            esperado: ClasificacionDelta.SIN_MEJORA,
        },
        {
            nombre: 'ΔZ = 0 exacto → clasifica como RUIDO_NUMERICO (|0| ≤ tol)',
            zActual: 10,
            zNuevo: 10,
            numCambios: 1,
            esperado: ClasificacionDelta.RUIDO_NUMERICO,
        },
        {
            nombre: 'ΔZ negativo pequeño (|ΔZ| > tol) → clasifica como SIN_MEJORA',
            zActual: 10,
            zNuevo: 9.98,     // ΔZ = −0.02, |−0.02| > tol(0.01)
            numCambios: 1,
            esperado: ClasificacionDelta.SIN_MEJORA,
        },
    ];

    it.each(casosClasificacion)('$nombre', ({ zActual, zNuevo, numCambios, esperado }) => {
        const clasificacion = criterio.clasificarDelta(zNuevo, zActual, numCambios);
        expect(clasificacion).toBe(esperado);
    });

    // ─── Casos borde IEEE-754 ───

    it('Borde: ΔZ exactamente = tol → RUIDO_NUMERICO (incluye frontera)', () => {
        const c = new CriterioAceptacion(0.01, 0, 0);
        expect(c.clasificarDelta(10.01, 10, 1)).toBe(ClasificacionDelta.RUIDO_NUMERICO);
    });

    it('Borde: ΔZ = tol + ε → RECHAZADA_POR_UMBRAL (apenas sobre tolerancia)', () => {
        const c = new CriterioAceptacion(0.01, 0, 0.1);
        expect(c.clasificarDelta(10.011, 10, 1)).toBe(ClasificacionDelta.RECHAZADA_POR_UMBRAL);
    });

    it('Borde: ΔZ = −tol → RUIDO_NUMERICO (frontera negativa)', () => {
        const c = new CriterioAceptacion(0.01, 0, 0);
        expect(c.clasificarDelta(9.99, 10, 1)).toBe(ClasificacionDelta.RUIDO_NUMERICO);
    });

    it('esMejoraSignificativa concuerda con clasificarDelta para MEJORA_SIGNIFICATIVA', () => {
        const c = new CriterioAceptacion(0.01, 0, 0.1);
        const zActual = 50;
        const zNuevo = 50.5;

        expect(c.esMejoraSignificativa(zNuevo, zActual, 1)).toBe(true);
        expect(c.clasificarDelta(zNuevo, zActual, 1)).toBe(ClasificacionDelta.MEJORA_SIGNIFICATIVA);
    });

    it('esMejoraSignificativa retorna false para todas las demás clasificaciones', () => {
        const c = new CriterioAceptacion(0.01, 0, 0.1);

        // RUIDO_NUMERICO
        expect(c.esMejoraSignificativa(10.005, 10, 1)).toBe(false);
        // RECHAZADA_POR_UMBRAL
        expect(c.esMejoraSignificativa(10.05, 10, 1)).toBe(false);
        // SIN_MEJORA
        expect(c.esMejoraSignificativa(9.5, 10, 1)).toBe(false);
    });

    it('numCambios > 1 escala el umbral proporcionalmente', () => {
        const c = new CriterioAceptacion(0.01, 0, 0.1);

        // 1 cambio: umbral = 0.1, threshold total = 0.11 → ΔZ=0.15 > 0.11 → MEJORA
        expect(c.clasificarDelta(10.15, 10, 1)).toBe(ClasificacionDelta.MEJORA_SIGNIFICATIVA);

        // 3 cambios: umbral = 0.3, threshold total = 0.31 → ΔZ=0.15 < 0.31 → RECHAZADA_POR_UMBRAL
        expect(c.clasificarDelta(10.15, 10, 3)).toBe(ClasificacionDelta.RECHAZADA_POR_UMBRAL);
    });
});

describe('Fase 3 Optimización — epsRel escala con magnitud de Z', () => {

    it('tol aumenta con |zActual| cuando epsRel > 0', () => {
        // epsAbs=0, epsRel=0.001 → tol = 0.001 × max(1, |zActual|)
        const c = new CriterioAceptacion(0, 0.001, 0);

        // zActual=100: tol = 0.1. ΔZ=0.05 → |0.05| ≤ 0.1 → RUIDO_NUMERICO
        expect(c.clasificarDelta(100.05, 100, 1)).toBe(ClasificacionDelta.RUIDO_NUMERICO);

        // zActual=1: tol = 0.001. ΔZ=0.05 → 0.05 > 0.001 → MEJORA_SIGNIFICATIVA
        expect(c.clasificarDelta(1.05, 1, 1)).toBe(ClasificacionDelta.MEJORA_SIGNIFICATIVA);
    });
});
