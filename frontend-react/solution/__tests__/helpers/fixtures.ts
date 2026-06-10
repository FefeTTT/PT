import { ProfesorDTO, GrupoDTO, FranjaHorariaDTO, HorarioDB_DTO } from '../../types/AssignmentTypes';

// ─────────────────────────────────────────────
// Factory functions mínimas
// ─────────────────────────────────────────────

let _nextId = 1000;

export function crearProfesor(overrides: Partial<Omit<ProfesorDTO, 'idArea'>> & { numeroEconomico: number; idArea: any }): ProfesorDTO {
    const areas = Array.isArray(overrides.idArea)
        ? overrides.idArea.map(String)
        : overrides.idArea !== undefined
            ? [String(overrides.idArea)]
            : [];
    const { idArea, ...rest } = overrides;
    return {
        horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '08:00:00', horaFin: '18:00:00' }],
        ...rest,
        idArea: areas,
    };
}

export function crearGrupo(overrides: Partial<Omit<GrupoDTO, 'idArea'>> & { idArea: any }): GrupoDTO {
    const id = overrides.idUeaGrupo ?? _nextId++;
    const area = overrides.idArea !== undefined ? String(overrides.idArea) : '';
    const { idArea, ...rest } = overrides;
    return {
        idUeaGrupo: id,
        idGrupo: rest.idGrupo ?? id,
        claveGrupo: rest.claveGrupo ?? `GRP${id}`,
        ueaClave: rest.ueaClave ?? id,
        horarios: rest.horarios ?? [franja(1, 8, 10)],
        horarioStringRaw: rest.horarioStringRaw ?? '',
        ...rest,
        idArea: area,
    };
}

export function franja(dia: number, horaInicio: number, horaFin: number): FranjaHorariaDTO {
    return { dia, horaInicio, horaFin };
}

export function horarioDB(dias: string, inicio: string, fin: string): HorarioDB_DTO {
    return { idDiasDeTrabajo: dias, horaInicio: inicio, horaFin: fin };
}

// ─────────────────────────────────────────────
// Dataset A — FSM + Constructiva
// 1 área, 2 profesores, 3 grupos con colisiones controladas
// ─────────────────────────────────────────────

export function datasetA() {
    const profesores: ProfesorDTO[] = [
        crearProfesor({ numeroEconomico: 1, idArea: 10, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] }),
        crearProfesor({ numeroEconomico: 2, idArea: 10, horariosContratacion: [horarioDB('L-V', '08:00:00', '14:00:00')] }),
    ];

    const grupos: GrupoDTO[] = [
        crearGrupo({ idUeaGrupo: 100, idGrupo: 100, idArea: 10, horarios: [franja(1, 8, 10), franja(3, 8, 10)] }),   // Lu+Mi 8-10 = 4h
        crearGrupo({ idUeaGrupo: 101, idGrupo: 101, idArea: 10, horarios: [franja(1, 10, 12), franja(3, 10, 12)] }), // Lu+Mi 10-12 = 4h
        crearGrupo({ idUeaGrupo: 102, idGrupo: 102, idArea: 10, horarios: [franja(2, 8, 10), franja(4, 8, 10)] }),   // Ma+Ju 8-10 = 4h
    ];

    return { profesores, grupos };
}

// ─────────────────────────────────────────────
// Dataset B — Reparación (huérfanos)
// 1 área, 3 profesores, 4 grupos. Profesor 3 tiene horario limitado
// que causa un huérfano post-constructiva.
// ─────────────────────────────────────────────

export function datasetB() {
    const profesores: ProfesorDTO[] = [
        crearProfesor({ numeroEconomico: 10, idArea: 20, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] }),
        crearProfesor({ numeroEconomico: 11, idArea: 20, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] }),
        crearProfesor({ numeroEconomico: 12, idArea: 20, horariosContratacion: [horarioDB('L-V', '08:00:00', '10:00:00')] }), // Solo 8-10
    ];

    const grupos: GrupoDTO[] = [
        crearGrupo({ idUeaGrupo: 200, idGrupo: 200, idArea: 20, horarios: [franja(1, 8, 10)] }),   // 2h
        crearGrupo({ idUeaGrupo: 201, idGrupo: 201, idArea: 20, horarios: [franja(1, 10, 12)] }),  // 2h
        crearGrupo({ idUeaGrupo: 202, idGrupo: 202, idArea: 20, horarios: [franja(2, 8, 10)] }),   // 2h
        crearGrupo({ idUeaGrupo: 203, idGrupo: 203, idArea: 20, horarios: [franja(2, 14, 16)] }),  // 2h — fuera de rango del prof 12
    ];

    return { profesores, grupos };
}

// ─────────────────────────────────────────────
// Dataset C — Optimización (swap-ready)
// 2 profesores con asignaciones completas para swap tests.
// ─────────────────────────────────────────────

export function datasetC() {
    const profesores: ProfesorDTO[] = [
        crearProfesor({ numeroEconomico: 50, idArea: 30, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] }),
        crearProfesor({ numeroEconomico: 51, idArea: 30, horariosContratacion: [horarioDB('L-V', '08:00:00', '18:00:00')] }),
    ];

    const grupos: GrupoDTO[] = [
        crearGrupo({ idUeaGrupo: 300, idGrupo: 300, idArea: 30, horarios: [franja(1, 8, 10)] }),
        crearGrupo({ idUeaGrupo: 301, idGrupo: 301, idArea: 30, horarios: [franja(1, 12, 14)] }),
        crearGrupo({ idUeaGrupo: 302, idGrupo: 302, idArea: 30, horarios: [franja(2, 8, 10)] }),
        crearGrupo({ idUeaGrupo: 303, idGrupo: 303, idArea: 30, horarios: [franja(2, 12, 14)] }),
    ];

    // Asignaciones iniciales: prof 50 → {300,301}, prof 51 → {302,303}
    const asignacionesIniciales = [
        { numEco: 50, idGrupo: 300 },
        { numEco: 50, idGrupo: 301 },
        { numEco: 51, idGrupo: 302 },
        { numEco: 51, idGrupo: 303 },
    ];

    return { profesores, grupos, asignacionesIniciales };
}
