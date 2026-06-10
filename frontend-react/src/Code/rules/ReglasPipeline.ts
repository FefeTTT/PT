import { ReglaBase } from './ReglaBase';
import {
    ReglaGrupoTieneProgramacion,
    ReglaArea,
    ReglaHorarioLaboral,
    ReglaTraslapeUEA,
    ReglaMaxN_Horas
} from './ReglasImplementacion';

export class ReglasPipeline {
    public static crear(limiteHorasSemanales: number = 24): ReglaBase[] {
        return [
            new ReglaGrupoTieneProgramacion(),
            new ReglaArea(),
            new ReglaHorarioLaboral(),
            new ReglaTraslapeUEA(),
            new ReglaMaxN_Horas(limiteHorasSemanales)
        ];
    }
}
