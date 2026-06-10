import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML, ModeloMLUniforme } from '../ml/IModeloML';
import { EvaluationContext, ISoftConstraint } from './SoftConstraints';

export interface ConstraintPonderada {
    constraint: ISoftConstraint;
    lambda: number;
}

export interface ResultadoZ {
    Z: number;
    /** Componente de recompensa principal: Σ s_ijh · x_ig */
    recompensa: number;
    /** Componente de viabilidad total: Σ λ_k · V_k(X) */
    viabilidadTotal: number;
    /** Desglose por restricción suave o módulo de viabilidad. */
    desglose: { nombre: string; scoreViabilidad: number; lambda: number; valorAportado: number }[];
}

/**
 * Función Objetivo Z para el GRASP.
 *
 *   Z = Σ(i∈P, g∈G) s_ijh · x_ig  +  Σ(k∈K) λ_k · V_k(X)
 * - El componente de recompensa usa scores directos pre-elásticos
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
     * @returns Resultado con Z, recompensa, viabilidad general y desglose.
     */
    public evaluarGrafo(grafo: GrafoBipartito): ResultadoZ {
        // ── Componente de recompensa: Σ s_ijh · x_ig ──
        let recompensa = 0;
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            const w = this._modelo.score(numEco, idGrupo);
            recompensa += w; 
        }

        // ── Componente de viabilidades ponderadas: Σ λ_k · V_k(X) ──
        let viabilidadTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const scoreViabilidad = cp.constraint.evaluar(grafo, this._modelo);
            const valorAportado = cp.lambda * scoreViabilidad;
            viabilidadTotal += valorAportado;

            desglose.push({
                nombre: cp.constraint.nombre,
                scoreViabilidad,
                lambda: cp.lambda,
                valorAportado
            });
        }

        return {
            Z: recompensa + viabilidadTotal,
            recompensa,
            viabilidadTotal,
            desglose
        };
    }

    public async evaluarGrafoAsync(grafo: GrafoBipartito, context?: EvaluationContext): Promise<ResultadoZ> {
        let recompensa = 0;
        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            const w = this._modelo.score(numEco, idGrupo);
            recompensa += w;
        }

        let viabilidadTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const scoreViabilidad = cp.constraint.evaluarAsync
                ? await cp.constraint.evaluarAsync(grafo, this._modelo, context)
                : cp.constraint.evaluar(grafo, this._modelo);
            const valorAportado = cp.lambda * scoreViabilidad;
            viabilidadTotal += valorAportado;

            desglose.push({
                nombre: cp.constraint.nombre,
                scoreViabilidad,
                lambda: cp.lambda,
                valorAportado
            });
        }

        return {
            Z: recompensa + viabilidadTotal,
            recompensa,
            viabilidadTotal,
            desglose
        };
    }
}
