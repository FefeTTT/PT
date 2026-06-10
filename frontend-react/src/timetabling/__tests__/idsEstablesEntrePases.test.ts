import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import { JSONAssignmentAdapter } from '@solution/data/JSONAssignmentAdapter';
import type { CandidateRow } from '../engine/kde/candidateRow';
import type { KdeRawInputs } from '../engine/kde/graspKdeTypes';
import { buildBlockedGroupKeys, excluirGruposBloqueados } from '../engine/kde/blockedGroups';
import { fusionarLockedYNuevas, normalizarIdsLockedAlCatalogo } from '../engine/kde/runKdeGraspIterative';
import { seedReglasJson } from '../engine/kde/manualAssignmentFsm';

/**
 * Cobertura del esquema "parse completo + exclusión post-parse" que unifica los `idUeaGrupo`
 * al espacio CRUDO del workspace entre pases. Sustituye a buildPartialArchivosRequeridos.test:
 * el catálogo del pase ya no se construye filtrando la programación ANTES del parse (lo que
 * renumeraba los ids), sino excluyendo grupos bloqueados por CONTENIDO después del parse.
 */

// Workspace de prueba: 3 UEAs, 6 grupos (uno SAI que la ingesta FSM filtra, uno sin horario
// que el parse descarta). Ids crudos por orden de parse: CCB01=1, CCB02=2, CSAI81=3, CCB03=4,
// CCB04=5, CCB05=6.
const programacionVacia = {
    '1111013': [
        { grupo: 'CCB01', horario: 'L:07:00-08:30|Mi:07:00-08:30' },
        { grupo: 'CCB02', horario: 'M:09:00-10:30' },
        { grupo: 'CSAI81', horario: 'M:07:00-08:30' },
    ],
    '1112005': [
        { grupo: 'CCB03', horario: 'J:11:00-12:30' },
        { grupo: 'CCB99', horario: null },
    ],
    '1113021': [
        { grupo: 'CCB04', horario: 'V:13:00-14:30' },
        { grupo: 'CCB05', horario: 'L:16:00-17:30' },
    ],
};

const inputs: KdeRawInputs = {
    ecoHorarioRegular: { '100': '07:00-22:00', '200': '07:00-22:00' },
    ecoHorarioIrregularVigente: {},
    ecoHorarioIrregular: {},
    areaProfesor: { '100': ['1111'], '200': ['1111'] },
    programacionVacia,
    ecoNombre: { '100': 'Profe A', '200': 'Profe B' },
    dfHist: [],
};

const grupoFactory = (id: number, uea: number, clave: string, horario = 'L:07:00-08:30'): GrupoDTO => ({
    idUeaGrupo: id,
    idGrupo: id * 100,
    claveGrupo: clave,
    idArea: String(uea).slice(0, 4),
    ueaClave: uea,
    horarios: [{ dia: 1, horaInicio: 7, horaFin: 8.5 }],
    horarioStringRaw: horario,
});

const rowDe = (grupo: GrupoDTO, eco = 100, locked = true): CandidateRow => ({
    numeroEconomico: eco,
    idUeaGrupo: grupo.idUeaGrupo,
    uea: grupo.ueaClave,
    claveGrupo: grupo.claveGrupo,
    horarioStringRaw: grupo.horarioStringRaw,
    turno: 'manana',
    locked,
    passIndex: 0,
});

function catalogoPaseDesdeWorkspace(): GrupoDTO[] {
    // Mismo pipeline que el worker: parse COMPLETO + ingesta FSM (sin exclusión todavía).
    const crudos = JSONAssignmentAdapter.parsearGruposDesdeObjeto(programacionVacia);
    return JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(crudos, { log: false });
}

beforeEach(() => {
    seedReglasJson(inputs);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('excluirGruposBloqueados (catálogo del pase en espacio crudo)', () => {
    it('excluye los grupos bloqueados por CONTENIDO y conserva ids crudos y orden de parse', () => {
        const gruposIngesta = catalogoPaseDesdeWorkspace();
        // Ingesta: CSAI81 filtrado por REGLA_IGNORAR_GRUPOS, CCB99 descartado en el parse.
        expect(gruposIngesta.map(g => g.claveGrupo)).toEqual(['CCB01', 'CCB02', 'CCB03', 'CCB04', 'CCB05']);
        expect(gruposIngesta.map(g => g.idUeaGrupo)).toEqual([1, 2, 4, 5, 6]);

        const blockedKeys = buildBlockedGroupKeys([
            { uea: 1111013, claveGrupo: 'CCB01' },
            { uea: 1113021, claveGrupo: 'CCB05' },
        ]);
        const catalogoPase = excluirGruposBloqueados(gruposIngesta, blockedKeys);

        expect(catalogoPase.map(g => g.claveGrupo)).toEqual(['CCB02', 'CCB03', 'CCB04']);
        // El punto del fix: los ids de los grupos restantes NO se renumeran (antes, re-parsear
        // la programación filtrada habría dado CCB02=1, CCB03=2, CCB04=3).
        expect(catalogoPase.map(g => g.idUeaGrupo)).toEqual([2, 4, 5]);
    });

    it('no matchea por id: un id bloqueado con contenido distinto no excluye nada', () => {
        const gruposIngesta = catalogoPaseDesdeWorkspace();
        // uea/claveGrupo que no existen en el workspace (fila bloqueada huérfana): no-op.
        const catalogoPase = excluirGruposBloqueados(gruposIngesta, [{ uea: 9999001, claveGrupo: 'CCB01' }]);
        expect(catalogoPase).toHaveLength(gruposIngesta.length);
    });

    it('paridad pase 0: con 0 bloqueados devuelve el MISMO array del parse directo', () => {
        const gruposIngesta = catalogoPaseDesdeWorkspace();
        // Identidad estricta (misma referencia): ni copia, ni reordenamiento, ni renumeración.
        expect(excluirGruposBloqueados(gruposIngesta, [])).toBe(gruposIngesta);
        expect(excluirGruposBloqueados(gruposIngesta, undefined)).toBe(gruposIngesta);
        // Y el catálogo es idéntico (ids/orden) al de un parse directo independiente.
        const parseDirecto = catalogoPaseDesdeWorkspace();
        expect(excluirGruposBloqueados(gruposIngesta, []).map(g => g.idUeaGrupo))
            .toEqual(parseDirecto.map(g => g.idUeaGrupo));
        expect(excluirGruposBloqueados(gruposIngesta, []).map(g => g.claveGrupo))
            .toEqual(parseDirecto.map(g => g.claveGrupo));
    });
});

describe('buildBlockedGroupKeys', () => {
    it('deriva claves por contenido y deduplica', () => {
        const keys = buildBlockedGroupKeys([
            { uea: 1111013, claveGrupo: 'CCB01' },
            { uea: 1111013, claveGrupo: 'CCB01' },
            { uea: 1112005, claveGrupo: 'CCB03' },
        ]);
        expect(keys).toEqual([
            { uea: 1111013, claveGrupo: 'CCB01' },
            { uea: 1112005, claveGrupo: 'CCB03' },
        ]);
    });
});

describe('normalizarIdsLockedAlCatalogo (migración de ids legacy al espacio crudo)', () => {
    const catalogo = [
        grupoFactory(1, 1111013, 'CCB01', 'L:07:00-08:30|Mi:07:00-08:30'),
        grupoFactory(2, 1111013, 'CCB02', 'M:09:00-10:30'),
        grupoFactory(4, 1112005, 'CCB03', 'J:11:00-12:30'),
    ];

    it('re-mapea por clave estable la fila cuyo id legacy apunta a OTRO grupo en el crudo', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        // Fila bloqueada de un pase viejo: contenido CCB03, pero id 1 (que en crudo es CCB01).
        const legacy: CandidateRow = { ...rowDe(catalogo[2]), idUeaGrupo: 1 };
        const out = normalizarIdsLockedAlCatalogo([legacy], catalogo);
        expect(out).toHaveLength(1);
        expect(out[0].idUeaGrupo).toBe(4);
        expect(out[0].claveGrupo).toBe('CCB03');
        // Conserva todo lo demás (locked/passIndex/eco).
        expect(out[0].locked).toBe(true);
        expect(out[0].passIndex).toBe(0);
        expect(out[0].numeroEconomico).toBe(100);
    });

    it('deja intacta (misma referencia) la fila cuyo id ya resuelve verificado en el crudo', () => {
        const yaCruda = rowDe(catalogo[1]);
        const out = normalizarIdsLockedAlCatalogo([yaCruda], catalogo);
        expect(out[0]).toBe(yaCruda);
    });

    it('deja intacta la fila irresoluble (contenido fuera del workspace)', () => {
        const huerfana: CandidateRow = { ...rowDe(grupoFactory(99, 9999001, 'CXX01')), idUeaGrupo: 99 };
        const out = normalizarIdsLockedAlCatalogo([huerfana], catalogo);
        expect(out[0]).toBe(huerfana);
    });

    it('la clave estable exige también el horario: si difiere no re-mapea', () => {
        const horarioStale: CandidateRow = {
            ...rowDe(catalogo[2]),
            idUeaGrupo: 1,
            horarioStringRaw: 'V:18:00-19:30',
        };
        const out = normalizarIdsLockedAlCatalogo([horarioStale], catalogo);
        expect(out[0]).toBe(horarioStale); // mapLockedRowsToDTO reportará el warn al sembrar
    });
});

describe('fusión post-pase sin dupGrp (ids unificados)', () => {
    const catalogo = [
        grupoFactory(1, 1111013, 'CCB01'),
        grupoFactory(2, 1111013, 'CCB02', 'M:09:00-10:30'),
        grupoFactory(3, 1112005, 'CCB03', 'J:11:00-12:30'),
        grupoFactory(4, 1113021, 'CCB04', 'V:13:00-14:30'),
    ];

    it('normalización + fusión: una locked legacy y una fresca con el mismo id numérico ya no colisionan', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        // Escenario medido del bug (dupGrp): la locked guardó CCB03 bajo id 1 (espacio del pase
        // viejo); en el espacio crudo el id 1 es CCB01, que el GRASP fresco asignó a otro ECO.
        const lockedLegacy: CandidateRow = { ...rowDe(catalogo[2], 100), idUeaGrupo: 1 };
        const frescas: CandidateRow[] = [
            rowDe(catalogo[0], 200, false), // CCB01 con su id crudo 1
            rowDe(catalogo[3], 200, false), // CCB04 con su id crudo 4
        ];
        const normalizadas = normalizarIdsLockedAlCatalogo([lockedLegacy], catalogo);
        const out = fusionarLockedYNuevas(normalizadas, frescas);

        expect(out).toHaveLength(3);
        // Ningún id duplicado entre filas físicamente distintas.
        const porId = new Map(out.map(r => [r.idUeaGrupo, `${r.uea}|${r.claveGrupo}`]));
        expect(porId.size).toBe(out.length);
        expect(out.find(r => r.claveGrupo === 'CCB03')!.idUeaGrupo).toBe(3);
        expect(out.find(r => r.claveGrupo === 'CCB01')!.idUeaGrupo).toBe(1);
    });

    it('dedupe defensivo: si una locked irresoluble conserva un id stale que colisiona, la fresca se descarta con warn', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Locked cuyo contenido YA NO existe en el workspace (irresoluble): conserva id 2,
        // que en el espacio crudo pertenece a CCB02.
        const lockedIrresoluble: CandidateRow = { ...rowDe(grupoFactory(2, 9999001, 'CVIEJO')), idUeaGrupo: 2 };
        const fresca: CandidateRow = rowDe(catalogo[1], 200, false); // CCB02, id crudo 2
        const out = fusionarLockedYNuevas([lockedIrresoluble], [fresca]);

        expect(out).toHaveLength(1);
        expect(out[0].claveGrupo).toBe('CVIEJO'); // gana la bloqueada (decisión del usuario)
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0][0])).toContain('id duplicado');
    });

    it('con 0 locks la fusión sigue siendo identidad (paridad pase 0, sin dedupe)', () => {
        const frescas = [rowDe(catalogo[0], 200, false), rowDe(catalogo[1], 200, false)];
        expect(fusionarLockedYNuevas([], frescas)).toEqual(frescas);
    });
});

describe('pool (Sin emparejar) coherente tras una fusión simulada de pase con locks', () => {
    it('la disponibilidad derivada gruposCatalogo − ids asignados es físicamente correcta', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const gruposCatalogo = [
            grupoFactory(1, 1111013, 'CCB01'),
            grupoFactory(2, 1111013, 'CCB02', 'M:09:00-10:30'),
            grupoFactory(3, 1112005, 'CCB03', 'J:11:00-12:30'),
            grupoFactory(4, 1113021, 'CCB04', 'V:13:00-14:30'),
        ];
        // Locked legacy: CCB03 guardado bajo id 1 (espacio viejo). Con ids sin unificar, el pool
        // excluiría CCB01 (id 1) y ofrecería CCB03 como disponible — ambos incorrectos.
        const lockedLegacy: CandidateRow = { ...rowDe(gruposCatalogo[2], 100), idUeaGrupo: 1 };
        const frescas: CandidateRow[] = [rowDe(gruposCatalogo[1], 200, false)]; // CCB02 id 2

        const combined = fusionarLockedYNuevas(
            normalizarIdsLockedAlCatalogo([lockedLegacy], gruposCatalogo),
            frescas,
        );

        // Derivación del pool idéntica a SolutionLockTable: catálogo crudo − idUeaGrupo asignados.
        const assignedIds = new Set(combined.map(r => r.idUeaGrupo));
        const pool = gruposCatalogo.filter(g => !assignedIds.has(g.idUeaGrupo));

        expect(pool.map(g => g.claveGrupo)).toEqual(['CCB01', 'CCB04']);
        // CCB03 (asignado/bloqueado) NO está disponible; CCB01 (libre) SÍ lo está.
        expect(pool.some(g => g.claveGrupo === 'CCB03')).toBe(false);
        expect(pool.some(g => g.claveGrupo === 'CCB01')).toBe(true);
    });
});
