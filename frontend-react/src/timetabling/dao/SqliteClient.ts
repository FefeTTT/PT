/**
 * Cliente HTTP generico hacia la capa de persistencia SQLite (`/api/db`) servida por el
 * middleware de Vite (`server/sqliteMiddleware.ts`).
 *
 * Usa `fetch` (nativo del navegador) para evitar el overhead de transformacion de axios con
 * payloads grandes (`archivos_requeridos` ~13 MB).
 */

const BASE = '/api/db';

export class SqliteHttpError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'SqliteHttpError';
    }
}

/** GET de una clave de `estado_configuraciones`. Devuelve null en 404. */
export async function getState<T>(clave: string): Promise<T | null> {
    const res = await fetch(`${BASE}/state/${encodeURIComponent(clave)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new SqliteHttpError(res.status, `GET state/${clave} -> ${res.status}`);
    return (await res.json()) as T;
}

/** PUT (upsert) de una clave de `estado_configuraciones`. El valor se serializa como JSON. */
export async function putState(clave: string, value: unknown): Promise<void> {
    const res = await fetch(`${BASE}/state/${encodeURIComponent(clave)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
    });
    if (!res.ok) throw new SqliteHttpError(res.status, `PUT state/${clave} -> ${res.status}`);
}

/** DELETE de una clave de `estado_configuraciones`. */
export async function deleteState(clave: string): Promise<void> {
    const res = await fetch(`${BASE}/state/${encodeURIComponent(clave)}`, { method: 'DELETE' });
    if (!res.ok) throw new SqliteHttpError(res.status, `DELETE state/${clave} -> ${res.status}`);
}

/** GET arbitrario que devuelve JSON, o null en 404. */
export async function getJson<T>(pathSuffix: string): Promise<T | null> {
    const res = await fetch(`${BASE}${pathSuffix}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new SqliteHttpError(res.status, `GET ${pathSuffix} -> ${res.status}`);
    return (await res.json()) as T;
}

/** PUT/POST arbitrario con cuerpo JSON. */
export async function sendJson<T>(
    pathSuffix: string,
    method: 'PUT' | 'POST' | 'DELETE',
    body?: unknown,
): Promise<T> {
    const res = await fetch(`${BASE}${pathSuffix}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new SqliteHttpError(res.status, `${method} ${pathSuffix} -> ${res.status}`);
    return (await res.json()) as T;
}
