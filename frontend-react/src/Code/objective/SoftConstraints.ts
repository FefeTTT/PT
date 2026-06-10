import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML } from '../ml/IModeloML';

/**
 * Restriccion suave con semantica de viabilidad positiva.
 * Debe retornar un valor normalizado en [0, 1], donde 1 es mejor.
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

function obtenerFranjasHorariasProfesor(numeroEconomico: number, grafo: GrafoBipartito): FranjaDia[] {
    const gruposAsignados = grafo.adyacencias.get(numeroEconomico) || [];
    const franjas: FranjaDia[] = [];

    for (const idGrupo of gruposAsignados) {
        const grupo = grafo.grupos.get(idGrupo);
        if (!grupo) continue;

        for (const h of grupo.horarios) {
            franjas.push({ dia: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin });
        }
    }

    return franjas;
}

function agruparFranjasPorDia(franjas: FranjaDia[]): Map<number, FranjaDia[]> {
    const mapa = new Map<number, FranjaDia[]>();
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
 * Viabilidad por huecos entre clases. Penaliza huecos estructurales sin volver a
 * usar s_ig, para evitar doble contabilizacion del modelo ML.
 */
export class ViabilidadHuecos implements ISoftConstraint {
    readonly nombre = 'VIABILIDAD_HUECOS';
    private readonly _refMaxHuecos: number;

    constructor(refMaxHuecosDia: number = 4) {
        this._refMaxHuecos = refMaxHuecosDia;
    }

    evaluar(grafo: GrafoBipartito, _modelo: IModeloML): number {
        let sumaViabilidad = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;

            profesoresActivos++;
            const porDia = agruparFranjasPorDia(franjas);
            let penalizacionProfesor = 0;

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length < 2) continue;

                for (let i = 1; i < franjasDia.length; i++) {
                    const hueco = franjasDia[i].horaInicio - franjasDia[i - 1].horaFin;
                    if (hueco > 0) {
                        penalizacionProfesor += Math.min(hueco / this._refMaxHuecos, 1);
                    }
                }
            }

            sumaViabilidad += Math.max(0, 1 - penalizacionProfesor);
        }

        return profesoresActivos > 0 ? sumaViabilidad / profesoresActivos : 1;
    }
}
