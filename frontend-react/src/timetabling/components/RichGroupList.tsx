import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { GroupProfileDTO } from '../dtos';
import { formatFranjas } from '../utils/schedule';
import styles from '../TimetablingApp.module.css';

interface RichGroupListProps {
    grupos: GroupProfileDTO[];
    query: string;
    selectedGroupId?: number;
    onQueryChange: (query: string) => void;
    onSelect: (idUeaGrupo: number) => void;
}

export function RichGroupList({
    grupos,
    query,
    selectedGroupId,
    onQueryChange,
    onSelect,
}: RichGroupListProps) {
    const filtered = useMemo(() => {
        if (!query.trim()) {
            return grupos;
        }

        const fuse = new Fuse(grupos, {
            keys: ['claveGrupo', 'ueaClave', 'ueaNombre', 'profesorAsignadoEco'],
            threshold: 0.28,
            ignoreLocation: true,
        });
        return fuse.search(query).map((result) => result.item);
    }, [grupos, query]);

    return (
        <section className={styles.band}>
            <div className={styles.bandHeader}>
                <h2>Grupos y UEA</h2>
                <span className={styles.statusPill}>{filtered.length}</span>
            </div>
            <div className={styles.bandBody}>
                <div className={styles.searchRow}>
                    <input
                        className={styles.input}
                        value={query}
                        onChange={(event) => onQueryChange(event.currentTarget.value)}
                        placeholder="Buscar grupo, UEA o eco asignado"
                    />
                    <span className={styles.statusIdle}>
                        {grupos.length} filas
                    </span>
                </div>
                <div className={styles.scrollList}>
                    {filtered.map((grupo) => {
                        const selected = selectedGroupId === grupo.idUeaGrupo;
                        return (
                            <button
                                className={`${styles.rowCard} ${selected ? styles.rowCardSelected : ''}`}
                                type="button"
                                key={grupo.idUeaGrupo}
                                onClick={() => onSelect(grupo.idUeaGrupo)}
                            >
                                <span className={styles.cardTitle}>
                                    <span>{grupo.claveGrupo}</span>
                                    <span>{grupo.ueaClave}</span>
                                </span>
                                <span className={styles.cardMeta}>
                                    <span className={stateClassName(grupo.estadoAsignacion)}>{grupo.estadoAsignacion}</span>
                                    <span className={styles.tag}>Area {grupo.idArea}</span>
                                    {grupo.profesorAsignadoEco && (
                                        <span className={styles.tag}>Eco {grupo.profesorAsignadoEco}</span>
                                    )}
                                </span>

                                {selected && (
                                    <span className={styles.detailPane}>
                                        <span className={styles.detailLine}>
                                            <strong>Horario</strong>
                                            <span>{formatFranjas(grupo.horarios)}</span>
                                        </span>
                                        <span className={styles.detailLine}>
                                            <strong>UEA</strong>
                                            <span>{grupo.ueaNombre ?? `Clave ${grupo.ueaClave}`}</span>
                                        </span>
                                        <span className={styles.detailLine}>
                                            <strong>Observaciones</strong>
                                            <span>
                                                {grupo.warnings.length === 0
                                                    ? 'Sin advertencias.'
                                                    : grupo.warnings.join(' | ')}
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

function stateClassName(state: GroupProfileDTO['estadoAsignacion']): string {
    if (state === 'asignada' || state === 'preasignada') {
        return styles.statusOk;
    }
    if (state === 'huerfana' || state === 'rechazada') {
        return styles.statusError;
    }
    return styles.statusWarn;
}
