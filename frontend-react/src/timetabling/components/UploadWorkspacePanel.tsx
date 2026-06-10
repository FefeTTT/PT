import { useRef } from 'react';
import type { RequiredTimetablingFileKey } from '../dtos';
import styles from '../TimetablingApp.module.css';

export type UploadedFileStatus = 'missing' | 'loaded' | 'invalid';

export interface UploadedFileState {
    name?: string;
    status: UploadedFileStatus;
    issueCount: number;
}

interface UploadWorkspacePanelProps {
    files: Record<RequiredTimetablingFileKey, UploadedFileState>;
    onUnifiedFileSelected: (file: File) => void;
    onBuildWorkspace: () => void;
    onOpenValidationDetails: () => void;
    canBuild: boolean;
    validationIssueCount: number;
}

function UploadIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}

function ReloadIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function InfoIcon() {
    return (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}

export function UploadWorkspacePanel({
    files,
    onUnifiedFileSelected,
    onBuildWorkspace,
    onOpenValidationDetails,
    canBuild,
    validationIssueCount,
}: UploadWorkspacePanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    // El JSON unificado puede no contener todos los archivos opcionales (p.ej.
    // los exclusivos de KDE), por lo que "cargado" se determina por la
    // presencia de cualquier dato, no por tenerlos todos. Esto mantiene la UI
    // consistente con el boton "Validar workspace".
    const isLoaded = Object.values(files).some(f => f.status !== 'missing');
    const loadedName = Object.values(files).find(f => f.name)?.name;

    const triggerPicker = () => inputRef.current?.click();

    return (
        <section className={styles.band}>
            <div className={styles.bandHeader}>
                <h2>Carga de archivos requeridos</h2>
                <div className={styles.bandHeaderActions}>
                    <button
                        className={styles.button}
                        type="button"
                        onClick={onBuildWorkspace}
                        disabled={!canBuild}
                    >
                        Validar workspace
                    </button>
                    <button
                        className={styles.infoIconButton}
                        type="button"
                        onClick={onOpenValidationDetails}
                        aria-label="Ver validación e integridad"
                        title="Ver validación e integridad"
                    >
                        <InfoIcon />
                        {validationIssueCount > 0 && (
                            <span className={styles.infoIconBadge}>{validationIssueCount}</span>
                        )}
                    </button>
                </div>
            </div>
            <div className={styles.bandBody}>
                <div className={styles.fileGrid}>
                    <div className={styles.fileRow}>
                        <span className={styles.fileTopLine}>
                            <span>
                                <span className={styles.fileName}>archivos_requeridos.json</span>
                                <p className={styles.fileHelp}>Archivo unificado con todos los datos requeridos.</p>
                            </span>
                            <span className={isLoaded ? styles.statusOk : styles.statusIdle}>
                                {isLoaded ? 'Cargado' : 'Pendiente'}
                            </span>
                        </span>

                        <input
                            ref={inputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                if (file) {
                                    onUnifiedFileSelected(file);
                                }
                                // Permite volver a seleccionar el mismo archivo.
                                event.currentTarget.value = '';
                            }}
                        />

                        {isLoaded ? (
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: 12, padding: '10px 12px', borderRadius: 8,
                                    background: '#e8f3df', border: '2px solid #b7d4a6',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1f4d3a', minWidth: 0 }}>
                                    <span style={{ display: 'inline-flex', color: '#2f7d4f' }}><CheckIcon /></span>
                                    <span style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block' }}>Archivo cargado</strong>
                                        <span style={{
                                            display: 'block', fontSize: 13, color: '#3a5c47',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {loadedName ?? 'archivos_requeridos.json'}
                                        </span>
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className={styles.button}
                                    onClick={triggerPicker}
                                    title="Recargar archivo"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                                >
                                    <ReloadIcon />
                                    Recargar
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={triggerPicker}
                                title="Seleccionar archivo"
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                    width: '100%', padding: '22px 12px', cursor: 'pointer',
                                    borderRadius: 8, border: '2px dashed #9b927f',
                                    background: '#fffdf7', color: '#31444a', font: 'inherit',
                                }}
                            >
                                <span style={{ display: 'inline-flex', color: '#5b676b' }}><UploadIcon /></span>
                                <strong>Seleccionar archivo</strong>
                                <span style={{ fontSize: 13, color: '#5b676b' }}>
                                    Sube el JSON unificado para comenzar.
                                </span>
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </section>
    );
}
