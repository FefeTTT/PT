import { HorarioDB_DTO, FranjaHorariaDTO } from '../types/FrontendTypes';
import { HorarioLaboral } from './HorarioLaboral';


export interface ResultadoDisponibilidad {
    asignable: boolean;
    esHoraMuerta?: boolean;
}

export class SemanaLaboral {
    // Almacena los bloques de horario continuos, optimizados y fusionados por cada día
    private _horariosFusionadosPorDia: Map<number, { inicio: number, fin: number }[]> = new Map();

    constructor(datosDB: HorarioDB_DTO[]) {
        this.construir(datosDB);
    }

    private construir(datosDB: HorarioDB_DTO[]) {
        // Agrupar los horarios crudos por día
        const franjasPorDia = new Map<number, { inicio: number, fin: number }[]>();

        for (const dato of datosDB) {
            const horario = new HorarioLaboral(dato.idDiasDeTrabajo, dato.horaInicio, dato.horaFin);

            for (const diaNum of horario.diasDesglosados) {
                if (!franjasPorDia.has(diaNum)) {
                    franjasPorDia.set(diaNum, []);
                }
                franjasPorDia.get(diaNum)!.push({ inicio: horario.horaInicio, fin: horario.horaFin });
            }
        }

        // Fusionar los bloques contiguos u solapados para cada día (Merge Intervals $O(K \log K)$)
        for (const [dia, bloques] of franjasPorDia.entries()) {
            if (bloques.length === 0) continue;

            bloques.sort((a, b) => a.inicio - b.inicio);

            const fusionados: { inicio: number, fin: number }[] = [];
            let actual = { ...bloques[0] };

            for (let i = 1; i < bloques.length; i++) {
                const siguiente = bloques[i];
                if (siguiente.inicio <= actual.fin) {
                    actual.fin = Math.max(actual.fin, siguiente.fin);
                } else {
                    fusionados.push({ ...actual });
                    actual = { ...siguiente };
                }
            }
            fusionados.push(actual);

            this._horariosFusionadosPorDia.set(dia, fusionados);
        }
    }

    public intentarAsignarFranja(franja: FranjaHorariaDTO): ResultadoDisponibilidad {
        const bloquesOptimizados = this._horariosFusionadosPorDia.get(franja.dia);

        if (!bloquesOptimizados || bloquesOptimizados.length === 0) {// Si el profesor no trabaja ese día
            return { asignable: false, esHoraMuerta: false };
        }

        for (const bloque of bloquesOptimizados) {// Búsqueda O(1) sobre los bloques precalculados
            if (franja.horaInicio >= bloque.inicio && franja.horaFin <= bloque.fin) {
                return { asignable: true };
            }
        }

        const primerBloque = bloquesOptimizados[0];
        const ultimoBloque = bloquesOptimizados[bloquesOptimizados.length - 1];

        const caeDentroDeLaJornada = franja.horaInicio >= primerBloque.inicio && franja.horaFin <= ultimoBloque.fin;

        return {
            asignable: false,
            esHoraMuerta: caeDentroDeLaJornada
        };
    }
}
