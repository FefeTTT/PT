import type { CandidateRow } from '../engine/kde/candidateRow';

export interface CandidateSetDiff {
    added: CandidateRow[];
    removed: CandidateRow[];
    reassigned: Array<{ idUeaGrupo: number; prevEco: number; currEco: number }>;
    identical: boolean;
}

function keyOf(row: { numeroEconomico: number; idUeaGrupo: number }): string {
    return `${row.numeroEconomico}|${row.idUeaGrupo}`;
}

export function diffCandidateSets(prev: CandidateRow[], curr: CandidateRow[]): CandidateSetDiff {
    const prevKeys = new Map(prev.map(r => [keyOf(r), r]));
    const currKeys = new Map(curr.map(r => [keyOf(r), r]));

    const added = curr.filter(r => !prevKeys.has(keyOf(r)));
    const removed = prev.filter(r => !currKeys.has(keyOf(r)));

    const prevByGroup = new Map(prev.map(r => [r.idUeaGrupo, r.numeroEconomico]));
    const reassigned: Array<{ idUeaGrupo: number; prevEco: number; currEco: number }> = [];
    for (const r of curr) {
        const prevEco = prevByGroup.get(r.idUeaGrupo);
        if (prevEco !== undefined && prevEco !== r.numeroEconomico) {
            reassigned.push({ idUeaGrupo: r.idUeaGrupo, prevEco, currEco: r.numeroEconomico });
        }
    }

    return {
        added,
        removed,
        reassigned,
        identical: added.length === 0 && removed.length === 0 && reassigned.length === 0,
    };
}
