import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import type { AssignmentDTO, EcoProfileDTO } from '../dtos';
import { formatFranjas } from '../utils/schedule';
import styles from '../TimetablingApp.module.css';

interface SolutionComparatorProps {
    assignments: AssignmentDTO[];
    profesores: EcoProfileDTO[];
}

interface ViewportState {
    query: string;
    mode: 'eco' | 'uea' | 'grupo';
}

export function SolutionComparator({ assignments, profesores }: SolutionComparatorProps) {
    const [left, setLeft] = useState<ViewportState>({ query: '', mode: 'eco' });
    const [right, setRight] = useState<ViewportState>({ query: '', mode: 'eco' });
    const professorNames = useMemo(
        () => new Map(profesores.map((profesor) => [profesor.numeroEconomico, profesor.nombre])),
        [profesores]
    );

    return (
        <section className={styles.band}>
            <div className={styles.bandHeader}>
                <h2>Comparador de viewports</h2>
                <span className={styles.statusPill}>2 vistas</span>
            </div>
            <div className={styles.bandBody}>
                <div className={styles.splitViewport}>
                    <Viewport
                        label="Viewport A"
                        state={left}
                        assignments={assignments}
                        professorNames={professorNames}
                        onChange={setLeft}
                    />
                    <Viewport
                        label="Viewport B"
                        state={right}
                        assignments={assignments}
                        professorNames={professorNames}
                        onChange={setRight}
                    />
                </div>
            </div>
        </section>
    );
}

function Viewport({
    label,
    state,
    assignments,
    professorNames,
    onChange,
}: {
    label: string;
    state: ViewportState;
    assignments: AssignmentDTO[];
    professorNames: Map<number, string>;
    onChange: (next: ViewportState) => void;
}) {
    const filtered = useMemo(() => filterAssignments(assignments, state), [assignments, state]);

    return (
        <div>
            <div className={styles.searchRow}>
                <input
                    className={styles.input}
                    value={state.query}
                    onChange={(event) => onChange({ ...state, query: event.currentTarget.value })}
                    placeholder={`${label}: 28650, 4377, UEA o grupo`}
                />
                <select
                    className={styles.select}
                    value={state.mode}
                    onChange={(event) => onChange({ ...state, mode: event.currentTarget.value as ViewportState['mode'] })}
                >
                    <option value="eco">Eco</option>
                    <option value="uea">UEA</option>
                    <option value="grupo">Grupo</option>
                </select>
            </div>
            <div className={styles.scrollList}>
                {filtered.map((assignment) => (
                    <div className={styles.rowCard} key={`${label}-${assignment.id}`}>
                        <div className={styles.cardTitle}>
                            <span>{assignment.claveGrupo}</span>
                            <span>{assignment.ueaClave}</span>
                        </div>
                        <div className={styles.cardMeta}>
                            <span className={styles.tag}>Eco {assignment.numeroEconomico}</span>
                            <span className={styles.tag}>{assignment.origen}</span>
                        </div>
                        <div className={styles.detailPane}>
                            <span>{professorNames.get(assignment.numeroEconomico) ?? 'Profesor sin nombre cargado'}</span>
                            <span>{formatFranjas(assignment.horarios)}</span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className={styles.empty}>Sin resultados en este viewport.</div>
                )}
            </div>
        </div>
    );
}

function filterAssignments(assignments: AssignmentDTO[], state: ViewportState): AssignmentDTO[] {
    if (!state.query.trim()) {
        return assignments.slice(0, 40);
    }

    const keysByMode: Record<ViewportState['mode'], string[]> = {
        eco: ['numeroEconomico'],
        uea: ['ueaClave', 'ueaNombre'],
        grupo: ['claveGrupo'],
    };
    const fuse = new Fuse(assignments, {
        keys: keysByMode[state.mode],
        threshold: 0.1,
        ignoreLocation: true,
    });

    return fuse.search(state.query).map((result) => result.item);
}
