import { Fragment, useState } from 'react';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { EcoUeasScheduleTable } from './EcoUeasScheduleTable';
// Reutiliza el mismo CSS que la tarjeta "UEAs Asignadas" para un look consistente.
import styles from './EcoUeasScheduleTable.module.css';

export interface CompletedEcosPanelProps {
    /** ECOs marcados como "carga terminada" (no se reasignan en los pases). */
    completedEcos: Set<number>;
    /** Candidatos actuales; se filtran por ECO para el detalle (dropdown) de cada fila. */
    candidates: CandidateRow[];
    ecoNombre?: Record<string, string>;
    /** Devuelve un ECO al pool (se reasignara en el siguiente pase). */
    onReturn: (eco: number) => void;
    /** Devuelve todos los ECOs completados de una vez. */
    onReturnAll: () => void;
    disabled?: boolean;
}

/**
 * Panel de ECOs completados (tabla). Cada fila es un ECO con carga terminada;
 * al hacer click se expande un dropdown con la tarjeta "UEAs Asignadas" del ECO.
 *
 * Razon de ser: un ECO completado se filtra de la generacion de candidatos y
 * puede quedarse sin filas en la tabla principal; aqui siempre aparece para poder
 * devolverlo. "Reiniciar a pase 0" tambien los reestablece todos.
 */
export function CompletedEcosPanel({
    completedEcos,
    candidates,
    ecoNombre,
    onReturn,
    onReturnAll,
    disabled,
}: CompletedEcosPanelProps) {
    const [expanded, setExpanded] = useState<number | null>(null);

    // Derivado en render (sin efecto): ECOs ordenados + sus UEAs asignadas.
    const ecos = [...completedEcos].sort((a, b) => a - b).map(eco => ({
        eco,
        nombre: ecoNombre?.[String(eco)] ?? '',
        ueas: candidates.filter(c => c.numeroEconomico === eco),
    }));

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h4 className={styles.title}>
                    <span className={styles.titleIcon}>✅</span>
                    ECOs Completados
                </h4>
                <span className={styles.badge}>{ecos.length}</span>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.scheduleTable} style={{ minWidth: 520 }}>
                    <thead>
                        <tr>
                            <th className={styles.thSticky} style={{ width: 36 }} aria-label="Expandir" />
                            <th className={styles.thSticky}>ECO</th>
                            <th className={styles.thSticky} style={{ textAlign: 'left' }}>Nombre</th>
                            <th className={`${styles.thSticky} ${styles.thNumeric}`}>UEAs</th>
                            <th className={styles.thSticky}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ecos.map(({ eco, nombre, ueas }) => {
                            const isOpen = expanded === eco;
                            return (
                                <Fragment key={eco}>
                                    <tr
                                        className={styles.row}
                                        onClick={() => setExpanded(isOpen ? null : eco)}
                                        style={{ cursor: 'pointer' }}
                                        title={isOpen ? 'Ocultar UEAs' : 'Ver UEAs asignadas'}
                                    >
                                        <td className={styles.cellNumeric} style={{ width: 36 }}>
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    display: 'inline-block', fontWeight: 900,
                                                    transition: 'transform 0.15s ease',
                                                    transform: isOpen ? 'rotate(90deg)' : 'none',
                                                }}
                                            >
                                                ▸
                                            </span>
                                        </td>
                                        <td className={styles.cellUea}>
                                            <span className={styles.ueaCode}>{eco}</span>
                                        </td>
                                        <td className={styles.cellGrupo} style={{ textAlign: 'left' }}>
                                            {nombre || '—'}
                                        </td>
                                        <td className={styles.cellNumeric}>
                                            <span className={styles.paseBadge}>{ueas.length}</span>
                                        </td>
                                        <td className={styles.cellTurno}>
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); onReturn(eco); }}
                                                disabled={disabled}
                                                title="Devolver al pool (se reasignara en el siguiente pase)"
                                                style={{
                                                    background: '#1f4d3a', color: '#f8f4ea',
                                                    border: '2px solid #182023', borderRadius: 6,
                                                    padding: '4px 10px', fontWeight: 800, fontSize: 11,
                                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                ✕ Devolver
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '0 12px 12px', background: '#f2ede0', borderBottom: '1px solid #e0dcd0' }}>
                                                <EcoUeasScheduleTable ueas={ueas} />
                                            </td>
                                        </tr>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={onReturnAll}
                    disabled={disabled}
                    style={{
                        background: '#c77928', color: '#f8f4ea', border: '2px solid #182023',
                        borderRadius: 6, padding: '6px 12px', fontWeight: 800,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                >
                    Devolver todos
                </button>
                <span style={{ color: '#5b5347', fontSize: 12 }}>
                    Su carga asignada se conserva. Reiniciar a pase 0 también los reestablece.
                </span>
            </div>
        </div>
    );
}
