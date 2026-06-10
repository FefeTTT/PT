import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { EstrategiaOrdenamiento } from './GreedyTypes';

/**
 * Prioriza las UEAs menos frecuentes en la programacion actual.
 * La frecuencia se calcula sobre la lista completa de grupos observados.
 */
export class EstrategiaUeaMenosVista implements EstrategiaOrdenamiento {
    private readonly _frecuenciaUea = new Map<number, number>();

    constructor(gruposBase: GrupoDTO[]) {
        for (const grupo of gruposBase) {
            this._frecuenciaUea.set(
                grupo.ueaClave,
                (this._frecuenciaUea.get(grupo.ueaClave) ?? 0) + 1
            );
        }
    }

    ordenarAreas(areas: Map<string, GrupoDTO[]>): [string, GrupoDTO[]][] {
        return Array.from(areas.entries()).sort(([idAreaA, gruposA], [idAreaB, gruposB]) => {
            const rarezaA = this._menorFrecuenciaUea(gruposA);
            const rarezaB = this._menorFrecuenciaUea(gruposB);
            if (rarezaA !== rarezaB) return rarezaA - rarezaB;

            if (gruposA.length !== gruposB.length) return gruposA.length - gruposB.length;
            return idAreaA.localeCompare(idAreaB);
        });
    }

    ordenarGrupos(grupos: GrupoDTO[]): GrupoDTO[] {
        return [...grupos].sort((a, b) => {
            const frecuenciaA = this._frecuencia(a.ueaClave);
            const frecuenciaB = this._frecuencia(b.ueaClave);
            if (frecuenciaA !== frecuenciaB) return frecuenciaA - frecuenciaB;

            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasA !== franjasB) return franjasB - franjasA;

            const duracionA = this._duracionTotal(a);
            const duracionB = this._duracionTotal(b);
            if (duracionA !== duracionB) return duracionB - duracionA;

            if (a.ueaClave !== b.ueaClave) return a.ueaClave - b.ueaClave;
            return a.idUeaGrupo - b.idUeaGrupo;
        });
    }

    ordenarProfesores(profesores: ProfesorDTO[], _grupoId?: number): ProfesorDTO[] {
        return [...profesores];
    }

    private _frecuencia(ueaClave: number): number {
        return this._frecuenciaUea.get(ueaClave) ?? Number.MAX_SAFE_INTEGER;
    }

    private _menorFrecuenciaUea(grupos: GrupoDTO[]): number {
        if (grupos.length === 0) return Number.MAX_SAFE_INTEGER;
        return Math.min(...grupos.map(grupo => this._frecuencia(grupo.ueaClave)));
    }

    private _duracionTotal(grupo: GrupoDTO): number {
        return grupo.horarios.reduce(
            (total, franja) => total + (franja.horaFin - franja.horaInicio),
            0
        );
    }
}
