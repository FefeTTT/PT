/*
 * EcoDetailPanel — ficha de inspección PERSISTENTE del lado derecho (dirección "Radical"),
 * en look "Taller". Reemplaza el overlay de CandidatoSolucionModal: al seleccionar un ECO en
 * la lista (Balanceado) la ficha se actualiza en sitio, sin perder el contexto de la tabla.
 *
 * Scores (§9.2): el % y la barra de cada kde_ih/ij/plan se colorean con la MISMA campana del
 * pase que la columna % de la lista — asimétrica/dirigida a la cola baja (verde = típico o mejor,
 * amarillo = bajo lo típico, rojo = cola baja). La barra se normaliza min–max ROBUSTO (percentiles
 * 5–95) sobre la población del pase para que las diferencias se vean aunque los scores caigan en 20–35 %.
 *
 * Gráficas KDE: se muestran SIEMPRE las del backend Python (PNG de `/charts/kde/:eco`), que ya
 * traen su título y ejes; si el backend está apagado, se degrada a "No disponible".
 */
import { useEffect, useMemo, useState } from 'react';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { MiniBar, Dot, IconLock, IconPencil, IconCheck } from './atoms';
import {
    tierOf, pct, turnoLabel, scoreColor, scoreBarFill, scoreTier,
    type DomainThresholds, type ScoreStats, type ScoreStatsByKind,
} from '../utils/scoreLens';
import styles from './KdeMode.module.css';

export interface EcoDetailPanelProps {
    eco: number | null;
    ecoNombre?: Record<string, string>;
    /** Mapa clave de UEA → nombre legible (de clave-uea.json). Si falta, se muestra "UEA <clave>". */
    claveUea?: Record<string, string>;
    ueas: CandidateRow[];
    /** Campana por tipo de score (kde_ih/ij/plan) sobre la población del pase. */
    scoreStats?: ScoreStatsByKind;
    baseUrl: string;
    chartsVersion?: number;
    domainThresholds?: DomainThresholds;
    completed?: boolean;
    busy?: boolean;
    onLockAll?: () => void;
    onEdit?: () => void;
    onToggleComplete?: () => void;
}

/** Sube si cambia el render del backend (p. ej. títulos); fuerza refetch del PNG cacheado. */
const CHART_VERSION = 3;

type DetailKind = 'ih' | 'ij' | 'plan';

const KIND_DESC: Record<DetailKind, string> = {
    ih: 'Normalidad de impartición en este horario',
    ij: 'Normalidad de impartición de esta UEA',
    plan: 'Normalidad de esta carga de UEA',
};
const TIER_WORD: Record<'good' | 'mid' | 'bad', string> = {
    good: 'dentro de lo normal',
    mid: 'poco habitual',
    bad: 'atípico',
};

/** Gráfica KDE del backend Python (PNG). El título y los ejes vienen renderizados en la imagen. */
function BackendKdeChart({ baseUrl, eco, tipo, title, chartsVersion }: {
    baseUrl: string; eco: number; tipo: 'ih' | 'ij'; title: string; chartsVersion?: number;
}) {
    const [error, setError] = useState(false);
    const bust = `cv=${CHART_VERSION}${chartsVersion ? `&v=${chartsVersion}` : ''}`;

    // Reintenta al cambiar de ECO / versión de gráficas.
    useEffect(() => { setError(false); }, [baseUrl, eco, tipo, bust]);

    if (error) {
        return <div className={styles.chartFallback}>{title} · No disponible (¿backend Python apagado?)</div>;
    }
    return (
        <img
            src={`${baseUrl}/charts/kde/${eco}?tipo=${tipo}&${bust}`}
            alt={`${title} — ECO ${eco}`}
            loading="lazy"
            onError={() => setError(true)}
            style={{
                width: '100%', height: 'auto', display: 'block',
                background: 'var(--tt-panel)', border: '1px solid var(--tt-line)',
                borderRadius: 'var(--tt-radius-sm)',
            }}
        />
    );
}

function ScoreLensRow({ label, value, kind, stats, thresholds }: {
    label: string; value: number | undefined; kind: DetailKind;
    stats: ScoreStats | null; thresholds?: DomainThresholds;
}) {
    const outOfDomain = tierOf(value, kind, thresholds) === 'dom';
    const color = scoreColor(value, stats);
    const fill = scoreBarFill(value, stats);
    const tier = scoreTier(value, stats);
    const tip = stats
        ? `Campana del pase para ${label}: mediana ${pct(stats.median)}, σ ${pct(stats.sigma)} · rango ${pct(stats.min)}–${pct(stats.max)} (n=${stats.n}). Verde si ≥ mediana − σ/2; amarillo hasta mediana − σ; rojo más abajo. Barra normalizada min–max robusto entre p5 ${pct(stats.p5)} y p95 ${pct(stats.p95)} (recorta colas).`
        : undefined;
    return (
        <div className={styles.scoreLensRow} title={tip}>
            <div className={styles.scoreLensTop}>
                <span className={styles.scoreLensLabel}>{label}</span>
                <span className={styles.scoreLensVal} style={{ color }}>
                    {pct(value)}
                    {outOfDomain && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--tt-bad)', marginLeft: 6 }}>⊘ fuera de dominio</span>}
                </span>
            </div>
            <div style={{ marginTop: 4 }}>
                <MiniBar fill={fill} color={color} width="100%" height={6} />
            </div>
            <div className={styles.scoreLensDesc}>
                {KIND_DESC[kind]} — {outOfDomain ? 'fuera de dominio' : TIER_WORD[tier]}
            </div>
        </div>
    );
}

export function EcoDetailPanel({
    eco, ecoNombre, claveUea, ueas, scoreStats, baseUrl, chartsVersion, domainThresholds, completed, busy,
    onLockAll, onEdit, onToggleComplete,
}: EcoDetailPanelProps) {
    const nombre = eco != null ? ecoNombre?.[String(eco)] : undefined;
    const allLocked = useMemo(() => ueas.length > 0 && ueas.every((u) => u.locked), [ueas]);

    if (eco == null || ueas.length === 0) {
        return (
            <div className={styles.detailCol}>
                <div className={styles.detailPlaceholder}>
                    Selecciona un ECO de la lista para inspeccionar su horario y sus scores.
                </div>
            </div>
        );
    }

    return (
        <div className={styles.detailCol}>
            <div className={styles.detailHead}>
                <span className={styles.detailName}>{nombre ?? `ECO ${eco}`}</span>
                <span className={styles.detailEco}>ECO {eco} · {ueas.length} UEA</span>
                {completed && <span className={styles.ecoBadgeDone}><IconCheck size={10} /> completado</span>}
            </div>

            <div className={styles.detailActions}>
                <button className={`${styles.detailBtn} ${styles.detailBtnPrimary}`} onClick={onLockAll} disabled={busy || allLocked}>
                    <IconLock size={12} /> Asignar todo
                </button>
                <button className={styles.detailBtn} onClick={onEdit} disabled={busy}>
                    <IconPencil size={12} /> Editar
                </button>
                <button className={styles.detailBtn} onClick={onToggleComplete} disabled={busy}>
                    <IconCheck size={12} /> {completed ? 'Reactivar' : 'Marcar completado'}
                </button>
            </div>

            {/* La rejilla semanal se removió: la lista maestra ya muestra el horario por UEA
                (cabecera de día + rangos), así que aquí era redundante. */}

            <div
                className={styles.detailSectionLabel}
                title="Color relativo a la campana del pase (no a umbrales fijos): solo la cola baja se penaliza."
            >
                Scores KDE · campana del pase
            </div>
            <div className={styles.lensLegend}>
                <span className={styles.lensLegendItem}><Dot color="var(--tt-good)" size={8} /> Típico o mejor</span>
                <span className={styles.lensLegendItem}><Dot color="var(--tt-mid)" size={8} /> Bajo lo típico</span>
                <span className={styles.lensLegendItem}><Dot color="var(--tt-bad)" size={8} /> Atípico (cola baja)</span>
            </div>
            {ueas.map((u, i) => (
                <div key={i} className={styles.detailUeaCard}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5 }} title={claveUea?.[String(u.uea)] ?? `UEA ${u.uea}`}>
                            {claveUea?.[String(u.uea)] ?? `UEA ${u.uea}`}
                        </span>
                        <span className={styles.ueaMeta}>
                            {claveUea?.[String(u.uea)] ? `${u.uea} · ` : ''}{u.claveGrupo} · {turnoLabel(u.turno)}
                        </span>
                    </div>
                    <ScoreLensRow label="kde_ih" value={u.kde_ih} kind="ih" stats={scoreStats?.ih ?? null} thresholds={domainThresholds} />
                    <ScoreLensRow label="kde_ij" value={u.kde_ij} kind="ij" stats={scoreStats?.ij ?? null} thresholds={domainThresholds} />
                    <ScoreLensRow label="kde_plan" value={u.kde_plan} kind="plan" stats={scoreStats?.plan ?? null} thresholds={domainThresholds} />
                </div>
            ))}

            <div className={styles.detailSectionLabel}>Gráficas KDE</div>
            <div style={{ display: 'grid', gap: 12 }}>
                <BackendKdeChart baseUrl={baseUrl} eco={eco} tipo="ih" title="Horas en las que ha impartido clase" chartsVersion={chartsVersion} />
                <BackendKdeChart baseUrl={baseUrl} eco={eco} tipo="ij" title="UEAs que ha impartido" chartsVersion={chartsVersion} />
            </div>
        </div>
    );
}
