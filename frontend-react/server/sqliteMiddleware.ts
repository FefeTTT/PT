import path from 'path';
import fs from 'fs';
import type { Connect, Plugin } from 'vite';
import Database from 'better-sqlite3';

/**
 * Plugin de Vite que expone una capa de persistencia SQLite bajo `/api/db`.
 *
 * Reemplaza el almacenamiento volátil (localStorage / IndexedDB / useState) por una base
 * SQLite en disco (`.data/timetabling.sqlite`) que sobrevive al refresh del navegador y al
 * reinicio del servidor de Vite.
 *
 * Espejo del patrón `redis-mget-proxy` ya presente en `vite.config.ts`.
 *
 * Endpoints:
 *   GET    /api/db/state/:clave                -> fila de estado_configuraciones (o 404)
 *   PUT    /api/db/state/:clave                -> upsert estado_configuraciones
 *   GET    /api/db/solution/current            -> EstadoSolucion + candidatos
 *   PUT    /api/db/solution/current            -> upsert EstadoSolucion + candidatos (+catálogo)
 *   DELETE /api/db/solution/current            -> borra el snapshot 'current'
 *   POST   /api/db/solution/pass               -> inserta/replace en historial_pases
 *   GET    /api/db/catalogo                    -> todas las filas de catalogo_grupo
 *   PUT    /api/db/catalogo                    -> upsertMany catalogo_grupo
 *   POST   /api/db/solution/snapshot           -> auto-guarda un snapshot completo navegable
 *   GET    /api/db/solution/snapshots?limit=N  -> lista snapshots por timestamp (metadatos)
 *   GET    /api/db/solution/snapshot/:id        -> carga un snapshot completo (para restaurar)
 *   GET    /api/db/health                        -> sonda de salud { ok: true }
 */

const SOLUTION_ID = 'current';
const MAX_BODY_BYTES = 64 * 1024 * 1024; // 64 MB (archivos_requeridos ~13 MB)
const SNAPSHOT_KEEP = 100; // auto-guardado: conserva los últimos N snapshots

function getDb(dataDir: string): Database.Database {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'timetabling.sqlite');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    crearEsquema(db);
    return db;
}

function crearEsquema(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS estado_configuraciones (
            clave TEXT PRIMARY KEY,
            json TEXT NOT NULL,
            actualizado_en INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS catalogo_grupo (
            id_uea_grupo     INTEGER PRIMARY KEY,
            uea_clave        INTEGER NOT NULL,
            clave_grupo      TEXT    NOT NULL,
            id_area          TEXT,
            horario_raw      TEXT,
            horario_canonico TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS estado_solucion (
            id                   TEXT PRIMARY KEY,
            pase                 INTEGER NOT NULL,
            config_grasp         TEXT    NOT NULL,
            grafo_bipartito_json TEXT    NOT NULL,
            convergio            INTEGER NOT NULL,
            actualizado_en       INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS candidato_solucion (
            estado_solucion_id TEXT    NOT NULL,
            cache_key          TEXT    NOT NULL,
            numero_economico   INTEGER NOT NULL,
            id_uea_grupo       INTEGER NOT NULL,
            turno              TEXT,
            score              REAL,
            kde_ij             REAL,
            kde_ih             REAL,
            kde_plan           REAL,
            z_base             REAL,
            bloqueado          INTEGER NOT NULL,
            indice_pase        INTEGER NOT NULL,
            PRIMARY KEY (estado_solucion_id, cache_key)
        );

        CREATE TABLE IF NOT EXISTS historial_pases (
            estado_solucion_id TEXT    NOT NULL,
            pase               INTEGER NOT NULL,
            resumen            TEXT    NOT NULL,
            diff               TEXT,
            creado_en          INTEGER NOT NULL,
            PRIMARY KEY (estado_solucion_id, pase)
        );

        -- Auto-guardado: cada fila es un snapshot COMPLETO y autocontenido del estado
        -- de la solución, navegable por estampa de tiempo (no es un log de acciones).
        CREATE TABLE IF NOT EXISTS historial_snapshots (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  INTEGER NOT NULL,
            configs    TEXT    NOT NULL,
            locked     TEXT    NOT NULL,
            unlocked   TEXT    NOT NULL,
            finishes   TEXT    NOT NULL,
            pase       INTEGER NOT NULL,
            convergio  INTEGER NOT NULL,
            grafo      TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON historial_snapshots (timestamp DESC);
    `);
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Body demasiado grande'));
                req.destroy();
                return;
            }
            body += chunk;
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function sendJson(res: Connect.ServerResponse, status: number, payload: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
}

interface CandidatoSolucionRow {
    cacheKey: string;
    numeroEconomico: number;
    idUeaGrupo: number;
    turno?: string | null;
    score?: number | null;
    kde_ij?: number | null;
    kde_ih?: number | null;
    kde_plan?: number | null;
    zBase?: number | null;
    bloqueado: boolean;
    indicePase: number;
}

interface CatalogoGrupoRow {
    idUeaGrupo: number;
    ueaClave: number;
    claveGrupo: string;
    idArea?: string | null;
    horarioRaw?: string | null;
    horarioCanonico: string;
}

interface EstadoSolucionPayload {
    pase: number;
    convergio: boolean;
    configGrasp: unknown;
    grafo: unknown;
    candidatos: CandidatoSolucionRow[];
    catalogo?: CatalogoGrupoRow[];
}

function upsertCatalogo(db: Database.Database, catalogo: CatalogoGrupoRow[]): void {
    const stmt = db.prepare(`
        INSERT INTO catalogo_grupo
            (id_uea_grupo, uea_clave, clave_grupo, id_area, horario_raw, horario_canonico)
        VALUES (@idUeaGrupo, @ueaClave, @claveGrupo, @idArea, @horarioRaw, @horarioCanonico)
        ON CONFLICT(id_uea_grupo) DO UPDATE SET
            uea_clave = excluded.uea_clave,
            clave_grupo = excluded.clave_grupo,
            id_area = excluded.id_area,
            horario_raw = excluded.horario_raw,
            horario_canonico = excluded.horario_canonico
    `);
    const tx = db.transaction((rows: CatalogoGrupoRow[]) => {
        for (const r of rows) {
            stmt.run({
                idUeaGrupo: r.idUeaGrupo,
                ueaClave: r.ueaClave,
                claveGrupo: r.claveGrupo,
                idArea: r.idArea ?? null,
                horarioRaw: r.horarioRaw ?? null,
                horarioCanonico: r.horarioCanonico,
            });
        }
    });
    tx(catalogo);
}

function readCatalogo(db: Database.Database): CatalogoGrupoRow[] {
    const rows = db.prepare(`
        SELECT id_uea_grupo AS idUeaGrupo, uea_clave AS ueaClave, clave_grupo AS claveGrupo,
               id_area AS idArea, horario_raw AS horarioRaw, horario_canonico AS horarioCanonico
        FROM catalogo_grupo
    `).all();
    return rows as CatalogoGrupoRow[];
}

function saveSolution(db: Database.Database, payload: EstadoSolucionPayload): void {
    const now = Date.now();
    const tx = db.transaction(() => {
        db.prepare(`
            INSERT INTO estado_solucion
                (id, pase, config_grasp, grafo_bipartito_json, convergio, actualizado_en)
            VALUES (@id, @pase, @configGrasp, @grafo, @convergio, @now)
            ON CONFLICT(id) DO UPDATE SET
                pase = excluded.pase,
                config_grasp = excluded.config_grasp,
                grafo_bipartito_json = excluded.grafo_bipartito_json,
                convergio = excluded.convergio,
                actualizado_en = excluded.actualizado_en
        `).run({
            id: SOLUTION_ID,
            pase: payload.pase,
            configGrasp: JSON.stringify(payload.configGrasp ?? {}),
            grafo: JSON.stringify(payload.grafo ?? {}),
            convergio: payload.convergio ? 1 : 0,
            now,
        });

        if (payload.catalogo && payload.catalogo.length > 0) {
            upsertCatalogo(db, payload.catalogo);
        }

        db.prepare('DELETE FROM candidato_solucion WHERE estado_solucion_id = ?').run(SOLUTION_ID);
        const insCand = db.prepare(`
            INSERT INTO candidato_solucion
                (estado_solucion_id, cache_key, numero_economico, id_uea_grupo, turno,
                 score, kde_ij, kde_ih, kde_plan, z_base, bloqueado, indice_pase)
            VALUES (@sid, @cacheKey, @numeroEconomico, @idUeaGrupo, @turno,
                    @score, @kde_ij, @kde_ih, @kde_plan, @zBase, @bloqueado, @indicePase)
        `);
        for (const c of payload.candidatos ?? []) {
            insCand.run({
                sid: SOLUTION_ID,
                cacheKey: c.cacheKey,
                numeroEconomico: c.numeroEconomico,
                idUeaGrupo: c.idUeaGrupo,
                turno: c.turno ?? null,
                score: c.score ?? null,
                kde_ij: c.kde_ij ?? null,
                kde_ih: c.kde_ih ?? null,
                kde_plan: c.kde_plan ?? null,
                zBase: c.zBase ?? null,
                bloqueado: c.bloqueado ? 1 : 0,
                indicePase: c.indicePase,
            });
        }
    });
    tx();
}

function loadSolution(db: Database.Database): (EstadoSolucionPayload & { actualizadoEn: number }) | null {
    const head = db.prepare(`
        SELECT pase, config_grasp AS configGrasp, grafo_bipartito_json AS grafo,
               convergio, actualizado_en AS actualizadoEn
        FROM estado_solucion WHERE id = ?
    `).get(SOLUTION_ID) as
        | { pase: number; configGrasp: string; grafo: string; convergio: number; actualizadoEn: number }
        | undefined;
    if (!head) return null;

    const candRows = db.prepare(`
        SELECT cache_key AS cacheKey, numero_economico AS numeroEconomico,
               id_uea_grupo AS idUeaGrupo, turno, score, kde_ij, kde_ih, kde_plan,
               z_base AS zBase, bloqueado, indice_pase AS indicePase
        FROM candidato_solucion WHERE estado_solucion_id = ?
    `).all(SOLUTION_ID) as Array<Omit<CandidatoSolucionRow, 'bloqueado'> & { bloqueado: number }>;

    return {
        pase: head.pase,
        convergio: head.convergio === 1,
        configGrasp: JSON.parse(head.configGrasp),
        grafo: JSON.parse(head.grafo),
        candidatos: candRows.map((c) => ({ ...c, bloqueado: c.bloqueado === 1 })),
        catalogo: readCatalogo(db),
        actualizadoEn: head.actualizadoEn,
    };
}

interface SnapshotPayload {
    configs: unknown;          // KdeWorkerConfig
    locked: unknown[];         // candidatos bloqueados (datos completos)
    unlocked: unknown[];       // candidatos libres (datos completos)
    finishes: number[];        // ECOs completados
    pase: number;
    convergio: boolean;
    grafo: unknown;            // grafo bipartito
}

function insertSnapshot(db: Database.Database, p: SnapshotPayload): { id: number; timestamp: number } {
    const timestamp = Date.now();
    const tx = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO historial_snapshots
                (timestamp, configs, locked, unlocked, finishes, pase, convergio, grafo)
            VALUES (@timestamp, @configs, @locked, @unlocked, @finishes, @pase, @convergio, @grafo)
        `).run({
            timestamp,
            configs: JSON.stringify(p.configs ?? {}),
            locked: JSON.stringify(p.locked ?? []),
            unlocked: JSON.stringify(p.unlocked ?? []),
            finishes: JSON.stringify(p.finishes ?? []),
            pase: p.pase ?? 0,
            convergio: p.convergio ? 1 : 0,
            grafo: JSON.stringify(p.grafo ?? {}),
        });
        // Poda: conserva sólo los últimos SNAPSHOT_KEEP (auto-guardado acotado).
        db.prepare(`
            DELETE FROM historial_snapshots
            WHERE id NOT IN (
                SELECT id FROM historial_snapshots ORDER BY timestamp DESC, id DESC LIMIT ?
            )
        `).run(SNAPSHOT_KEEP);
        return Number(info.lastInsertRowid);
    });
    const id = tx();
    return { id, timestamp };
}

function listSnapshots(db: Database.Database, limit: number): unknown[] {
    return db.prepare(`
        SELECT id, timestamp, pase, convergio,
               json_array_length(locked)   AS lockedCount,
               json_array_length(unlocked) AS unlockedCount,
               json_array_length(finishes) AS finishesCount
        FROM historial_snapshots
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
    `).all(limit).map((r: any) => ({ ...r, convergio: r.convergio === 1 }));
}

function loadSnapshot(db: Database.Database, id: number): Record<string, unknown> | null {
    const row = db.prepare(`
        SELECT id, timestamp, configs, locked, unlocked, finishes, pase, convergio, grafo
        FROM historial_snapshots WHERE id = ?
    `).get(id) as
        | { id: number; timestamp: number; configs: string; locked: string; unlocked: string;
            finishes: string; pase: number; convergio: number; grafo: string }
        | undefined;
    if (!row) return null;
    return {
        id: row.id,
        timestamp: row.timestamp,
        configs: JSON.parse(row.configs),
        locked: JSON.parse(row.locked),
        unlocked: JSON.parse(row.unlocked),
        finishes: JSON.parse(row.finishes),
        pase: row.pase,
        convergio: row.convergio === 1,
        grafo: JSON.parse(row.grafo),
    };
}

export function sqlitePersistencePlugin(): Plugin {
    let db: Database.Database | null = null;
    let dataDir = '';

    return {
        name: 'sqlite-persistence',
        configResolved(config) {
            dataDir = path.resolve(config.root, '.data');
        },
        configureServer(server) {
            db = getDb(dataDir);
            const database = db;

            server.middlewares.use('/api/db', async (req, res) => {
                try {
                    const url = new URL(req.url ?? '', 'http://localhost');
                    const segments = url.pathname.split('/').filter(Boolean); // ['state', ':clave'] etc.
                    const method = (req.method ?? 'GET').toUpperCase();

                    // ---- estado_configuraciones: /state/:clave ----
                    if (segments[0] === 'state' && segments[1]) {
                        const clave = decodeURIComponent(segments[1]);
                        if (method === 'GET') {
                            const row = database.prepare(
                                'SELECT json FROM estado_configuraciones WHERE clave = ?'
                            ).get(clave) as { json: string } | undefined;
                            if (!row) { sendJson(res, 404, { error: 'not_found', clave }); return; }
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(row.json); // ya es JSON serializado
                            return;
                        }
                        if (method === 'PUT') {
                            const body = await readBody(req);
                            database.prepare(`
                                INSERT INTO estado_configuraciones (clave, json, actualizado_en)
                                VALUES (?, ?, ?)
                                ON CONFLICT(clave) DO UPDATE SET
                                    json = excluded.json, actualizado_en = excluded.actualizado_en
                            `).run(clave, body, Date.now());
                            sendJson(res, 200, { ok: true, clave });
                            return;
                        }
                        if (method === 'DELETE') {
                            database.prepare('DELETE FROM estado_configuraciones WHERE clave = ?').run(clave);
                            sendJson(res, 200, { ok: true, clave });
                            return;
                        }
                    }

                    // ---- estado_solucion: /solution/current ----
                    if (segments[0] === 'solution' && segments[1] === 'current') {
                        if (method === 'GET') {
                            const sol = loadSolution(database);
                            if (!sol) { sendJson(res, 404, { error: 'not_found' }); return; }
                            sendJson(res, 200, sol);
                            return;
                        }
                        if (method === 'PUT') {
                            const body = await readBody(req);
                            const payload = JSON.parse(body) as EstadoSolucionPayload;
                            saveSolution(database, payload);
                            sendJson(res, 200, { ok: true });
                            return;
                        }
                        if (method === 'DELETE') {
                            const tx = database.transaction(() => {
                                database.prepare('DELETE FROM candidato_solucion WHERE estado_solucion_id = ?').run(SOLUTION_ID);
                                database.prepare('DELETE FROM historial_pases WHERE estado_solucion_id = ?').run(SOLUTION_ID);
                                database.prepare('DELETE FROM estado_solucion WHERE id = ?').run(SOLUTION_ID);
                            });
                            tx();
                            sendJson(res, 200, { ok: true });
                            return;
                        }
                    }

                    // ---- historial_pases: /solution/pass ----
                    if (segments[0] === 'solution' && segments[1] === 'pass' && method === 'POST') {
                        const body = await readBody(req);
                        const { pase, resumen, diff } = JSON.parse(body) as
                            { pase: number; resumen: unknown; diff?: unknown };
                        database.prepare(`
                            INSERT INTO historial_pases (estado_solucion_id, pase, resumen, diff, creado_en)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(estado_solucion_id, pase) DO UPDATE SET
                                resumen = excluded.resumen, diff = excluded.diff, creado_en = excluded.creado_en
                        `).run(
                            SOLUTION_ID, pase, JSON.stringify(resumen ?? {}),
                            diff != null ? JSON.stringify(diff) : null, Date.now(),
                        );
                        sendJson(res, 200, { ok: true, pase });
                        return;
                    }

                    // ---- historial_snapshots: /solution/snapshots (lista) ----
                    if (segments[0] === 'solution' && segments[1] === 'snapshots' && method === 'GET') {
                        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 50));
                        sendJson(res, 200, listSnapshots(database, limit));
                        return;
                    }

                    // ---- historial_snapshots: /solution/snapshot (auto-guardar / restaurar) ----
                    if (segments[0] === 'solution' && segments[1] === 'snapshot') {
                        if (method === 'POST' && !segments[2]) {
                            const body = await readBody(req);
                            const payload = JSON.parse(body) as SnapshotPayload;
                            const meta = insertSnapshot(database, payload);
                            sendJson(res, 200, { ok: true, ...meta });
                            return;
                        }
                        if (method === 'GET' && segments[2]) {
                            const snap = loadSnapshot(database, Number(segments[2]));
                            if (!snap) { sendJson(res, 404, { error: 'not_found', id: segments[2] }); return; }
                            sendJson(res, 200, snap);
                            return;
                        }
                    }

                    // ---- sonda de salud: /health ----
                    if (segments[0] === 'health' && method === 'GET') {
                        sendJson(res, 200, { ok: true });
                        return;
                    }

                    // ---- catalogo_grupo: /catalogo ----
                    if (segments[0] === 'catalogo') {
                        if (method === 'GET') {
                            sendJson(res, 200, readCatalogo(database));
                            return;
                        }
                        if (method === 'PUT') {
                            const body = await readBody(req);
                            const rows = JSON.parse(body) as CatalogoGrupoRow[];
                            upsertCatalogo(database, rows);
                            sendJson(res, 200, { ok: true, count: rows.length });
                            return;
                        }
                    }

                    sendJson(res, 404, { error: 'ruta_no_encontrada', path: url.pathname, method });
                } catch (e) {
                    sendJson(res, 500, { error: String(e) });
                }
            });
        },
        closeBundle() {
            if (db) { db.close(); db = null; }
        },
    };
}
