export interface FranjaHorariaDTO {
    dia: number; // 1 - 5 respectivamente
    horaInicio: number; // Ejemplo: 8:30 AM -> 8.5
    horaFin: number; // Ejemplo: 10:00 AM -> 10.0
}

export interface GrupoDTO {
    idUeaGrupo: number;
    idGrupo: number;
    claveGrupo: string; // Ejemplo: CCB01, CCB81
    idArea: string;
    ueaClave: number;
    horarios: FranjaHorariaDTO[];
    horarioStringRaw: string;
}

export interface HorarioDB_DTO {
    idDiasDeTrabajo: string; // Ejemplo: "L-V", "M-J"
    horaInicio: string; // Ejemplo: "10:00:00"
    horaFin: string; // Ejemplo: "18:00:00"
}

export interface ProfesorDTO {
    numeroEconomico: number;
    idArea: string[];
    horariosContratacion: HorarioDB_DTO[];
}
