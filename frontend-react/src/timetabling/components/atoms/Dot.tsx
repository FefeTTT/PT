/*
 * Dot.tsx — semáforo de estado (dependencias, historial). Portado de `ui-atoms.jsx`.
 * `color` acepta una variable CSS Taller (p.ej. 'var(--tt-good)') o cualquier color.
 */
import styles from './atoms.module.css';

export interface DotProps {
    color: string;
    size?: number;
    pulse?: boolean;
}

export function Dot({ color, size = 8, pulse = false }: DotProps) {
    return (
        <span
            className={pulse ? `${styles.dot} ${styles.dotPulse}` : styles.dot}
            style={{ width: size, height: size, background: color, color }}
        />
    );
}
