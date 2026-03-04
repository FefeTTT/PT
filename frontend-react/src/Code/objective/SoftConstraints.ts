import { GrafoBipartito } from '../models/GrafoBipartito';

/**
 * Interfaz base para restricciones suaves.
 * Cada implementación calcula la magnitud de violación sobre el grafo completo.
 * El valor retornado debe ser ≥ 0 (0 = sin violación).
 */
export interface ISoftConstraint {
    readonly nombre: string;
    evaluar(grafo: GrafoBipartito): number;
}

// ─── Utilidades compartidas ───

interface FranjaDia {
    dia: number;
    horaInicio: number;
    horaFin: number;
}

/**
 * Obtiene todas las franjas horarias asignadas a un profesor dado
 * su número económico y el grafo actual.
 */
function obtenerFranjasProfesor(numeroEconomico: number, grafo: GrafoBipartito): FranjaDia[] {
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

/**
 * Agrupa franjas por día y las ordena por hora de inicio.
 */
function agruparPorDia(franjas: FranjaDia[]): Map<number, FranjaDia[]> {
    const mapa = new Map<number, FranjaDia[]>();
    for (const f of franjas) {
        if (!mapa.has(f.dia)) mapa.set(f.dia, []);
        mapa.get(f.dia)!.push(f);
    }
    // Ordenar cada día por hora de inicio
    for (const [, lista] of mapa) {
        lista.sort((a, b) => a.horaInicio - b.horaInicio);
    }
    return mapa;
}

// ─── Implementaciones ───

/**
 * Penalización por huecos (idle time).
 *
 * Para cada profesor, por cada día, cuenta las horas de timeslots vacíos
 * entre su primera y última clase asignada.
 *
 * Ejemplo: si un profesor tiene clase de 8-10 y de 12-14 el lunes,
 * hay 2 horas de hueco → penalización += 2.
 */
export class PenalizacionHuecos implements ISoftConstraint {
    readonly nombre = 'PENALIZACION_HUECOS';

    evaluar(grafo: GrafoBipartito): number {
        let totalHuecos = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;

            const porDia = agruparPorDia(franjas);

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length < 2) continue;

                // Sumar huecos entre franjas consecutivas
                for (let i = 1; i < franjasDia.length; i++) {
                    const finAnterior = franjasDia[i - 1].horaFin;
                    const inicioActual = franjasDia[i].horaInicio;
                    const hueco = inicioActual - finAnterior;
                    if (hueco > 0) {
                        totalHuecos += hueco;
                    }
                }
            }
        }

        return totalHuecos;
    }
}

/**
 * Penalización por sobrecarga consecutiva.
 *
 * Para cada profesor, por cada día, calcula las horas consecutivas de clase.
 * Si excede el umbral (default: 3h), penaliza por cada hora extra.
 *
 * Ejemplo: 5 horas consecutivas con umbral 3 → penalización += 2.
 */
export class PenalizacionConsecutiva implements ISoftConstraint {
    readonly nombre = 'PENALIZACION_CONSECUTIVA';
    private _umbralHoras: number;

    constructor(umbralHoras: number = 3) {
        this._umbralHoras = umbralHoras;
    }

    evaluar(grafo: GrafoBipartito): number {
        let totalPenalizacion = 0;

        for (const [numEco] of grafo.profesores) {
            const franjas = obtenerFranjasProfesor(numEco, grafo);
            if (franjas.length === 0) continue;

            const porDia = agruparPorDia(franjas);

            for (const [, franjasDia] of porDia) {
                if (franjasDia.length === 0) continue;

                // Fusionar franjas consecutivas/solapadas para calcular bloques continuos
                const bloques: { inicio: number; fin: number }[] = [];
                let actual = { inicio: franjasDia[0].horaInicio, fin: franjasDia[0].horaFin };

                for (let i = 1; i < franjasDia.length; i++) {
                    // Consideramos "consecutiva" si la siguiente empieza donde termina la anterior
                    // (tolerancia 0 — contiguas exactas)
                    if (franjasDia[i].horaInicio <= actual.fin) {
                        actual.fin = Math.max(actual.fin, franjasDia[i].horaFin);
                    } else {
                        bloques.push({ ...actual });
                        actual = { inicio: franjasDia[i].horaInicio, fin: franjasDia[i].horaFin };
                    }
                }
                bloques.push(actual);

                // Penalizar bloques que excedan el umbral
                for (const bloque of bloques) {
                    const duracion = bloque.fin - bloque.inicio;
                    if (duracion > this._umbralHoras) {
                        totalPenalizacion += (duracion - this._umbralHoras);
                    }
                }
            }
        }

        return totalPenalizacion;
    }
}
