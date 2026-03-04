import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { EstrategiaOrdenamiento } from './GreedyTypes';
import { IModeloML, ModeloMLUniforme } from '../ml/IModeloML';

/**
 * Estrategia RCL (Restricted Candidate List) para GRASP.
 *
 * Fase constructiva probabilística:
 * - Áreas y grupos: delega al mismo orden MCV (áreas pequeñas primero, grupos restrictivos primero).
 * - Profesores: aleatoriza el orden ponderado por scores w_ig del modelo ML.
 *
 * Parámetro α ∈ [0, 1]:
 *   α = 0 → Totalmente greedy (solo el mejor candidato)
 *   α = 1 → Totalmente aleatorio (todos los candidatos)
 */
export class EstrategiaRCL implements EstrategiaOrdenamiento {
    private _alpha: number;
    private _modelo: IModeloML;

    constructor(alpha: number = 0.3, modelo?: IModeloML) {
        this._alpha = Math.max(0, Math.min(1, alpha));
        this._modelo = modelo ?? new ModeloMLUniforme();
    }

    ordenarAreas(areas: Map<number, GrupoDTO[]>): [number, GrupoDTO[]][] {
        // Mismo criterio MCV: áreas con menos grupos primero
        const entries = Array.from(areas.entries());
        entries.sort((a, b) => a[1].length - b[1].length);
        return entries;
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        // Mismo criterio MCV: más franjas → más restrictivo → primero
        return [...grupos].sort((a, b) => {
            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasB !== franjasA) return franjasB - franjasA;

            const durA = a.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            const durB = b.horarios.reduce((s, f) => s + (f.horaFin - f.horaInicio), 0);
            return durB - durA;
        });
    }

    /**
     * Construye una RCL de profesores y selecciona uno aleatoriamente.
     * La RCL incluye candidatos cuyo score w_ig está dentro del umbral:
     *   RCL = { p | w_p ≥ w_max − α(w_max − w_min) }
     *
     * Luego aleatoriza el orden de la RCL completa para dar variabilidad
     * al GRASP en múltiples ejecuciones.
     */
    ordenarProfesores(profesores: ProfesorDTO[]): ProfesorDTO[] {
        if (profesores.length <= 1) return profesores;

        // Sin grupo específico disponible en la interfaz actual,
        // usamos grupoId = 0 como proxy genérico para obtener scores
        const conScore = profesores.map(p => ({
            profesor: p,
            w: this._modelo.score(p.numeroEconomico, 0)
        }));

        const wMax = Math.max(...conScore.map(c => c.w));
        const wMin = Math.min(...conScore.map(c => c.w));
        const umbral = wMax - this._alpha * (wMax - wMin);

        // Filtrar candidatos en la RCL
        const rcl = conScore.filter(c => c.w >= umbral);

        // Aleatorizar el orden dentro de la RCL (Fisher-Yates)
        for (let i = rcl.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rcl[i], rcl[j]] = [rcl[j], rcl[i]];
        }

        // RCL aleatorizada + el resto que no pasó el umbral (por si se necesitan)
        const idsEnRCL = new Set(rcl.map(c => c.profesor.numeroEconomico));
        const resto = conScore
            .filter(c => !idsEnRCL.has(c.profesor.numeroEconomico))
            .map(c => c.profesor);

        return [...rcl.map(c => c.profesor), ...resto];
    }
}
