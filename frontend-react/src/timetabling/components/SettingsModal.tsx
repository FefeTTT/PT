import type { BackendConfigDTO } from '../dtos';
import { BackendServicesSettings } from './BackendServicesSettings';
import styles from '../TimetablingApp.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    config: BackendConfigDTO;
    onSave: (config: BackendConfigDTO) => void;
    onClose: () => void;
}

/**
 * Modal de "Configuracion de servicios" (solo conexion/health/cache/docker). Se usa en modo
 * Legacy y como fallback en modo KDE cuando aun no hay archivos cargados (KdeMode no montado).
 * En modo KDE con datos, la configuracion vive en el modal unificado KdeConfigModal.
 */
export function SettingsModal({ isOpen, config, onSave, onClose }: SettingsModalProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.modalOverlay} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Configuracion de servicios">
                <div className={styles.modalHeader}>
                    <h2>Configuracion de servicios</h2>
                    <button className={styles.secondaryButton} type="button" onClick={onClose}>Cerrar</button>
                </div>
                <div className={styles.modalBody}>
                    <BackendServicesSettings config={config} onSave={onSave} />
                </div>
            </div>
        </div>
    );
}
