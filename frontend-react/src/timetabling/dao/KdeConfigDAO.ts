import { getState, putState } from './SqliteClient';
import type { KdeWorkerConfig } from '../engine/kde/graspKdeTypes';

const CLAVE = 'kde_config';

/**
 * DAO de la configuracion del panel "CONFIGURACION GRASP + KDE" (seed/k/alpha + KDE options).
 * Vive en `estado_configuraciones` bajo la clave 'kde_config'.
 *
 * Nota: la configuracion tambien se serializa dentro de `estado_solucion.config_grasp`
 * cuando hay un snapshot de solucion activo. Este DAO la persiste de forma INDEPENDIENTE
 * para que los cambios hechos por el usuario antes de correr el primer pase (o en cualquier
 * momento) sobrevivan a refrescos de navegador.
 *
 * Prioridad al hidratar (ver KdeMode.tsx): si hay `estado_solucion` se usa el config que
 * vive ahi (es el que produjo la solucion); si NO hay solucion, se usa este `kde_config`.
 */
export const KdeConfigDAO = {
    async load(): Promise<KdeWorkerConfig | null> {
        return getState<KdeWorkerConfig>(CLAVE);
    },

    async save(config: KdeWorkerConfig): Promise<void> {
        await putState(CLAVE, config);
    },
};
