/* Spinner.tsx — indicador de "guardando…" / proceso en curso (look Taller). */
import styles from './atoms.module.css';

export interface SpinnerProps {
    size?: number;
    color?: string;
    sw?: number;
}

export function Spinner({ size = 14, color = 'currentColor', sw = 2 }: SpinnerProps) {
    return (
        <svg
            className={styles.spinner}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
    );
}
