import { getJson, sendJson } from './SqliteClient';
import type { CatalogoGrupoDTO } from '../dtos/solutionGraph';

/**
 * DAO de la tabla intermedia `catalogo_grupo` (id_uea_grupo -> uea/grupo/horario canonico).
 * Estatica/solo-lectura durante las ejecuciones; se puebla al parsear el workspace.
 */
export const CatalogoGrupoDAO = {
    async getAll(): Promise<CatalogoGrupoDTO[]> {
        const rows = await getJson<CatalogoGrupoDTO[]>('/catalogo');
        return rows ?? [];
    },

    async upsertMany(catalogo: CatalogoGrupoDTO[]): Promise<void> {
        if (catalogo.length === 0) return;
        await sendJson('/catalogo', 'PUT', catalogo);
    },
};
