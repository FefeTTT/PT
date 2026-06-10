import { useCallback, useEffect } from 'react';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { AsignacionInput } from '@solution/greedy/GreedyTypes';
import type { KdeRawInputs, KdeWorkerConfig } from '../engine/kde/graspKdeTypes';
import type { IterativeRunState } from '../engine/kde/runKdeGraspIterative';
import { buildSetAssignationSnapshot, type SetAssignationSnapshot } from './useSetAssignation';
import { candidateRowToDTO, type CandidatoSolucionDTO } from '../dtos/solutionGraph';

export const SAVE_ASSIGNATION_SOLUTION_EVENT = 'timetabling:save-assignation-solution';

export interface SaveAssignationSolutionPayload {
    version: 1;
    savedAt: number;
    snapshot: SetAssignationSnapshot;
    candidatos: CandidatoSolucionDTO[];
    GRASPSolutionToXLS: {
        asignaciones: AsignacionInput[];
        grupos: GrupoDTO[];
        ecoNombre: Record<string, string>;
        claveUea?: Record<string, string>;
        programacionVacia?: KdeRawInputs['programacionVacia'];
    };
}

interface UseSaveAssignationSolutionOptions {
    state: IterativeRunState | null;
    config: KdeWorkerConfig;
    rawInputs: KdeRawInputs;
    completedEcos: Set<number>;
    /** Catálogo CRUDO del workspace (ids estables). Se propaga al snapshot del runner. */
    gruposCatalogo?: GrupoDTO[];
}

function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function requestSaveAssignationSolution() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(SAVE_ASSIGNATION_SOLUTION_EVENT));
}

export function buildSaveAssignationSolutionPayload(
    state: IterativeRunState,
    config: KdeWorkerConfig,
    rawInputs: KdeRawInputs,
    completedEcos: Set<number>,
    gruposCatalogo?: GrupoDTO[],
): SaveAssignationSolutionPayload {
    const snapshot = buildSetAssignationSnapshot(state, config, rawInputs, completedEcos, gruposCatalogo);
    const asignaciones: AsignacionInput[] = state.candidates.map(({ numeroEconomico, idUeaGrupo }) => ({
        numeroEconomico,
        idUeaGrupo,
    }));
    return {
        version: 1,
        savedAt: snapshot.savedAt,
        snapshot,
        candidatos: state.candidates.map(candidateRowToDTO),
        GRASPSolutionToXLS: {
            asignaciones,
            grupos: state.lastResult.gruposValidos,
            ecoNombre: rawInputs.ecoNombre,
            claveUea: rawInputs.claveUea,
            programacionVacia: rawInputs.programacionVacia,
        },
    };
}

export function useSaveAssignationSolution({ state, config, rawInputs, completedEcos, gruposCatalogo }: UseSaveAssignationSolutionOptions) {
    const save = useCallback(() => {
        if (!state) return;
        const payload = buildSaveAssignationSolutionPayload(state, config, rawInputs, completedEcos, gruposCatalogo);
        downloadJson(`assignation_solution_pase${state.pass}.json`, [payload]);
    }, [state, config, rawInputs, completedEcos, gruposCatalogo]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onRequest = () => save();
        window.addEventListener(SAVE_ASSIGNATION_SOLUTION_EVENT, onRequest);
        return () => window.removeEventListener(SAVE_ASSIGNATION_SOLUTION_EVENT, onRequest);
    }, [save]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                save();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [save]);

    return save;
}
