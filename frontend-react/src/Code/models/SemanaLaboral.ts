import { HorarioDB_DTO, FranjaHorariaDTO } from '../types/FrontendTypes';
import { HorarioLaboral } from './HorarioLaboral';


const DIA_NUMERO_A_STRING: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miercoles',
    4: 'Jueves',
    5: 'Viernes'
};

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
        const diaBuscado = DIA_NUMERO_A_STRING[franja.dia];
        if (!diaBuscado) return false;

        for (const tramo of this._horariosLaborales) {
            const coversDay = tramo.diasDesglosados.some(d => d.toLowerCase() === diaBuscado.toLowerCase());

            if (coversDay) {
                if (franja.horaInicio >= tramo.horaInicio && franja.horaFin <= tramo.horaFin) {
                    return true;
                }
            }
        }

        return false;
    }

    public intentarAsignarFranjaContigua(franja: FranjaHorariaDTO): boolean {
        const diaBuscado = DIA_NUMERO_A_STRING[franja.dia];
        if (!diaBuscado) return false

        const bloquesDelDia = this._horariosLaborales.filter(tramo =>
            tramo.diasDesglosados.some(d => d.toLowerCase() === diaBuscado.toLowerCase())
        );

        if (bloquesDelDia.length === 0) return false;

        bloquesDelDia.sort((a, b) => a.horaInicio - b.horaInicio);

        const mergedIntervals: { inicio: number, fin: number }[] = [];
        let currentInterval = {
            inicio: bloquesDelDia[0].horaInicio,
            fin: bloquesDelDia[0].horaFin
        };

        for (let i = 1; i < bloquesDelDia.length; ++i) {
            const nextBlock = bloquesDelDia[i];

            if (nextBlock.horaInicio <= currentInterval.fin) {
                currentInterval.fin = Math.max(currentInterval.fin, nextBlock.horaFin);
            } else {
                mergedIntervals.push({ ...currentInterval });
                currentInterval = { inicio: nextBlock.horaInicio, fin: nextBlock.horaFin };
            }
        }
        mergedIntervals.push(currentInterval);

        return mergedIntervals.some(interval =>
            franja.horaInicio >= interval.inicio && franja.horaFin <= interval.fin
        );
    }
}
