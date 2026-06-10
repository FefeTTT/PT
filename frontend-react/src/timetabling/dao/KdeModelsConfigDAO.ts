import { getState, putState } from './SqliteClient';
import type { KdeModelsConfig } from '../dtos/kdeModelsConfig';

const CLAVE = 'kde_models_config';

/**
 * DAO de los parametros de entrenamiento de los modelos KDE de Python (joblibs
 * de las graficas). Vive en `estado_configuraciones` bajo 'kde_models_config'.
 *
 * Independiente de `kde_config` (scoring TS in-browser). La fuente de verdad de
 * con que params se entrenaron los joblibs vigentes es el backend
 * (GET /admin/kde/config); este DAO solo persiste las ediciones del usuario en la
 * UI para que sobrevivan refrescos.
 */
export const KdeModelsConfigDAO = {
    async load(): Promise<KdeModelsConfig | null> {
        return getState<KdeModelsConfig>(CLAVE);
    },

    async save(config: KdeModelsConfig): Promise<void> {
        await putState(CLAVE, config);
    },
};
