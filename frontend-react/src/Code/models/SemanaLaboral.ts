import { HorarioDB_DTO, FranjaHorariaDTO } from '../types/FrontendTypes';
import { HorarioLaboral } from './HorarioLaboral';


export class SemanaLaboral {
    private _horariosLaborales: HorarioLaboral[] = [];

    constructor(datosDB: HorarioDB_DTO[]) {
        this.construir(datosDB);
    }

    private construir(datos: HorarioDB_DTO[]) {
        for (const d of datos) {
            this._horariosLaborales.push(new HorarioLaboral(d.idDiasDeTrabajo, d.horaInicio, d.horaFin));
        }
    }

    public intentarAsignarFranja(franja: FranjaHorariaDTO): boolean {
        const diaBuscado = franja.dia.toLowerCase();

        for (const tramo of this._horariosLaborales) {
            const coversDay = tramo.diasDesglosados.some(d => d.toLowerCase() === diaBuscado);

            if (coversDay) {
                if (franja.horaInicio >= tramo.horaInicio && franja.horaFin <= tramo.horaFin) {
                    return true;
                }
            }
        }

        return false;
    }
}
