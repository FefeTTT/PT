export interface DiaHorario {
    inicio: string;
    fin: string;
}

export type MapaDias = {
    [key in 'L' | 'M' | 'Mi' | 'J' | 'V']?: DiaHorario;
};

export class HorarioVO {
    private readonly _grupo: string;
    private readonly _cupo: number;
    private readonly _dias: MapaDias;

    constructor(grupo: string, cupo: number, dias: MapaDias) {
        this._grupo = grupo;
        this._cupo = cupo;
        this._dias = dias;
    }

    get grupo() { return this._grupo; }
    get cupo() { return this._cupo; }
    get dias() { return this._dias; }

    // Método para serializar al enviar al backend
    toJSON() {
        return { grupo: this._grupo, cupo: this._cupo, dias: this._dias };
    }
}

export class UeaVO {
    private readonly _clave: number;
    private _horarios: HorarioVO[] = [];

    constructor(clave: number) {
        this._clave = clave;
    }

    addHorario(horario: HorarioVO): void {
        this._horarios.push(horario);
    }

    get clave() { return this._clave; }
    get horarios() { return this._horarios; }

    toJSON() {
        return { clave: this._clave, horarios: this._horarios.map(h => h.toJSON()) };
    }
}
