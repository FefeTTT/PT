import { useMemo } from 'react';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { candidateKey } from '../engine/kde/candidateRow';
import styles from './EcoUeasScheduleTable.module.css';

/** Day abbreviations used in horarioStringRaw (e.g. "L:07:00-08:30|Mi:07:00-08:30") */
const DAY_KEYS = ['L', 'Ma', 'Mi', 'J', 'V'] as const;
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;

interface DaySchedule {
    L: string;
    Ma: string;
    Mi: string;
    J: string;
    V: string;
}

/**
 * Parses a horarioStringRaw like "L:19:00-20:30|Mi:19:00-20:30|V:19:00-20:30"
 * into a per-day map: { L: "19:00-20:30", Ma: "", Mi: "19:00-20:30", J: "", V: "19:00-20:30" }
 */
function parseHorarioByDay(raw: string): DaySchedule {
    const schedule: DaySchedule = { L: '', Ma: '', Mi: '', J: '', V: '' };
    if (!raw) return schedule;

    const segments = raw.split('|');
    for (const seg of segments) {
        const trimmed = seg.trim();
        if (!trimmed) continue;
        // Match pattern like "L:07:00-08:30" or "Mi:19:00-20:30"
        const match = trimmed.match(/^(L|Ma|Mi|J|V):(.+)$/);
        if (match) {
            const day = match[1] as keyof DaySchedule;
            const timeRange = match[2];
            // If there's already a time for this day, append
            if (schedule[day]) {
                schedule[day] += `\n${timeRange}`;
            } else {
                schedule[day] = timeRange;
            }
        }
    }
    return schedule;
}

function formatTurno(turno: string): string {
    switch (turno) {
        case 'manana': return 'Mañana';
        case 'medioDia': return 'Mediodía';
        case 'tarde': return 'Tarde';
        default: return turno;
    }
}

function num(n: number | undefined, digits = 4): string {
    return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
}

export interface EcoUeasScheduleTableProps {
    ueas: CandidateRow[];
}

export function EcoUeasScheduleTable({ ueas }: EcoUeasScheduleTableProps) {
    const rows = useMemo(() =>
        ueas.map(c => ({
            candidate: c,
            days: parseHorarioByDay(c.horarioStringRaw),
        })),
        [ueas],
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h4 className={styles.title}>
                    <span className={styles.titleIcon}>📋</span>
                    UEAs Asignadas
                </h4>
                <span className={styles.badge}>{ueas.length}</span>
            </div>

            {ueas.length === 0 ? (
                <div className={styles.empty}>
                    No hay UEAs asignadas para este ECO.
                </div>
            ) : (
                <div className={styles.tableWrap}>
                    <table className={styles.scheduleTable}>
                        <thead>
                            <tr>
                                <th className={styles.thSticky}>UEA</th>
                                <th className={styles.thSticky}>Grupo</th>
                                {DAY_KEYS.map((key, i) => (
                                    <th key={key} className={`${styles.thSticky} ${styles.thDay}`}>
                                        <span className={styles.dayFull}>{DAY_LABELS[i]}</span>
                                        <span className={styles.dayShort}>{key}</span>
                                    </th>
                                ))}
                                <th className={styles.thSticky}>Turno</th>
                                <th className={`${styles.thSticky} ${styles.thNumeric}`}>Score</th>
                                <th className={`${styles.thSticky} ${styles.thNumeric}`}>Pase</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ candidate: c, days }) => (
                                <tr key={candidateKey(c)} className={styles.row}>
                                    <td className={styles.cellUea}>
                                        <span className={styles.ueaCode}>{c.uea}</span>
                                    </td>
                                    <td className={styles.cellGrupo}>{c.claveGrupo}</td>
                                    {DAY_KEYS.map(day => (
                                        <td
                                            key={day}
                                            className={`${styles.cellDay} ${days[day] ? styles.cellDayActive : styles.cellDayEmpty}`}
                                            title={days[day] || 'Sin clase'}
                                        >
                                            {days[day] ? (
                                                <span className={styles.timeChip}>{days[day]}</span>
                                            ) : (
                                                <span className={styles.noClass}>—</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className={styles.cellTurno}>
                                        <span className={`${styles.turnoBadge} ${styles[`turno_${c.turno}`]}`}>
                                            {formatTurno(c.turno)}
                                        </span>
                                    </td>
                                    <td className={styles.cellNumeric}>{num(c.score)}</td>
                                    <td className={styles.cellNumeric}>
                                        <span className={styles.paseBadge}>{c.passIndex}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
