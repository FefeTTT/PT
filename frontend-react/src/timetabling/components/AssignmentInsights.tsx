import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { AssignmentDTO, EcoProfileDTO, GroupProfileDTO, SolutionDTO } from '../dtos';
import { formatFranjas } from '../utils/schedule';
import styles from '../TimetablingApp.module.css';

interface AssignmentInsightsProps {
    solution?: SolutionDTO;
    assignments: AssignmentDTO[];
    grupos: GroupProfileDTO[];
    profesores: EcoProfileDTO[];
}

export function AssignmentInsights({
    solution,
    assignments,
    grupos,
    profesores,
}: AssignmentInsightsProps) {
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<'all' | 'huerfanos' | 'preasignadas'>('all');
    const professorNames = useMemo(
        () => new Map(profesores.map((profesor) => [profesor.numeroEconomico, profesor.nombre])),
        [profesores]
    );
    const orphanGroups = solution?.orphanGroups ?? grupos.filter((grupo) => !grupo.profesorAsignadoEco);

    const visibleAssignments = useMemo(() => {
        const base = mode === 'preasignadas'
            ? assignments.filter((assignment) => assignment.origen === 'preasignacion')
            : assignments;

        if (!query.trim()) {
            return base;
        }

        const fuse = new Fuse(base, {
            keys: ['numeroEconomico', 'claveGrupo', 'ueaClave', 'ueaNombre', 'origen'],
            threshold: 0.3,
            ignoreLocation: true,
        });

        return fuse.search(query).map((result) => result.item);
    }, [assignments, mode, query]);

    const visibleOrphans = useMemo(() => {
        if (mode !== 'huerfanos') {
            return [];
        }
        if (!query.trim()) {
            return orphanGroups;
        }
        const fuse = new Fuse(orphanGroups, {
            keys: ['claveGrupo', 'ueaClave', 'ueaNombre', 'idArea'],
            threshold: 0.3,
            ignoreLocation: true,
        });
        return fuse.search(query).map((result) => result.item);
    }, [mode, orphanGroups, query]);

    return (
        <section className={styles.band}>
            <div className={styles.bandHeader}>
                <h2>Insights de solucion</h2>
                <span className={styles.statusPill}>{solution?.nombre ?? 'Workspace actual'}</span>
            </div>
            <div className={styles.bandBody}>
                <div className={styles.searchRow}>
                    <input
                        className={styles.input}
                        value={query}
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Buscar eco, UEA, nombre, grupo o area"
                    />
                    <select
                        className={styles.select}
                        value={mode}
                        onChange={(event) => setMode(event.currentTarget.value as 'all' | 'huerfanos' | 'preasignadas')}
                    >
                        <option value="all">Asignaciones</option>
                        <option value="preasignadas">Preasignaciones</option>
                        <option value="huerfanos">Nodos huerfanos</option>
                    </select>
                </div>

                {mode === 'huerfanos' ? (
                    <div className={styles.scrollList}>
                        {visibleOrphans.map((group) => (
                            <div className={styles.rowCard} key={group.idUeaGrupo}>
                                <div className={styles.cardTitle}>
                                    <span>{group.claveGrupo}</span>
                                    <span>{group.ueaClave}</span>
                                </div>
                                <div className={styles.cardMeta}>
                                    <span className={styles.statusError}>huerfana</span>
                                    <span className={styles.tag}>Area {group.idArea}</span>
                                </div>
                                <div className={styles.detailPane}>
                                    <span>{formatFranjas(group.horarios)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.scrollList}>
                        {visibleAssignments.map((assignment) => (
                            <div className={styles.rowCard} key={assignment.id}>
                                <div className={styles.cardTitle}>
                                    <span>{assignment.claveGrupo} - {assignment.ueaClave}</span>
                                    <span>Eco {assignment.numeroEconomico}</span>
                                </div>
                                <div className={styles.cardMeta}>
                                    <span className={assignment.origen === 'preasignacion' ? styles.statusOk : styles.statusIdle}>
                                        {assignment.origen}
                                    </span>
                                    {typeof assignment.scoreFinal === 'number' && (
                                        <span className={styles.tag}>Z {assignment.scoreFinal.toFixed(3)}</span>
                                    )}
                                    {typeof assignment.rHat === 'number' && (
                                        <span className={styles.tag}>r_hat {assignment.rHat.toFixed(3)}</span>
                                    )}
                                    {typeof assignment.kde === 'number' && (
                                        <span className={styles.tag}>kde {assignment.kde.toFixed(3)}</span>
                                    )}
                                </div>
                                <div className={styles.detailPane}>
                                    <span>{professorNames.get(assignment.numeroEconomico) ?? 'Profesor sin nombre cargado'}</span>
                                    <span>{formatFranjas(assignment.horarios)}</span>
                                </div>
                            </div>
                        ))}
                        {visibleAssignments.length === 0 && (
                            <div className={styles.empty}>Sin asignaciones para el filtro actual.</div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
