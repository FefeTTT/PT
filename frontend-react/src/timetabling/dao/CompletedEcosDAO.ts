import { getState, putState } from './SqliteClient';

const CLAVE = 'completed_ecos';

/**
 * DAO del conjunto de ECOs marcados como "carga terminada" (ConjuntoCompletado).
 * Vive en `estado_configuraciones` bajo la clave 'completed_ecos' como un `number[]`.
 *
 * Un ECO completado conserva su carga ya bloqueada (sembrada en el grafoInicial del GRASP)
 * y se sigue puntuando con KDE, pero queda excluido de la GENERACION de candidatos del worker,
 * de modo que no recibe nuevas reasignaciones en los pases siguientes.
 */
export const CompletedEcosDAO = {
    async load(): Promise<number[] | null> {
        return getState<number[]>(CLAVE);
    },

    async save(ecos: number[]): Promise<void> {
        await putState(CLAVE, ecos);
    },
};
