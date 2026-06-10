import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { EstrategiaOrdenamiento } from './GreedyTypes';

/**
 * Heuristica MCV (Most Constrained Variable) de dos niveles:
 *
 * Nivel 1: areas con menos grupos programados primero.
 * Nivel 2: grupos con mas franjas y mayor duracion primero.
 */
export class EstrategiaMCV implements EstrategiaOrdenamiento {
    ordenarAreas(areas: Map<string, GrupoDTO[]>): [string, GrupoDTO[]][] {
        return Array.from(areas.entries()).sort((a, b) => a[1].length - b[1].length);
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        return [...grupos].sort((a, b) => {
            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasB !== franjasA) return franjasB - franjasA;

            const durA = this._duracionTotal(a);
            const durB = this._duracionTotal(b);
            if (durA !== durB) return durB - durA;

            return a.idUeaGrupo - b.idUeaGrupo;
        });
    }

    ordenarProfesores(profesores: ProfesorDTO[], grupoId?: number): ProfesorDTO[] {
        if (profesores.length <= 1) return [...profesores];
        if (grupoId === undefined) return [...profesores];

        return [...profesores].sort((a, b) => {
            const franjasA = this._contarFranjasContratacion(a);
            const franjasB = this._contarFranjasContratacion(b);
            if (franjasA !== franjasB) return franjasA - franjasB;
            return a.numeroEconomico - b.numeroEconomico;
        });
    }

    private _duracionTotal(grupo: GrupoDTO): number {
        return grupo.horarios.reduce(
            (total, franja) => total + (franja.horaFin - franja.horaInicio),
            0
        );
    }

    private _contarFranjasContratacion(profesor: ProfesorDTO): number {
        return profesor.horariosContratacion.reduce((total, horario) => {
            return total + this._contarDiasLaborales(horario.idDiasDeTrabajo);
        }, 0);
    }

    private _contarDiasLaborales(idDiasDeTrabajo: string): number {
        const texto = idDiasDeTrabajo.trim().toUpperCase();
        if (texto === 'L-V') return 5;
        if (texto === 'L-J') return 4;

        const dias = texto.split(/[-,/\s]+/).filter(Boolean);
        return dias.length > 0 ? dias.length : 1;
    }
}
