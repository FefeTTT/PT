import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML } from '../ml/IModeloML';

/**
 * El valor retornado debe ser ≥ 0 (0 = sin violación).
 * Recibe el modelo ML para modular la penalización con los pesos w_ig.
 */
export interface ISoftConstraint {
    readonly nombre: string;
    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number;
}

interface FranjaDia {
    dia: number;
    horaInicio: number;
    horaFin: number;
}

/**
 * Franja enriquecida con el idGrupo que la origina.
 * Permite consultar w_ig del modelo para las asignaciones que forman un bloque.
 */
interface FranjaDiaConGrupo extends FranjaDia {
    idGrupo: number;
}

function obtenerFranjasHorariasProfesor(numeroEconomico: number, grafo: GrafoBipartito): FranjaDiaConGrupo[] {
    const gruposAsignados = grafo.adyacencias.get(numeroEconomico) || [];
    const franjas: FranjaDiaConGrupo[] = [];

    if (gruposAsignados.length === 0) return [];

    for (const idGrupo of gruposAsignados) {
        const grupo = grafo.grupos.get(idGrupo);
        if (!grupo) continue;

        for (const h of grupo.horarios) {
            franjas.push({ dia: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin, idGrupo });
        }
    }

    return franjas;
}

function agruparFranjasPorDiaGetMapa(franjas: FranjaDiaConGrupo[]): Map<number, FranjaDiaConGrupo[]> {
    const mapa = new Map<number, FranjaDiaConGrupo[]>();
    for (const franja of franjas) {
        if (!mapa.has(franja.dia)) {
            mapa.set(franja.dia, []);
        }
        mapa.get(franja.dia)!.push(franja);
    }

    for (const [, lista] of mapa) { // Ordenar cada día por hora de inicio
        lista.sort((a, b) => a.horaInicio - b.horaInicio);
    }
    return mapa;
}

/**
 * Para cada profesor, por cada día, cuenta las horas de huecos entre clases asignadas.
 * Si un profesor tiene clase de 8:00-10:00 y de 12:00-14:00 el lunes, hay 2 horas de hueco.
 *
 * La penalización se modula con w_ig y se normaliza a [0, 1]:
 *   f = (1/P_activos) × Σ_p ( hueco × (1 − w̄_ig) / REF_MAX_HUECOS )
 * donde REF_MAX_HUECOS (default 4h) es la referencia de violación máxima esperada.
 */
export class PenalizacionHuecos implements ISoftConstraint {
    readonly nombre = 'PENALIZACION_HUECOS';
    private _refMaxHuecos: number;

    /** @param refMaxHuecosDia Horas de referencia máxima de huecos por profesor-día para normalizar (default: 4h). */
    constructor(refMaxHuecosDia: number = 4) {
        this._refMaxHuecos = refMaxHuecosDia;
    }

    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number {
        let totalHuecos = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;
            profesoresActivos++;

            const porDia = agruparFranjasPorDiaGetMapa(franjas);

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length < 2) continue;

                for (let i = 1; i < franjasDia.length; i++) {
                    const finAnterior = franjasDia[i - 1].horaFin;
                    const inicioActual = franjasDia[i].horaInicio;
                    const hueco = inicioActual - finAnterior;
                    if (hueco > 0) {
                        const wAnterior = modelo.score(numEco, franjasDia[i - 1].idGrupo);
                        const wActual = modelo.score(numEco, franjasDia[i].idGrupo);
                        const wPromedio = (wAnterior + wActual) / 2;

                        // Normalizar cada hueco contra la referencia max, cap a 1.0
                        const huecoNorm = Math.min(hueco / this._refMaxHuecos, 1.0);
                        totalHuecos += huecoNorm * (1 - wPromedio);
                    }
                }
            }
        }

        // Promediar por profesores activos → resultado ∈ [0, 1]
        return profesoresActivos > 0 ? totalHuecos / profesoresActivos : 0;
    }
}

/**
 * Penalización por carga consecutiva, normalizada a [0, 1].
 * Para cada profesor, por cada día, calcula las horas consecutivas de clase.
 * Si excede el umbral (default: 3h), penaliza proporcionalmente.
 *
 * Modulada por w_ig del XGBoost:
 *   - Profesor que siempre da 2 labs seguidos → w_ig alto → penalización ≈ 0
 *   - Profesor que nunca ha dado bloques largos → w_ig bajo → penalización completa
 *
 * Normalización:
 *   f = (1/P_activos) × Σ_p ( exceso/(REF_MAX_EXCESO) × (1 − w̄_ig) )
 *   donde REF_MAX_EXCESO (default 3h) es la referencia del exceso máximo esperado.
 */
export class PenalizacionCargaConsecutiva implements ISoftConstraint {
    readonly nombre = 'PENALIZACION_CARGA_CONSECUTIVA';
    private _umbralHoras: number;
    private _refMaxExceso: number;

    /**
     * @param umbralHoras  Horas consecutivas permitidas antes de penalizar (default: 3h).
     * @param refMaxExceso Exceso máximo de referencia para normalizar a [0,1] (default: 3h).
     */
    constructor(umbralHoras: number = 3, refMaxExceso: number = 3) {
        this._umbralHoras = umbralHoras;
        this._refMaxExceso = refMaxExceso;
    }

    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number {
        let totalPenalizacion = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;
            profesoresActivos++;

            const porDia = agruparFranjasPorDiaGetMapa(franjas);

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length === 0) continue;

                const bloques: { inicio: number; fin: number; grupoIds: number[] }[] = [];
                let actual = {
                    inicio: franjasDia[0].horaInicio,
                    fin: franjasDia[0].horaFin,
                    grupoIds: [franjasDia[0].idGrupo]
                };

                for (let i = 1; i < franjasDia.length; i++) {
                    if (franjasDia[i].horaInicio <= actual.fin) {
                        actual.fin = Math.max(actual.fin, franjasDia[i].horaFin);
                        actual.grupoIds.push(franjasDia[i].idGrupo);
                    } else {
                        bloques.push({ ...actual, grupoIds: [...actual.grupoIds] });
                        actual = {
                            inicio: franjasDia[i].horaInicio,
                            fin: franjasDia[i].horaFin,
                            grupoIds: [franjasDia[i].idGrupo]
                        };
                    }
                }
                bloques.push({ ...actual, grupoIds: [...actual.grupoIds] });

                for (const bloque of bloques) {
                    const duracion = bloque.fin - bloque.inicio;
                    if (duracion > this._umbralHoras) {
                        const exceso = duracion - this._umbralHoras;

                        const gruposUnicos = [...new Set(bloque.grupoIds)];
                        const sumaW = gruposUnicos.reduce(
                            (acc, gId) => acc + modelo.score(numEco, gId), 0
                        );
                        const wPromedio = gruposUnicos.length > 0 ? sumaW / gruposUnicos.length : 0;

                        // Normalizar exceso contra referencia, cap a 1.0
                        const excesoNorm = Math.min(exceso / this._refMaxExceso, 1.0);
                        totalPenalizacion += excesoNorm * (1 - wPromedio);
                    }
                }
            }
        }

        // Promediar por profesores activos → resultado ∈ [0, 1]
        return profesoresActivos > 0 ? totalPenalizacion / profesoresActivos : 0;
    }
}
