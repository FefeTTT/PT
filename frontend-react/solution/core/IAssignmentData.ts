import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';

export interface IAssignmentData {
    /**
     * Devuelve la lista completa de profesores disponibles para asignación.
     */
    getProfesores(): Promise<ProfesorDTO[]>;

    /**
     * Devuelve la lista completa de grupos/UEA disponibles para asignación.
     */
    getGrupos(): Promise<GrupoDTO[]>;

    /**
     * Devuelve los candidatos para un área específica.
     * @param areaId ID del área
     */
    getCandidatosPorArea(areaId: number): Promise<any>;

    /**
     * Obtener datos de prueba FSM
     */
    getFSMTestData(numeroEconomico: number, idUeaGrupo: number): Promise<{ profesor: ProfesorDTO, grupo: GrupoDTO }>;
}
