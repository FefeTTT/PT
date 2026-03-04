import { ReglaBase } from './ReglaBase';
import { ReglaGrupoTieneProgramacion, ReglaArea, ReglaHorario, ReglaMaxN_Horas } from './ReglasImplementacion';

/**
 * Factory centralizado para el pipeline de reglas de la FSM.
 * Garantiza orden consistente: integridad → área → horario → límite horas.
 */
export class ReglasPipeline {
    /**
     * Crea una nueva instancia del pipeline de reglas en el orden canónico.
     * @param limiteHorasSemanales Límite de horas semanales para ReglaMaxN_Horas (default: 24)
     */
    public static crear(limiteHorasSemanales: number = 24): ReglaBase[] {
        return [
            new ReglaGrupoTieneProgramacion(),
            new ReglaArea(),
            new ReglaHorario(),
            new ReglaMaxN_Horas(limiteHorasSemanales)
        ];
    }
}
