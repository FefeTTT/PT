/**
 * Parametros de entrenamiento de los modelos KDE de Python que producen las
 * graficas per-eco (joblibs). Espejo de `ServidorPython/app/kde_global_config.py`.
 *
 * Estos NO son los parametros del scoring TS in-browser (esos viven en
 * KdeWorkerConfig / KdeConfigPanel); estos controlan los joblibs que renderiza
 * el backend en /charts/kde.
 */

export interface KdeIjParams {
    half_life: number;
    bandwidth_uea: number;
    steep_power: number;
    lambda_factor: number;
}

export interface KdeUnificadoParams {
    kde_bandwidth_horas: number;
    kde_bandwidth_dias: number;
    half_life_trimestres: number;
    score_threshold: number;
    lambda_bonus: number;
    threshold_ratio: number;
    steep_power_regular: number;
    steep_power_irregular: number;
}

export interface KdeModelsConfig {
    kde_ij: KdeIjParams;
    kde_unificado: KdeUnificadoParams;
}

export type KdeModelName = keyof KdeModelsConfig;

export const KDE_MODEL_LABELS: Record<KdeModelName, string> = {
    kde_ij: 'KDE IJ',
    kde_unificado: 'KDE Horario Unificado',
};

/** Defaults = los valores historicos horneados en los entrenadores Python. */
export const KDE_MODELS_DEFAULTS: KdeModelsConfig = {
    kde_ij: {
        half_life: 8.0,
        bandwidth_uea: 0.05,
        steep_power: 2.5,
        lambda_factor: 2.0,
    },
    kde_unificado: {
        kde_bandwidth_horas: 0.225,
        kde_bandwidth_dias: 0.175,
        half_life_trimestres: 8.0,
        score_threshold: 0.01,
        lambda_bonus: 0.2,
        threshold_ratio: 0.85,
        steep_power_regular: 6.0,
        steep_power_irregular: 2.0,
    },
};

/** Etiquetas legibles por campo, para construir el panel. */
export const KDE_IJ_FIELDS: ReadonlyArray<{ key: keyof KdeIjParams; label: string }> = [
    { key: 'half_life', label: 'half_life' },
    { key: 'bandwidth_uea', label: 'bandwidth_uea' },
    { key: 'steep_power', label: 'steep_power' },
    { key: 'lambda_factor', label: 'lambda_factor' },
];

export const KDE_UNIFICADO_FIELDS: ReadonlyArray<{ key: keyof KdeUnificadoParams; label: string }> = [
    { key: 'kde_bandwidth_horas', label: 'kde_bandwidth_horas' },
    { key: 'kde_bandwidth_dias', label: 'kde_bandwidth_dias' },
    { key: 'half_life_trimestres', label: 'half_life_trimestres' },
    { key: 'score_threshold', label: 'score_threshold' },
    { key: 'lambda_bonus', label: 'lambda_bonus' },
    { key: 'threshold_ratio', label: 'threshold_ratio' },
    { key: 'steep_power_regular', label: 'steep_power_regular' },
    { key: 'steep_power_irregular', label: 'steep_power_irregular' },
];

/** Comparacion por bloque (mismo criterio que el backend para 'dirty'). */
export function modelosDiferentes(a: KdeModelsConfig, b: KdeModelsConfig): KdeModelName[] {
    const out: KdeModelName[] = [];
    (Object.keys(KDE_MODEL_LABELS) as KdeModelName[]).forEach(modelo => {
        const ba = a[modelo] as unknown as Record<string, number>;
        const bb = b[modelo] as unknown as Record<string, number>;
        const diff = Object.keys(ba).some(k => Math.abs((ba[k] ?? 0) - (bb[k] ?? 0)) > 1e-12);
        if (diff) out.push(modelo);
    });
    return out;
}
