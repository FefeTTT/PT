/*
 * useSaveStatus — estado de guardado VISIBLE (pieza Eje 3).
 *
 * Hoy las escrituras de los DAO fallan en silencio (`console.warn`). Este contexto envuelve
 * esas operaciones y expone idle|saving|saved|error + retry(). El proveedor vive en el shell
 * (TimetablingApp) para que el chip del topbar lo lea, y los descendientes (KdeMode) llamen a
 * `track()` sin prop-threading.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
    state: SaveState;
    lastSavedAt: number | null;
    error: string | null;
}

export interface SaveStatusApi {
    status: SaveStatus;
    /** Ejecuta una escritura mostrando saving→saved/error. No relanza (registra el error). */
    track: <T>(op: () => Promise<T>) => Promise<T | undefined>;
    /** Reintenta la última operación que falló. */
    retry: () => void;
}

const IDLE: SaveStatus = { state: 'idle', lastSavedAt: null, error: null };

const SaveStatusContext = createContext<SaveStatusApi | null>(null);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<SaveStatus>(IDLE);
    const lastOp = useRef<(() => Promise<unknown>) | null>(null);

    const track = useCallback(async <T,>(op: () => Promise<T>): Promise<T | undefined> => {
        lastOp.current = op;
        setStatus((s) => ({ ...s, state: 'saving', error: null }));
        try {
            const result = await op();
            setStatus({ state: 'saved', lastSavedAt: Date.now(), error: null });
            return result;
        } catch (e) {
            setStatus((s) => ({
                ...s,
                state: 'error',
                error: e instanceof Error ? e.message : String(e),
            }));
            console.warn('[useSaveStatus] guardado fallido:', e);
            return undefined;
        }
    }, []);

    const retry = useCallback(() => {
        if (lastOp.current) void track(lastOp.current);
    }, [track]);

    const api = useMemo<SaveStatusApi>(() => ({ status, track, retry }), [status, track, retry]);
    return <SaveStatusContext.Provider value={api}>{children}</SaveStatusContext.Provider>;
}

/**
 * Devuelve el API de guardado. Si no hay proveedor (p.ej. tests aislados), degrada a un
 * `track` que ejecuta la operación sin reportar estado.
 */
export function useSaveStatus(): SaveStatusApi {
    const ctx = useContext(SaveStatusContext);
    if (ctx) return ctx;
    return {
        status: IDLE,
        track: async (op) => {
            try { return await op(); } catch (e) { console.warn('[useSaveStatus] sin proveedor:', e); return undefined; }
        },
        retry: () => {},
    };
}
