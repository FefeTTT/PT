const DIAS_MAP: Record<string, number[]> = {
    'L-V': [1, 2, 3, 4, 5],
    'L-MI-V': [1, 3, 5],
    'M-J': [2, 4],
    'L': [1],
    'M': [2],
    'MI': [3],
    'J': [4],
    'V': [5],
};

export class HorarioLaboral {
    private _horaInicioNum: number;
    private _horaFinNum: number;
    private _diasExpandidos: number[];

    constructor(idDiasDeTrabajo: string, horaInicio: string, horaFin: string) {

        this._horaInicioNum = this.parseTimeToNumber(horaInicio);
        this._horaFinNum = this.parseTimeToNumber(horaFin);
        this._diasExpandidos = DIAS_MAP[idDiasDeTrabajo.toUpperCase()] || [];
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

    public get diasDesglosados(): number[] {
        return this._diasExpandidos;
    }
}
