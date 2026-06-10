import { describe, it, expect } from 'vitest';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { candidateKey } from '../engine/kde/candidateRow';
import {
    applyManualAssign,
    applyRemoveAssignment,
    applyReplaceAssignment,
    applyReplaceOccupiedAssignment,
    type SolutionState,
} from '../utils/solutionMutations';

/**
 * Fábrica mínima de CandidateRow (forma exacta de engine/kde/candidateRow.ts).
 * Los campos score/kde_* son opcionales y se omiten salvo override.
 */
const makeRow = (eco: number, idUeaGrupo: number, overrides: Partial<CandidateRow> = {}): CandidateRow => ({
    numeroEconomico: eco,
    idUeaGrupo,
    uea: 1112005,
    claveGrupo: `G${idUeaGrupo}`,
    horarioStringRaw: 'L:07:00-08:30|Mi:07:00-08:30|V:07:00-08:30',
    turno: 'manana',
    locked: true,
    passIndex: 0,
    ...overrides,
});

/** Conjunto de idUeaGrupo realmente asignados en el estado actual. */
const assignedGroupIds = (state: SolutionState): Set<number> =>
    new Set(state.candidates.map(c => c.idUeaGrupo));

/**
 * Invariantes globales que TODA operación debe preservar:
 *  (a) candidateKey único en candidates,
 *  (b) locks ⊆ keys(candidates) (sin locks colgando),
 *  (c) cada idUeaGrupo asignado a lo sumo a un ECO.
 */
function assertInvariants(state: SolutionState): void {
    const keys = state.candidates.map(candidateKey);

    // (a) candidateKey único.
    expect(new Set(keys).size).toBe(keys.length);

    // (b) locks ⊆ keys(candidates): no hay locks que no correspondan a una fila.
    const keySet = new Set(keys);
    for (const lock of state.locks) {
        expect(keySet.has(lock)).toBe(true);
    }

    // (c) cada idUeaGrupo a lo sumo en un ECO.
    const groupIds = state.candidates.map(c => c.idUeaGrupo);
    expect(new Set(groupIds).size).toBe(groupIds.length);
}

describe('solutionMutations — integridad de la lista de candidatos', () => {
    describe('applyManualAssign (assign)', () => {
        it('agrega una fila nueva una sola vez y bloquea su key', () => {
            const candidates = [makeRow(1, 10), makeRow(2, 20)];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(makeRow(2, 20))]);
            const nueva = makeRow(3, 30);

            const next = applyManualAssign(candidates, locks, [nueva]);

            expect(next.candidates).toHaveLength(3);
            expect(next.candidates.filter(c => candidateKey(c) === candidateKey(nueva))).toHaveLength(1);
            expect(next.locks.has(candidateKey(nueva))).toBe(true);
            assertInvariants(next);
        });

        it('es idempotente: asignar un (eco,idUeaGrupo) ya presente no lo duplica', () => {
            const existente = makeRow(1, 10);
            const candidates = [existente, makeRow(2, 20)];
            const locks = new Set([candidateKey(existente), candidateKey(makeRow(2, 20))]);

            const next = applyManualAssign(candidates, locks, [makeRow(1, 10)]);

            expect(next.candidates).toHaveLength(2);
            expect(next.candidates.filter(c => candidateKey(c) === candidateKey(existente))).toHaveLength(1);
            expect(next.locks.has(candidateKey(existente))).toBe(true);
            assertInvariants(next);
        });

        it('no duplica un idUeaGrupo ocupado por otro ECO', () => {
            const ocupada = makeRow(1, 10);
            const intento = makeRow(2, 10);
            const candidates = [ocupada, makeRow(3, 30)];
            const locks = new Set([candidateKey(ocupada), candidateKey(makeRow(3, 30))]);

            const next = applyManualAssign(candidates, locks, [intento]);

            expect(next.candidates).toHaveLength(2);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(ocupada))).toBe(true);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(intento))).toBe(false);
            expect(next.locks.has(candidateKey(intento))).toBe(false);
            assertInvariants(next);
        });

        it('limpia locks huérfanos al reconstruir el estado', () => {
            const existente = makeRow(1, 10);
            const locks = new Set([candidateKey(existente), candidateKey(makeRow(9, 99))]);

            const next = applyManualAssign([existente], locks, [makeRow(2, 20)]);

            expect(next.locks.has(candidateKey(makeRow(9, 99)))).toBe(false);
            assertInvariants(next);
        });

        it('no muta los inputs (arrays/sets originales intactos)', () => {
            const candidates = [makeRow(1, 10)];
            const locks = new Set([candidateKey(makeRow(1, 10))]);
            const candidatesSnapshot = [...candidates];
            const locksSnapshot = new Set(locks);

            const next = applyManualAssign(candidates, locks, [makeRow(2, 20)]);

            expect(candidates).toEqual(candidatesSnapshot);
            expect(candidates).toHaveLength(1);
            expect([...locks]).toEqual([...locksSnapshot]);
            expect(next.candidates).not.toBe(candidates);
            expect(next.locks).not.toBe(locks);
        });
    });

    describe('applyRemoveAssignment (desasignar)', () => {
        it('quita la fila de candidates y de locks; su idUeaGrupo vuelve al pool derivado', () => {
            const gruposValidos = new Set([10, 20, 30]); // pool universo
            const objetivo = makeRow(2, 20);
            const candidates = [makeRow(1, 10), objetivo];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(objetivo)]);

            const next = applyRemoveAssignment(candidates, locks, objetivo);

            // Fuera de candidates y de locks.
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(objetivo))).toBe(false);
            expect(next.locks.has(candidateKey(objetivo))).toBe(false);

            // El grupo 20 ya no está entre los asignados => de vuelta en el pool derivado.
            const asignados = assignedGroupIds(next);
            expect(asignados.has(20)).toBe(false);
            const poolDerivado = [...gruposValidos].filter(id => !asignados.has(id));
            expect(poolDerivado).toContain(20);

            assertInvariants(next);
        });

        it('no toca las demás filas', () => {
            const sobrevive = makeRow(1, 10);
            const candidates = [sobrevive, makeRow(2, 20)];
            const locks = new Set([candidateKey(sobrevive), candidateKey(makeRow(2, 20))]);

            const next = applyRemoveAssignment(candidates, locks, makeRow(2, 20));

            expect(next.candidates).toHaveLength(1);
            expect(next.candidates[0]).toEqual(sobrevive);
            expect(next.locks.has(candidateKey(sobrevive))).toBe(true);
            assertInvariants(next);
        });

        it('es un no-op idempotente si la fila no existe', () => {
            const candidates = [makeRow(1, 10), makeRow(2, 20)];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(makeRow(2, 20))]);

            const next = applyRemoveAssignment(candidates, locks, makeRow(9, 99));

            expect(next.candidates).toHaveLength(2);
            expect([...next.locks].sort()).toEqual([...locks].sort());
            assertInvariants(next);
        });

        it('no muta los inputs (arrays/sets originales intactos)', () => {
            const objetivo = makeRow(2, 20);
            const candidates = [makeRow(1, 10), objetivo];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(objetivo)]);
            const candidatesSnapshot = [...candidates];
            const locksSnapshot = new Set(locks);

            const next = applyRemoveAssignment(candidates, locks, objetivo);

            expect(candidates).toEqual(candidatesSnapshot);
            expect(candidates).toHaveLength(2);
            expect([...locks]).toEqual([...locksSnapshot]);
            expect(next.candidates).not.toBe(candidates);
            expect(next.locks).not.toBe(locks);
        });
    });

    describe('applyReplaceAssignment (swap 1↔1)', () => {
        it('quita oldRow (grupo de vuelta al pool) y deja newRow presente y bloqueada', () => {
            const gruposValidos = new Set([10, 20, 30, 40]);
            const oldRow = makeRow(2, 20);
            const newRow = makeRow(3, 40);
            const candidates = [makeRow(1, 10), oldRow];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(oldRow)]);

            const next = applyReplaceAssignment(candidates, locks, oldRow, [newRow]);

            // Conteo invariante en swap 1↔1.
            expect(next.candidates).toHaveLength(candidates.length);

            // Vieja fuera; nueva dentro.
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(oldRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(newRow))).toBe(true);

            // Locks: vieja key fuera, nueva key dentro.
            expect(next.locks.has(candidateKey(oldRow))).toBe(false);
            expect(next.locks.has(candidateKey(newRow))).toBe(true);

            // El grupo viejo (20) vuelve al pool derivado; el nuevo (40) queda asignado.
            const asignados = assignedGroupIds(next);
            expect(asignados.has(20)).toBe(false);
            expect(asignados.has(40)).toBe(true);
            const poolDerivado = [...gruposValidos].filter(id => !asignados.has(id));
            expect(poolDerivado).toContain(20);
            expect(poolDerivado).not.toContain(40);

            assertInvariants(next);
        });

        it('si el nuevo grupo está ocupado, elimina displacedRow', () => {
            const oldRow = makeRow(1, 10);
            const displacedRow = makeRow(2, 20);
            const newRow = makeRow(1, 20);
            const survivor = makeRow(3, 30);
            const candidates = [oldRow, displacedRow, survivor];
            const locks = new Set(candidates.map(candidateKey));

            const next = applyReplaceAssignment(candidates, locks, oldRow, [newRow]);

            expect(next.candidates).toHaveLength(2);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(oldRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(displacedRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(newRow))).toBe(true);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(survivor))).toBe(true);
            expect(next.locks.has(candidateKey(displacedRow))).toBe(false);
            expect(next.locks.has(candidateKey(newRow))).toBe(true);
            assertInvariants(next);
        });

        it('no muta los inputs (arrays/sets originales intactos)', () => {
            const oldRow = makeRow(2, 20);
            const candidates = [makeRow(1, 10), oldRow];
            const locks = new Set([candidateKey(makeRow(1, 10)), candidateKey(oldRow)]);
            const candidatesSnapshot = [...candidates];
            const locksSnapshot = new Set(locks);

            applyReplaceAssignment(candidates, locks, oldRow, [makeRow(3, 40)]);

            expect(candidates).toEqual(candidatesSnapshot);
            expect(candidates).toHaveLength(2);
            expect([...locks]).toEqual([...locksSnapshot]);
        });
    });

    describe('applyReplaceOccupiedAssignment (reemplazo ocupado / takeover / intercambio)', () => {
        it('takeover remueve oldRow y occupiedRow, y agrega la nueva fila', () => {
            const oldRow = makeRow(1, 10);
            const occupiedRow = makeRow(2, 20);
            const newRow = makeRow(1, 20);
            const survivor = makeRow(3, 30);
            const candidates = [oldRow, occupiedRow, survivor];
            const locks = new Set([...candidates.map(candidateKey), candidateKey(makeRow(9, 99))]);

            const next = applyReplaceOccupiedAssignment(candidates, locks, oldRow, occupiedRow, [newRow]);

            expect(next.candidates).toHaveLength(2);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(oldRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(occupiedRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(newRow))).toBe(true);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(survivor))).toBe(true);
            expect(next.locks.has(candidateKey(oldRow))).toBe(false);
            expect(next.locks.has(candidateKey(occupiedRow))).toBe(false);
            expect(next.locks.has(candidateKey(newRow))).toBe(true);
            expect(next.locks.has(candidateKey(makeRow(9, 99)))).toBe(false);
            assertInvariants(next);
        });

        it('swap remueve ambas filas viejas y agrega ambas filas nuevas', () => {
            const oldRow = makeRow(1, 10);
            const occupiedRow = makeRow(2, 20);
            const newOldRow = makeRow(1, 20);
            const newOccupiedRow = makeRow(2, 10);
            const survivor = makeRow(3, 30);
            const candidates = [oldRow, occupiedRow, survivor];
            const locks = new Set(candidates.map(candidateKey));

            const next = applyReplaceOccupiedAssignment(candidates, locks, oldRow, occupiedRow, [newOldRow, newOccupiedRow]);

            expect(next.candidates).toHaveLength(3);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(oldRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(occupiedRow))).toBe(false);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(newOldRow))).toBe(true);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(newOccupiedRow))).toBe(true);
            expect(next.candidates.some(c => candidateKey(c) === candidateKey(survivor))).toBe(true);
            expect(next.locks.has(candidateKey(newOldRow))).toBe(true);
            expect(next.locks.has(candidateKey(newOccupiedRow))).toBe(true);
            assertInvariants(next);
        });

        it('no muta los inputs (arrays/sets originales intactos)', () => {
            const oldRow = makeRow(1, 10);
            const occupiedRow = makeRow(2, 20);
            const candidates = [oldRow, occupiedRow, makeRow(3, 30)];
            const locks = new Set(candidates.map(candidateKey));
            const candidatesSnapshot = [...candidates];
            const locksSnapshot = new Set(locks);

            applyReplaceOccupiedAssignment(candidates, locks, oldRow, occupiedRow, [makeRow(1, 20)]);

            expect(candidates).toEqual(candidatesSnapshot);
            expect(candidates).toHaveLength(3);
            expect([...locks]).toEqual([...locksSnapshot]);
        });
    });
});
