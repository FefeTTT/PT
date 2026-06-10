/*
 * Icons.tsx — set de iconos SVG del look "Taller", portado de
 * `TimetablingUI/timetabling/ui-atoms.jsx`. Usan `currentColor`, así que cada
 * contexto los colorea vía la propiedad CSS `color` o el prop `color`.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface IconProps {
    size?: number;
    color?: string;
    /** stroke-width */
    sw?: number;
    style?: CSSProperties;
    title?: string;
}

function makeIcon(path: ReactNode, opts?: { filled?: boolean; viewBox?: string }) {
    const viewBox = opts?.viewBox ?? '0 0 24 24';
    const filled = opts?.filled ?? false;
    return function Icon({ size = 16, color = 'currentColor', sw = 1.8, style, title }: IconProps) {
        return (
            <svg
                width={size}
                height={size}
                viewBox={viewBox}
                fill={filled ? color : 'none'}
                stroke={filled ? 'none' : color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={style}
                role={title ? 'img' : undefined}
                aria-hidden={title ? undefined : true}
            >
                {title ? <title>{title}</title> : null}
                {path}
            </svg>
        );
    };
}

export const IconEye = makeIcon(
    <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
);
export const IconPencil = makeIcon(
    <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
);
export const IconLock = makeIcon(
    <><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
);
export const IconCheck = makeIcon(<path d="M20 6 9 17l-5-5" />);
export const IconUndo = makeIcon(
    <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></>,
);
export const IconWarn = makeIcon(
    <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
);
export const IconAlert = makeIcon(
    <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
);
export const IconChevronR = makeIcon(<path d="m9 6 6 6-6 6" />);
export const IconChevronD = makeIcon(<path d="m6 9 6 6 6-6" />);
export const IconSearch = makeIcon(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const IconX = makeIcon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconPlay = makeIcon(<path d="M6 4v16l13-8Z" />, { filled: true });
export const IconSave = makeIcon(
    <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
);
export const IconReset = makeIcon(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>);
export const IconSliders = makeIcon(
    <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="7" cy="18" r="2" fill="currentColor" /></>,
);
/** Swap vertical (reemplazar fila): dos flechas opuestas, una sube y otra baja. */
export const IconSwap = makeIcon(
    <><path d="M7 4v16" /><path d="m4 7 3-3 3 3" /><path d="M17 20V4" /><path d="m14 17 3 3 3-3" /></>,
);
/** Bote de basura (desasignar). */
export const IconTrash = makeIcon(
    <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
);
