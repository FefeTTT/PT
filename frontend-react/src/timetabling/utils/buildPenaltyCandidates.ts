import type {
    AssignmentDTO,
    GroupProfileDTO,
    WorkspaceDTO,
} from '../dtos';
import { canonicalizeHorario } from '../engine/solution-parity/ml/CacheKeys';

/**
 * Payload por candidato enviado al endpoint /score_batch del backend Python.
 *
 * El backend usa estos campos asi:
 *   - eco, uea, horario           -> entrada de PenalizacionCargaHistoricaModel.predict_extended
 *   - ueas_asignadas_actuales     -> contexto: claves UEA de asignaciones previas
 *   - horarios_asignados_actuales -> contexto: horarios de esas asignaciones previas
 *
 * El campo `id` es opaco para el backend; el frontend lo usa para reasociar
 * el resultado a la fila de la UI.
 */
export interface PenaltyBatchItem {
    id: string;
    eco: string;
    uea: string;
    horario: string;
    ueas_asignadas_actuales: string[];
    horarios_asignados_actuales: string[];
}

export interface BuildPenaltyCandidatesOptions {
    /**
     * Limita el numero de candidatos por eco (top-N grupos compatibles).
     * Util para previsualizar antes de mandar el batch entero.
     */
    maxCandidatesPerEco?: number;

    /**
     * Limita el numero total de candidatos del batch. 0 = sin limite
     * (sujeto al SCORE_BATCH_MAX_SIZE del backend).
     */
    maxTotal?: number;

    /**
     * Si se provee, restringe la generacion a estos ecos.
     */
    targetEcos?: Set<number>;

    /**
     * Si se provee, se usan estas asignaciones como contexto. Sin esto,
     * el contexto sera el vacio (escenario "primera asignacion").
     */
    asignacionesPrevias?: AssignmentDTO[];
}

export interface PenaltyCandidatesBuildResult {
    items: PenaltyBatchItem[];
    skippedGroups: number;
    truncated: boolean;
}

/**
 * Construye TODOS los candidatos (eco, grupo) viables a partir del workspace,
 * listos para mandarse al backend en un solo POST a /score_batch.
 *
 * Reglas de viabilidad:
 *   - El profesor debe tener al menos un idArea que matchee el idArea del grupo.
 *   - El grupo debe tener horarioStringRaw legible (lo canonicaliza antes de mandar).
 *
 * NO filtra por choques de horario, KDE ni reglas FSM. Esa es responsabilidad
 * de capas superiores: aqui solo se ENVIA al modelo penalty para que devuelva
 * su score y el frontend pueda filtrar/ordenar con esa info ya en memoria.
 */
export function buildPenaltyCandidates(
    workspace: WorkspaceDTO,
    options: BuildPenaltyCandidatesOptions = {}
): PenaltyCandidatesBuildResult {
    const { maxCandidatesPerEco, maxTotal = 0, targetEcos, asignacionesPrevias } = options;

    const gruposPorArea = new Map<number, GroupProfileDTO[]>();
    let skippedGroups = 0;
    for (const grupo of workspace.grupos) {
        if (!grupo.horarioStringRaw) {
            skippedGroups++;
            continue;
        }
        const lista = gruposPorArea.get(grupo.idArea) ?? [];
        lista.push(grupo);
        gruposPorArea.set(grupo.idArea, lista);
    }

    const contextoPorEco = buildContextoPorEco(asignacionesPrevias ?? [], workspace.grupos);

    const items: PenaltyBatchItem[] = [];
    let truncated = false;

    for (const profesor of workspace.profesores) {
        if (targetEcos && !targetEcos.has(profesor.numeroEconomico)) continue;
        const ecoStr = String(profesor.numeroEconomico);
        const contexto = contextoPorEco.get(profesor.numeroEconomico) ?? { ueas: [], horarios: [] };

        let perEcoCount = 0;
        for (const area of profesor.areas) {
            const grupos = gruposPorArea.get(area);
            if (!grupos) continue;
            for (const grupo of grupos) {
                if (maxCandidatesPerEco !== undefined && perEcoCount >= maxCandidatesPerEco) break;
                let horarioCanon: string;
                try {
                    horarioCanon = canonicalizeHorario(grupo.horarioStringRaw!);
                } catch {
                    skippedGroups++;
                    continue;
                }
                items.push({
                    id: `${ecoStr}|${grupo.idUeaGrupo}`,
                    eco: ecoStr,
                    uea: String(grupo.ueaClave),
                    horario: horarioCanon,
                    ueas_asignadas_actuales: contexto.ueas,
                    horarios_asignados_actuales: contexto.horarios,
                });
                perEcoCount++;
                if (maxTotal > 0 && items.length >= maxTotal) {
                    truncated = true;
                    break;
                }
            }
            if (truncated) break;
        }
        if (truncated) break;
    }

    return { items, skippedGroups, truncated };
}

function buildContextoPorEco(
    asignaciones: AssignmentDTO[],
    grupos: GroupProfileDTO[]
): Map<number, { ueas: string[]; horarios: string[] }> {
    const byId = new Map<number, GroupProfileDTO>();
    for (const g of grupos) byId.set(g.idUeaGrupo, g);

    const out = new Map<number, { ueas: string[]; horarios: string[] }>();
    for (const asg of asignaciones) {
        const grupo = byId.get(asg.idUeaGrupo);
        if (!grupo?.horarioStringRaw) continue;
        let horarioCanon: string;
        try {
            horarioCanon = canonicalizeHorario(grupo.horarioStringRaw);
        } catch {
            continue;
        }
        const entry = out.get(asg.numeroEconomico) ?? { ueas: [], horarios: [] };
        entry.ueas.push(String(grupo.ueaClave));
        entry.horarios.push(horarioCanon);
        out.set(asg.numeroEconomico, entry);
    }
    return out;
}

/**
 * Construye la key Redis (lado cliente) usada por el backend para escribir
 * el resultado del batch. Util cuando el frontend quiere pre-checar el cache
 * via /api/redis/mget antes de mandar el batch.
 */
export function penaltyRedisKeyFor(item: PenaltyBatchItem): string {
    // v3: alineado con el bump de namespace del penalty reentrenado (carga = UEAs TOTALES).
    return `Penalty:v3:${item.eco}:${item.uea}:${item.horario}`;
}
