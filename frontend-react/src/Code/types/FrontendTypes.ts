export interface FranjaHorariaDTO {
    dia: number; // 1 (L), 2 (M), 3 (MI), 4 (J), 5 (V)
    horaInicio: number; // Ejemplo: 8:30 AM -> 8.5
    horaFin: number; // Ejemplo: 10:00 AM -> 10.0
}

export interface GrupoDTO {
    idUeaGrupo: number; // ID único real para asignación (tabla uea_grupo)
    idGrupo: number; // Referencia a tabla grupo
    claveGrupo: string; // Ejemplo: CCB01, CCB81
    idArea: number; // Continúa usándose para ReglaArea
    ueaClave: number; // Referencia a uea(clave)
    horarios: FranjaHorariaDTO[]; // Horarios de impartición en tabla_horario_grupo_uea
}

export interface HorarioDB_DTO {
    idDiasDeTrabajo: string; // Ejemplo: "L-V", "M-J"
    horaInicio: string; // Ejemplo: "10:00:00"
    horaFin: string; // Ejemplo: "18:00:00"
}

export interface ProfesorDTO {
    numeroEconomico: number; // PK
    idArea: number;
    horariosContratacion: HorarioDB_DTO[];
}
