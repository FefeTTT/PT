import { getJson, sendJson } from './SqliteClient';
import {
    gruposToCatalogo,
    type CandidatoSolucionDTO,
    type EstadoSolucionDTO,
    type GrafoBipartitoDTO,
} from '../dtos/solutionGraph';
import type { KdeWorkerConfig } from '../engine/kde/graspKdeTypes';

/**
 * DAO del auto-guardado por snapshots (`historial_snapshots`). Cada snapshot es un estado
 * COMPLETO y autocontenido de la solución, navegable por estampa de tiempo. Reutiliza los
 * serializadores de `dtos/solutionGraph.ts`: un snapshot equivale a un `EstadoSolucionDTO`
 * (con los candidatos partidos en locked/unlocked) + los ECOs completados (`finishes`).
 */

/** Metadatos ligeros para el timeline del historial (sin grafo/candidatos pesados). */
export interface SnapshotMetaDTO {
    id: number;
    timestamp: number;
    pase: number;
    convergio: boolean;
    lockedCount: number;
    unlockedCount: number;
    finishesCount: number;
}

/** Snapshot completo tal como lo devuelve el middleware. */
export interface SnapshotDTO {
    id: number;
    timestamp: number;
    configs: KdeWorkerConfig;
    locked: CandidatoSolucionDTO[];
    unlocked: CandidatoSolucionDTO[];
    finishes: number[];
    pase: number;
    convergio: boolean;
    grafo: GrafoBipartitoDTO;
}

export const SnapshotDAO = {
    /** Auto-guarda un snapshot completo. Devuelve el id/timestamp asignados. */
    async save(dto: EstadoSolucionDTO, finishes: number[]): Promise<{ id: number; timestamp: number }> {
        const locked = dto.candidatos.filter((c) => c.bloqueado);
        const unlocked = dto.candidatos.filter((c) => !c.bloqueado);
        return sendJson('/solution/snapshot', 'POST', {
            configs: dto.configGrasp,
            locked,
            unlocked,
            finishes,
            pase: dto.pase,
            convergio: dto.convergio,
            grafo: dto.grafo,
        });
    },

    /** Lista los snapshots (metadatos) por timestamp, más reciente primero. */
    async list(limit = 50): Promise<SnapshotMetaDTO[]> {
        return (await getJson<SnapshotMetaDTO[]>(`/solution/snapshots?limit=${limit}`)) ?? [];
    },

    /** Carga un snapshot completo por id (para restaurar). */
    async load(id: number): Promise<SnapshotDTO | null> {
        return getJson<SnapshotDTO>(`/solution/snapshot/${id}`);
    },

    /**
     * Reensambla un `EstadoSolucionDTO` restaurable desde un snapshot. El catálogo se
     * reconstruye de `grafo.grupos` (cada GrupoDTO trae uea/clave/horario), de modo que el
     * snapshot es autosuficiente para `estadoSolucionToIterativeState`.
     */
    toEstadoSolucion(snap: SnapshotDTO): EstadoSolucionDTO {
        return {
            pase: snap.pase,
            convergio: snap.convergio,
            configGrasp: snap.configs,
            grafo: snap.grafo,
            candidatos: [...snap.locked, ...snap.unlocked],
            catalogo: gruposToCatalogo(snap.grafo.grupos),
        };
    },
};
