import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { EcoProfileDTO } from '../dtos';
import styles from '../TimetablingApp.module.css';

interface RichProfessorListProps {
    profesores: EcoProfileDTO[];
    query: string;
    selectedEco?: number;
    loadingEco: number | null;
    scoreError?: string | null;
    onQueryChange: (query: string) => void;
    onSelect: (eco: number) => void;
}

export function RichProfessorList({
    profesores,
    query,
    selectedEco,
    loadingEco,
    scoreError,
    onQueryChange,
    onSelect,
}: RichProfessorListProps) {
    const filtered = useMemo(() => {
        if (!query.trim()) {
            return profesores;
        }

        const fuse = new Fuse(profesores, {
            keys: ['nombre', 'numeroEconomico', 'areas'],
            threshold: 0.28,
            ignoreLocation: true,
        });

        return fuse.search(query).map((result) => result.item);
    }, [profesores, query]);

    return (
        <section className={styles.band}>
            <div className={styles.bandHeader}>
                <h2>Profesores vigentes</h2>
                <span className={styles.statusPill}>{filtered.length}</span>
            </div>
            <div className={styles.bandBody}>
                <div className={styles.searchRow}>
                    <input
                        className={styles.input}
                        value={query}
                        onChange={(event) => onQueryChange(event.currentTarget.value)}
                        placeholder="Buscar eco, nombre o area"
                    />
                    <span className={styles.statusIdle}>
                        {profesores.length} ecos
                    </span>
                </div>

                {scoreError && <div className={styles.notice}>{scoreError}</div>}

                <div className={styles.scrollList}>
                    {filtered.map((profesor) => {
                        const selected = selectedEco === profesor.numeroEconomico;
                        return (
                            <button
                                className={`${styles.rowCard} ${selected ? styles.rowCardSelected : ''}`}
                                type="button"
                                key={profesor.numeroEconomico}
                                onClick={() => onSelect(profesor.numeroEconomico)}
                            >
                                <span className={styles.cardTitle}>
                                    <span>{profesor.nombre}</span>
                                    <span>#{profesor.numeroEconomico}</span>
                                </span>
                                <span className={styles.cardMeta}>
                                    <span className={styles.tag}>{profesor.tipoHorario}</span>
                                    {profesor.areas.map((area) => (
                                        <span className={styles.tag} key={area}>{area}</span>
                                    ))}
                                    <span className={styles.tag}>{profesor.assignments.length} asignaciones</span>
                                </span>

                                {selected && (
                                    <span className={styles.detailPane}>
                                        <span className={styles.detailLine}>
                                            <strong>Horario laboral</strong>
                                            <span>{formatContratacion(profesor)}</span>
                                        </span>
                                        <span className={styles.scoreList}>
                                            <ScoreBox
                                                title="Top r_hat"
                                                emptyLabel={loadingEco === profesor.numeroEconomico ? 'Consultando backend...' : 'Sin scores cargados'}
                                                items={profesor.topRHat}
                                            />
                                            <ScoreBox
                                                title="Top kde"
                                                emptyLabel={loadingEco === profesor.numeroEconomico ? 'Consultando backend...' : 'Sin scores cargados'}
                                                items={profesor.topKde}
                                            />
                                        </span>
                                        <span className={styles.detailLine}>
                                            <strong>Asignaciones</strong>
                                            <span>
                                                {profesor.assignments.length === 0
                                                    ? 'Sin asignaciones observadas.'
                                                    : profesor.assignments.map((assignment) => `${assignment.claveGrupo}-${assignment.ueaClave}`).join(', ')}
                                            </span>
                                        </span>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function ScoreBox({
    title,
    emptyLabel,
    items,
}: {
    title: string;
    emptyLabel: string;
    items: EcoProfileDTO['topRHat'];
}) {
    return (
        <span className={styles.scoreBox}>
            <h4>{title}</h4>
            {items.length === 0 ? (
                <span>{emptyLabel}</span>
            ) : (
                <ol>
                    {items.map((score) => (
                        <li key={`${score.source}-${score.label}-${score.score}`}>
                            {score.label}: {score.score.toFixed(3)}
                        </li>
                    ))}
                </ol>
            )}
        </span>
    );
}

function formatContratacion(profesor: EcoProfileDTO): string {
    if (profesor.profesor.horariosContratacion.length === 0) {
        return 'Sin horario laboral declarado.';
    }

    return profesor.profesor.horariosContratacion
        .map((horario) => `${horario.idDiasDeTrabajo} ${horario.horaInicio}-${horario.horaFin}`)
        .join(' | ');
}
