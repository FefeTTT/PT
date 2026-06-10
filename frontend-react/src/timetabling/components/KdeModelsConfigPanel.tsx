import { useCallback, useEffect, useRef, useState } from 'react';
import {
    KDE_IJ_FIELDS,
    KDE_MODEL_LABELS,
    KDE_UNIFICADO_FIELDS,
    modelosDiferentes,
    type KdeIjParams,
    type KdeModelName,
    type KdeModelsConfig,
    type KdeUnificadoParams,
} from '../dtos/kdeModelsConfig';
import { NumericField } from './KdeConfigPanel';
import styles from './KdeMode.module.css';

export interface KdeModelsConfigPanelProps {
    config: KdeModelsConfig;
    onChange: (next: KdeModelsConfig) => void;
    baseUrl: string;
    disabled?: boolean;
    /** Se llama tras un reentrenamiento exitoso para invalidar el cache de graficas. */
    onRetrained?: () => void;
}

interface ProgressState {
    done: number;
    total: number;
}

export function KdeModelsConfigPanel({ config, onChange, baseUrl, disabled, onRetrained }: KdeModelsConfigPanelProps) {
    // Baseline: con que params se entrenaron los joblibs vigentes (fuente: backend).
    const [trainedConfig, setTrainedConfig] = useState<KdeModelsConfig | null>(null);
    const [baselineError, setBaselineError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<ProgressState | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const hydratedRef = useRef(false);

    useEffect(() => {
        if (hydratedRef.current) return;
        hydratedRef.current = true;
        fetch(`${baseUrl}/admin/kde/config`)
            .then(async res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<KdeModelsConfig>;
            })
            .then(cfg => setTrainedConfig(cfg))
            .catch(e => setBaselineError(String(e?.message ?? e)));
    }, [baseUrl]);

    const updateIj = (key: keyof KdeIjParams, v: number) =>
        onChange({ ...config, kde_ij: { ...config.kde_ij, [key]: v } });
    const updateUnif = (key: keyof KdeUnificadoParams, v: number) =>
        onChange({ ...config, kde_unificado: { ...config.kde_unificado, [key]: v } });

    // Modelos cuyos params editados difieren del baseline entrenado.
    const dirty: KdeModelName[] = trainedConfig ? modelosDiferentes(config, trainedConfig) : [];

    const retrain = useCallback(async () => {
        setBusy(true);
        setError(null);
        setLog([]);
        setProgress({ done: 0, total: dirty.length });
        try {
            const res = await fetch(`${baseUrl}/admin/kde/retrain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try {
                    const j = await res.json();
                    if (j?.error) msg = j.error;
                } catch { /* cuerpo no-JSON */ }
                setError(msg);
                return;
            }

            const contentType = res.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
                // "sin_cambios": no hubo nada que reentrenar.
                setTrainedConfig(config);
                setProgress(null);
                onRetrained?.();
                return;
            }

            if (!res.body) {
                setError('El backend no devolvio un stream de progreso.');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let total = dirty.length;
            let failed = false;

            const procesarLinea = (linea: string) => {
                const txt = linea.trim();
                if (!txt) return;
                let ev: any;
                try {
                    ev = JSON.parse(txt);
                } catch {
                    return;
                }
                if (typeof ev.total === 'number') total = ev.total;
                if (ev.error) {
                    setError(`${ev.modelo ?? 'KDE'}: ${ev.error}`);
                    failed = true;
                    return;
                }
                const done = typeof ev.indice === 'number' ? ev.indice : 0;
                setProgress({ done, total });
                const label = KDE_MODEL_LABELS[ev.modelo as KdeModelName] ?? ev.modelo;
                setLog(prev => [...prev, `${label} ✓ (${done}/${total})`]);
            };

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { value, done: streamDone } = await reader.read();
                if (streamDone) break;
                buffer += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = buffer.indexOf('\n')) >= 0) {
                    procesarLinea(buffer.slice(0, nl));
                    buffer = buffer.slice(nl + 1);
                }
                if (failed) break;
            }
            if (buffer.trim()) procesarLinea(buffer);

            if (!failed) {
                // Exito: el baseline pasa a ser la config actual (limpia los botones).
                setTrainedConfig(config);
                onRetrained?.();
            }
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setBusy(false);
        }
    }, [baseUrl, config, dirty.length, onRetrained]);

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Modelos KDE (graficas / joblibs)</h2>

            <h3 style={{ margin: '4px 0', color: '#182023' }}>{KDE_MODEL_LABELS.kde_ij} — modelo_kde_ij.joblib</h3>
            <div className={styles.configGrid}>
                {KDE_IJ_FIELDS.map(f => (
                    <NumericField
                        key={f.key}
                        label={f.label}
                        value={config.kde_ij[f.key]}
                        onCommit={v => updateIj(f.key, v)}
                        disabled={disabled || busy}
                    />
                ))}
            </div>

            <h3 style={{ margin: '12px 0 4px', color: '#182023' }}>{KDE_MODEL_LABELS.kde_unificado} — modelo_kde_unificado.joblib</h3>
            <div className={styles.configGrid}>
                {KDE_UNIFICADO_FIELDS.map(f => (
                    <NumericField
                        key={f.key}
                        label={f.label}
                        value={config.kde_unificado[f.key]}
                        onCommit={v => updateUnif(f.key, v)}
                        disabled={disabled || busy}
                    />
                ))}
            </div>

            {baselineError && (
                <div className={styles.statusBox} style={{ borderColor: '#8f2d2d', color: '#8f2d2d' }}>
                    No se pudo leer la config entrenada del backend ({baselineError}). ¿Backend Python arriba?
                </div>
            )}

            {dirty.length > 0 && !busy && (
                <div style={{ marginTop: 10 }}>
                    <button
                        onClick={retrain}
                        disabled={disabled}
                        style={{
                            background: '#f4c20d', color: '#182023', border: '2px solid #182023',
                            borderRadius: 6, padding: '8px 16px', fontWeight: 800, cursor: 'pointer',
                        }}
                    >
                        ⟳ Reentrenamiento requerido: {dirty.map(m => KDE_MODEL_LABELS[m]).join(', ')}
                    </button>
                </div>
            )}

            {busy && progress && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        Reentrenando… {progress.done}/{progress.total} joblibs
                    </div>
                    <div style={{ background: '#e6ddc8', borderRadius: 4, height: 14, overflow: 'hidden', border: '1px solid #182023' }}>
                        <div
                            style={{
                                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                                height: '100%', background: '#1f4d3a', transition: 'width 0.3s',
                            }}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className={styles.statusBox} style={{ borderColor: '#8f2d2d', color: '#8f2d2d', marginTop: 8 }}>
                    ERROR de reentrenamiento: {error}
                </div>
            )}

            {log.length > 0 && (
                <div className={styles.statusBox} style={{ marginTop: 8 }}>
                    {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
            )}
        </section>
    );
}
