import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import { GrafoBipartito } from '@solution/models/GrafoBipartito';
import { canonicalizeHorario } from '@solution/ml/CacheKeys';
import type { KdeWorkerConfig, KdeWorkerResult, KdeWorkerSummary } from '../engine/kde/graspKdeTypes';
import type { CandidateRow, CandidateRowMetadata } from '../engine/kde/candidateRow';
import type { IterativeRunState } from '../engine/kde/runKdeGraspIterative';

/**
 * DTOs/serializadores para persistir el estado del grafo bipartito de la solucion
 * (la tabla "CANDIDATOS DE LA SOLUCION") en SQLite y rehidratarlo como `grafoInicial`
 * del GRASP.
 *
 * El `cacheKey` de cada candidato se construye `{eco}:{uea}:{horario_canonico}` reutilizando
 * `canonicalizeHorario` (CacheKeys.ts), de modo que casa 1:1 con `sijhKey`/`kdeKey` del cache
 * de Redis del GRASP.
 */

// ---------------------------------------------------------------------------
// Tipos DTO
// ---------------------------------------------------------------------------

/** DTO con tipo compatible con el GRASP que serializa un `GrafoBipartito`. */
export interface GrafoBipartitoDTO {
    profesores: ProfesorDTO[];
    grupos: GrupoDTO[];
    adyacencias: { numeroEconomico: number; idUeaGrupo: number[] }[];
    asignacionesInversas: { idUeaGrupo: number; numeroEconomico: number }[];
}

/** Catalogo intermedio id_uea_grupo -> (uea, grupo, horario canonico). */
export interface CatalogoGrupoDTO {
    idUeaGrupo: number;
    ueaClave: number;
    claveGrupo: string;
    idArea?: string | null;
    horarioRaw?: string | null;
    horarioCanonico: string;
}

/** Serializacion plana de un `CandidateRow` + `cacheKey` canonico para Redis. */
export interface CandidatoSolucionDTO {
    cacheKey: string;
    numeroEconomico: number;
    idUeaGrupo: number;
    turno?: string | null;
    score?: number | null;
    kde_ij?: number | null;
    kde_ih?: number | null;
    kde_ih_raw?: number | null;
    kde_plan?: number | null;
    zBase?: number | null;
    bloqueado: boolean;
    indicePase: number;
    metadata?: CandidateRowMetadata;
}

/** Snapshot 'current' del estado de la solucion. */
export interface EstadoSolucionDTO {
    pase: number;
    convergio: boolean;
    configGrasp: KdeWorkerConfig;
    grafo: GrafoBipartitoDTO;
    candidatos: CandidatoSolucionDTO[];
    catalogo?: CatalogoGrupoDTO[];
}

/** Registro de historial de un pase. */
export interface HistorialPaseDTO {
    pase: number;
    resumen: KdeWorkerSummary;
    diff?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers de horario canonico
// ---------------------------------------------------------------------------

/**
 * Variante segura de `canonicalizeHorario`: nunca lanza (devuelve '' si el horario es
 * vacio/invalido), porque los candidatos huerfanos pueden no tener horario.
 */
export function canonicalizeHorarioSafe(horarioRaw: string | null | undefined): string {
    if (!horarioRaw || !horarioRaw.trim()) return '';
    try {
        return canonicalizeHorario(horarioRaw);
    } catch {
        return '';
    }
}

/** `{eco}:{uea}:{horario_canonico}` — mismo material que sijhKey/kdeKey. */
export function buildCacheKey(numeroEconomico: number, ueaClave: number, horarioRaw: string | null | undefined): string {
    return `${numeroEconomico}:${ueaClave}:${canonicalizeHorarioSafe(horarioRaw)}`;
}

// ---------------------------------------------------------------------------
// GrafoBipartito <-> GrafoBipartitoDTO
// ---------------------------------------------------------------------------

export function grafoToDTO(grafo: GrafoBipartito): GrafoBipartitoDTO {
    return {
        profesores: Array.from(grafo.profesores.values()),
        grupos: Array.from(grafo.grupos.values()),
        adyacencias: Array.from(grafo.adyacencias.entries()).map(([numeroEconomico, idUeaGrupo]) => ({
            numeroEconomico,
            idUeaGrupo: [...idUeaGrupo],
        })),
        asignacionesInversas: Array.from(grafo.asignacionesInversas.entries()).map(([idUeaGrupo, numeroEconomico]) => ({
            idUeaGrupo,
            numeroEconomico,
        })),
    };
}

/** Rehidrata un `GrafoBipartito` registrando profesores+grupos y aplicando asignaciones. */
export function dtoToGrafo(dto: GrafoBipartitoDTO): GrafoBipartito {
    const grafo = new GrafoBipartito();
    dto.profesores.forEach((p) => grafo.registrarProfesor(p));
    dto.grupos.forEach((g) => grafo.registrarGrupo(g));
    for (const inv of dto.asignacionesInversas) {
        if (!grafo.asignacionesInversas.has(inv.idUeaGrupo)) {
            grafo.asignarMutable(inv.numeroEconomico, inv.idUeaGrupo);
        }
    }
    return grafo;
}

/**
 * Construye un `GrafoBipartitoDTO` a partir de profesores+grupos y un conjunto de aristas
 * (numeroEconomico ↔ idUeaGrupo). Util para serializar el estado a partir de los candidatos
 * de un `IterativeRunState` sin tener que materializar primero un `GrafoBipartito`.
 */
export function buildGrafoDTO(
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[],
    aristas: Array<{ numeroEconomico: number; idUeaGrupo: number }>,
): GrafoBipartitoDTO {
    const grafo = new GrafoBipartito();
    profesores.forEach((p) => grafo.registrarProfesor(p));
    grupos.forEach((g) => grafo.registrarGrupo(g));
    for (const a of aristas) {
        if (!grafo.asignacionesInversas.has(a.idUeaGrupo)) {
            grafo.asignarMutable(a.numeroEconomico, a.idUeaGrupo);
        }
    }
    return grafoToDTO(grafo);
}

// ---------------------------------------------------------------------------
// GrupoDTO -> CatalogoGrupoDTO
// ---------------------------------------------------------------------------

export function grupoToCatalogo(grupo: GrupoDTO): CatalogoGrupoDTO {
    return {
        idUeaGrupo: grupo.idUeaGrupo,
        ueaClave: grupo.ueaClave,
        claveGrupo: grupo.claveGrupo,
        idArea: grupo.idArea ?? null,
        horarioRaw: grupo.horarioStringRaw ?? null,
        horarioCanonico: canonicalizeHorarioSafe(grupo.horarioStringRaw),
    };
}

export function gruposToCatalogo(grupos: GrupoDTO[]): CatalogoGrupoDTO[] {
    return grupos.map(grupoToCatalogo);
}

// ---------------------------------------------------------------------------
// CandidateRow <-> CandidatoSolucionDTO
// ---------------------------------------------------------------------------

export function candidateRowToDTO(row: CandidateRow): CandidatoSolucionDTO {
    return {
        cacheKey: buildCacheKey(row.numeroEconomico, row.uea, row.horarioStringRaw),
        numeroEconomico: row.numeroEconomico,
        idUeaGrupo: row.idUeaGrupo,
        turno: row.turno ?? null,
        score: row.score ?? null,
        kde_ij: row.kde_ij ?? null,
        kde_ih: row.kde_ih ?? null,
        kde_ih_raw: row.kde_ih_raw ?? null,
        kde_plan: row.kde_plan ?? null,
        zBase: row.zBase ?? null,
        bloqueado: row.locked,
        indicePase: row.passIndex,
        metadata: row.metadata,
    };
}

/**
 * Reconstruye un `CandidateRow` desde la fila persistida + el catalogo intermedio.
 * El catalogo aporta uea/claveGrupo/horarioRaw que no viven en `candidato_solucion`.
 */
export function dtoToCandidateRow(
    dto: CandidatoSolucionDTO,
    catalogo: Map<number, CatalogoGrupoDTO>,
): CandidateRow {
    const cat = catalogo.get(dto.idUeaGrupo);
    const turno = (dto.turno as CandidateRow['turno']) ?? 'manana';
    return {
        numeroEconomico: dto.numeroEconomico,
        idUeaGrupo: dto.idUeaGrupo,
        uea: cat?.ueaClave ?? -1,
        claveGrupo: cat?.claveGrupo ?? '?',
        horarioStringRaw: cat?.horarioRaw ?? '',
        turno,
        score: dto.score ?? undefined,
        kde_ij: dto.kde_ij ?? undefined,
        kde_ih: dto.kde_ih ?? undefined,
        kde_ih_raw: dto.kde_ih_raw ?? undefined,
        kde_plan: dto.kde_plan ?? undefined,
        zBase: dto.zBase ?? undefined,
        locked: dto.bloqueado,
        passIndex: dto.indicePase,
        metadata: dto.metadata,
    };
}

// ---------------------------------------------------------------------------
// IterativeRunState <-> EstadoSolucionDTO
// ---------------------------------------------------------------------------

/**
 * Serializa un `IterativeRunState` (estado en memoria de KdeMode) a `EstadoSolucionDTO`.
 * Se persiste el grafo reconstruido + los candidatos (no el `lastResult` completo, que es
 * pesado). El catalogo se arma de `lastResult.gruposValidos`.
 */
export function iterativeStateToEstadoSolucion(
    state: IterativeRunState,
    config: KdeWorkerConfig,
): EstadoSolucionDTO {
    const profesores = state.lastResult.profesores;
    const grupos = state.lastResult.gruposValidos;
    const aristas = state.candidates.map((c) => ({
        numeroEconomico: c.numeroEconomico,
        idUeaGrupo: c.idUeaGrupo,
    }));
    return {
        pase: state.pass,
        convergio: state.converged,
        configGrasp: config,
        grafo: buildGrafoDTO(profesores, grupos, aristas),
        candidatos: state.candidates.map(candidateRowToDTO),
        catalogo: gruposToCatalogo(grupos),
    };
}

/**
 * Rehidrata los `CandidateRow[]` y el conjunto de locks desde un `EstadoSolucionDTO`.
 * No reconstruye `lastResult` (los grupos/profesores rehidratados van por el grafo en el
 * DAO); KdeMode usa esto para repoblar la tabla y los locks al montar.
 */
export function estadoSolucionToCandidates(dto: EstadoSolucionDTO): {
    candidates: CandidateRow[];
    locks: Set<string>;
    pass: number;
    converged: boolean;
    config: KdeWorkerConfig;
} {
    const catalogo = new Map<number, CatalogoGrupoDTO>(
        (dto.catalogo ?? []).map((c) => [c.idUeaGrupo, c]),
    );
    const candidates = dto.candidatos.map((c) => dtoToCandidateRow(c, catalogo));
    const locks = new Set<string>(
        candidates.filter((c) => c.locked).map((c) => `${c.numeroEconomico}|${c.idUeaGrupo}`),
    );
    return {
        candidates,
        locks,
        pass: dto.pase,
        converged: dto.convergio,
        config: dto.configGrasp,
    };
}

/**
 * Rehidrata un `IterativeRunState` minimo desde el snapshot persistido. No reconstruye los
 * datos pesados (`surfaceData`, logs); arma un `lastResult` con lo suficiente para encadenar
 * el siguiente pase: `profesores` y `gruposValidos` (del grafo) y `asignaciones`.
 *
 * Devuelve tambien `locks`/`config` para que el caller (KdeMode) repueble su estado React.
 */
export function estadoSolucionToIterativeState(dto: EstadoSolucionDTO): {
    state: IterativeRunState;
    locks: Set<string>;
    config: KdeWorkerConfig;
} {
    const { candidates, locks, pass, converged, config } = estadoSolucionToCandidates(dto);

    const asignaciones = dto.grafo.asignacionesInversas.map((inv) => ({
        numeroEconomico: inv.numeroEconomico,
        idUeaGrupo: inv.idUeaGrupo,
    }));

    const summary: KdeWorkerSummary = {
        mode: config.mode,
        seed: config.seed,
        k: config.k,
        alpha: config.alpha,
        totalAsignaciones: asignaciones.length,
        totalGrupos: dto.grafo.grupos.length,
        gruposSinAsignar: 0,
        scoreZ: 0,
        tiempoMs: 0,
        ecos: [],
    };

    const lastResult = {
        surfaceData: [],
        asignaciones,
        metricas: {
            totalEvaluaciones: 0,
            totalAsignados: asignaciones.length,
            totalRechazados: 0,
            tiempoMs: 0,
            gruposSinAsignar: [],
            scoreZ: 0,
            mejorasLocales: 0,
            reparaciones: 0,
        },
        summary,
        profesoresCount: dto.grafo.profesores.length,
        gruposValidos: dto.grafo.grupos,
        profesores: dto.grafo.profesores,
    } as unknown as KdeWorkerResult;

    const state: IterativeRunState = {
        pass,
        candidates,
        history: [],
        converged,
        lastDiff: undefined,
        lastResult,
    };

    return { state, locks, config };
}
