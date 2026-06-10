import { GrupoDTO } from '../types/FrontendTypes';
import { CandidatoProfesor, EstrategiaOrdenamiento } from './GreedyTypes';

/**
 * Estrategia RCL para GRASP.
 *
 * La RCL se construye sobre candidatos factibles del grupo actual:
 * scoreRCL(i,g|A) = s_ig - pesoPenalizacionConsecutiva * P_consec(i,g|A)
 */
export class EstrategiaRCL implements EstrategiaOrdenamiento {
    private readonly _alpha: number;

    constructor(alpha: number = 0.3) {
        this._alpha = Math.max(0, Math.min(1, alpha));
    }

    ordenarAreas(areas: Map<number, GrupoDTO[]>): [number, GrupoDTO[]][] {
        const entries = Array.from(areas.entries());
        entries.sort((a, b) => a[1].length - b[1].length);
        return entries;
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        return [...grupos].sort((a, b) => {
            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasB !== franjasA) return franjasB - franjasA;

            const durA = a.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            const durB = b.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            return durB - durA;
        });
    }

    seleccionarProfesorParaGrupo(candidatos: CandidatoProfesor[], _grupo: GrupoDTO): CandidatoProfesor | null {
        if (candidatos.length === 0) return null;
        if (candidatos.length === 1) return candidatos[0];

        const puntajes = candidatos.map(c => c.scoreRCL);
        const wMax = Math.max(...puntajes);
        const wMin = Math.min(...puntajes);
        const umbral = wMax - this._alpha * (wMax - wMin);
        const rcl = candidatos.filter(c => c.scoreRCL >= umbral);

        const elegido = rcl[Math.floor(Math.random() * rcl.length)];
        return elegido ?? candidatos[0];
    }
}
