import { describe, it, expect } from 'vitest';
import {
    tierOf,
    nivelHabitualPhrase,
    marginalPlusOne,
    marginalPhrase,
} from '../components/EcoPenaltyBadge';

describe('tierOf', () => {
    it('clasifica por penalización (más negativo = peor)', () => {
        expect(tierOf(0)).toBe('ok');
        expect(tierOf(-0.4)).toBe('ok');
        expect(tierOf(-0.6)).toBe('warn');
        expect(tierOf(-1.6)).toBe('bad');
    });
    it('una probabilidad muy baja fuerza sobrecarga', () => {
        expect(tierOf(0, 0.01)).toBe('bad');
    });
});

describe('nivelHabitualPhrase — no contradictoria', () => {
    it('nivel "Alta" + 100% habitual se enlaza con "aunque" (no contradictorio)', () => {
        // Reproduce el caso de la badge: penalización en banda de aviso pero carga 100% habitual.
        const phrase = nivelHabitualPhrase('warn', 1);
        expect(phrase).toBe('Alta, aunque 100% habitual');
        // No debe quedar la yuxtaposición seca "Alta · 100% habitual".
        expect(phrase).not.toBe('Alta · 100% habitual');
    });

    it('nivel "Sobrecarga" + carga inusual se enlaza con "y" (refuerza)', () => {
        expect(nivelHabitualPhrase('bad', 0.03)).toBe('Sobrecarga y inusual (3%)');
    });

    it('nivel "Alta" + carga poco habitual se enlaza con "y"', () => {
        expect(nivelHabitualPhrase('warn', 0.2)).toBe('Alta y poco habitual (20%)');
    });

    it('nivel "Normal" usa separador neutro', () => {
        expect(nivelHabitualPhrase('ok', 0.9)).toBe('Normal · 90% habitual');
    });

    it('sin probabilidad muestra solo el nivel', () => {
        expect(nivelHabitualPhrase('warn', undefined)).toBe('Alta');
        expect(nivelHabitualPhrase('warn', NaN)).toBe('Alta');
    });
});

describe('marginalPlusOne — selección pura del "+1"', () => {
    // Curva indexada por w=2..max_w; índice 0 = 2 asignaciones, índice i = (i+2) asignaciones.
    it('K=2 con curva de 4 elementos toma el índice 1 (carga 3)', () => {
        const loads = [-0.1, -0.5, -1.2, -2.0];
        const probs = [0.9, 0.4, 0.1, 0.02];
        expect(marginalPlusOne(loads, probs, 2)).toEqual({
            penalty: -0.5,
            prob: 0.4,
            count: 3,
        });
    });

    it('K=5 con curva de 4 elementos cae fuera de rango → null', () => {
        const loads = [-0.1, -0.5, -1.2, -2.0];
        const probs = [0.9, 0.4, 0.1, 0.02];
        expect(marginalPlusOne(loads, probs, 5)).toBeNull();
    });

    it('sin curva o count < 2 → null', () => {
        expect(marginalPlusOne(undefined, undefined, 3)).toBeNull();
        expect(marginalPlusOne([-0.1, -0.5], [0.9, 0.4], 1)).toBeNull();
    });

    it('prob ausente/malformada se degrada a undefined sin romper', () => {
        const loads = [-0.1, -0.5, -1.2];
        expect(marginalPlusOne(loads, undefined, 2)).toEqual({
            penalty: -0.5,
            prob: undefined,
            count: 3,
        });
    });
});

describe('marginalPhrase — predicción "+1"', () => {
    it('prob del "+1" < 0.05 y carga actual habitual → "carga más alta que suele llevar"', () => {
        const marg = { penalty: -2.0, prob: 0.02, count: 4 };
        const phrase = marginalPhrase(marg, 0.8);
        expect(phrase).toContain('Si asignas 1 grupo más (→ 4 grupos):');
        expect(phrase).toContain('Es la carga más alta que suele llevar; un grupo más sería inusual.');
    });

    it('prob del "+1" < 0.05 y carga actual poco habitual → variante "carga alta"', () => {
        const marg = { penalty: -2.0, prob: 0.02, count: 4 };
        const phrase = marginalPhrase(marg, 0.2);
        expect(phrase).toContain('Ya es una carga alta para este profesor; un grupo más sería inusual.');
    });

    it('prob del "+1" habitual no añade la nota de techo', () => {
        const marg = { penalty: -0.6, prob: 0.6, count: 4 };
        const phrase = marginalPhrase(marg, 0.9);
        expect(phrase).not.toContain('inusual');
        expect(phrase).toBe('Si asignas 1 grupo más (→ 4 grupos): ● Alta, aunque 60% habitual.');
    });
});
