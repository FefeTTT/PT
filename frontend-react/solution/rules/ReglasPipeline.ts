import { ReglaBase } from './ReglaBase';
import {
    ReglaGrupoTieneProgramacion,
    ReglaHorarioLaboral,
    ReglaTraslapeUEA,
    ReglaMaxHorasDiarias,
    ReglaAsignacionGlobal,
    ReglaIgnorarGrupos,
    ReglaProfesorVigente,
    ReglaAreasVistas,
    type ReglaIgnorarGruposOpciones
} from './ReglasImplementacion';

/** Opciones opt-in de los pipelines. Default (sin opciones) = comportamiento histórico. */
export type ReglasPipelineOpciones = ReglaIgnorarGruposOpciones;

export class ReglasPipeline {
    public static getReglasIngestaGrupos(opciones?: ReglasPipelineOpciones): readonly ReglaBase[] {
        return [
            new ReglaGrupoTieneProgramacion(),
            new ReglaIgnorarGrupos(opciones)
        ];
    }

    public static getReglasFastFail(opciones?: ReglasPipelineOpciones): readonly ReglaBase[] {
        return [
            new ReglaProfesorVigente(),
            new ReglaAreasVistas(),
            new ReglaGrupoTieneProgramacion(),
            new ReglaIgnorarGrupos(opciones)
        ];
    }

    /**
     * Devuelve las reglas estructurales y de contrato que mutan estado o son más pesadas.
     * Incluye ReglaIgnorarGrupos al final como defensa en profundidad: la EjectionChain valida
     * solo con estas reglas (GreedyOrchestrator) y los SAI/CPRO no deben colarse por ahí.
     * Hoy es no-op para el GRASP (los SAI no entran al catálogo del pase), pero cierra el hueco
     * si algún día se usa `asignarAutomaticamente`.
     * @param maxHorasDiarias Límite diario de horas (default: 4.5h para GRASP, 24 desde frontend hook).
     */
    public static getReglasRestantes(maxHorasDiarias: number = 4.5, opciones?: ReglasPipelineOpciones): readonly ReglaBase[] {
        return [
            new ReglaAsignacionGlobal(),
            new ReglaTraslapeUEA(),
            new ReglaHorarioLaboral(),
            new ReglaMaxHorasDiarias(maxHorasDiarias),
            new ReglaIgnorarGrupos(opciones)
        ];
    }
}
