import { getState, putState } from './SqliteClient';
import type { BackendConfigDTO } from '../dtos';

const CLAVE = 'backend_config';

/**
 * DAO de la config de backend (host/port Python+Redis, modo de conexion). Reemplaza el
 * almacenamiento previo en localStorage; vive en `estado_configuraciones` bajo la clave
 * 'backend_config'.
 */
export const BackendConfigDAO = {
    async load(): Promise<BackendConfigDTO | null> {
        return getState<BackendConfigDTO>(CLAVE);
    },

    async save(config: BackendConfigDTO): Promise<void> {
        await putState(CLAVE, config);
    },
};
