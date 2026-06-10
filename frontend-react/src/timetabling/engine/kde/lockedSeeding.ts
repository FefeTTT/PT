import type { GrafoBipartito } from '@solution/models/GrafoBipartito';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { LockedAssignmentDTO } from './graspKdeTypes';

/**
 * Base de los ids sintéticos para filas bloqueadas cuyo id colisiona con OTRO grupo físico del
 * catálogo del pase (los ids se renumeran en cada parse). Muy por encima de cualquier id real
 * (los catálogos rondan unos cientos de grupos), así que no puede chocar con ids del pase.
 */
export const SYNTHETIC_LOCKED_ID_BASE = 1_000_000;

export function lockedToGrupoDTO(l: LockedAssignmentDTO): GrupoDTO {
    return {
        idUeaGrupo: l.idUeaGrupo,
        idGrupo: l.idGrupo,
        claveGrupo: l.claveGrupo,
        idArea: l.idArea,
        ueaClave: l.ueaClave,
        horarios: l.horarios,
        horarioStringRaw: l.horarioStringRaw,
    };
}

export interface SeededLockedAssignment {
    locked: LockedAssignmentDTO;
    /** GrupoDTO efectivamente registrado en el grafo (su id puede ser sintético). */
    dto: GrupoDTO;
    /** id bajo el que quedó sembrada la carga en el grafo. */
    idEfectivo: number;
    /** true si hubo colisión de renumeración y se usó un id sintético. */
    sintetico: boolean;
}

/**
 * Siembra las asignaciones bloqueadas (ConjuntoBloqueado) en el `grafoInicial` del pase.
 *
 * Guard anti-colisión: si `idUeaGrupo` ya está registrado en el grafo pero el DTO registrado
 * describe OTRO grupo físico (ueaClave/claveGrupo distintos — colisión por renumeración de ids
 * entre pases), sembrar bajo ese id cargaría la W EQUIVOCADA. En ese caso el DTO bloqueado se
 * registra bajo un id sintético único (>= SYNTHETIC_LOCKED_ID_BASE) y la asignación se hace ahí,
 * dejando intacto el grupo del pase. Con 0 locks la función es no-op (paridad con pase 0).
 *
 * Devuelve los registros efectivos para que el worker pueda incluirlos en `gruposValidos`
 * (gruposParaResumen) y el scoring/fusión posteriores resuelvan también los ids sintéticos.
 */
export function sembrarAsignacionesBloqueadas(
    grafo: GrafoBipartito,
    lockedAssignments: LockedAssignmentDTO[],
): SeededLockedAssignment[] {
    const out: SeededLockedAssignment[] = [];
    let nextSyntheticId = SYNTHETIC_LOCKED_ID_BASE;
    for (const locked of lockedAssignments) {
        const registrado = grafo.grupos.get(locked.idUeaGrupo);
        let idEfectivo = locked.idUeaGrupo;
        let sintetico = false;
        if (!registrado) {
            grafo.registrarGrupo(lockedToGrupoDTO(locked));
        } else if (registrado.ueaClave !== locked.ueaClave || registrado.claveGrupo !== locked.claveGrupo) {
            while (grafo.grupos.has(nextSyntheticId)) nextSyntheticId++;
            idEfectivo = nextSyntheticId++;
            sintetico = true;
            grafo.registrarGrupo({ ...lockedToGrupoDTO(locked), idUeaGrupo: idEfectivo });
            console.warn(
                '[sembrarAsignacionesBloqueadas] Colisión de id en la siembra: '
                + `id=${locked.idUeaGrupo} está registrado como ${registrado.ueaClave}/${registrado.claveGrupo} `
                + `pero la fila bloqueada es ${locked.ueaClave}/${locked.claveGrupo} (eco=${locked.numeroEconomico}). `
                + `Se siembra bajo id sintético ${idEfectivo}.`,
            );
        }
        const dto = grafo.grupos.get(idEfectivo)!;
        if (grafo.asignacionesInversas.has(idEfectivo)) {
            console.warn(
                '[sembrarAsignacionesBloqueadas] El grupo ya tiene asignación en el grafo inicial; '
                + `se omite la siembra duplicada. eco=${locked.numeroEconomico} id=${idEfectivo} `
                + `grupo=${locked.ueaClave}/${locked.claveGrupo}`,
            );
            out.push({ locked, dto, idEfectivo, sintetico });
            continue;
        }
        grafo.asignarMutable(locked.numeroEconomico, idEfectivo);
        out.push({ locked, dto, idEfectivo, sintetico });
    }
    return out;
}
