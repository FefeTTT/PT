import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { AsignacionInput, ResultadoGreedy, MetricasGreedy, EstrategiaOrdenamiento } from './GreedyTypes';
import { EstrategiaMCV } from './EstrategiaMCV';
import { IModeloML, ModeloMLUniforme } from '../ml/IModeloML';
import { FuncionObjetivoZ, ConstraintPonderada } from '../objective/FuncionObjetivoZ';
import { PenalizacionHuecos, PenalizacionCargaConsecutiva } from '../objective/SoftConstraints';
import { EjectionChain } from './EjectionChain';

/**
 * GreedyOrchestrator — GRASP (Greedy Randomized Adaptive Search Procedure).
 *
 * Clase pura (sin dependencias React/DOM).
 * Recibe catálogos crudos de profesores y grupos, genera combinaciones,
 * las valida con FSMAsignador, y produce un AsignacionInput[] con los
 * emparejamientos exitosos.
 *
 * Fases del GRASP:
 * 1. Fase Constructiva: Greedy con RCL probabilístico (o MCV determinista).
 * 2. Evaluación: Función objetivo Z (recompensa ML − penalización suave).
 * 3. Búsqueda Local: Ejection Chains (KHE14) para mejora iterativa.
 *
 * Diseñada para instanciar tanto en el hilo principal como en un Web Worker.
 */
export class GreedyOrchestrator {
    private _estrategia: EstrategiaOrdenamiento;
    private _limiteHorasSemanales: number;
    private _modelo: IModeloML;
    private _funcionZ: FuncionObjetivoZ;
    private _ejectionChain: EjectionChain;

    constructor(
        estrategia: EstrategiaOrdenamiento = new EstrategiaMCV(),
        limiteHorasSemanales: number = 24,
        modelo?: IModeloML,
        constraintsPersonalizados?: ConstraintPonderada[],
        ejectionChain?: EjectionChain
    ) {
        this._estrategia = estrategia;
        this._limiteHorasSemanales = limiteHorasSemanales;
        this._modelo = modelo ?? new ModeloMLUniforme();

        // Constraints por defecto si no se proporcionan
        const constraints = constraintsPersonalizados ?? [
            { constraint: new PenalizacionHuecos(), lambda: 2.0 },
            { constraint: new PenalizacionCargaConsecutiva(3), lambda: 1.5 }
        ];

        this._funcionZ = new FuncionObjetivoZ(constraints, this._modelo);
        this._ejectionChain = ejectionChain ?? new EjectionChain();
    }

    /**
     * Ejecuta el algoritmo GRASP sobre los catálogos proporcionados.
     *
     * @param profesores Lista completa de profesores disponibles.
     * @param grupos Lista completa de grupos a asignar.
     * @returns ResultadoGreedy con asignaciones exitosas, métricas y scoreZ.
     */
    public ejecutar(profesores: ProfesorDTO[], grupos: GrupoDTO[]): ResultadoGreedy {
        const inicio = performance.now();

        SemanaLaboral.invalidarCache();

        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        const reglas = ReglasPipeline.crear(this._limiteHorasSemanales);
        const fsm = new FSMAsignador(grafo, reglas);
        const gruposPorArea = this._agruparPorArea(grupos);
        const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
        const profesoresPorArea = this._agruparProfesoresPorArea(profesores);

        const gruposAsignados = new Set<number>();
        let totalEvaluaciones = 0;
        let totalRechazados = 0;

        for (const [idArea, gruposDelArea] of areasOrdenadas) {
            const profesoresDelArea = profesoresPorArea.get(idArea) || [];
            if (profesoresDelArea.length === 0) continue;

            const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);
            const profesoresOrdenados = this._estrategia.ordenarProfesores(profesoresDelArea);

            for (const grupo of gruposOrdenados) {
                if (gruposAsignados.has(grupo.idUeaGrupo)) continue;

                for (const profesor of profesoresOrdenados) {
                    totalEvaluaciones++;

                    const resultado = fsm.procesarAsignacion(
                        profesor.numeroEconomico,
                        grupo.idUeaGrupo
                    );

                    if (resultado.estado === EstadoAsignacion.ASIGNACION_OK) {
                        grafo.asignarMutable(profesor.numeroEconomico, grupo.idUeaGrupo);
                        gruposAsignados.add(grupo.idUeaGrupo);
                        break;
                    } else {
                        totalRechazados++;
                    }
                }
            }
        }

        fsm.actualizarGrafo(grafo);

        // Computar huérfanos pre-búsqueda local para Fase 1 de reparación
        const todosLosGrupoIds = grupos.map(g => g.idUeaGrupo);
        const huerfanosPreRepair = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const resultadoMejora = this._ejectionChain.mejorar(grafo, fsm, this._funcionZ, huerfanosPreRepair);
        const resultadoZ = this._funcionZ.evaluarGrafo(grafo);
        const asignaciones: AsignacionInput[] = [];
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            asignaciones.push({
                numeroEconomico: numEco,
                idUeaGrupo: idGrupo
            });
        }

        // Re-computar grupos sin asignar después de la fase de mejora
        const gruposSinAsignar = todosLosGrupoIds.filter(id => !grafo.asignacionesInversas.has(id));

        const fin = performance.now();

        const metricas: MetricasGreedy = {
            totalEvaluaciones,
            totalAsignados: asignaciones.length,
            totalRechazados,
            tiempoMs: Math.round(fin - inicio),
            gruposSinAsignar,
            scoreZ: resultadoZ.Z,
            mejorasLocales: resultadoMejora.mejoras,
            reparaciones: resultadoMejora.reparaciones
        };

        return { asignaciones, metricas };
    }

    private _agruparPorArea(grupos: GrupoDTO[]): Map<number, GrupoDTO[]> {
        const mapa = new Map<number, GrupoDTO[]>();
        for (const grupo of grupos) {
            if (!mapa.has(grupo.idArea)) {
                mapa.set(grupo.idArea, []);
            }
            mapa.get(grupo.idArea)!.push(grupo);
        }
        return mapa;
    }

    private _agruparProfesoresPorArea(profesores: ProfesorDTO[]): Map<number, ProfesorDTO[]> {
        const mapa = new Map<number, ProfesorDTO[]>();
        for (const profesor of profesores) {
            if (!mapa.has(profesor.idArea)) {
                mapa.set(profesor.idArea, []);
            }
            mapa.get(profesor.idArea)!.push(profesor);
        }
        return mapa;
    }
}
