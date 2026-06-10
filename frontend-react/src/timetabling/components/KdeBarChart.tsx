import { useMemo } from 'react';
import styles from './KdeMode.module.css';

export interface KdeBarPoint {
    x: number;
    y: number;
}

export interface KdeBarChartProps {
    title: string;
    samples: KdeBarPoint[];
    /** Histogram bin count for the discrete bar layer. Default 14. */
    bins?: number;
    /** Color of the continuous curve line. Default orange (#c77928). */
    lineColor?: string;
    /** Optional axis labels. */
    xLabel?: string;
    yLabel?: string;
}

/**
 * Visualización 1D: histograma discreto (barras) + curva continua de la función
 * evaluada (línea sobre los samples ordenados). Usado para kde_ij, kde_ih y horario
 * unificado de impartición.
 */
export function KdeBarChart({ title, samples, bins = 14, lineColor = '#c77928', xLabel, yLabel }: KdeBarChartProps) {
    const { barData, linePath, xMin, xMax, yMax } = useMemo(() => {
        if (samples.length === 0) {
            return { barData: [], linePath: '', xMin: 0, xMax: 1, yMax: 1 };
        }
        const xs = samples.map(s => s.x);
        const ys = samples.map(s => s.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMax = Math.max(...ys, 0.0001);

        const bw = (xMax - xMin) / bins || 1;
        const buckets = Array.from({ length: bins }, () => ({ sum: 0, count: 0 }));
        for (const s of samples) {
            const idx = Math.min(bins - 1, Math.max(0, Math.floor((s.x - xMin) / bw)));
            buckets[idx].sum += s.y;
            buckets[idx].count += 1;
        }
        const barData = buckets.map((b, i) => ({
            x0: xMin + i * bw,
            x1: xMin + (i + 1) * bw,
            mean: b.count > 0 ? b.sum / b.count : 0,
        }));

        const groupedSamples = new Map<number, { sum: number; count: number }>();
        for (const s of samples) {
            const current = groupedSamples.get(s.x) || { sum: 0, count: 0 };
            groupedSamples.set(s.x, { sum: current.sum + s.y, count: current.count + 1 });
        }
        const sortedSamples = Array.from(groupedSamples.entries())
            .map(([x, data]) => ({ x, y: data.sum / data.count }))
            .sort((a, b) => a.x - b.x);

        const W = 360;
        const H = 110;
        const toX = (x: number) => ((x - xMin) / (xMax - xMin || 1)) * W;
        const toY = (y: number) => H - (y / yMax) * H;
        const linePath = sortedSamples
            .map((s, i) => `${i === 0 ? 'M' : 'L'} ${toX(s.x).toFixed(2)} ${toY(s.y).toFixed(2)}`)
            .join(' ');

        return { barData, linePath, xMin, xMax, yMax };
    }, [samples, bins]);

    const W = 360;
    const H = 110;
    const toX = (x: number) => ((x - xMin) / (xMax - xMin || 1)) * W;
    const toY = (y: number) => H - (y / yMax) * H;

    return (
        <div className={styles.barChart}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                <span>{title}</span>
                <span style={{ color: '#425257', fontWeight: 600 }}>
                    {samples.length} pts · max y={yMax.toFixed(4)}
                </span>
            </div>
            <svg width={W} height={H + 16} style={{ display: 'block', marginTop: 4 }}>
                <rect x={0} y={0} width={W} height={H} fill="#cbd0c8" opacity={0.3} />
                {barData.map((b, i) => {
                    const x = toX(b.x0);
                    const w = Math.max(1, toX(b.x1) - toX(b.x0) - 1);
                    const y = toY(b.mean);
                    return (
                        <rect
                            key={i}
                            x={x}
                            y={y}
                            width={w}
                            height={H - y}
                            fill="#1f4d3a"
                            opacity={0.55}
                        />
                    );
                })}
                {linePath && (
                    <path
                        d={linePath}
                        stroke={lineColor}
                        strokeWidth={2}
                        fill="none"
                    />
                )}
                <text x={4} y={H + 12} fontSize={10} fill="#425257">
                    {xLabel ? `${xLabel}: ` : ''}[{xMin.toFixed(2)}, {xMax.toFixed(2)}]
                </text>
                {yLabel && (
                    <text x={W - 4} y={H + 12} fontSize={10} fill="#425257" textAnchor="end">
                        {yLabel}
                    </text>
                )}
            </svg>
        </div>
    );
}
