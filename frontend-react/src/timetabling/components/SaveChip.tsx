/*
 * SaveChip — indicador de guardado VISIBLE en el topbar (pieza Eje 3).
 * Lee el contexto useSaveStatus: guardando… / guardado · hace Ns / no se pudo guardar + reintentar.
 */
import { useEffect, useState } from 'react';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { IconCheck, IconAlert, IconReset } from './atoms';
import { Spinner } from './atoms';
import styles from '../TimetablingApp.module.css';

function timeAgo(ts: number): string {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `hace ${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    return `hace ${h} h`;
}

export function SaveChip() {
    const { status, retry } = useSaveStatus();
    const [, setTick] = useState(0);

    // Re-render periódico para mantener fresco el "hace N s".
    useEffect(() => {
        if (status.state !== 'saved') return;
        const t = setInterval(() => setTick((n) => n + 1), 5000);
        return () => clearInterval(t);
    }, [status.state]);

    if (status.state === 'idle') return null;

    if (status.state === 'saving') {
        return (
            <span className={styles.saveChip} style={{ background: 'rgba(53,107,82,0.10)', color: 'var(--tt-accent)' }}>
                <Spinner size={14} /> Guardando…
            </span>
        );
    }

    if (status.state === 'error') {
        return (
            <span className={styles.saveChip} style={{ background: 'var(--tt-con-tint)', color: 'var(--tt-bad)' }}>
                <IconAlert size={14} /> No se pudo guardar
                <button type="button" className={styles.saveChipBtn} onClick={retry} title={status.error ?? undefined}>
                    <IconReset size={12} /> Reintentar
                </button>
            </span>
        );
    }

    return (
        <span className={styles.saveChip} style={{ background: 'rgba(63,125,94,0.12)', color: 'var(--tt-good)' }}>
            <IconCheck size={14} /> Guardado{status.lastSavedAt ? ` · ${timeAgo(status.lastSavedAt)}` : ''}
        </span>
    );
}
