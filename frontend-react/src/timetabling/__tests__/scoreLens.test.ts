import { describe, it, expect } from 'vitest';
import {
    tierOf, tierColor, flatTier, lente, pct, DOMAIN_MIN,
    computeScoreStats, scoreBarFill,
} from '../utils/scoreLens';

describe('scoreLens.tierOf', () => {
    it('clasifica por umbrales 0.5 / 0.25', () => {
        expect(tierOf(0.7, 'ih')).toBe('good');
        expect(tierOf(0.5, 'ih')).toBe('good');
        expect(tierOf(0.3, 'ih')).toBe('warn');
        expect(tierOf(0.1, 'ih')).toBe('out');
    });

    it('marca fuera de dominio (dom) por debajo del umbral del kind', () => {
        expect(tierOf(0.01, 'ij')).toBe('dom'); // < 0.02
        expect(tierOf(0.03, 'ih')).toBe('dom'); // < 0.05
        expect(tierOf(0.04, 'plan')).toBe('dom'); // < 0.05
    });

    it('trata valores inválidos como out', () => {
        expect(tierOf(undefined, 'ih')).toBe('out');
        expect(tierOf(Number.NaN, 'ij')).toBe('out');
    });

    it('respeta umbrales override del config', () => {
        expect(tierOf(0.1, 'ij', { minKdeIj: 0.2 })).toBe('dom');
        expect(tierOf(0.3, 'ij', { minKdeIj: 0.2 })).toBe('warn');
    });
});

describe('scoreLens helpers', () => {
    it('tierColor mapea a variables CSS Taller', () => {
        expect(tierColor('good')).toContain('--tt-good');
        expect(tierColor('warn')).toContain('--tt-mid');
        expect(tierColor('out')).toContain('--tt-bad');
        expect(tierColor('dom')).toContain('--tt-bad');
    });

    it('flatTier colapsa dom → out', () => {
        expect(flatTier('dom')).toBe('out');
        expect(flatTier('good')).toBe('good');
        expect(flatTier('warn')).toBe('warn');
    });

    it('pct formatea porcentaje o em-dash', () => {
        expect(pct(0.68)).toBe('68%');
        expect(pct(undefined)).toBe('—');
    });

    it('lente devuelve frases interpretativas', () => {
        expect(lente('ih', 0.7)).toMatch(/horario/i);
        expect(lente('ij', 0.1)).toMatch(/atípico/i);
        expect(lente('plan', 0.6)).toMatch(/carga/i);
    });

    it('DOMAIN_MIN iguala los defaults de makeDefaultConfig', () => {
        expect(DOMAIN_MIN).toEqual({ ij: 0.02, ih: 0.05, plan: 0.05 });
    });
});

describe('scoreLens.computeScoreStats + scoreBarFill (barra robusta p5–p95)', () => {
    it('expone p5/p95 dentro de [min,max] y alrededor de la mediana', () => {
        const vals = Array.from({ length: 101 }, (_, i) => i / 100); // 0.00 .. 1.00
        const s = computeScoreStats(vals)!;
        expect(s.min).toBeCloseTo(0, 6);
        expect(s.max).toBeCloseTo(1, 6);
        expect(s.p5).toBeCloseTo(0.05, 6);
        expect(s.p95).toBeCloseTo(0.95, 6);
        expect(s.p5).toBeGreaterThan(s.min);
        expect(s.p95).toBeLessThan(s.max);
    });

    it('clampa colas: ≤p5 → 0, ≥p95 → 1, punto medio → ~0.5', () => {
        const vals = Array.from({ length: 101 }, (_, i) => i / 100);
        const s = computeScoreStats(vals)!;
        expect(scoreBarFill(s.p5, s)).toBeCloseTo(0, 6);
        expect(scoreBarFill(s.p95, s)).toBeCloseTo(1, 6);
        expect(scoreBarFill(0, s)).toBe(0);   // por debajo de p5 satura a 0
        expect(scoreBarFill(1, s)).toBe(1);   // por encima de p95 satura a 1
        expect(scoreBarFill((s.p5 + s.p95) / 2, s)).toBeCloseTo(0.5, 6);
    });

    it('es robusta a outliers: dos extremos no aplastan la barra del grueso (vs min–max crudo)', () => {
        // Grueso en [0.10, 0.40] + dos outliers altos, como las distribuciones KDE sesgadas.
        const core = Array.from({ length: 50 }, (_, i) => 0.1 + (0.3 * i) / 49); // 0.10 .. 0.40
        const s = computeScoreStats([...core, 0.95, 1.0])!;
        const mid = 0.25;
        const robust = scoreBarFill(mid, s);
        const rawMinMax = (mid - s.min) / (s.max - s.min); // lo que daba el min–max absoluto previo
        expect(robust).toBeGreaterThan(rawMinMax + 0.2); // el grueso se reparte, no se aplasta
        expect(s.p95).toBeLessThanOrEqual(s.max);
    });

    it('población degenerada → barra llena; stats nulos/valor indefinido → 0', () => {
        const s = computeScoreStats([0.3, 0.3, 0.3])!;
        expect(scoreBarFill(0.3, s)).toBe(1); // p5 == p95 → span 0 → llena
        expect(scoreBarFill(0.5, null)).toBe(0);
        expect(scoreBarFill(undefined, s)).toBe(0);
        expect(computeScoreStats([])).toBeNull();
    });
});
