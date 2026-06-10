/*
 * scoreLens.ts — "lente" para hacer interpretables los scores KDE.
 *
 * Portado de `TimetablingUI/timetabling/mockData.js` (tierOf / lente / DOMAIN_MIN).
 * Convierte un score en [0,1] en (a) un tier con color, (b) un porcentaje y (c) una
 * frase en lenguaje natural, para la pieza Eje 3 "Scores interpretables".
 *
 * Los umbrales de dominio por defecto IGUALAN los `minKdeIj/Ih/Plan` de
 * `makeDefaultConfig()` (KdeMode.tsx). `tierOf` acepta un override para reutilizar los
 * umbrales reales del `KdeWorkerConfig` en uso, de modo que la lente coincida con el
 * dominio del scoring del pase.
 */

export type ScoreKind = 'ij' | 'ih' | 'plan' | 'pref';
export type ScoreTier = 'good' | 'warn' | 'out' | 'dom';

/** Umbrales de dominio por defecto (= minKdeIj/Ih/Plan de makeDefaultConfig). */
export const DOMAIN_MIN: Record<string, number> = { ij: 0.02, ih: 0.05, plan: 0.05 };

export interface DomainThresholds {
    minKdeIj?: number;
    minKdeIh?: number;
    minKdePlan?: number;
}

function domainMinFor(kind: ScoreKind, thresholds?: DomainThresholds): number {
    if (thresholds) {
        if (kind === 'ij') return thresholds.minKdeIj ?? DOMAIN_MIN.ij;
        if (kind === 'ih' || kind === 'pref') return thresholds.minKdeIh ?? DOMAIN_MIN.ih;
        if (kind === 'plan') return thresholds.minKdePlan ?? DOMAIN_MIN.plan;
    }
    return DOMAIN_MIN[kind === 'pref' ? 'ih' : kind] ?? 0;
}

/**
 * tier de un score KDE en [0,1]:
 *   good = ≥ 0.50 (encaje claro) · warn = 0.25–0.50 (límite)
 *   out  = < 0.25 · dom = por debajo del umbral de dominio (fuera de dominio)
 */
export function tierOf(v: number | undefined, kind: ScoreKind, thresholds?: DomainThresholds): ScoreTier {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'out';
    if (v < domainMinFor(kind, thresholds)) return 'dom';
    if (v < 0.25) return 'out';
    if (v < 0.5) return 'warn';
    return 'good';
}

/** Color (variable CSS Taller) para un tier. 'out' y 'dom' comparten el rojo. */
export function tierColor(tier: ScoreTier): string {
    if (tier === 'good') return 'var(--tt-good)';
    if (tier === 'warn') return 'var(--tt-mid)';
    return 'var(--tt-bad)';
}

/** Tier "plano" (good|warn|out) para componentes como MiniBar que no distinguen 'dom'. */
export function flatTier(tier: ScoreTier): 'good' | 'warn' | 'out' {
    return tier === 'dom' ? 'out' : tier;
}

/** Frase interpretativa de un score (la "pista" para el operador). */
export function lente(kind: ScoreKind, v: number | undefined): string {
    const p = Math.round((v ?? 0) * 100);
    const lvl = p >= 50 ? 'dentro de lo normal' : p >= 25 ? 'poco habitual' : 'atípico';
    if (kind === 'ih') return `Normalidad de impartición en este horario — ${lvl}`;
    if (kind === 'ij') return `Normalidad de impartición de esta UEA — ${lvl}`;
    if (kind === 'plan') return `Normalidad de esta carga de UEA — ${lvl}`;
    if (kind === 'pref') return `Cercanía a la hora preferencial administrativa — ${p >= 50 ? 'cerca' : p >= 25 ? 'media' : 'lejos'}`;
    return `${p}%`;
}

export function pct(v: number | undefined): string {
    return typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—';
}

export function fixed(v: number | undefined, d = 3): string {
    return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '—';
}

/** Etiqueta de turno legible. */
export function turnoLabel(t: string): string {
    return ({ manana: 'Mañana', medioDia: 'Mediodía', tarde: 'Tarde' } as Record<string, string>)[t] ?? t;
}

/*
 * ───────────────────────────────────────────────────────────────────────────
 * Campana del pase: color ASIMÉTRICO (cola baja) + barra normalizada min–max robusta (p5–p95).
 *
 * Compartido por la lista maestra (columna %) y la ficha de detalle (kde_ih/ij/plan),
 * para que ambos vistas coloreen con el MISMO criterio relativo al pase, en vez de
 * umbrales fijos que dejaban casi todo en rojo/amarillo cuando los scores caen en 20–35 %.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Estadísticas robustas de la población de scores del pase actual. */
export interface ScoreStats {
    median: number;
    /** σ robusta vía MAD escalado por 1.4826. */
    sigma: number;
    /** Mínimo y máximo observados (solo para tooltips; la barra se normaliza con p5–p95). */
    min: number;
    max: number;
    /** Percentiles 5 y 95: bornes robustos para normalizar la barra sin que las colas la aplasten. */
    p5: number;
    p95: number;
    /** Número de scores válidos usados. */
    n: number;
}

/** Estadísticas por tipo de score KDE (para la ficha de detalle). */
export interface ScoreStatsByKind {
    ih: ScoreStats | null;
    ij: ScoreStats | null;
    plan: ScoreStats | null;
}

/** Mediana de un array YA ordenado ascendentemente. */
function medianSorted(sorted: number[]): number {
    const n = sorted.length;
    if (n === 0) return 0;
    return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];
}

/** Percentil q∈[0,100] por interpolación lineal sobre un array YA ordenado ascendentemente. */
function percentileSorted(sorted: number[], q: number): number {
    const n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return sorted[0];
    const rank = (q / 100) * (n - 1);
    const lo = Math.floor(rank);
    const hi = Math.min(n - 1, lo + 1);
    const frac = rank - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Estimador robusto de (mediana, σ, min, max) sobre los scores. σ se deriva de MAD×1.4826
 * (estimador consistente de σ gaussiano), porque la distribución observada está fuertemente
 * concentrada con colas atípicas; la desviación estándar clásica quedaría inflada por los
 * outliers y la campana visual no reflejaría "lo típico" del pase.
 */
export function computeScoreStats(values: ReadonlyArray<number>): ScoreStats | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const median = medianSorted(sorted);
    const mad = medianSorted([...values].map(v => Math.abs(v - median)).sort((a, b) => a - b));
    // Piso defensivo: con pocos datos o todos iguales el MAD puede ser 0 y degenerar las bandas.
    const sigma = Math.max(mad * 1.4826, 0.005);
    return {
        median, sigma,
        min: sorted[0], max: sorted[sorted.length - 1],
        p5: percentileSorted(sorted, 5), p95: percentileSorted(sorted, 95),
        n: values.length,
    };
}

/**
 * Color del score según una campana de Gauss centrada en la mediana del pase, ASIMÉTRICA y
 * DIRIGIDA hacia abajo: solo la cola baja se penaliza, porque un score más alto siempre es mejor
 * encaje y no tiene sentido marcar un outlier alto como atípico.
 *
 *   score ≥ mediana            → verde   (encaje igual o mejor que lo típico)
 *   mediana − score ≤ σ/2      → verde   (cae apenas por debajo, dentro de lo normal)
 *   σ/2 < mediana − score ≤ σ  → amarillo (claramente bajo el centro)
 *   mediana − score >  σ       → rojo    (cola baja: encaje atípicamente malo)
 */
export function scoreColor(v: number | undefined, stats: ScoreStats | null): string {
    if (v == null || !stats) return 'var(--tt-sub)';
    if (v >= stats.median) return 'var(--tt-good)';
    const dev = stats.median - v;
    if (dev <= stats.sigma / 2) return 'var(--tt-good)';
    if (dev <= stats.sigma) return 'var(--tt-mid)';
    return 'var(--tt-bad)';
}

/** Tier asimétrico ('good'|'mid'|'bad') equivalente a `scoreColor`, para textos coherentes. */
export function scoreTier(v: number | undefined, stats: ScoreStats | null): 'good' | 'mid' | 'bad' {
    if (v == null || !stats) return 'bad';
    if (v >= stats.median) return 'good';
    const dev = stats.median - v;
    if (dev <= stats.sigma / 2) return 'good';
    if (dev <= stats.sigma) return 'mid';
    return 'bad';
}

/**
 * Relleno 0..1 de la barra, normalizado min–max ROBUSTO entre los percentiles 5 y 95 de la
 * población del pase (no entre el mín/máx absolutos). Los scores KDE están muy sesgados a la cola
 * baja (mín≈0) con máximos cerca de 1, así que el min–max crudo degeneraba en ≈ v·100 y las barras
 * parecían "sin normalizar"; recortar a p5–p95 reparte el grueso (20–40 %) a lo largo de la barra.
 * Lo que cae por debajo de p5 se satura a 0 y por encima de p95 a 1 (clamp de colas).
 */
export function scoreBarFill(v: number | undefined, stats: ScoreStats | null): number {
    if (v == null || !stats) return 0;
    const span = stats.p95 - stats.p5;
    if (span <= 1e-9) return 1; // p5==p95 (población degenerada) → barra llena
    return Math.max(0, Math.min(1, (v - stats.p5) / span));
}
