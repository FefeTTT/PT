import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML } from '../ml/IModeloML';

/**
 * El valor retornado debe ser ≥ 0 y tendiente a 1.0  (1.0 = excelente, cercanía a 0 = inviable).
 */
export interface ISoftConstraint {
    readonly nombre: string;
    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number;
    evaluarAsync?(grafo: GrafoBipartito, modelo: IModeloML, context?: EvaluationContext): Promise<number>;
}

export interface EvaluationContext {
    [key: string]: unknown;
}

interface FranjaDia {
    dia: number;
    horaInicio: number;
    horaFin: number;
}

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

    for (const [, lista] of mapa) {
        lista.sort((a, b) => a.horaInicio - b.horaInicio);
    }
    return mapa;
}

/**
 * Evalúa la viabilidad en relación con los huecos muertos.
 * 1.0 (100% viable) indica sin huecos o huecos respaldados por alta afinidad del ML.
 * Si detecta huecos sin validación estadística, merma la viabilidad hasta un piso de 0.0.
 */
export class ViabilidadHuecos implements ISoftConstraint {
    readonly nombre = 'VIABILIDAD_HUECOS';
    private _refMaxHuecos: number;

    constructor(refMaxHuecosDia: number = 4) {
        this._refMaxHuecos = refMaxHuecosDia;
    }

    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number {
        let viabilidadTotalAcumulada = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;
            profesoresActivos++;

            const porDia = agruparFranjasPorDiaGetMapa(franjas);
            let reduccionesAlProfesor = 0;

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length < 2) continue;

                for (let i = 1; i < franjasDia.length; i++) {
                    const hueco = franjasDia[i].horaInicio - franjasDia[i - 1].horaFin;
                    if (hueco > 0) {
                        // Puntaje predictivo nos indica si este profesor suele aceptar estos huecos en la práctica (h_ih)
                        const wAnterior = modelo.score(numEco, franjasDia[i - 1].idGrupo);
                        const wActual = modelo.score(numEco, franjasDia[i].idGrupo);
                        // w ya es s_ijh, que puede llegar a mas de 1. Vamos a normalizar su deducción:
                        // Mayor score s_ijh -> Menor deducción
                        const wPromedio = (wAnterior + wActual) / 2;
                        const factorMitigante = Math.max(0, 1 - wPromedio);

                        const huecoNorm = Math.min(hueco / this._refMaxHuecos, 1.0);
                        reduccionesAlProfesor += huecoNorm * factorMitigante;
                    }
                }
            }

            const viabilidadDeEsteProfesor = Math.max(0, 1.0 - reduccionesAlProfesor);
            viabilidadTotalAcumulada += viabilidadDeEsteProfesor;
        }

        return profesoresActivos > 0 ? viabilidadTotalAcumulada / profesoresActivos : 0;
    }
}

/**
 * Viabilidad de carga continua. Si un educador excede N horas de dictado seguido,
 * bajará su puntuación de factor óptimo u orgánico (tendiendo a 0).
 */
export class ViabilidadCargaConsecutiva implements ISoftConstraint {
    readonly nombre = 'VIABILIDAD_CARGA_CONSECUTIVA';
    private _umbralHoras: number;
    private _refMaxExceso: number;

    constructor(umbralHoras: number = 3, refMaxExceso: number = 3) {
        this._umbralHoras = umbralHoras;
        this._refMaxExceso = refMaxExceso;
    }

    evaluar(grafo: GrafoBipartito, modelo: IModeloML): number {
        let viabilidadTotalAcumulada = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;
            profesoresActivos++;

            const porDia = agruparFranjasPorDiaGetMapa(franjas);
            let reduccionesAlProfesor = 0;

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
                        bloques.push({ ...actual });
                        actual = {
                            inicio: franjasDia[i].horaInicio,
                            fin: franjasDia[i].horaFin,
                            grupoIds: [franjasDia[i].idGrupo]
                        };
                    }
                }
                bloques.push({ ...actual });

                for (const bloque of bloques) {
                    const duracion = bloque.fin - bloque.inicio;
                    if (duracion > this._umbralHoras) {
                        const exceso = duracion - this._umbralHoras;

                        const gruposUnicos = [...new Set(bloque.grupoIds)];
                        const sumaW = gruposUnicos.reduce(
                            (acc, gId) => acc + modelo.score(numEco, gId), 0
                        );
                        let wPromedio = gruposUnicos.length > 0 ? sumaW / gruposUnicos.length : 0;
                        const factorMitigante = Math.max(0, 1 - wPromedio);

                        const excesoNorm = Math.min(exceso / this._refMaxExceso, 1.0);
                        reduccionesAlProfesor += excesoNorm * factorMitigante;
                    }
                }
            }

            const viabilidadDeEsteProfesor = Math.max(0, 1.0 - reduccionesAlProfesor);
            viabilidadTotalAcumulada += viabilidadDeEsteProfesor;
        }

        return profesoresActivos > 0 ? viabilidadTotalAcumulada / profesoresActivos : 0;
    }
}
