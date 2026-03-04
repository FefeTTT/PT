import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion } from '../fsm/FSMAsignador';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';

/**
 * Resultado de una iteración de mejora local.
 */
export interface ResultadoMejora {
    grafo: GrafoBipartito;
    mejoras: number;
    iteracionesEjecutadas: number;
}

/**
 * Ejection Chain — Búsqueda Local para GRASP (inspirada en KHE14).
 *
 * Estrategia de mejora:
 * 1. Selecciona una asignación existente al azar.
 * 2. Des-asigna el grupo (eject).
 * 3. Intenta reasignar el grupo libre a otro profesor válido vía FSM.
 * 4. Acepta el cambio si ΔZ > 0.
 * 5. Para cuando no hay mejora en N iteraciones consecutivas.
 *
 * Opera sobre un GrafoBipartito mutable para eficiencia O(1) por mutación.
 */
export class EjectionChain {
    private _maxIteraciones: number;
    private _maxSinMejora: number;

    constructor(maxIteraciones: number = 100, maxSinMejora: number = 20) {
        this._maxIteraciones = maxIteraciones;
        this._maxSinMejora = maxSinMejora;
    }

    /**
     * Ejecuta la búsqueda local sobre el grafo dado.
     *
     * @param grafo       Grafo mutable con las asignaciones actuales.
     * @param fsm         FSM para validar nuevas asignaciones.
     * @param funcionZ    Función objetivo para evaluar la calidad.
     * @returns           Resultado con el grafo mejorado y métricas.
     */
    public mejorar(
        grafo: GrafoBipartito,
        fsm: FSMAsignador,
        funcionZ: FuncionObjetivoZ
    ): ResultadoMejora {
        let mejoras = 0;
        let sinMejora = 0;
        let iteracion = 0;
        let zActual = funcionZ.evaluar(grafo).Z;

        while (iteracion < this._maxIteraciones && sinMejora < this._maxSinMejora) {
            iteracion++;

            // 1. Obtener todas las asignaciones actuales
            const asignaciones = Array.from(grafo.asignacionesInversas.entries());
            if (asignaciones.length === 0) break;

            // 2. Seleccionar una asignación al azar
            const idx = Math.floor(Math.random() * asignaciones.length);
            const [idGrupo, numEcoOriginal] = asignaciones[idx];

            // 3. Obtener candidatos alternativos (profesores de la misma área)
            const grupo = grafo.grupos.get(idGrupo);
            if (!grupo) {
                sinMejora++;
                continue;
            }

            const candidatos = Array.from(grafo.profesores.values())
                .filter(p =>
                    p.idArea === grupo.idArea &&
                    p.numeroEconomico !== numEcoOriginal
                );

            if (candidatos.length === 0) {
                sinMejora++;
                continue;
            }

            // 4. Des-asignar el grupo (eject)
            grafo.desasignarMutable(idGrupo);

            // 5. Intentar reasignar a un candidato alternativo
            // Actualizar FSM con el grafo post-eject
            fsm.actualizarGrafo(grafo);

            let reasignado = false;

            // Aleatorizar el orden de candidatos
            const candidatosAleatorios = [...candidatos];
            for (let i = candidatosAleatorios.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidatosAleatorios[i], candidatosAleatorios[j]] =
                    [candidatosAleatorios[j], candidatosAleatorios[i]];
            }

            for (const candidato of candidatosAleatorios) {
                const resultado = fsm.procesarAsignacion(
                    candidato.numeroEconomico,
                    idGrupo
                );

                if (resultado.estado === EstadoAsignacion.ASIGNACION_OK) {
                    // Asignar al nuevo profesor
                    grafo.asignarMutable(candidato.numeroEconomico, idGrupo);
                    fsm.actualizarGrafo(grafo);

                    // Evaluar Z con la nueva asignación
                    const zNuevo = funcionZ.evaluar(grafo).Z;

                    if (zNuevo > zActual) {
                        // Mejora: aceptar
                        zActual = zNuevo;
                        mejoras++;
                        sinMejora = 0;
                        reasignado = true;
                    } else {
                        // No mejora: revertir
                        grafo.desasignarMutable(idGrupo);
                        grafo.asignarMutable(numEcoOriginal, idGrupo);
                        fsm.actualizarGrafo(grafo);
                        sinMejora++;
                    }
                    break;
                }
            }

            if (!reasignado) {
                // Ningún candidato fue válido: restaurar la asignación original
                grafo.asignarMutable(numEcoOriginal, idGrupo);
                fsm.actualizarGrafo(grafo);
                sinMejora++;
            }
        }

        return {
            grafo,
            mejoras,
            iteracionesEjecutadas: iteracion
        };
    }
}
