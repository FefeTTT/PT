/**
 * Criterio de aceptación con tolerancia numérica
 * tolerancia = epsAbs + epsRel × max(1, |zActual|)
 * epsRel escala con la magnitud de Z para absorber error acumulado
 * en sumas largas (Σ w_ig, Σ λ_k·f_k). epsAbs protege cuando Z ≈ 0.
 */
export class CriterioAceptacion {
    private readonly _epsAbs: number;
    private readonly _epsRel: number;
    private readonly _alfa: number;

    constructor(epsAbs: number = 1e-9, epsRel: number = 1e-9, alfa: number = 0) {
        this._epsAbs = epsAbs;
        this._epsRel = epsRel;
        this._alfa = alfa;
    }

    private _calcularTolerancia(zActual: number): number {
        return this._epsAbs + this._epsRel * Math.max(1, Math.abs(zActual));
    }

    private _calcularUmbralMovimiento(numCambios: number): number {
        return this._alfa * numCambios;
    }

    public esMejoraSignificativa(zNuevo: number, zActual: number, numCambios: number = 1): boolean {
        const tolerancia = this._calcularTolerancia(zActual);
        const umbralMovimiento = this._calcularUmbralMovimiento(numCambios);
        return zNuevo > zActual + tolerancia + umbralMovimiento;
    }

    public clasificarDelta(
        zNuevo: number,
        zActual: number,
        numCambios: number = 1
    ): ClasificacionDelta {
        const delta = zNuevo - zActual;
        const tolerancia = this._calcularTolerancia(zActual);
        const umbralMovimiento = this._calcularUmbralMovimiento(numCambios);

        if (this.esMejoraSignificativa(zNuevo, zActual, numCambios)) {
            return ClasificacionDelta.MEJORA_SIGNIFICATIVA;
        }

        if (Math.abs(delta) <= tolerancia) {
            return ClasificacionDelta.RUIDO_NUMERICO;
        }

        if (delta > tolerancia && delta <= tolerancia + umbralMovimiento) {
            return ClasificacionDelta.RECHAZADA_POR_UMBRAL;
        }

        return ClasificacionDelta.SIN_MEJORA;
    }
}

export enum ClasificacionDelta {
    MEJORA_SIGNIFICATIVA = 'MEJORA_SIGNIFICATIVA',
    RUIDO_NUMERICO = 'RUIDO_NUMERICO',
    RECHAZADA_POR_UMBRAL = 'RECHAZADA_POR_UMBRAL',
    SIN_MEJORA = 'SIN_MEJORA',
}
