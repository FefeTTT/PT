/*
 * solutionMutations — transformaciones PURAS de la lista de candidatos (la "solución") y su
 * conjunto de locks. Se extraen de los handlers de KdeMode para poder reusarlas y, sobre todo,
 * testear la INTEGRIDAD de la lista tras asignar / reemplazar / desasignar de forma aislada.
 *
 * Invariantes que preservan:
 *  - `candidateKey` (= `${numeroEconomico}|${idUeaGrupo}`) único en `candidates`.
 *  - `locks ⊆ keys(candidates)` (no quedan locks colgando de filas inexistentes).
 *  - Un `idUeaGrupo` asignado a lo sumo a un ECO (no se duplica un grupo entre profesores).
 *
 * El "pool de candidatos a programar" es DERIVADO (`gruposValidos − {idUeaGrupo en candidates}`),
 * así que quitar una fila de `candidates` devuelve su grupo al pool automáticamente: aquí no hay
 * que tocar ningún pool explícito.
 */
import type { CandidateRow } from '../engine/kde/candidateRow';
import { candidateKey } from '../engine/kde/candidateRow';

export interface SolutionState {
    candidates: CandidateRow[];
    locks: Set<string>;
}

interface AtomicMutationOptions {
    removeRows?: CandidateRow[];
    addRows?: CandidateRow[];
    displaceOccupiedGroups?: boolean;
}

function applyAtomicMutation(
    candidates: CandidateRow[],
    locks: Set<string>,
    { removeRows = [], addRows = [], displaceOccupiedGroups = false }: AtomicMutationOptions,
): SolutionState {
    const removeKeys = new Set(removeRows.map(candidateKey));
    const addGroupIds = new Set(addRows.map(r => r.idUeaGrupo));
    const baseCandidates = candidates.filter(c => {
        if (removeKeys.has(candidateKey(c))) return false;
        return !(displaceOccupiedGroups && addGroupIds.has(c.idUeaGrupo));
    });

    const nextCandidates: CandidateRow[] = [];
    const seenKeys = new Set<string>();
    const seenGroupIds = new Set<number>();

    for (const row of baseCandidates) {
        const key = candidateKey(row);
        if (seenKeys.has(key) || seenGroupIds.has(row.idUeaGrupo)) continue;
        seenKeys.add(key);
        seenGroupIds.add(row.idUeaGrupo);
        nextCandidates.push(row);
    }

    for (const row of addRows) {
        const key = candidateKey(row);
        if (seenKeys.has(key) || seenGroupIds.has(row.idUeaGrupo)) continue;
        seenKeys.add(key);
        seenGroupIds.add(row.idUeaGrupo);
        nextCandidates.push(row);
    }

    const candidateKeys = new Set(nextCandidates.map(candidateKey));
    const nextLocks = new Set<string>();
    for (const lock of locks) {
        if (candidateKeys.has(lock)) nextLocks.add(lock);
    }
    for (const row of addRows) {
        const key = candidateKey(row);
        if (candidateKeys.has(key)) nextLocks.add(key);
    }

    return { candidates: nextCandidates, locks: nextLocks };
}

/**
 * Agrega filas asignadas a mano (dedupe por `candidateKey`). Las filas pasadas quedan bloqueadas
 * (su key entra al set de locks). No muta las entradas: devuelve nuevas referencias.
 */
export function applyManualAssign(
    candidates: CandidateRow[],
    locks: Set<string>,
    rows: CandidateRow[],
): SolutionState {
    return applyAtomicMutation(candidates, locks, { addRows: rows });
}

/**
 * Desasigna (libera) una fila: la quita de `candidates` y de `locks`. Su grupo vuelve al pool
 * derivado. Idempotente si la fila no existe.
 */
export function applyRemoveAssignment(
    candidates: CandidateRow[],
    locks: Set<string>,
    row: CandidateRow,
): SolutionState {
    return applyAtomicMutation(candidates, locks, { removeRows: [row] });
}

/**
 * Reemplaza (swap) una fila por otra(s): libera la vieja (vuelve al pool) y agrega las nuevas
 * (dedupe + bloqueadas), de forma atómica. Para el swap 1↔1 `newRows` tiene un solo elemento.
 */
export function applyReplaceAssignment(
    candidates: CandidateRow[],
    locks: Set<string>,
    oldRow: CandidateRow,
    newRows: CandidateRow[],
): SolutionState {
    return applyAtomicMutation(candidates, locks, {
        removeRows: [oldRow],
        addRows: newRows,
        displaceOccupiedGroups: true,
    });
}

/**
 * Reemplazo ocupado / takeover / intercambio entre profesores: libera la fila vieja y la fila
 * ocupante antes de agregar las nuevas filas bloqueadas, todo en una sola mutación.
 */
export function applyReplaceOccupiedAssignment(
    candidates: CandidateRow[],
    locks: Set<string>,
    oldRow: CandidateRow,
    occupiedRow: CandidateRow,
    newRows: CandidateRow[],
): SolutionState {
    return applyAtomicMutation(candidates, locks, {
        removeRows: [oldRow, occupiedRow],
        addRows: newRows,
        displaceOccupiedGroups: true,
    });
}
