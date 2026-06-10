import { useEffect, useState, type CSSProperties } from 'react';
import type { BackendConfigDTO, WorkspaceDTO } from '../dtos';
import type { KdeWorkerConfig } from '../engine/kde/graspKdeTypes';
import type { KdeModelsConfig } from '../dtos/kdeModelsConfig';
import { BackendServicesSettings } from './BackendServicesSettings';
import { KdeConfigPanel } from './KdeConfigPanel';
import { KdeModelsConfigPanel } from './KdeModelsConfigPanel';
import { PenaltyBatchPanel } from './PenaltyBatchPanel';
import styles from '../TimetablingApp.module.css';

type TabKey = 'grasp' | 'modelos' | 'penalty' | 'servicios';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
    { key: 'grasp', label: 'GRASP + KDE' },
    { key: 'modelos', label: 'Modelos KDE' },
    { key: 'penalty', label: 'Penalty (batch)' },
    { key: 'servicios', label: 'Servicios' },
];

export interface KdeConfigModalProps {
    open: boolean;
    onClose: () => void;
    /** Servicios (conexion Python/Redis, health, cache, docker). */
    backendConfig: BackendConfigDTO;
    onSaveBackendConfig: (config: BackendConfigDTO) => void;
    /** Configuracion GRASP + KDE (seed/K/alpha, umbrales de dominio, flags). */
    kdeConfig: KdeWorkerConfig;
    onChangeKdeConfig: (config: KdeWorkerConfig) => void;
    /** Modelos KDE (params de entrenamiento de joblibs + reentrenamiento). */
    kdeModelsConfig: KdeModelsConfig;
    onChangeKdeModelsConfig: (config: KdeModelsConfig) => void;
    baseUrl: string;
    onModelsRetrained: () => void;
    /** Penalty backend (batch). */
    workspace?: WorkspaceDTO;
    ecoNombre: Record<string, string>;
    /** Bloquea la edicion mientras corre un pase. */
    busy?: boolean;
}

/**
 * Modal unificado "Configuracion" del modo KDE. Encapsula en pestañas las tres secciones que antes
 * vivian sueltas encima de la tabla (Penalty batch, Configuracion GRASP+KDE, Modelos KDE) mas la
 * configuracion de servicios, dejando el area principal solo con los botones de pase y la tabla de
 * candidatos.
 */
export function KdeConfigModal({
    open,
    onClose,
    backendConfig,
    onSaveBackendConfig,
    kdeConfig,
    onChangeKdeConfig,
    kdeModelsConfig,
    onChangeKdeModelsConfig,
    baseUrl,
    onModelsRetrained,
    workspace,
    ecoNombre,
    busy,
}: KdeConfigModalProps) {
    const [tab, setTab] = useState<TabKey>('grasp');

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return (
        <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label="Configuracion"
                style={{ width: 'min(1150px, calc(100vw - 28px))' }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={styles.modalHeader}>
                    <h2>Configuracion</h2>
                    <button className={styles.secondaryButton} type="button" onClick={onClose}>Cerrar</button>
                </div>

                <div role="tablist" aria-label="Secciones de configuracion" style={tabBarStyle}>
                    {TABS.map((t) => {
                        const active = t.key === tab;
                        return (
                            <button
                                key={t.key}
                                role="tab"
                                aria-selected={active}
                                type="button"
                                onClick={() => setTab(t.key)}
                                style={tabStyle(active)}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                <div className={styles.modalBody}>
                    {tab === 'grasp' && (
                        <KdeConfigPanel config={kdeConfig} onChange={onChangeKdeConfig} disabled={busy} />
                    )}
                    {tab === 'modelos' && (
                        <KdeModelsConfigPanel
                            config={kdeModelsConfig}
                            onChange={onChangeKdeModelsConfig}
                            baseUrl={baseUrl}
                            disabled={busy}
                            onRetrained={onModelsRetrained}
                        />
                    )}
                    {tab === 'penalty' && (
                        <PenaltyBatchPanel workspace={workspace} config={backendConfig} ecoNombre={ecoNombre} />
                    )}
                    {tab === 'servicios' && (
                        <BackendServicesSettings
                            config={backendConfig}
                            onSave={onSaveBackendConfig}
                            saveLabel="Guardar servicios"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

const tabBarStyle: CSSProperties = {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    padding: '10px 14px 0',
    background: 'var(--tt-panel2)',
};

function tabStyle(active: boolean): CSSProperties {
    return {
        border: '2px solid #182023',
        borderBottom: active ? '2px solid var(--tt-panel2)' : '2px solid #182023',
        background: active ? '#1f4d3a' : '#f8f4ea',
        color: active ? '#f8f4ea' : '#182023',
        padding: '7px 14px',
        fontWeight: 800,
        borderRadius: '6px 6px 0 0',
        cursor: 'pointer',
        marginBottom: -2,
    };
}
