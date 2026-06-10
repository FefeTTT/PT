import { GrupoDTO } from '../types/FrontendTypes';
import { CandidatoProfesor, EstrategiaOrdenamiento } from './GreedyTypes';

/**
 * Heuristica MCV:
 * - Areas con menos grupos primero.
 * - Grupos con mas franjas/duracion primero.
 * - Profesor: mejor scoreRCL entre candidatos factibles del grupo actual.
 */
export class EstrategiaMCV implements EstrategiaOrdenamiento {
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

        return [...candidatos].sort((a, b) => {
            if (b.scoreRCL !== a.scoreRCL) return b.scoreRCL - a.scoreRCL;
            return a.profesor.numeroEconomico - b.profesor.numeroEconomico;
        })[0];
    }
}
