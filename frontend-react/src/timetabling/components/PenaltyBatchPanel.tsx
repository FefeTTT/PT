import { useCallback, useMemo, useState } from 'react';
import type { BackendConfigDTO, WorkspaceDTO } from '../dtos';
import { useScoreBatchApi, type ScoreBatchResponse, type ScoreBatchResultRow } from '../hooks/useScoreBatchApi';
import { buildPenaltyCandidates, type PenaltyBatchItem } from '../utils/buildPenaltyCandidates';
import styles from './KdeMode.module.css';

export interface PenaltyBatchPanelProps {
    workspace: WorkspaceDTO | undefined;
    config: BackendConfigDTO;
    ecoNombre: Record<string, string>;
}

interface ResultRow {
    id: string;
    eco: string;
    uea: string;
    horario: string;
    totalPenalty: number;
    loadProbability?: number;
    projectedUeaCount?: number;
}

const DEFAULT_MAX_PER_ECO = 0;
const DEFAULT_MAX_TOTAL = 4096;
const HARD_BACKEND_LIMIT = 4096;

export function PenaltyBatchPanel({ workspace, config, ecoNombre }: PenaltyBatchPanelProps) {
    const batchApi = useScoreBatchApi(config);
    const [maxPerEco, setMaxPerEco] = useState<number>(DEFAULT_MAX_PER_ECO);
    const [maxTotal, setMaxTotal] = useState<number>(DEFAULT_MAX_TOTAL);
    const [chunkSize, setChunkSize] = useState<number>(2048);
    const [filterEco, setFilterEco] = useState<string>('');
    const [items, setItems] = useState<PenaltyBatchItem[]>([]);
    const [resultsByEco, setResultsByEco] = useState<Map<string, ResultRow[]>>(new Map());
    const [lastSummary, setLastSummary] = useState<{ batches: number; results: number; errors: number; redisWrites: number; redisAvailable: boolean } | null>(null);

    const handleBuild = useCallback(() => {
        if (!workspace) return;
        const targetEcos = filterEco.trim()
            ? new Set(filterEco.split(',').map((s) => Number(s.trim())).filter(Number.isFinite))
            : undefined;
        const result = buildPenaltyCandidates(workspace, {
            maxCandidatesPerEco: maxPerEco > 0 ? maxPerEco : undefined,
            maxTotal: maxTotal > 0 ? maxTotal : 0,
            targetEcos,
        });
        setItems(result.items);
    }, [workspace, maxPerEco, maxTotal, filterEco]);

    const handleSubmit = useCallback(async () => {
        if (items.length === 0) return;
        const cs = Math.min(Math.max(chunkSize, 1), HARD_BACKEND_LIMIT);
        const grouped = new Map<string, ResultRow[]>();
        let totalResults = 0;
        let totalErrors = 0;
        let redisWrites = 0;
        let redisAvailable = false;
        let batches = 0;

        for (let i = 0; i < items.length; i += cs) {
            const slice = items.slice(i, i + cs);
            const response: ScoreBatchResponse = await batchApi.submit({
                model: 'penalty',
                items: slice,
                session_id: `timetabling-penalty-batch-${Date.now()}`,
            });
            batches++;
            redisAvailable = response.redis.available;
            redisWrites += response.redis.writes;
            totalErrors += response.errors.length;

            for (const row of response.results) {
                const mapped = mapResultRow(row, slice);
                if (!mapped) continue;
                totalResults++;
                const arr = grouped.get(mapped.eco) ?? [];
                arr.push(mapped);
                grouped.set(mapped.eco, arr);
            }
        }
        for (const arr of grouped.values()) {
            arr.sort((a, b) => b.totalPenalty - a.totalPenalty);
        }
        setResultsByEco(grouped);
        setLastSummary({ batches, results: totalResults, errors: totalErrors, redisWrites, redisAvailable });
    }, [batchApi, items, chunkSize]);

    const ecoSummary = useMemo(() => {
        const list = Array.from(resultsByEco.entries()).map(([eco, rows]) => ({
            eco,
            nombre: ecoNombre[eco] ?? `Eco ${eco}`,
            count: rows.length,
            top: rows[0],
        }));
        list.sort((a, b) => (b.top?.totalPenalty ?? -Infinity) - (a.top?.totalPenalty ?? -Infinity));
        return list;
    }, [resultsByEco, ecoNombre]);

    const ready = Boolean(workspace);

    return (
        <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Penalty backend (batch)</h2>

            <div className={styles.configGrid}>
                <div className={styles.field}>
                    <label>Max candidatos / eco (0 = sin limite)</label>
                    <input type="number" min={0} value={maxPerEco} onChange={(e) => setMaxPerEco(Number(e.target.value) || 0)} />
                </div>
                <div className={styles.field}>
                    <label>Max total candidatos (0 = sin limite)</label>
                    <input type="number" min={0} value={maxTotal} onChange={(e) => setMaxTotal(Number(e.target.value) || 0)} />
                </div>
                <div className={styles.field}>
                    <label>Chunk size HTTP (&lt;= {HARD_BACKEND_LIMIT})</label>
                    <input type="number" min={1} max={HARD_BACKEND_LIMIT} value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value) || 1)} />
                </div>
                <div className={styles.field}>
                    <label>Filtrar ecos (CSV, opcional)</label>
                    <input type="text" placeholder="19834,28650,14416" value={filterEco} onChange={(e) => setFilterEco(e.target.value)} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={handleBuild}
                    disabled={!ready}
                    style={{ background: '#1f4d3a', color: '#f8f4ea', border: '2px solid #182023', borderRadius: 6, padding: '8px 14px', fontWeight: 800, cursor: ready ? 'pointer' : 'not-allowed' }}
                >
                    Construir candidatos
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={items.length === 0 || batchApi.loading}
                    style={{ background: '#c77928', color: '#f8f4ea', border: '2px solid #182023', borderRadius: 6, padding: '8px 14px', fontWeight: 800, cursor: items.length === 0 || batchApi.loading ? 'not-allowed' : 'pointer' }}
                >
                    {batchApi.loading ? 'Enviando...' : `Enviar al backend (${items.length})`}
                </button>
            </div>

            {batchApi.error && (
                <div style={{ marginTop: 10, color: '#8f2d2d', fontWeight: 700 }}>
                    ERROR: {batchApi.error}
                </div>
            )}

            {lastSummary && (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <strong>Batches:</strong> {lastSummary.batches}{' '}
                    | <strong>Resultados:</strong> {lastSummary.results}{' '}
                    | <strong>Errores:</strong> {lastSummary.errors}{' '}
                    | <strong>Redis:</strong> {lastSummary.redisAvailable ? `${lastSummary.redisWrites} writes` : 'offline'}
                </div>
            )}

            {ecoSummary.length > 0 && (
                <div style={{ marginTop: 14, maxHeight: 360, overflowY: 'auto', border: '2px solid #182023', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: '#1f4d3a', color: '#f8f4ea', position: 'sticky', top: 0 }}>
                                <th style={th}>Eco</th>
                                <th style={th}>Nombre</th>
                                <th style={th}># Cand.</th>
                                <th style={th}>Mejor UEA</th>
                                <th style={th}>Mejor horario</th>
                                <th style={th}>Top penalty</th>
                                <th style={th}>Load prob.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ecoSummary.map((row) => (
                                <tr key={row.eco} style={{ borderBottom: '1px solid #182023' }}>
                                    <td style={td}>{row.eco}</td>
                                    <td style={td}>{row.nombre}</td>
                                    <td style={td}>{row.count}</td>
                                    <td style={td}>{row.top?.uea ?? '-'}</td>
                                    <td style={td}>{row.top?.horario ?? '-'}</td>
                                    <td style={td}>{row.top?.totalPenalty.toFixed(4) ?? '-'}</td>
                                    <td style={td}>{row.top?.loadProbability?.toFixed(3) ?? '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function mapResultRow(row: ScoreBatchResultRow, batch: PenaltyBatchItem[]): ResultRow | null {
    const item = batch.find((c) => c.id === row.id);
    if (!item) return null;
    const score = row.score as {
        total_penalty?: unknown;
        load_probability?: unknown;
        projected_uea_count?: unknown;
    };
    if (typeof score.total_penalty !== 'number' || !Number.isFinite(score.total_penalty)) return null;
    return {
        id: row.id,
        eco: item.eco,
        uea: item.uea,
        horario: item.horario,
        totalPenalty: score.total_penalty,
        loadProbability: typeof score.load_probability === 'number' ? score.load_probability : undefined,
        projectedUeaCount: typeof score.projected_uea_count === 'number' ? score.projected_uea_count : undefined,
    };
}

const th: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', fontWeight: 800 };
const td: React.CSSProperties = { padding: '4px 8px' };
