import { FranjaHorariaDTO } from '../types/FrontendTypes';

const DIAS_MAP: Record<string, string[]> = {
    'L-V': ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
    'L-MI-V': ['Lunes', 'Miercoles', 'Viernes'],
    'M-J': ['Martes', 'Jueves'],
    'L': ['Lunes'],
    'M': ['Martes'],
    'MI': ['Miercoles'],
    'J': ['Jueves'],
    'V': ['Viernes'],
};

export class HorarioLaboral {
    private _idDiasDeTrabajo: string;
    private _horaInicioStr: string;
    private _horaFinStr: string;

    private _horaInicioNum: number;
    private _horaFinNum: number;
    private _diasExpandidos: string[];

    constructor(idDiasDeTrabajo: string, horaInicio: string, horaFin: string) {
        this._idDiasDeTrabajo = idDiasDeTrabajo;
        this._horaInicioStr = horaInicio;
        this._horaFinStr = horaFin;

        this._horaInicioNum = this.parseTimeToNumber(horaInicio);
        this._horaFinNum = this.parseTimeToNumber(horaFin);
        this._diasExpandidos = DIAS_MAP[idDiasDeTrabajo.toUpperCase()] || [idDiasDeTrabajo];
    }

    private parseTimeToNumber(timeStr: string): number {
        const parts = timeStr.split(':');
        if (parts.length < 2) return 0;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return h + (m / 60);
    }

    public get horaInicio(): number {
        return this._horaInicioNum;
    }

    public get horaFin(): number {
        return this._horaFinNum;
    }

    public get diasDesglosados(): string[] {
        return this._diasExpandidos;
    }
}
