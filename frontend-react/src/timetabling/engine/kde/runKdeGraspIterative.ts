import { runKdeGraspWorker } from './runKdeGraspWorker';
import type {
    KdeRawInputs,
    KdeWorkerConfig,
    KdeWorkerProgress,
    KdeWorkerResult,
    KdeWorkerSummary,
    LockedAssignmentDTO,
} from './graspKdeTypes';
import { buildCandidateRows, candidateKey, physicalKey, type CandidateRow } from './candidateRow';
import { diffCandidateSets, type CandidateSetDiff } from '../../utils/diffCandidateSets';
import { buildBlockedGroupKeys } from './blockedGroups';
import { invalidateStalePenaltyRedisOnce } from './penaltyCacheInvalidation';
import { JSONAssignmentAdapter } from '@solution/data/JSONAssignmentAdapter';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';

/** Clave estable de un grupo físico (independiente del id renumerado por pase). */
function stableGroupKey(uea: number, claveGrupo: string, horario: string): string {
    return `${uea}|${claveGrupo}|${horario}`;
}

/**
 * Normaliza los `idUeaGrupo` de filas bloqueadas LEGACY al espacio de ids CRUDO del workspace.
 *
 * Las soluciones persistidas antes del esquema "parse completo + exclusión post-parse" tienen
 * filas con ids del espacio de pases viejos (renumerados por `buildPartialArchivosRequeridos`).
 * Para cada fila cuyo id NO resuelva en `gruposCatalogo[id]` con verificación uea+claveGrupo,
 * pero SÍ resuelva por clave estable (uea, claveGrupo, horario), se RE-MAPEA su `idUeaGrupo`
 * al id crudo: migración progresiva de soluciones viejas al espacio único de ids. Conserva
 * locked/passIndex/metadata y deja intactas las filas ya crudas o irresolubles (estas últimas
 * las reporta `mapLockedRowsToDTO` con warn al sembrar).
 *
 * Pura: devuelve filas nuevas solo para las re-mapeadas (mismo orden y longitud que la entrada,
 * para que el caller pueda migrar candidateKeys por posición).
 */
export function normalizarIdsLockedAlCatalogo(
    lockedRows: CandidateRow[],
    gruposCatalogo: GrupoDTO[],
): CandidateRow[] {
    if (lockedRows.length === 0) return lockedRows;
    const porId = new Map(gruposCatalogo.map(g => [g.idUeaGrupo, g]));
    const porClave = new Map(gruposCatalogo.map(g => [stableGroupKey(g.ueaClave, g.claveGrupo, g.horarioStringRaw), g]));
    return lockedRows.map(row => {
        const dtoPorId = porId.get(row.idUeaGrupo);
        if (dtoPorId && dtoPorId.ueaClave === row.uea && dtoPorId.claveGrupo === row.claveGrupo) {
            return row; // ya está en el espacio crudo
        }
        const crudo = porClave.get(stableGroupKey(row.uea, row.claveGrupo, row.horarioStringRaw));
        if (crudo && crudo.idUeaGrupo !== row.idUeaGrupo) {
            console.info(
                '[normalizarIdsLockedAlCatalogo] Migrando id legacy al espacio crudo: '
                + `eco=${row.numeroEconomico} ${row.uea}/${row.claveGrupo} id ${row.idUeaGrupo} → ${crudo.idUeaGrupo}.`,
            );
            return { ...row, idUeaGrupo: crudo.idUeaGrupo };
        }
        return row;
    });
}

/**
 * Mapea las filas bloqueadas (ConjuntoBloqueado) a `LockedAssignmentDTO[]`, resolviendo el
 * `GrupoDTO` completo. Estas asignaciones se inyectan al worker para sembrar el `grafoInicial`
 * con la carga W ya comprometida por cada ECO.
 *
 * Con ids unificados (parse completo + exclusión post-parse) las filas bloqueadas llegan aquí
 * normalizadas al espacio crudo (`normalizarIdsLockedAlCatalogo`), por lo que casi siempre
 * resuelven en el paso 1. Los pasos siguientes quedan como defensa para datos legacy. Orden:
 *  1. `gruposCatalogo[id]` (catálogo CRUDO del workspace, ids deterministas, incluye SAI/CPRO),
 *     verificando ueaClave/claveGrupo contra la fila.
 *  2. Búsqueda por clave estable (uea, claveGrupo, horario) en el catálogo crudo — cubre filas
 *     bloqueadas con ids legacy aún no normalizados.
 *  3. `gruposValidos[id]` verificado — cubre estados donde el catálogo crudo no esté disponible.
 *  4. Warn detallado + omitir (antes era silencioso).
 *
 * El DTO emitido conserva el `idUeaGrupo` de la fila (su candidateKey/lock); el guard del
 * worker resuelve las colisiones de id (solo posibles con datos legacy) con ids sintéticos.
 */
export function mapLockedRowsToDTO(
    lockedRows: CandidateRow[],
    catalogo: GrupoDTO[],
    gruposCatalogo?: GrupoDTO[],
): LockedAssignmentDTO[] {
    const idToGrupo = new Map(catalogo.map(g => [g.idUeaGrupo, g]));
    const idToCrudo = gruposCatalogo ? new Map(gruposCatalogo.map(g => [g.idUeaGrupo, g])) : null;
    const crudoPorClave = gruposCatalogo
        ? new Map(gruposCatalogo.map(g => [stableGroupKey(g.ueaClave, g.claveGrupo, g.horarioStringRaw), g]))
        : null;
    const coincide = (dto: GrupoDTO | undefined, row: CandidateRow): dto is GrupoDTO =>
        dto != null && dto.ueaClave === row.uea && dto.claveGrupo === row.claveGrupo;
    const result: LockedAssignmentDTO[] = [];
    for (const row of lockedRows) {
        // 1) Catálogo crudo por id (ids deterministas del workspace completo).
        let grupo = idToCrudo?.get(row.idUeaGrupo);
        // 2) Clave estable en el crudo (ids renumerados por pase ya no sirven).
        if (!coincide(grupo, row)) {
            grupo = crudoPorClave?.get(stableGroupKey(row.uea, row.claveGrupo, row.horarioStringRaw));
        }
        // 3) Catálogo del pase por id (respaldo cuando no hay catálogo crudo).
        if (!coincide(grupo, row)) {
            grupo = idToGrupo.get(row.idUeaGrupo);
        }
        if (!coincide(grupo, row)) {
            console.warn(
                '[mapLockedRowsToDTO] Fila bloqueada omitida de la siembra: no se pudo resolver su GrupoDTO. '
                + `eco=${row.numeroEconomico} idUeaGrupo=${row.idUeaGrupo} uea=${row.uea} grupo=${row.claveGrupo} `
                + `horario=${row.horarioStringRaw || '(vacío)'} · `
                + `gruposValidos[id]=${describeGrupo(idToGrupo.get(row.idUeaGrupo))} · `
                + `gruposCatalogo[id]=${idToCrudo ? describeGrupo(idToCrudo.get(row.idUeaGrupo)) : '(catálogo crudo no provisto)'}`,
            );
            continue;
        }
        result.push({
            numeroEconomico: row.numeroEconomico,
            // id ORIGINAL de la fila: preserva candidateKey/locks; el contenido viene del DTO resuelto.
            idUeaGrupo: row.idUeaGrupo,
            idGrupo: grupo.idGrupo,
            ueaClave: grupo.ueaClave,
            claveGrupo: grupo.claveGrupo,
            idArea: grupo.idArea,
            horarioStringRaw: grupo.horarioStringRaw,
            horarios: grupo.horarios,
            kde_ih_raw: row.kde_ih_raw,
            metadata: row.metadata,
        });
    }
    return result;
}

function describeGrupo(dto: GrupoDTO | undefined): string {
    return dto ? `${dto.ueaClave}/${dto.claveGrupo}` : '(ausente)';
}

/**
 * Fusiona las filas bloqueadas con el output fresco del pase:
 *  - Cada fila bloqueada adopta los scores frescos del worker SOLO si la fila fresca describe el
 *    MISMO contenido físico (eco + uea + claveGrupo); el match es primero por candidateKey y, si
 *    el id cambió (siembra bajo id sintético por colisión de renumeración), por physicalKey.
 *    La fila conserva su `idUeaGrupo`/candidateKey ORIGINALES, su passIndex y su metadata.
 *  - Las filas frescas que duplican físicamente a una bloqueada (mismo eco+uea+claveGrupo, id
 *    distinto — p.ej. la propia siembra reapareciendo con id sintético) se EXCLUYEN: la exclusión
 *    es por contenido físico además de por candidateKey, para que un id sintético no la esquive.
 *  - Dedupe defensivo de ids: el resultado NO debe contener el mismo `idUeaGrupo` en filas
 *    físicamente DISTINTAS (espacio unificado de ids crudos). Si ocurre (fila legacy irresoluble
 *    cuyo id stale colisiona con un id crudo del pase), se conserva la bloqueada y se descarta
 *    la fresca con warn: su grupo vuelve a derivarse como disponible en el pool.
 * Con 0 filas bloqueadas es identidad sobre `newRows` (paridad con el pase 0).
 */
export function fusionarLockedYNuevas(lockedRows: CandidateRow[], newRows: CandidateRow[]): CandidateRow[] {
    const lockedKeys = new Set(lockedRows.map(candidateKey));
    const lockedFisicas = new Set(lockedRows.map(physicalKey));
    const newPorKey = new Map(newRows.map(r => [candidateKey(r), r]));
    const newPorFisica = new Map(newRows.map(r => [physicalKey(r), r]));
    const combined = [
        ...lockedRows.map(r => {
            const porId = newPorKey.get(candidateKey(r));
            // Guard anti-colisión de ids: el re-score por id solo vale si es el MISMO grupo.
            const fresh = (porId && porId.uea === r.uea && porId.claveGrupo === r.claveGrupo)
                ? porId
                : newPorFisica.get(physicalKey(r));
            return fresh
                ? { ...fresh, idUeaGrupo: r.idUeaGrupo, locked: true, passIndex: r.passIndex, metadata: r.metadata }
                : { ...r, locked: true };
        }),
        ...newRows.filter(r => !lockedKeys.has(candidateKey(r)) && !lockedFisicas.has(physicalKey(r))),
    ];
    if (lockedRows.length === 0) return combined; // identidad: sin locks no puede haber colisión
    // Aserción/dedupe defensivo: mismo id en filas físicamente distintas = dupGrp latente.
    const contenidoPorId = new Map<number, string>();
    return combined.filter(r => {
        const contenido = `${r.uea}|${r.claveGrupo}`;
        const previo = contenidoPorId.get(r.idUeaGrupo);
        if (previo === undefined) {
            contenidoPorId.set(r.idUeaGrupo, contenido);
            return true;
        }
        if (previo === contenido) return true; // mismo grupo físico (p.ej. doble eco legacy): no es colisión de id
        console.warn(
            '[fusionarLockedYNuevas] id duplicado entre filas físicamente distintas: '
            + `id=${r.idUeaGrupo} ya pertenece a ${previo}; se descarta la fila ${contenido} `
            + `(eco=${r.numeroEconomico}) — su grupo queda disponible en el pool.`,
        );
        return false;
    });
}

export interface IterativeRunPassHistory {
    pass: number;
    candidates: CandidateRow[];
    summary: KdeWorkerSummary;
    diff?: CandidateSetDiff;
}

export interface IterativeRunState {
    pass: number;
    candidates: CandidateRow[];
    history: IterativeRunPassHistory[];
    converged: boolean;
    lastDiff?: CandidateSetDiff;
    lastResult: KdeWorkerResult;
}

export interface RunKdeGraspIterativeOptions {
    baseInputs: KdeRawInputs;
    initialState?: IterativeRunState;
    locks: Set<string>;
    completedEcos?: number[];
    config: KdeWorkerConfig;
    autoConverge?: boolean;
    maxPasses?: number;
    signal?: AbortSignal;
    onPass?: (state: IterativeRunState) => void;
    onProgress?: (event: KdeWorkerProgress) => void;
    /**
     * Catálogo CRUDO del workspace completo (parse de programacionVacia sin filtrar, ids
     * deterministas y estables entre pases; incluye SAI/CPRO). Es el espacio ÚNICO de ids:
     * se usa para normalizar ids legacy de filas bloqueadas y para resolver sus GrupoDTO
     * al sembrar. Si no se pasa, se deriva de baseInputs (mismo parse determinista).
     */
    gruposCatalogo?: GrupoDTO[];
}

/**
 * Driver iterativo del GRASP+KDE con human-in-the-loop:
 *  - Pase 0: workspace completo (initialState===undefined).
 *  - Pase N≥1: el worker recibe SIEMPRE los archivos_requeridos COMPLETOS (ids crudos estables)
 *    más `blockedKeys` (contenido de los grupos bloqueados, que el worker excluye post-parse),
 *    corre, fusiona locked + output fresco, mide diff y decide si continuar.
 */
export async function runKdeGraspIterative(options: RunKdeGraspIterativeOptions): Promise<IterativeRunState> {
    const maxPasses = options.maxPasses ?? 10;
    let state: IterativeRunState | undefined = options.initialState;
    // Copia local de los locks: al normalizar ids legacy las candidateKeys de las filas
    // bloqueadas pueden cambiar; este set migra junto con ellas para que los pases siguientes
    // (auto-convergencia) sigan encontrando las filas bloqueadas. options.locks no se muta.
    const locksVigentes = new Set(options.locks);
    // Catálogo crudo del workspace: si el caller no lo pasó (plumbing perdido en algún camino de
    // pase), se deriva aquí de baseInputs.programacionVacia — mismo parse determinista que usa
    // KdeMode. Garantiza que la siembra de filas bloqueadas SIEMPRE tenga el respaldo de ids
    // estables, sin importar desde dónde se invoque el driver. Lazy: solo se parsea si hay pases
    // N≥1 (con pase 0 no hay locks que sembrar).
    let gruposCatalogo = options.gruposCatalogo;
    const obtenerGruposCatalogo = (): GrupoDTO[] => {
        if (!gruposCatalogo) {
            gruposCatalogo = JSONAssignmentAdapter.parsearGruposDesdeObjeto(options.baseInputs.programacionVacia);
        }
        return gruposCatalogo;
    };

    while (true) {
        const pass = state ? state.pass + 1 : 0;
        options.onProgress?.({ kind: 'stage', stage: 'pipeline:pase', detail: `pase=${pass}` });

        // PASE 0: invalidar la cache de penalizacion del modelo VIEJO. El namespace
        // ya subio a v3 (las entradas v2 quedan huerfanas), pero ademas purgamos
        // explicitamente Penalty:v2:*/PenaltyObserved:v2:* en Redis para que el pase 0
        // recompute fresco contra el modelo nuevo y recachee bajo v3. La cache en
        // memoria del penalty vive dentro de cada worker (instancia nueva por pase),
        // asi que no hay que limpiarla aqui. Idempotente: solo corre una vez por sesion.
        if (pass === 0) {
            const origin = typeof self !== 'undefined' && self.location ? self.location.origin : '';
            await invalidateStalePenaltyRedisOnce(origin);
        }

        // ConjuntoBloqueado = filas locked del estado previo, NORMALIZADAS al espacio crudo de
        // ids: las soluciones persistidas con ids de pases viejos (renumerados) se re-mapean por
        // clave estable a los ids deterministas del workspace. Migración progresiva: tras este
        // pase, la solución fusionada vive completa en el espacio único.
        const lockedRowsPrevias = state
            ? state.candidates.filter(r => locksVigentes.has(candidateKey(r)))
            : [];
        const lockedRows = lockedRowsPrevias.length > 0
            ? normalizarIdsLockedAlCatalogo(lockedRowsPrevias, obtenerGruposCatalogo())
            : lockedRowsPrevias;
        // Migrar las candidateKeys de los locks re-mapeados (mismo orden/longitud por contrato).
        for (let i = 0; i < lockedRows.length; i++) {
            if (lockedRows[i] !== lockedRowsPrevias[i]) {
                locksVigentes.delete(candidateKey(lockedRowsPrevias[i]));
                locksVigentes.add(candidateKey(lockedRows[i]));
            }
        }
        if (pass > 0) {
            options.onProgress?.({
                kind: 'stage',
                stage: 'pipeline:filtrar',
                detail: `${lockedRows.length} asignaciones ya asignadas se conservan`,
            });
        }
        // El worker parsea SIEMPRE el workspace COMPLETO (ids crudos estables) y excluye el
        // ConjuntoBloqueado post-parse, matcheando por CONTENIDO (uea+claveGrupo): catálogo del
        // pase = ConjuntoOriginal − ConjuntoBloqueado, sin renumerar los ids restantes.
        const blockedKeys = pass === 0 ? undefined : buildBlockedGroupKeys(lockedRows);
        // Carga existente (W) por ECO que el worker materializa en el grafoInicial.
        const lockedAssignments = pass === 0
            ? undefined
            : mapLockedRowsToDTO(lockedRows, state!.lastResult.gruposValidos, obtenerGruposCatalogo());

        const configForPass: KdeWorkerConfig = {
            ...options.config,
            seed: options.config.seed + pass,
        };

        const handle = runKdeGraspWorker({
            inputs: options.baseInputs,
            config: configForPass,
            lockedAssignments,
            completedEcos: options.completedEcos,
            blockedKeys,
            onProgress: options.onProgress,
            signal: options.signal,
        });

        const result = await handle.promise;

        const lockedSetUpdated = new Set(lockedRows.map(candidateKey));
        const newRows = buildCandidateRows(
            result.asignaciones,
            result.gruposValidos,
            result.summary.ecos,
            pass,
            lockedSetUpdated,
        );
        // Re-scorear las filas bloqueadas con los scores frescos del pase actual y excluir del
        // output fresco las filas que dupliquen físicamente a una bloqueada (incl. siembras bajo
        // id sintético). Lógica extraída a fusionarLockedYNuevas (pura, testeable).
        const combined: CandidateRow[] = fusionarLockedYNuevas(lockedRows, newRows);

        const diff = state ? diffCandidateSets(state.candidates, combined) : undefined;
        options.onProgress?.({
            kind: 'stage',
            stage: 'pipeline:diff',
            detail: diff
                ? `+${diff.added.length} / -${diff.removed.length} / reasignadas ${diff.reassigned.length}`
                : 'pase inicial sin diff previo',
        });

        const passHistory: IterativeRunPassHistory = {
            pass,
            candidates: combined,
            summary: result.summary,
            diff,
        };
        const history = state ? [...state.history, passHistory] : [passHistory];

        const converged = (diff?.identical ?? false) || pass >= maxPasses;

        state = {
            pass,
            candidates: combined,
            history,
            converged,
            lastDiff: diff,
            lastResult: result,
        };

        options.onPass?.(state);

        if (!options.autoConverge) return state;
        if (converged) {
            options.onProgress?.({ kind: 'stage', stage: 'pipeline:convergencia', detail: `pase=${pass}` });
            return state;
        }
    }
}
