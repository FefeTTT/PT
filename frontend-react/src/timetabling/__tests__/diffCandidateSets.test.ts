import { describe, it, expect } from 'vitest';
import { diffCandidateSets } from '../utils/diffCandidateSets';
import type { CandidateRow } from '../engine/kde/candidateRow';

const row = (eco: number, idUeaGrupo: number, overrides: Partial<CandidateRow> = {}): CandidateRow => ({
    numeroEconomico: eco,
    idUeaGrupo,
    uea: 1112005,
    claveGrupo: `G${idUeaGrupo}`,
    horarioStringRaw: 'L:07:00-08:30|Mi:07:00-08:30|V:07:00-08:30',
    turno: 'manana',
    locked: false,
    passIndex: 0,
    ...overrides,
});

describe('diffCandidateSets', () => {
    it('marks identical when prev === curr', () => {
        const prev = [row(1, 1), row(2, 2)];
        const curr = [row(1, 1), row(2, 2)];
        const diff = diffCandidateSets(prev, curr);
        expect(diff.identical).toBe(true);
        expect(diff.added).toHaveLength(0);
        expect(diff.removed).toHaveLength(0);
        expect(diff.reassigned).toHaveLength(0);
    });

    it('detects added rows', () => {
        const prev = [row(1, 1)];
        const curr = [row(1, 1), row(2, 2)];
        const diff = diffCandidateSets(prev, curr);
        expect(diff.added).toHaveLength(1);
        expect(diff.added[0].numeroEconomico).toBe(2);
        expect(diff.identical).toBe(false);
    });

    it('detects removed rows', () => {
        const prev = [row(1, 1), row(2, 2)];
        const curr = [row(1, 1)];
        const diff = diffCandidateSets(prev, curr);
        expect(diff.removed).toHaveLength(1);
        expect(diff.removed[0].idUeaGrupo).toBe(2);
        expect(diff.identical).toBe(false);
    });

    it('detects reassigned (same group, different eco)', () => {
        const prev = [row(1, 7)];
        const curr = [row(2, 7)];
        const diff = diffCandidateSets(prev, curr);
        expect(diff.reassigned).toEqual([{ idUeaGrupo: 7, prevEco: 1, currEco: 2 }]);
    });
});
