import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { BlockedGroupKey } from './graspKdeTypes';

/**
 * Helpers puros del esquema "parse completo + exclusión post-parse":
 * el worker parsea SIEMPRE el workspace completo (ids crudos estables por construcción) y
 * EXCLUYE del catálogo del pase los grupos bloqueados matcheando por CONTENIDO (uea+claveGrupo),
 * nunca por `idUeaGrupo`. Sustituye al viejo `buildPartialArchivosRequeridos`, que filtraba la
 * `programacionVacia` ANTES del parse y renumeraba los ids del catálogo en cada pase.
 */

function claveContenido(uea: number, claveGrupo: string): string {
    return `${uea}|${claveGrupo}`;
}

/**
 * Deriva las claves de exclusión del CONTENIDO de las filas bloqueadas (deduplicadas).
 * Igual que el viejo builder: la identidad de exclusión es (uea, claveGrupo) — el mismo par
 * no aparece dos veces en `programacion_vacia` con horarios distintos, y si la fila tiene un
 * horario stale lo correcto sigue siendo excluir el grupo físico completo.
 */
export function buildBlockedGroupKeys(
    rows: ReadonlyArray<{ uea: number; claveGrupo: string }>,
): BlockedGroupKey[] {
    const seen = new Set<string>();
    const keys: BlockedGroupKey[] = [];
    for (const row of rows) {
        const clave = claveContenido(row.uea, row.claveGrupo);
        if (seen.has(clave)) continue;
        seen.add(clave);
        keys.push({ uea: row.uea, claveGrupo: row.claveGrupo });
    }
    return keys;
}

/**
 * ConjuntoSinAsignar = ConjuntoOriginal − ConjuntoBloqueado, sobre el catálogo YA parseado
 * (ids crudos). Pura y estable:
 *  - Con 0 claves devuelve el MISMO array (identidad → paridad bit-idéntica con el pase 0).
 *  - `Array.prototype.filter` preserva el orden de parse del catálogo restante.
 *  - Los ids de los grupos restantes no se tocan: siguen siendo los crudos del workspace.
 */
export function excluirGruposBloqueados(
    grupos: GrupoDTO[],
    blockedKeys?: ReadonlyArray<BlockedGroupKey>,
): GrupoDTO[] {
    if (!blockedKeys || blockedKeys.length === 0) return grupos;
    const claves = new Set(blockedKeys.map(k => claveContenido(k.uea, k.claveGrupo)));
    return grupos.filter(g => !claves.has(claveContenido(g.ueaClave, g.claveGrupo)));
}
