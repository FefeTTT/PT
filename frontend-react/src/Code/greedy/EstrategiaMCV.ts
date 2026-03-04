import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { EstrategiaOrdenamiento } from './GreedyTypes';

/**
 * Heurística MCV (Most Constrained Variable) de dos niveles:
 * 
 * Nivel 1 (inter-área): Áreas con MENOS grupos programados primero.
 *   → Reduce probabilidad de nodos huérfanos en el grafo.
 * 
 * Nivel 2 (intra-área): Grupos con MÁS restricciones (más franjas horarias) primero.
 *   → Evita que al final queden los grupos "difíciles" sin profesores disponibles.
 */
export class EstrategiaMCV implements EstrategiaOrdenamiento {

    ordenarAreas(areas: Map<number, GrupoDTO[]>): [number, GrupoDTO[]][] {
        const entries = Array.from(areas.entries());
        // Áreas con menos grupos primero (más restringidas)
        entries.sort((a, b) => a[1].length - b[1].length);
        return entries;
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        return [...grupos].sort((a, b) => {
            // Más franjas horarias = más restrictivo → primero
            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasB !== franjasA) return franjasB - franjasA;

            // Desempate: mayor duración total primero
            const durA = a.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            const durB = b.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            return durB - durA;
        });
    }

    ordenarProfesores(profesores: ProfesorDTO[]): ProfesorDTO[] {
        // Por ahora, sin ordenamiento especial de profesores.
        // Se podría ordenar por disponibilidad residual en futuras iteraciones.
        return profesores;
    }
}
