import { getState, putState } from './SqliteClient';

const CLAVE = 'archivos_requeridos';

/**
 * DAO del JSON unificado `archivos_requeridos` (keyed por nombre de archivo). Reemplaza el
 * almacenamiento previo en IndexedDB; vive en `estado_configuraciones` bajo la clave
 * 'archivos_requeridos'.
 */
export const ArchivosRequeridosDAO = {
    async load(): Promise<Record<string, unknown> | null> {
        return getState<Record<string, unknown>>(CLAVE);
    },

    async save(data: Record<string, unknown>): Promise<void> {
        await putState(CLAVE, data);
    },
};
