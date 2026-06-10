/*
 * useSolutionHistory — lista los auto-guardados (snapshots) navegables por estampa de tiempo,
 * para la pieza Eje 3 "Deshacer + historial". El restaurar ("Volver aquí") lo implementa
 * KdeMode (tiene los setters de estado); aquí solo se listan y se refrescan.
 */
import { useCallback, useEffect, useState } from 'react';
import { SnapshotDAO, type SnapshotMetaDTO } from '../dao/SnapshotDAO';

export function useSolutionHistory(limit = 50) {
    const [snapshots, setSnapshots] = useState<SnapshotMetaDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setSnapshots(await SnapshotDAO.list(limit));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { snapshots, loading, error, refresh };
}
