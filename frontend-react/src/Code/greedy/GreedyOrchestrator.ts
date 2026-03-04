import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { AsignacionInput, ResultadoGreedy, MetricasGreedy, EstrategiaOrdenamiento } from './GreedyTypes';
import { EstrategiaMCV } from './EstrategiaMCV';

/**
 * GreedyOrchestrator — Generador de Propuestas de Asignación.
 * 
 * Clase pura (sin dependencias React/DOM).
 * Recibe catálogos crudos de profesores y grupos, genera combinaciones,
 * las valida con FSMAsignador, y produce un AsignacionInput[] con los
 * emparejamientos exitosos.
 * 
 * Diseñada para instanciar tanto en el hilo principal como en un Web Worker.
 */
export class GreedyOrchestrator {
    private _estrategia: EstrategiaOrdenamiento;
    private _limiteHorasSemanales: number;

    constructor(
        estrategia: EstrategiaOrdenamiento = new EstrategiaMCV(),
        limiteHorasSemanales: number = 24
    ) {
        this._estrategia = estrategia;
        this._limiteHorasSemanales = limiteHorasSemanales;
    }

    /**
     * Ejecuta el algoritmo Greedy sobre los catálogos proporcionados.
     * 
     * @param profesores Lista completa de profesores disponibles.
     * @param grupos Lista completa de grupos a asignar.
     * @returns ResultadoGreedy con asignaciones exitosas y métricas.
     */
    public ejecutar(profesores: ProfesorDTO[], grupos: GrupoDTO[]): ResultadoGreedy {
        const inicio = performance.now();

        // 1. Invalidar caché de SemanaLaboral al inicio de cada ejecución
        SemanaLaboral.invalidarCache();

        // 2. Construir el grafo bipartito con todos los datos
        const grafo = new GrafoBipartito();
        profesores.forEach(p => grafo.registrarProfesor(p));
        grupos.forEach(g => grafo.registrarGrupo(g));

        // 3. Crear la FSM con el pipeline de reglas (una sola instancia)
        const reglas = ReglasPipeline.crear(this._limiteHorasSemanales);
        const fsm = new FSMAsignador(grafo, reglas);

        // 4. Agrupar grupos por idArea
        const gruposPorArea = this._agruparPorArea(grupos);

        // 5. Ordenar áreas por la estrategia (MCV: áreas pequeñas primero)
        const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);

        // 6. Indexar profesores por idArea para lookup rápido
        const profesoresPorArea = this._agruparProfesoresPorArea(profesores);

        // 7. Iterar y asignar
        const asignaciones: AsignacionInput[] = [];
        const gruposAsignados = new Set<number>();
        let totalEvaluaciones = 0;
        let totalRechazados = 0;

        for (const [idArea, gruposDelArea] of areasOrdenadas) {
            // Obtener profesores de esta área
            const profesoresDelArea = profesoresPorArea.get(idArea) || [];
            if (profesoresDelArea.length === 0) continue;

            // Ordenar grupos dentro del área según estrategia
            const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);

            // Ordenar profesores dentro del área según estrategia
            const profesoresOrdenados = this._estrategia.ordenarProfesores(profesoresDelArea);

            for (const grupo of gruposOrdenados) {
                // Si el grupo ya fue asignado, saltar
                if (gruposAsignados.has(grupo.idUeaGrupo)) continue;

                for (const profesor of profesoresOrdenados) {
                    totalEvaluaciones++;

                    const resultado = fsm.procesarAsignacion(
                        profesor.numeroEconomico,
                        grupo.idUeaGrupo
                    );

                    if (resultado.estado === EstadoAsignacion.ASIGNACION_OK) {
                        // Consolidar asignación
                        asignaciones.push({
                            numeroEconomico: profesor.numeroEconomico,
                            idUeaGrupo: grupo.idUeaGrupo
                        });

                        // Actualizar grafo in-place para la siguiente evaluación
                        grafo.asignarMutable(profesor.numeroEconomico, grupo.idUeaGrupo);

                        // Marcar grupo como asignado
                        gruposAsignados.add(grupo.idUeaGrupo);

                        // Romper inner loop: este grupo ya tiene profesor
                        break;
                    } else {
                        totalRechazados++;
                    }
                }
            }
        }

        // 8. Computar grupos sin asignar
        const todosLosGrupoIds = grupos.map(g => g.idUeaGrupo);
        const gruposSinAsignar = todosLosGrupoIds.filter(id => !gruposAsignados.has(id));

        const fin = performance.now();

        const metricas: MetricasGreedy = {
            totalEvaluaciones,
            totalAsignados: asignaciones.length,
            totalRechazados,
            tiempoMs: Math.round(fin - inicio),
            gruposSinAsignar
        };

        return { asignaciones, metricas };
    }

    /** Agrupa los grupos por su idArea. */
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

    /** Agrupa los profesores por su idArea. */
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
