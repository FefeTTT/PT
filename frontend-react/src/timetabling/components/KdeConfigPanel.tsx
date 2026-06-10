import { type ChangeEvent, useEffect, useState } from 'react';
import type { KdeWorkerConfig } from '../engine/kde/graspKdeTypes';
import styles from './KdeMode.module.css';

export interface KdeConfigPanelProps {
    config: KdeWorkerConfig;
    onChange: (next: KdeWorkerConfig) => void;
    disabled?: boolean;
}

/** Trunca un string decimal sin redondeo float: "1.119" → 1.11 (no 1.12). */
function parseDecimalTruncated(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.') return null;
    // Validar formato numérico (evitar cosas como "1.2.3").
    if (!/^-?\d*\.?\d*$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return n;
}

export function NumericField({
    label,
    value,
    onCommit,
    disabled,
}: {
    label: string;
    value: number;
    onCommit: (v: number) => void;
    disabled?: boolean;
}) {
    // Estado local: el texto crudo que ve el usuario.
    const [draft, setDraft] = useState(String(value));

    // Si el valor externo cambia (p.ej. reset), sincronizar el draft.
    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    return (
        <div className={styles.field} key={label}>
            <label>{label}</label>
            <input
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value;
                    // Permitir cualquier edición intermedia válida: dígitos, punto, signo.
                    if (/^-?\d*\.?\d*$/.test(raw)) {
                        setDraft(raw);
                        const parsed = parseDecimalTruncated(raw);
                        if (parsed !== null) onCommit(parsed);
                    }
                }}
                onBlur={() => {
                    // Al perder foco, limpiar el draft al valor numérico final.
                    const parsed = parseDecimalTruncated(draft);
                    if (parsed !== null) {
                        setDraft(String(parsed));
                    } else {
                        // Si el draft quedó inválido, revertir al valor externo.
                        setDraft(String(value));
                    }
                }}
                disabled={disabled}
            />
        </div>
    );
}

export function KdeConfigPanel({ config, onChange, disabled }: KdeConfigPanelProps) {
    const updateOptions = (patch: Partial<KdeWorkerConfig['options']>) =>
        onChange({ ...config, options: { ...config.options, ...patch } });

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Configuracion GRASP + KDE</h2>
            <div className={styles.configGrid}>
                <div className={styles.field}>
                    <label>Modo</label>
                    <select
                        value={config.mode}
                        onChange={e => onChange({ ...config, mode: e.target.value as KdeWorkerConfig['mode'] })}
                        disabled={disabled}
                    >
                        <option value="kde_ij">kde_ij (default)</option>
                        <option value="legacy">legacy (requiere Redis)</option>
                    </select>
                </div>
                <NumericField label="Seed" value={config.seed} onCommit={v => onChange({ ...config, seed: Math.floor(v) })} disabled={disabled} />
                <NumericField label="K (RCL)" value={config.k} onCommit={v => onChange({ ...config, k: Math.max(1, Math.floor(v)) })} disabled={disabled} />
                <NumericField label="Alpha" value={config.alpha} onCommit={v => onChange({ ...config, alpha: v })} disabled={disabled} />
                {/* steepPower / halfLife / bandwidthUea / bandwidthHour se removieron de aqui:
                    son params de entrenamiento de los modelos KDE y ahora viven en el panel
                    "Modelos KDE (graficas / joblibs)" de abajo. Aqui solo quedan los params de
                    GRASP (Seed/K/Alpha) y los umbrales de dominio del scoring (minKde*). */}
                <NumericField label="minKdeIj" value={config.options.minKdeIj ?? 0.02} onCommit={v => updateOptions({ minKdeIj: v })} disabled={disabled} />
                <NumericField label="minKdeIh" value={config.options.minKdeIh ?? 0.05} onCommit={v => updateOptions({ minKdeIh: v })} disabled={disabled} />
                <NumericField label="minKdePlan" value={config.options.minKdePlan ?? 0.05} onCommit={v => updateOptions({ minKdePlan: v })} disabled={disabled} />
            </div>
            <div className={styles.checkboxRow}>
                <label>
                    <input
                        type="checkbox"
                        checked={config.renderOnly}
                        onChange={e => onChange({ ...config, renderOnly: e.target.checked })}
                        disabled={disabled}
                    />
                    {' '}--render-only
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={config.noPenalty}
                        onChange={e => onChange({ ...config, noPenalty: e.target.checked })}
                        disabled={disabled}
                    />
                    {' '}--no-penalty (desactívalo para paridad con testAsinacionKDE; requiere backend Python+Redis)
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={config.withRhat}
                        onChange={e => onChange({ ...config, withRhat: e.target.checked })}
                        disabled={disabled}
                    />
                    {' '}--with-rhat (requiere Redis)
                </label>
            </div>
        </section>
    );
}
