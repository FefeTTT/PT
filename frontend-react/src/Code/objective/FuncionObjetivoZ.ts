import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML, ModeloMLUniforme, scoreNormalizado } from '../ml/IModeloML';
import {
    IPerfilCargaConsecutivaProvider,
    PESO_PENALIZACION_CONSECUTIVA,
    PerfilCargaConsecutivaConstante
} from '../ml/PerfilCargaConsecutiva';
import { ISoftConstraint } from './SoftConstraints';
import { calcularPromedioPenalizacionCargaConsecutivaGrafo } from './CargaConsecutivaHistorica';

export interface ConstraintPonderada {
    constraint: ISoftConstraint;
    lambda: number;
}

export interface PesosObjetivoZ {
    pesoCobertura: number;
    pesoScoreML: number;
    pesoPenalizacionConsecutiva: number;
}

export interface ResultadoZ {
    Z: number;
    asignados: number;
    cobertura: number;
    avgScoreML: number;
    scoreML: number;
    viabilidadTotal: number;
    penalizacionCargaConsecutiva: number;
    valorPenalizacionCargaConsecutiva: number;
    desglose: { nombre: string; scoreViabilidad: number; lambda: number; valorAportado: number }[];
}

export const PESO_COBERTURA_DEFAULT = 10;
export const PESO_SCORE_ML_DEFAULT = 1;

const PESOS_DEFAULT: PesosObjetivoZ = {
    pesoCobertura: PESO_COBERTURA_DEFAULT,
    pesoScoreML: PESO_SCORE_ML_DEFAULT,
    pesoPenalizacionConsecutiva: PESO_PENALIZACION_CONSECUTIVA
};

/**
 * Funcion objetivo con soft constraints positivas y penalizacion historica
 * externa de carga consecutiva.
 *
 * Z = pesoCobertura * asignados + pesoScoreML * avg(s_ig)
 *     + sum(lambda_k * V_k) - pesoPenalizacionConsecutiva * avg(P_consec)
 */
export class FuncionObjetivoZ {
    private readonly _modelo: IModeloML;
    private readonly _constraints: ConstraintPonderada[];
    private readonly _perfilCargaProvider: IPerfilCargaConsecutivaProvider;
    private readonly _pesos: PesosObjetivoZ;

    constructor(
        constraints: ConstraintPonderada[] = [],
        modelo?: IModeloML,
        perfilCargaProvider?: IPerfilCargaConsecutivaProvider,
        pesos?: Partial<PesosObjetivoZ>
    ) {
        this._modelo = modelo ?? new ModeloMLUniforme();
        this._constraints = constraints;
        this._perfilCargaProvider = perfilCargaProvider ?? new PerfilCargaConsecutivaConstante();
        this._pesos = { ...PESOS_DEFAULT, ...pesos };
    }

    public evaluarGrafo(grafo: GrafoBipartito): ResultadoZ {
        let sumaScoreML = 0;

        for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
            sumaScoreML += scoreNormalizado(this._modelo, numEco, idGrupo);
        }

        const asignados = grafo.asignacionesInversas.size;
        const avgScoreML = asignados > 0 ? sumaScoreML / asignados : 0;
        const cobertura = this._pesos.pesoCobertura * asignados;
        const scoreML = this._pesos.pesoScoreML * avgScoreML;

        let viabilidadTotal = 0;
        const desglose: ResultadoZ['desglose'] = [];

        for (const cp of this._constraints) {
            const scoreViabilidad = Math.max(0, Math.min(1, cp.constraint.evaluar(grafo, this._modelo)));
            const valorAportado = cp.lambda * scoreViabilidad;
            viabilidadTotal += valorAportado;

            desglose.push({
                nombre: cp.constraint.nombre,
                scoreViabilidad,
                lambda: cp.lambda,
                valorAportado
            });
        }

        const penalizacionCargaConsecutiva = calcularPromedioPenalizacionCargaConsecutivaGrafo(
            grafo,
            this._perfilCargaProvider
        );
        const valorPenalizacionCargaConsecutiva =
            this._pesos.pesoPenalizacionConsecutiva * penalizacionCargaConsecutiva;

        return {
            Z: cobertura + scoreML + viabilidadTotal - valorPenalizacionCargaConsecutiva,
            asignados,
            cobertura,
            avgScoreML,
            scoreML,
            viabilidadTotal,
            penalizacionCargaConsecutiva,
            valorPenalizacionCargaConsecutiva,
            desglose
        };
    }
}
