import { useId, useState } from 'react';
import { Spinner } from './atoms';
import {
    usePenaltyLoadPreview,
    type PenaltyUea,
} from '../hooks/usePenaltyLoadPreview';
import styles from './KdeMode.module.css';

export interface EcoPenaltyBadgeProps {
    /** Texto que ya muestra la badge, p.ej. "5 grupos · 2 asig". Se conserva intacto. */
    label: string;
    /** `${origin}/py`. */
    baseUrl: string;
    /** Número económico del profesor. */
    eco: number;
    /** Asignaciones ya asignadas (carga actual); cada entrada cuenta aunque repita UEA. */
    lockedUeas: PenaltyUea[];
    /** Todas las asignaciones (asignadas ∪ por asignar) = carga proyectada. */
    allUeas: PenaltyUea[];
}

/** Clasificación de color/nivel por total_penalty (mayor/hacia 0 = mejor; más negativo = peor). */
export type Tier = 'ok' | 'warn' | 'bad';
export function tierOf(penalty: number, probability?: number): Tier {
    if (penalty <= -1.5 || (typeof probability === 'number' && probability < 0.05)) return 'bad';
    if (penalty < -0.5) return 'warn';
    return 'ok';
}
function tierClass(tier: Tier): string {
    return tier === 'ok' ? styles.penaltyOk : tier === 'warn' ? styles.penaltyWarn : styles.penaltyBad;
}
/** Nombre del nivel en lenguaje natural. */
function tierName(tier: Tier): string {
    return tier === 'ok' ? 'Normal' : tier === 'warn' ? 'Alta' : 'Sobrecarga';
}
const TIER_RANK: Record<Tier, number> = { ok: 0, warn: 1, bad: 2 };

function fmt(value: number): string {
    return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
/** "N grupo(s)" con plural correcto. Unidad que el usuario ve y asigna (cada fila = 1 grupo). */
function gruposTxt(n: number): string {
    return `${n} grupo${n === 1 ? '' : 's'}`;
}
/**
 * Describe la habitualidad de una carga a partir de load_probability (0..1).
 * Devuelve el texto y si la carga es "habitual", para enlazarla con el nivel de
 * penalización sin contradicción (p.ej. "Alta, aunque 100% habitual").
 */
function habitualidad(prob?: number): { txt: string; habitual: boolean } | null {
    if (typeof prob !== 'number' || !Number.isFinite(prob)) return null;
    const pct = Math.round(prob * 100);
    if (prob < 0.05) return { txt: `inusual (${pct}%)`, habitual: false };
    if (prob < 0.5) return { txt: `poco habitual (${pct}%)`, habitual: false };
    return { txt: `${pct}% habitual`, habitual: true };
}

/**
 * Frase coherente nivel + habitualidad. El nivel (y su color) viene de la penalización;
 * la habitualidad de load_probability. Cuando discrepan (carga "Alta" pero habitual, o al
 * revés) se enlazan con "aunque"/"y" para que NO se lea contradictorio.
 */
export function nivelHabitualPhrase(tier: Tier, prob?: number): string {
    const nivel = tierName(tier);
    const hab = habitualidad(prob);
    if (!hab) return nivel;
    if (tier === 'ok') return `${nivel} · ${hab.txt}`;
    if (hab.habitual) return `${nivel}, aunque ${hab.txt}`;
    return `${nivel} y ${hab.txt}`;
}

/**
 * Selección pura del "+1 marginal": dada la curva de carga (`loads`/`probs`, indexada por
 * w=2..max_w con índice 0 = 2 asignaciones) y el conteo actual `count` (K grupos), devuelve
 * la entrada para UN grupo adicional (carga K+1), que vive en el índice `K-1`.
 *
 * Nota: `loads` es solo el componente SEMANAL de la penalización (aproximación indicativa),
 * no el `total_penalty` completo; sirve para un preview "+1" pero es aproximado.
 *
 * Devuelve null si no hay curva, si `count < 2`, o si el índice cae fuera del arreglo
 * (K ≥ max_w+1, p.ej. una carga ya en el máximo modelado).
 */
export function marginalPlusOne(
    loads: number[] | undefined,
    probs: number[] | undefined,
    count: number | undefined,
): { penalty: number; prob: number | undefined; count: number } | null {
    if (!Array.isArray(loads) || typeof count !== 'number' || !Number.isFinite(count)) return null;
    if (count < 2) return null;
    const idx = count - 1; // "+1" = carga (count+1), índice (count+1)-2 = count-1.
    if (idx < 0 || idx >= loads.length) return null;
    const penalty = loads[idx];
    if (typeof penalty !== 'number' || !Number.isFinite(penalty)) return null;
    const rawProb = Array.isArray(probs) ? probs[idx] : undefined;
    const prob = typeof rawProb === 'number' && Number.isFinite(rawProb) ? rawProb : undefined;
    return { penalty, prob, count: count + 1 };
}

/**
 * Frase del "+1 marginal" cuando todo está asignado (o como predicción adicional):
 * qué penalización/habitualidad recibiría el profesor con UN grupo más. Si ese grupo extra
 * sería ~inusual (prob < 0.05), añade que la carga actual es de hecho el techo, enlazándolo
 * con la habitualidad de la carga ACTUAL para que NO quede contradictorio.
 */
export function marginalPhrase(
    marg: { penalty: number; prob: number | undefined; count: number },
    currentProb?: number,
): string {
    const tier = tierOf(marg.penalty, marg.prob);
    const base = `Si asignas 1 grupo más (→ ${marg.count} grupos): ● ${nivelHabitualPhrase(tier, marg.prob)}.`;
    if (typeof marg.prob === 'number' && marg.prob < 0.05) {
        // La actual es el techo. Coherente con qué tan habitual es la carga ACTUAL.
        const actualHabitual =
            typeof currentProb === 'number' && Number.isFinite(currentProb) && currentProb >= 0.5;
        const techo = actualHabitual
            ? 'Es la carga más alta que suele llevar; un grupo más sería inusual.'
            : 'Ya es una carga alta para este profesor; un grupo más sería inusual.';
        return `${base} ${techo}`;
    }
    return base;
}

/** Frase comparativa current → projected en lenguaje natural. */
function comparativa(extra: number, curTier: Tier, projTier: Tier): string {
    const otras = extra === 1 ? 'el otro grupo' : `los otros ${extra} grupos`;
    const cur = tierName(curTier).toLowerCase();
    const proj = tierName(projTier).toLowerCase();
    if (TIER_RANK[projTier] > TIER_RANK[curTier]) {
        return `Asignar ${otras} lo pasa de carga ${cur} a ${proj}.`;
    }
    if (TIER_RANK[projTier] < TIER_RANK[curTier]) {
        return `Asignar ${otras} deja la carga en ${proj}.`;
    }
    return `Asignar ${otras} mantiene la carga ${proj}.`;
}

export function EcoPenaltyBadge({ label, baseUrl, eco, lockedUeas, allUeas }: EcoPenaltyBadgeProps) {
    const [open, setOpen] = useState(false);
    const [showRaw, setShowRaw] = useState(false);
    const tipId = useId();
    const preview = usePenaltyLoadPreview(baseUrl, eco, lockedUeas, allUeas);

    const show = () => {
        setOpen(true);
        preview.trigger(); // fetch perezoso: solo al primer hover/focus de ESTA badge.
    };
    const hide = () => setOpen(false);

    const lockedCount = lockedUeas.filter(u => u.uea !== -1 && u.horario.trim() !== '').length;
    const allCount = allUeas.filter(u => u.uea !== -1 && u.horario.trim() !== '').length;
    const hasCurrent = lockedCount >= 1;
    const hasExtra = allCount > lockedCount; // hay asignaciones por asignar que añadir
    const extraCount = allCount - lockedCount;

    const curTier = preview.current != null ? tierOf(preview.current, preview.currentProbability) : null;
    const projTier = preview.projected != null ? tierOf(preview.projected, preview.projectedProbability) : null;

    /** Una línea "Etiqueta: ● Nivel · % habitual (raw)". */
    const loadLine = (
        labelTxt: string,
        penalty: number,
        prob: number | undefined,
        tier: Tier,
    ) => {
        return (
            <span className={styles.penaltyTipRow}>
                <span className={styles.penaltyTipLabel}>{labelTxt}</span>
                <span className={`${styles.penaltyTipVal} ${tierClass(tier)}`}>
                    <span className={styles.penaltyTipDot}>●</span>
                    {nivelHabitualPhrase(tier, prob)}
                    {showRaw ? <span className={styles.penaltyTipRaw}>({fmt(penalty)})</span> : null}
                </span>
            </span>
        );
    };

    const hasAnyValue = preview.current != null || preview.projected != null;

    // "+1 marginal": qué pasaría con UN GRUPO más. La flecha = grupos actuales + 1 (lo que el
    // usuario ve y asigna). Indexamos la curva por nº de asignaciones/grupos. La entrada "+1" vive
    // en índice (grupos)-1. Cuando todo está asignado, proyectada == actual.
    const marginal =
        marginalPlusOne(preview.projectedLoads, preview.projectedLoadProbabilities, allCount) ??
        marginalPlusOne(preview.currentLoads, preview.currentLoadProbabilities, lockedCount);

    return (
        <span
            className={styles.ecoBadgeWrap}
            tabIndex={0}
            aria-describedby={open ? tipId : undefined}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            <span className={`${styles.ecoBadge} ${styles.ecoBadgeHover}`}>{label}</span>

            {open && (
                <span className={styles.penaltyTip} role="tooltip" id={tipId}>
                    <span className={styles.penaltyTipTitle}>
                        Carga del profesor
                        {hasAnyValue && (
                            <button
                                type="button"
                                className={styles.penaltyTipInfo}
                                aria-pressed={showRaw}
                                title={showRaw ? 'Ocultar valor del modelo' : 'Ver valor del modelo'}
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(e) => { e.stopPropagation(); setShowRaw(v => !v); }}
                            >
                                ⓘ
                            </button>
                        )}
                    </span>

                    {preview.status === 'loading' && (
                        <span className={styles.penaltyTipRow}>
                            <Spinner size={12} />
                            <span className={styles.penaltyTipMuted}>calculando penalización…</span>
                        </span>
                    )}

                    {preview.status === 'error' && !hasAnyValue && (
                        <span className={`${styles.penaltyTipRow} ${styles.penaltyTipError}`}>
                            No se pudo calcular: {preview.error ?? 'error desconocido'}
                        </span>
                    )}

                    {(preview.status === 'ready' || (preview.status === 'error' && hasAnyValue)) && (
                        <>
                            {/* Carga actual (asignaciones asignadas). Requiere ≥1 asignada. */}
                            {hasCurrent ? (
                                preview.current != null && curTier ? (
                                    loadLine(
                                        `Actual (${gruposTxt(lockedCount)})`,
                                        preview.current,
                                        preview.currentProbability,
                                        curTier,
                                    )
                                ) : (
                                    <span className={styles.penaltyTipRow}>
                                        <span className={styles.penaltyTipMuted}>Actual: sin dato</span>
                                    </span>
                                )
                            ) : (
                                <span className={styles.penaltyTipRow}>
                                    <span className={styles.penaltyTipMuted}>asigna ≥1 grupo para comparar</span>
                                </span>
                            )}

                            {/* Proyectada (todas las asignaciones) — solo si añade carga. */}
                            {hasExtra && preview.projected != null && projTier && (
                                loadLine(
                                    `Proyectada (→ ${gruposTxt(allCount)})`,
                                    preview.projected,
                                    preview.projectedProbability,
                                    projTier,
                                )
                            )}

                            {/* Frase comparativa en lenguaje natural. */}
                            {hasCurrent && hasExtra && curTier && projTier && (
                                <span className={styles.penaltyTipClause}>
                                    ↳ {comparativa(extraCount, curTier, projTier)}
                                </span>
                            )}
                            {hasCurrent && !hasExtra && (
                                marginal ? (
                                    <span className={styles.penaltyTipClause}>
                                        {marginalPhrase(marginal, preview.currentProbability)}
                                    </span>
                                ) : (
                                    <span className={styles.penaltyTipClause}>
                                        Todo asignado — sin carga adicional.
                                    </span>
                                )
                            )}

                            {/* Error parcial: un ítem no volvió, pero mostramos lo que sí. */}
                            {preview.status === 'error' && (
                                <span className={`${styles.penaltyTipRow} ${styles.penaltyTipError}`}>
                                    Dato parcial: {preview.error ?? 'error'}
                                </span>
                            )}
                        </>
                    )}
                </span>
            )}
        </span>
    );
}
