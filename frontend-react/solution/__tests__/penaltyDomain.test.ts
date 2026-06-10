import { describe, expect, it, beforeEach } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador } from '../fsm/FSMAsignador';
import { ZScoreFunction } from '../ml/IModeloML';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';
import { PenaltyObservedCache, PenaltyObservedPayload } from '../ml/PenaltyObservedCache';
import { ViabilidadPenalizacionCarga } from '../objective/ViabilidadPenalizacionCarga';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { GreedyOrchestrator } from '../greedy/GreedyOrchestrator';
import { EjectionChain } from '../greedy/EjectionChain';
import { CriterioAceptacion } from '../objective/Tolerancia';
import { EstrategiaOrdenamiento } from '../greedy/GreedyTypes';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { crearGrupo, crearProfesor, franja, horarioDB } from './helpers/fixtures';

class ModeloScores {
    constructor(private readonly scores: Record<string, number>) {}

    score(profesorId: number, grupoId: number): number {
        return this.scores[`${profesorId}:${grupoId}`] ?? 1;
    }

    funcionZ: ZScoreFunction = (profesorId, grupoId) => {
        const score = this.score(profesorId, grupoId);
        return { score, h_ih: score, rhat: score, zBase: score, source: 'uniform' };
    };
}

class EstrategiaFija implements EstrategiaOrdenamiento {
    ordenarAreas(areas: Map<string, GrupoDTO[]>): [string, GrupoDTO[]][] {
        return Array.from(areas.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        return [...grupos].sort((a, b) => a.idUeaGrupo - b.idUeaGrupo);
    }

    ordenarProfesores(profesores: ProfesorDTO[]): ProfesorDTO[] {
        return [...profesores].sort((a, b) => a.numeroEconomico - b.numeroEconomico);
    }
}

function modeloPenaltyListo(): ModeloPenaltyCached {
    const modelo = new ModeloPenaltyCached();
    (modelo as any)._statsInicializados = true;
    return modelo;
}

function payloadBase(overrides: Partial<PenaltyObservedPayload> = {}): PenaltyObservedPayload {
    return {
        eco: '1',
        horario: 'L:08:00-10:00',
        ueas_asignadas_actuales: [],
        horarios_asignados_actuales: [],
        uea_prediccion: '100',
        ...overrides
    };
}

function grafoConTresAsignacionesPotenciales(): { grafo: GrafoBipartito; candidato: GrupoDTO } {
    const profesor = crearProfesor({
        numeroEconomico: 1,
        idArea: 10,
        horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')]
    });
    const grupos = [
        crearGrupo({ idUeaGrupo: 100, idArea: 10, ueaClave: 100, horarios: [franja(1, 8, 10)], horarioStringRaw: 'L:08:00-10:00' }),
        crearGrupo({ idUeaGrupo: 101, idArea: 10, ueaClave: 101, horarios: [franja(2, 8, 10)], horarioStringRaw: 'M:08:00-10:00' }),
        crearGrupo({ idUeaGrupo: 102, idArea: 10, ueaClave: 102, horarios: [franja(3, 8, 10)], horarioStringRaw: 'Mi:08:00-10:00' })
    ];

    const grafo = new GrafoBipartito();
    grafo.registrarProfesor(profesor);
    grupos.forEach(g => grafo.registrarGrupo(g));
    grafo.asignarMutable(1, 100);
    grafo.asignarMutable(1, 101);

    return { grafo, candidato: grupos[2] };
}

function grafoMismaUeaDosGrupos(): { grafo: GrafoBipartito; candidato: GrupoDTO } {
    // Mismo ueaClave (500) en dos grupos distintos: la carga proyectada debe ser 2.
    const profesor = crearProfesor({
        numeroEconomico: 1,
        idArea: 10,
        horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')]
    });
    const grupos = [
        crearGrupo({ idUeaGrupo: 200, idArea: 10, ueaClave: 500, horarios: [franja(1, 8, 10)], horarioStringRaw: 'L:08:00-10:00' }),
        crearGrupo({ idUeaGrupo: 201, idArea: 10, ueaClave: 500, horarios: [franja(2, 8, 10)], horarioStringRaw: 'M:08:00-10:00' })
    ];

    const grafo = new GrafoBipartito();
    grafo.registrarProfesor(profesor);
    grupos.forEach(g => grafo.registrarGrupo(g));
    grafo.asignarMutable(1, 200);

    return { grafo, candidato: grupos[1] };
}

describe('dominio ML de penalty observado', () => {
    beforeEach(() => {
        SemanaLaboral.invalidarCache();
    });

    it('PenaltyObservedCache conserva loads y best_5 en la respuesta completa', async () => {
        const cache = new PenaltyObservedCache({
            fetcher: async () => ({
                total_penalty: -0.4,
                loads: [-0.1, -0.2, -0.3, -0.4],
                best_5: [{ horario: 'L:08:00-10:00' }],
                projected_uea_count: 2,
                load_probability: 0.75,
                load_probabilities: [1, 0.75],
                load_density_ratio: 0.8,
                load_density_ratios: [1, 0.8]
            })
        });

        const response = await cache.getOrFetchResponse(payloadBase());

        expect(response.total_penalty).toBe(-0.4);
        expect(response.loads).toEqual([-0.1, -0.2, -0.3, -0.4]);
        expect(response.best_5).toEqual([{ horario: 'L:08:00-10:00' }]);
        expect(response.load_probability).toBe(0.75);
        expect(response.load_density_ratio).toBe(0.8);
        await expect(cache.getOrFetch(payloadBase())).resolves.toBe(-0.4);
    });

    it('cuenta la carga proyectada por grupo (asignaciones), no por UEA distinta, en el fallback', async () => {
        const { grafo, candidato } = grafoMismaUeaDosGrupos();
        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                // Sin projected_uea_count: fuerza el fallback _contarUeasProyectadas.
                fetcher: async () => ({ total_penalty: -0.2, loads: [-0.05, -0.1, -0.2] })
            })
        );

        const result = await penalty.evaluarCandidatoAsync(grafo, 1, candidato.idUeaGrupo);

        // Misma ueaClave (500) en 2 grupos distintos => carga 2, no 1.
        expect(result.projectedUeaCount).toBe(2);
    });

    it('respeta projected_uea_count del backend cuando esta presente (no usa el fallback)', async () => {
        const { grafo, candidato } = grafoMismaUeaDosGrupos();
        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                fetcher: async () => ({ total_penalty: -0.2, loads: [-0.05, -0.1, -0.2], projected_uea_count: 2 })
            })
        );

        const result = await penalty.evaluarCandidatoAsync(grafo, 1, candidato.idUeaGrupo);

        expect(result.projectedUeaCount).toBe(2);
    });

    it('bloquea candidatos cuando total_penalty cae en -1.5 o menos', async () => {
        const { grafo, candidato } = grafoConTresAsignacionesPotenciales();
        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                fetcher: async () => ({ total_penalty: -1.5, loads: [-0.1, -0.2] })
            })
        );

        const result = await penalty.evaluarCandidatoAsync(grafo, 1, candidato.idUeaGrupo);

        expect(result.blocked).toBe(true);
        expect(result.blockReason).toContain('PENALTY_TOTAL_FUERA_DOMINIO');
        expect(result.viabilidad).toBeCloseTo(-0.63514895, 6);
    });

    it('bloquea candidatos cuando loads[W-2] cae en -1.5 o menos', async () => {
        const { grafo, candidato } = grafoConTresAsignacionesPotenciales();
        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                fetcher: async () => ({ total_penalty: -0.2, loads: [-0.05, -1.5, -0.4] })
            })
        );

        const result = await penalty.evaluarCandidatoAsync(grafo, 1, candidato.idUeaGrupo);

        expect(result.projectedUeaCount).toBe(3);
        expect(result.loadPenalty).toBe(-1.5);
        expect(result.blocked).toBe(true);
        expect(result.blockReason).toContain('PENALTY_LOAD_FUERA_DOMINIO');
    });

    it('bloquea candidatos cuando la probabilidad KDE de carga del ECO cae bajo 0.05', async () => {
        const { grafo, candidato } = grafoConTresAsignacionesPotenciales();
        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                fetcher: async () => ({
                    total_penalty: -0.2,
                    loads: [-0.05, -0.9, -1.8],
                    projected_uea_count: 3,
                    load_probability: 0.01,
                    load_density_ratio: 0.02
                })
            })
        );

        const result = await penalty.evaluarCandidatoAsync(grafo, 1, candidato.idUeaGrupo);

        expect(result.blocked).toBe(true);
        expect(result.blockReason).toContain('PODA_CARGA_KDE_ECO');
        expect(result.loadProbability).toBe(0.01);
        expect(result.penaltyProbability).toBe(0.01);
        expect(result.viabilidad).toBe(-0.98);
    });

    it('GreedyOrchestrator suma total_penalty negativo y excluye el candidato bloqueado antes del top-K', async () => {
        const profesores = [
            crearProfesor({ numeroEconomico: 19834, idArea: 1112, horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')] }),
            crearProfesor({ numeroEconomico: 28650, idArea: 1112, horariosContratacion: [horarioDB('L-V', '10:00:00', '18:00:00')] })
        ];
        const grupos = [
            crearGrupo({ idUeaGrupo: 100, idArea: 1112, ueaClave: 1112034, horarios: [franja(1, 11.5, 13)], horarioStringRaw: 'L:11:30-13:00' })
        ];
        const penaltyCache = new PenaltyObservedCache({
            fetcher: async payload => payload.eco === '19834'
                ? { total_penalty: -1.5, loads: [-1.5], load_probability: 0.01 }
                : { total_penalty: 0, loads: [0], load_probability: 1 }
        });
        const penalty = new ViabilidadPenalizacionCarga('http://test', modeloPenaltyListo(), penaltyCache);
        const modelo = new ModeloScores({ '19834:100': 2, '28650:100': 1 });
        const orchestrator = new GreedyOrchestrator(
            new EstrategiaFija(),
            modelo.funcionZ,
            [{ constraint: penalty, lambda: 1 }],
            new EjectionChain(0, 0, new CriterioAceptacion()),
            modeloPenaltyListo(),
            { k: 1, alpha: 0 }
        );

        const result = await orchestrator.ejecutarAsync(profesores, grupos);

        expect(result.asignaciones).toEqual([{ numeroEconomico: 28650, idUeaGrupo: 100 }]);
        expect(result.metricas.scoreZ).toBe(1);
        const logGrupo = result.metricas.logsFase1?.find(log => log.idUeaGrupo === 100);
        const bloqueado = logGrupo?.candidatosTentados.find(c => c.eco === 19834 && c.penaltyBlocked);
        expect(bloqueado?.penaltyBlocked).toBe(true);
    });

    it('EjectionChain async rechaza el primer candidato bloqueado por penalty y prueba el siguiente', async () => {
        const profesores = [
            crearProfesor({ numeroEconomico: 1, idArea: 10, horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')] }),
            crearProfesor({ numeroEconomico: 2, idArea: 10, horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')] })
        ];
        const grupo = crearGrupo({
            idUeaGrupo: 100,
            idArea: 10,
            ueaClave: 100,
            horarios: [franja(1, 8, 10)],
            horarioStringRaw: 'L:08:00-10:00'
        });
        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grafo.registrarGrupo(grupo);

        const penalty = new ViabilidadPenalizacionCarga(
            'http://test',
            modeloPenaltyListo(),
            new PenaltyObservedCache({
                fetcher: async payload => payload.eco === '1'
                    ? { total_penalty: -1.5, loads: [-1.5], load_probability: 0.01 }
                    : { total_penalty: 0, loads: [0], load_probability: 1 }
            })
        );
        const funcionZ = new FuncionObjetivoZ(
            [{ constraint: penalty, lambda: 1 }],
            new ModeloScores({ '1:100': 1, '2:100': 1 }).funcionZ
        );
        const fsm = new FSMAsignador(grafo, []);
        const ejection = new EjectionChain(0, 0, new CriterioAceptacion());
        const logs: any[] = [];

        const result = await ejection.mejorarSolucionAsync(grafo, fsm, funcionZ, [100], logs);

        expect(result.reparaciones).toBe(1);
        expect(grafo.asignacionesInversas.get(100)).toBe(2);
        expect(logs.some(log => log.tipo === 'PENALTY_DOMAIN_BLOCK' && log.ecoCandidato === 1)).toBe(true);
    });
});
