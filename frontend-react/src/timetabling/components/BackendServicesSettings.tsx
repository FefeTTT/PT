import { useState } from 'react';
import type { BackendConfigDTO } from '../dtos';
import { useDockerOps } from '../hooks/useDockerOps';
import { useGraspCacheOps } from '../hooks/useGraspCacheOps';
import { usePythonBackendHealth, useRedisHealth } from '../hooks/useBackendHealth';
import styles from '../TimetablingApp.module.css';

export interface BackendServicesSettingsProps {
    config: BackendConfigDTO;
    /** Persiste la config de servicios. No cierra necesariamente el modal contenedor. */
    onSave: (config: BackendConfigDTO) => void;
    saveLabel?: string;
}

/**
 * Cuerpo reutilizable de "Configuracion de servicios" (conexion Python/Redis, pruebas de salud,
 * invalidacion de cache y ops Docker). Extraido de SettingsModal para poder embeberlo tambien en
 * el modal unificado de Configuracion del modo KDE (KdeConfigModal), sin duplicar la UI.
 */
export function BackendServicesSettings({ config, onSave, saveLabel = 'Guardar' }: BackendServicesSettingsProps) {
    const [draft, setDraft] = useState(config);
    const pythonHealth = usePythonBackendHealth(draft);
    const redisHealth = useRedisHealth(draft);
    const cacheOps = useGraspCacheOps(draft);
    const dockerOps = useDockerOps(draft);

    return (
        <>
            <div className={styles.formGrid}>
                <label>
                    Modo de conexion
                    <select
                        className={styles.select}
                        value={draft.connectionMode}
                        onChange={(event) => setDraft({
                            ...draft,
                            connectionMode: event.currentTarget.value as BackendConfigDTO['connectionMode'],
                        })}
                    >
                        <option value="viteProxy">Proxy Vite /py sin CORS</option>
                        <option value="direct">Directo http://IP:PUERTO</option>
                    </select>
                </label>
                <label>
                    Backend Python IP
                    <input
                        className={styles.input}
                        value={draft.pythonHost}
                        onChange={(event) => setDraft({ ...draft, pythonHost: event.currentTarget.value })}
                    />
                </label>
                <label>
                    Backend Python puerto
                    <input
                        className={styles.input}
                        value={draft.pythonPort}
                        onChange={(event) => setDraft({ ...draft, pythonPort: event.currentTarget.value })}
                    />
                </label>
                <label>
                    Redis host
                    <input
                        className={styles.input}
                        value={draft.redisHost}
                        onChange={(event) => setDraft({ ...draft, redisHost: event.currentTarget.value })}
                    />
                </label>
                <label>
                    Redis puerto
                    <input
                        className={styles.input}
                        value={draft.redisPort}
                        onChange={(event) => setDraft({ ...draft, redisPort: event.currentTarget.value })}
                    />
                </label>
            </div>

            <div className={styles.toolbar}>
                <button className={styles.button} type="button" onClick={() => onSave(draft)}>
                    {saveLabel}
                </button>
                <button className={styles.secondaryButton} type="button" onClick={pythonHealth.check}>
                    Probar Python
                </button>
                <button className={styles.secondaryButton} type="button" onClick={redisHealth.check}>
                    Probar Redis
                </button>
            </div>

            <div className={styles.notice}>
                {pythonHealth.health.message} | {redisHealth.health.message}
                <br />
                Las pruebas de salud sondean los <strong>mismos proxies same-origin que usa el GRASP</strong>
                (Python via <code>/py</code>, Redis via <code>/api/redis/mget</code>), por lo que reflejan lo que
                el motor realmente alcanza. El host/puerto de abajo solo afectan al modo directo de los servicios
                legacy (scores); no influyen en estas pruebas ni en el worker KDE.
            </div>

            <div className={styles.toolbar}>
                <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => cacheOps.invalidate('grasp')}
                    disabled={cacheOps.loading}
                >
                    Invalidar GRASP
                </button>
                <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => cacheOps.invalidate('r_hat')}
                    disabled={cacheOps.loading}
                >
                    Invalidar r_hat
                </button>
                <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => cacheOps.invalidate('kde')}
                    disabled={cacheOps.loading}
                >
                    Invalidar kde
                </button>
            </div>
            {cacheOps.message && <div className={styles.notice}>{cacheOps.message}</div>}

            <div className={styles.toolbar}>
                <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => dockerOps.requestDockerAction('build')}
                    disabled={dockerOps.loading}
                >
                    Construir Docker
                </button>
                <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => dockerOps.requestDockerAction('up')}
                    disabled={dockerOps.loading}
                >
                    Levantar Docker
                </button>
            </div>
            {dockerOps.message && <div className={styles.notice}>{dockerOps.message}</div>}
        </>
    );
}
