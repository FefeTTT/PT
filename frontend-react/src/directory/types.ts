export interface Professor {
    idProfesor: string | number;
    nombre: string;
    numeroEconomico: string;
    correo_uam?: string;
    correo_personal?: string;
    celular?: string;
    gradoEstudios?: string;
    // Extra fields often returned or needed
    isJefeArea?: number | string;
    isJefeGrupo?: number | string;
    tipo?: 'profesor';
    // Detailed fields loaded on demand
    areas?: AreaAssignment[];
    grupos?: GroupAssignment[];
    contrato?: Contract;
    contactos?: EmergencyContact[];
    lugares?: Location[];
}

export interface Admin {
    idAdministrativo: string | number;
    nombre: string;
    numeroEconomico: string;
    correo_uam?: string;
    correo_personal?: string;
    celular?: string;
    gradoEstudios?: string;
    lugar?: string;
    extension?: string;
    idAdministrativoTipo?: string | number;
    tipoNombre?: string;
    tipo?: 'administrativo';
}

export interface DirectoryItem {
    id: string | number;
    tipo: 'profesor' | 'administrativo';
    nombre: string;
    numeroEconomico: string;
    raw: Professor | Admin;
}

export interface AreaAssignment {
    idAreaAcademica: string | number;
    nombre: string;
    puesto: string;
}

export interface GroupAssignment {
    idGrupoTematico: string | number;
    nombreGrupo: string;
    puesto: string;
}

export interface Contract {
    idProfesorContrato?: string | number;
    idProfesorTipo?: string | number;
    tipoNombre?: string;
    descripcion?: string;
}

export interface EmergencyContact {
    idProfesorEmergencia?: string | number;
    nombre: string;
    parentesco: string;
    celular: string;
}

export interface Location {
    idLugar?: string | number;
    edificio: string;
    piso?: string | number;
    cubiculo?: string;
    nombre?: string;
    notas?: string;
}

export interface FilterOptions {
    areaAcademicas: { idAreaAcademica: string | number; nombre: string }[];
    gruposTematicos: { idGrupoTematico: string | number; nombreGrupo: string }[];
    profesorTipos: { idProfesorTipo: string | number; nombre: string }[];
    profesorAreaTipos: { idProfesorAreaTipo: string | number; descripcion: string }[];
    administrativoTipos: { idAdministrativoTipo: string | number; nombre: string }[];
    trimestres: { idTrimestre: string | number; año: number; sigla?: string; nombre?: string }[];
}

export interface DirectoryState {
    q: string;
    areaAcademica: string;
    grupoTematico: string;
    profesorAreaTipo: string;
    profesorTipo: string;
    adminTipo: string;
    trimestre: string;
    sort: 'nombre' | 'numeroEconomico';
    sortDir: 'ASC' | 'DESC';
}

export interface Trimester {
    idTrimestre: string | number;
    anio: string | number;
    trimestre: string;
    inicio?: string;
    fin?: string;
    observaciones?: string;
    estado?: string | number; // 0 or 1
}

export interface UEA {
    idUEA: string | number;
    claveUEA: string;
    nombreUEA: string;
    tipo?: string;
}

export interface TeacherSchedule {
    idGrupo: string | number;
    claveGrupo: string;
    claveUEA: string;
    nombreUEA?: string; // Derived if possible
    matricula?: string;
}

export interface TimeSlot { // Horario
    idHorario: string | number;
    dia: string;
    horaInicio: string;
    horaFin: string;
}

export interface PreferenceData {
    idPreferencia?: string | number;
    noGrupos?: string | number;
    observaciones?: string; // 'obser' in some places
    ueas?: { idUEA: string | number; prioridad: number; nombreUEA?: string; claveUEA?: string }[];
    horarios?: { idHorario: string | number; dia: string; horaInicio: string; horaFin: string }[];
}

export interface GradoAreaImport {
    nombre: string;
    grado: string;
    area: string;
}