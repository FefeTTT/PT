import { HorarioDB_DTO, FranjaHorariaDTO } from '../types/FrontendTypes';
import { HorarioLaboral } from './HorarioLaboral';


const DIA_NUMERO_A_STRING: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miercoles',
    4: 'Jueves',
    5: 'Viernes'
};

export interface ResultadoDisponibilidad {
    asignable: boolean;
    esHoraMuerta?: boolean;
}

export class SemanaLaboral {
    // Almacena los bloques de horario continuos, optimizados y fusionados por cada día
    private _horariosFusionadosPorDia: Map<string, { inicio: number, fin: number }[]> = new Map();

    constructor(datosDB: HorarioDB_DTO[]) {
        this.construir(datosDB);
    }

    private construir(datosDB: HorarioDB_DTO[]) {
        // Agrupar los horarios crudos por día
        const franjasPorDia = new Map<string, { inicio: number, fin: number }[]>();

        for (const dato of datosDB) {
            const horario = new HorarioLaboral(dato.idDiasDeTrabajo, dato.horaInicio, dato.horaFin);

            for (const diaStr of horario.diasDesglosados) {
                const diaNormalizado = diaStr.toLowerCase();
                if (!franjasPorDia.has(diaNormalizado)) {
                    franjasPorDia.set(diaNormalizado, []);
                }
                franjasPorDia.get(diaNormalizado)!.push({ inicio: horario.horaInicio, fin: horario.horaFin });
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
        const diaBuscadoOriginal = DIA_NUMERO_A_STRING[franja.dia];
        if (!diaBuscadoOriginal) return { asignable: false };

        const diaNormalizado = diaBuscadoOriginal.toLowerCase();
        const bloquesOptimizados = this._horariosFusionadosPorDia.get(diaNormalizado);

        // Si el profesor no trabaja ese día
        if (!bloquesOptimizados || bloquesOptimizados.length === 0) {
            return { asignable: false, esHoraMuerta: false };
        }

        // Búsqueda estricta O(1) sobre los bloques pre-calculados
        for (const bloque of bloquesOptimizados) {
            if (franja.horaInicio >= bloque.inicio && franja.horaFin <= bloque.fin) {
                return { asignable: true };
            }
        }

        // Si llegamos aquí, la franja no cabe en ningún bloque. 
        // Vamos a verificar si cayó en una "hora muerta" 
        // (es decir, entre el inicio del primer bloque laboral y el fin del último bloque laboral de su día)
        const primerBloque = bloquesOptimizados[0];
        const ultimoBloque = bloquesOptimizados[bloquesOptimizados.length - 1];

        const caeDentroDeLaJornada = franja.horaInicio >= primerBloque.inicio && franja.horaFin <= ultimoBloque.fin;

        return {
            asignable: false,
            esHoraMuerta: caeDentroDeLaJornada
        };
    }
}
