import { useEffect } from 'react';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import { JSONAssignmentAdapter } from '@solution/data/JSONAssignmentAdapter';
import type {
    KdeRawInputs,
    KdeWorkerConfig,
    KdeWorkerInbound,
} from '../engine/kde/graspKdeTypes';
import {
    mapLockedRowsToDTO,
    normalizarIdsLockedAlCatalogo,
    type IterativeRunState,
} from '../engine/kde/runKdeGraspIterative';
import { buildBlockedGroupKeys } from '../engine/kde/blockedGroups';

export const SET_ASSIGNATION_STORAGE_KEY = 'timetabling:kde:set-assignation';

type KdeRunPayload = Extract<KdeWorkerInbound, { type: 'run' }>;

export interface SetAssignationSnapshot extends KdeRunPayload {
    /** v2: `inputs` son los archivos_requeridos COMPLETOS (antes: programacion filtrada) y los
     *  grupos bloqueados viajan por contenido en `blockedKeys` (el worker los excluye post-parse,
     *  preservando los ids crudos del catálogo). */
    version: 2;
    savedAt: number;
    pase: number;
    paseSiguiente: number;
}

interface UseSetAssignationOptions {
    state: IterativeRunState | null;
    config: KdeWorkerConfig;
    rawInputs: KdeRawInputs;
    completedEcos: Set<number>;
    /** Catálogo CRUDO del workspace (ids estables, incluye SAI/CPRO). Respaldo para resolver
     *  los GrupoDTO de filas bloqueadas cuyo id ya no coincide en gruposValidos del pase. */
    gruposCatalogo?: GrupoDTO[];
}

export function buildSetAssignationSnapshot(
    state: IterativeRunState,
    config: KdeWorkerConfig,
    rawInputs: KdeRawInputs,
    completedEcos: Set<number>,
    gruposCatalogo?: GrupoDTO[],
): SetAssignationSnapshot {
    // Sin catálogo crudo la siembra de locks con ids legacy se OMITE (warn) y el payload
    // del runner subestimaría la carga W; si el caller no lo pasó, se deriva del workspace.
    const catalogoCrudo = gruposCatalogo
        ?? JSONAssignmentAdapter.parsearGruposDesdeObjeto(rawInputs.programacionVacia);
    // Mismo pipeline que el driver iterativo: filas bloqueadas normalizadas al espacio crudo
    // de ids, exclusión por contenido (blockedKeys) y archivos_requeridos COMPLETOS.
    const lockedRows = normalizarIdsLockedAlCatalogo(
        state.candidates.filter(row => row.locked),
        catalogoCrudo,
    );
    const lockedAssignments = mapLockedRowsToDTO(lockedRows, state.lastResult.gruposValidos, catalogoCrudo);
    const blockedKeys = buildBlockedGroupKeys(lockedRows);
    const paseSiguiente = state.pass + 1;

    return {
        version: 2,
        savedAt: Date.now(),
        pase: state.pass,
        paseSiguiente,
        type: 'run',
        inputs: rawInputs,
        config: {
            ...config,
            seed: config.seed + paseSiguiente,
        },
        lockedAssignments,
        blockedKeys,
        completedEcos: [...completedEcos],
    };
}

export function useSetAssignation({ state, config, rawInputs, completedEcos, gruposCatalogo }: UseSetAssignationOptions) {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!state) {
            window.localStorage.removeItem(SET_ASSIGNATION_STORAGE_KEY);
            return;
        }

        const timer = window.setTimeout(() => {
            try {
                const snapshot = buildSetAssignationSnapshot(state, config, rawInputs, completedEcos, gruposCatalogo);
                window.localStorage.setItem(SET_ASSIGNATION_STORAGE_KEY, JSON.stringify(snapshot));
            } catch (e) {
                console.warn('No se pudo guardar useSetAssignation en localStorage:', e);
            }
        }, 600);

        return () => window.clearTimeout(timer);
    }, [state, config, rawInputs, completedEcos, gruposCatalogo]);
}
