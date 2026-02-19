export interface FranjaHorariaDTO {
    dia: string; // Lunes, Martes, Miercoles...
    horaInicio: number; // Ejemplo: 8:30 AM -> 8.5
    horaFin: number; // Ejemplo: 10:00 AM -> 10.0
}

export interface GrupoDTO {
    idGrupo: string;
    claveGrupo: string; // Ejemplo: CCB01, CCB81
    idArea: number;
    claveUEA: string;
    horarios: FranjaHorariaDTO[]; // Horarios de impartición
}

export interface HorarioDB_DTO {
    idDiasDeTrabajo: string; // Ejemplo: "L-V", "M-J"
    horaInicio: string; // Ejemplo: "10:00:00"
    horaFin: string; // Ejemplo: "18:00:00"
}

export interface ProfesorDTO {
    numeroEconomico: string;
    idArea: number;
    horariosContratacion: HorarioDB_DTO[];
}
