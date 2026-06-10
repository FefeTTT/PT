import { getJson, sendJson } from './SqliteClient';
import type { EstadoSolucionDTO, HistorialPaseDTO } from '../dtos/solutionGraph';

/**
 * DAO del snapshot 'current' del estado de la solucion (grafo bipartito + candidatos) y del
 * historial de pases. Persiste/rehidrata `EstadoSolucionDTO`.
 */
export const SolutionGraphDAO = {
    /** Carga el snapshot 'current'. Devuelve null si aun no existe. */
    async loadCurrent(): Promise<EstadoSolucionDTO | null> {
        const raw = await getJson<EstadoSolucionDTO & { actualizadoEn?: number }>(
            '/solution/current',
        );
        if (!raw) return null;
        return {
            pase: raw.pase,
            convergio: raw.convergio,
            configGrasp: raw.configGrasp,
            grafo: raw.grafo,
            candidatos: raw.candidatos ?? [],
            catalogo: raw.catalogo ?? [],
        };
    },

    /** Upsert del snapshot 'current'. */
    async saveCurrent(state: EstadoSolucionDTO): Promise<void> {
        await sendJson('/solution/current', 'PUT', state);
    },

    /** Borra el snapshot 'current' (candidatos + historial + cabecera). */
    async deleteCurrent(): Promise<void> {
        await sendJson('/solution/current', 'DELETE');
    },

    /** Inserta/reemplaza un registro de historial de pase. */
    async appendPass(pass: HistorialPaseDTO): Promise<void> {
        await sendJson('/solution/pass', 'POST', pass);
    },
};
