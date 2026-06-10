/*
 * MiniBar.tsx — sparkline horizontal de un score 0..1, coloreado por tier.
 * Portado de `ui-atoms.jsx`. El color sale de las variables CSS Taller (--tt-*).
 */
import { tierColor, type ScoreTier } from '../../utils/scoreLens';
import styles from './atoms.module.css';

export interface MiniBarProps {
    /** valor en [0,1] (relleno crudo v·100, salvo que se pase `fill`). */
    v?: number;
    /** tier ya calculado (good|warn|out|dom); ignorado si se pasa `color`. */
    tier?: ScoreTier;
    /** ancho CSS (px o '100%') */
    width?: number | string;
    height?: number;
    /** Relleno 0..1 YA normalizado (p. ej. min–max del pase). Si se da, sustituye a v·100. */
    fill?: number;
    /** Color explícito de la barra. Si se da, sustituye a `tierColor(tier)`. */
    color?: string;
}

export function MiniBar({ v, tier, width = 46, height = 6, fill, color }: MiniBarProps) {
    const ratio = fill != null ? fill : (v ?? 0);
    const pctFill = Math.max(3, Math.min(100, ratio * 100));
    const background = color ?? tierColor(tier ?? 'out');
    return (
        <span className={styles.miniBar} style={{ width, height }}>
            <span className={styles.miniBarFill} style={{ width: `${pctFill}%`, background }} />
        </span>
    );
}
