import { IAssignmentData } from '../../../solution/core/IAssignmentData';
import { GrupoDTO, ProfesorDTO } from '../../../solution/types/AssignmentTypes';

export class HttpAssignmentData implements IAssignmentData {
    public async getProfesores(): Promise<ProfesorDTO[]> {
        throw new Error("getProfesores() no implementado aún de forma global. Usa getCandidatosPorArea().");
    }

    public async getGrupos(): Promise<GrupoDTO[]> {
        throw new Error("getGrupos() no implementado aún de forma global. Usa getCandidatosPorArea().");
    }

    public async getCandidatosPorArea(areaId: number): Promise<any> {
        const response = await fetch(`controlador/candidatosPorArea.php?claveArea=${areaId}`);
        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Error del servidor: ${data.error}`);
        }
        return data;
    }

    public async getFSMTestData(numeroEconomico: number, idUeaGrupo: number): Promise<any> {
        const response = await fetch(`controlador/testFSMDatos.php?numeroEconomico=${numeroEconomico}&idUeaGrupo=${idUeaGrupo}`);
        const data = await response.json();
        if (!data.ok) {
            throw new Error(`Error al cargar datos BD para ${numeroEconomico} - ${idUeaGrupo}: ${data.error || 'Server error'}`);
        }
        return data; // returns { profesor, grupo }
    }
}
