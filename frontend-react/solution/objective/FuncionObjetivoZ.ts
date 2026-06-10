import { GrafoBipartito } from '../models/GrafoBipartito';
import { ZScoreDetails, ZScoreFunction, explicarBloqueoZScore, funcionZUniforme } from '../ml/IModeloML';
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

export interface ResultadoDominioCandidato {
    permitido: boolean;
    rechazos: string[];
}


/**
 * Función Objetivo Z para el GRASP.
 *
 *   Z = Σ(i∈P, g∈G) s_ijh · x_ig  +  Σ(k∈K) λ_k · V_k(X)
 * - El componente de recompensa usa scores directos pre-elásticos
 */
export class FuncionObjetivoZ {
    private _funcionZ: ZScoreFunction;
    private _constraints: ConstraintPonderada[];

    constructor(
        constraints: ConstraintPonderada[] = [],
        funcionZ?: ZScoreFunction
    ) {
        this._funcionZ = funcionZ ?? funcionZUniforme;
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
            const zDetails = this._funcionZ(numEco, idGrupo, grafo);
            recompensa += zDetails.score; 
        }

        // ── Componente de viabilidades ponderadas: Σ λ_k · V_k(X) ──
        let viabilidadTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const scoreViabilidad = cp.constraint.evaluar(grafo, this._funcionZ);
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
            const zDetails = this._funcionZ(numEco, idGrupo, grafo);
            recompensa += zDetails.score;
        }

        let viabilidadTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const scoreViabilidad = cp.constraint.evaluarAsync
                ? await cp.constraint.evaluarAsync(grafo, this._funcionZ, context)
                : cp.constraint.evaluar(grafo, this._funcionZ);
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

    public async evaluarDominioCandidatoAsync(
        grafo: GrafoBipartito,
        numEco: number,
        idGrupoCandidato: number,
        context?: EvaluationContext
    ): Promise<ResultadoDominioCandidato> {
        const rechazos: string[] = [];
        const detallesZ = this._funcionZ(numEco, idGrupoCandidato, grafo);
        const bloqueoZ = explicarBloqueoZScore(detallesZ);

        if (bloqueoZ) {
            rechazos.push(`FUNCION_Z: ${bloqueoZ}`);
        }

        for (const cp of this._constraints) {
            if (!cp.constraint.evaluarCandidatoAsync) continue;

            const resultado = await cp.constraint.evaluarCandidatoAsync(
                grafo,
                numEco,
                idGrupoCandidato,
                context
            );

            if (resultado.blocked) {
                rechazos.push(`${cp.constraint.nombre}: ${resultado.blockReason ?? 'candidato fuera de dominio'}`);
            }
        }

        return {
            permitido: rechazos.length === 0,
            rechazos
        };
    }

    public obtenerDetallesCandidato(
        grafo: GrafoBipartito,
        numEco: number,
        idGrupoCandidato: number
    ): ZScoreDetails {
        return this._funcionZ(numEco, idGrupoCandidato, grafo);
    }
}
