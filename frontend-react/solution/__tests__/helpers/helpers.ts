import { GrafoBipartito } from '../../models/GrafoBipartito';
import { FSMAsignador } from '../../fsm/FSMAsignador';
import { ReglasPipeline } from '../../rules/ReglasPipeline';
import { ProfesorDTO, GrupoDTO } from '../../types/AssignmentTypes';

// ─────────────────────────────────────────────
// Grafo pre-poblado con asignaciones
// ─────────────────────────────────────────────

export function crearGrafoConAsignaciones(
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[],
    asignaciones: { numEco: number; idGrupo: number }[]
): GrafoBipartito {
    const grafo = new GrafoBipartito();
    profesores.forEach(p => grafo.registrarProfesor(p));
    grupos.forEach(g => grafo.registrarGrupo(g));

    for (const a of asignaciones) {
        grafo.asignarMutable(a.numEco, a.idGrupo);
    }

    return grafo;
}

// ─────────────────────────────────────────────
// FSM con pipeline canónico de reglas
// ─────────────────────────────────────────────

export function crearFSMConReglas(grafo: GrafoBipartito, limiteHoras: number = 24): FSMAsignador {
    const reglas = [
        ...ReglasPipeline.getReglasFastFail(),
        ...ReglasPipeline.getReglasRestantes(limiteHoras)
    ];
    return new FSMAsignador(grafo, reglas);
}

// ─────────────────────────────────────────────
// Snapshot helpers (rollback verification)
// ─────────────────────────────────────────────

/** Captura el hash determinista del grafo. */
export function snapshotGrafo(grafo: GrafoBipartito): string {
    return grafo.hashEstado();
}

/** Verifica que dos snapshots sean idénticos (rollback exacto). */
export function verificarRollback(antes: string, despues: string): boolean {
    return antes === despues;
}
