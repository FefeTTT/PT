import { GrafoBipartito } from '@solution/models/GrafoBipartito';
import { FSMAsignador, EstadoAsignacion, type ResultadoAsignacion } from '@solution/fsm/FSMAsignador';
import { ReglasPipeline } from '@solution/rules/ReglasPipeline';
import { reiniciarCacheReglas } from '@solution/rules/ReglasImplementacion';
import { setJsonFiles } from '@solution/misc/helper_functions';
import type { ContextoRegla, ReglaBase } from '@solution/rules/ReglaBase';
import type { GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import type { CandidateRow } from './candidateRow';
import type { KdeRawInputs } from './graspKdeTypes';

export { EstadoAsignacion };
export type { ResultadoAsignacion };

/**
 * Inyecta en el realm actual (hilo principal) los JSON que requieren ReglaProfesorVigente y
 * ReglaAreasVistas. Es el espejo de lo que hace graspKdeWorker antes de correr el GRASP
 * (graspKdeWorker.ts:140-146). Debe llamarse ANTES de construir el pipeline, porque esas
 * reglas memorizan los archivos en globals de módulo en su primera construcción; por eso
 * además invalidamos el cache para tolerar cambios de workspace en caliente.
 */
export function seedReglasJson(inputs: KdeRawInputs): void {
    setJsonFiles({
        'ecos_vigentes_con_horario_regular.json': inputs.ecoHorarioRegular,
        'ecos_vigentes_con_horario_irregular.json': inputs.ecoHorarioIrregularVigente ?? {},
        'ecos_irregulares_inferidos.json': inputs.ecoHorarioIrregular ?? {},
        'area_profesor.json': inputs.areaProfesor,
        'programacion_vacia_26P.json': inputs.programacionVacia,
        'eco-nombre.json': inputs.ecoNombre,
    });
    reiniciarCacheReglas();
}

/**
 * Pipeline de validación de asignación MANUAL: exactamente las mismas reglas que aplica el
 * GRASP (GreedyOrchestrator.ts:119-122): primero las de fast-fail (profesor vigente, áreas
 * vistas, programación, grupos ignorados) y luego las estructurales/de contrato (asignación
 * global, traslape, horario laboral, máximo de horas diarias).
 *
 * @param maxHorasDiarias Límite diario. Default = el del GRASP (4.5h vía getReglasRestantes).
 */
export function crearPipelineManual(maxHorasDiarias?: number): ReglaBase[] {
    return [
        ...ReglasPipeline.getReglasFastFail(),
        ...ReglasPipeline.getReglasRestantes(maxHorasDiarias),
    ];
}

/**
 * Reconstruye el grafo bipartito con la carga ACTUAL de la solución: registra todos los
 * profesores y grupos válidos del pase y reaplica (in-place, O(n)) las asignaciones vigentes.
 * Sobre este grafo la FSM evaluará traslapes y carga diaria del eco.
 *
 * @param gruposFallback Catálogo de respaldo (p.ej. el parse CRUDO del workspace, con SAI/CPRO)
 *  para registrar los grupos de filas asignadas cuyo id no está en `grupos` (el catálogo del
 *  pase). Sin esto, la carga de una fila SAI asignada a mano sería invisible para los chequeos
 *  de traslape y máximo de horas diarias. Solo se registra si el DTO del fallback coincide en
 *  ueaClave/claveGrupo con la fila (los ids se renumeran entre pases y pueden colisionar).
 */
export function construirGrafoActual(
    profesores: ProfesorDTO[],
    grupos: GrupoDTO[],
    candidates: CandidateRow[],
    gruposFallback?: ReadonlyMap<number, GrupoDTO> | GrupoDTO[],
): GrafoBipartito {
    const grafo = new GrafoBipartito();
    for (const p of profesores) grafo.registrarProfesor(p);
    for (const g of grupos) grafo.registrarGrupo(g);
    if (gruposFallback) {
        const fallbackById: ReadonlyMap<number, GrupoDTO> = Array.isArray(gruposFallback)
            ? new Map(gruposFallback.map(g => [g.idUeaGrupo, g]))
            : gruposFallback;
        for (const c of candidates) {
            if (grafo.grupos.has(c.idUeaGrupo)) continue;
            const dto = fallbackById.get(c.idUeaGrupo);
            // Verificación anti-colisión de ids: el DTO debe ser el MISMO grupo que la fila.
            if (!dto || dto.ueaClave !== c.uea || dto.claveGrupo !== c.claveGrupo) continue;
            grafo.registrarGrupo(dto);
        }
    }
    for (const c of candidates) {
        // Defensivo: un grupo ausente del catálogo o ya tomado rompería asignarMutable.
        if (!grafo.grupos.has(c.idUeaGrupo)) continue;
        if (grafo.asignacionesInversas.has(c.idUeaGrupo)) continue;
        grafo.asignarMutable(c.numeroEconomico, c.idUeaGrupo);
    }
    return grafo;
}

/**
 * Garantiza que un GrupoDTO involucrado en una validación manual esté registrado en el grafo.
 * Necesario para las piernas de Tomar/Intercambiar: `construirGrafoActual` solo registra los
 * grupos del catálogo del pase + los de las filas que recibe, y las dos filas involucradas en
 * un swap se EXCLUYEN de esa lista — sin este registro la FSM falla con INTEGRIDAD_GRAFO antes
 * de evaluar reglas (y la excepción manual SAI/CPRO nunca aplica).
 *
 * Si el id ya está ocupado por OTRO grupo físico (colisión de renumeración entre pases) y ese
 * id no tiene asignación vigente, el DTO correcto reemplaza al del catálogo SOLO en este grafo
 * local de validación; si tiene asignación, se respeta el registro existente (defensivo).
 */
export function asegurarGrupoEnGrafo(grafo: GrafoBipartito, grupo: GrupoDTO | undefined): void {
    if (!grupo) return;
    const existente = grafo.grupos.get(grupo.idUeaGrupo);
    if (!existente) {
        grafo.registrarGrupo(grupo);
        return;
    }
    const esOtroGrupo = existente.ueaClave !== grupo.ueaClave || existente.claveGrupo !== grupo.claveGrupo;
    if (esOtroGrupo && !grafo.asignacionesInversas.has(grupo.idUeaGrupo)) {
        grafo.registrarGrupo(grupo);
    }
}

export interface ContextoManualOpciones {
    /** Autoriza explícitamente asignar a mano un grupo SAI/CPRO (REGLA_IGNORAR_GRUPOS). */
    asignarManualmenteGruposIgnorados?: boolean;
}

export function crearContextoManualAsignacion(
    detalles: ZScoreDetails,
    hayMutuoAcuerdo: boolean,
    opciones?: ContextoManualOpciones,
): ContextoRegla {
    const contexto: ContextoRegla = {
        modoAsignacion: 'manual',
        hayAcuerdoHorarioLaboral: {
            revisarAcuerdo: 1,
            umbral: 0.02,
            score: detalles.kde_ih_raw ?? detalles.kde_ih ?? detalles.h_ih ?? 0,
            hayMutuoAcuerdo,
        },
    };
    if (opciones?.asignarManualmenteGruposIgnorados === true) {
        contexto.asignacionGruposIgnorados = { asignarManualmente: true };
    }
    return contexto;
}

/**
 * Corre la FSM manual sobre un grafo dado. No muta el grafo de entrada: en caso de éxito
 * devuelve `nuevoGrafo` (copia inmutable con la asignación aplicada), útil para encadenar
 * varias asignaciones en una misma sesión de edición.
 */
export function validarAsignacion(
    grafo: GrafoBipartito,
    eco: number,
    idUeaGrupo: number,
    pipeline: ReglaBase[],
    contexto?: ContextoRegla,
): ResultadoAsignacion {
    return new FSMAsignador(grafo, pipeline).procesarAsignacion(eco, idUeaGrupo, contexto);
}
