import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML, ModeloMLUniforme } from '../ml/IModeloML';
import { ISoftConstraint } from './SoftConstraints';

/**
 * Configuración de una restricción suave con su peso de penalización.
 */
export interface ConstraintPonderada {
    constraint: ISoftConstraint;
    lambda: number;
}

/**
 * Resultado detallado de la evaluación de Z.
 */
export interface ResultadoZ {
    /** Valor total de Z (recompensa − penalización). */
    Z: number;
    /** Componente de recompensa: Σ w_ig · x_ig */
    recompensa: number;
    /** Componente de penalización total: Σ λ_k · f_k(X) */
    penalizacionTotal: number;
    /** Desglose por restricción suave. */
    desglose: { nombre: string; violacion: number; lambda: number; penalizacion: number }[];
}

/**
 * Función Objetivo Z para el GRASP.
 *
 *   Z = Σ(i∈P, g∈G) w_ig · x_ig  −  Σ(k∈K) λ_k · f_k(X)
 *
 * Clase pura (sin dependencias React/DOM).
 * - El componente de recompensa usa scores del modelo ML (w_ig).
 * - El componente de penalización usa restricciones suaves ponderadas.
 */
export class FuncionObjetivoZ {
    private _modelo: IModeloML;
    private _constraints: ConstraintPonderada[];

    constructor(
        constraints: ConstraintPonderada[] = [],
        modelo?: IModeloML
    ) {
        this._modelo = modelo ?? new ModeloMLUniforme();
        this._constraints = constraints;
    }

    /**
     * Evalúa la función objetivo Z sobre el grafo completo.
     * @param grafo  Estado actual de asignaciones.
     * @returns Resultado con Z, recompensa, penalización y desglose.
     */
    public evaluar(grafo: GrafoBipartito): ResultadoZ {
        // ── Componente de recompensa: Σ w_ig · x_ig ──
        let recompensa = 0;
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            const w = this._modelo.score(numEco, idGrupo);
            recompensa += w; // x_ig = 1 para todas las asignaciones en el mapa
        }

        // ── Componente de penalización: Σ λ_k · f_k(X) ──
        let penalizacionTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const violacion = cp.constraint.evaluar(grafo);
            const penalizacion = cp.lambda * violacion;
            penalizacionTotal += penalizacion;

            desglose.push({
                nombre: cp.constraint.nombre,
                violacion,
                lambda: cp.lambda,
                penalizacion
            });
        }

        return {
            Z: recompensa - penalizacionTotal,
            recompensa,
            penalizacionTotal,
            desglose
        };
    }
}
