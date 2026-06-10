import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { AsignacionInput } from '@solution/greedy/GreedyTypes';
import type { KdeWorkerEcoResumen } from './graspKdeTypes';

export interface CandidateRowMetadata {
    origin?: string;
    horarioLaboralAgreement?: {
        hayMutuoAcuerdo?: boolean;
        aplicaReglaHorarioLaboral?: boolean;
        modoValidacion?: string;
        kdeIhScoreUsado?: number;
        kdeIhUmbralAutomatico?: number;
        subestado?: 'EXCEPCION_HORARIO_LABORAL';
        motivo?: string;
    };
    /** Excepción manual de REGLA_IGNORAR_GRUPOS (grupos SAI/CPRO). Espejo de
     *  horarioLaboralAgreement; solo aditivo (compatible con snapshots persistidos). */
    grupoIgnoradoAgreement?: {
        asignarManualmente: boolean;
        regla?: string;
        subestado?: string;
        modoValidacion?: string;
        motivo?: string;
    };
}

export interface CandidateRow {
    numeroEconomico: number;
    idUeaGrupo: number;
    uea: number;
    claveGrupo: string;
    horarioStringRaw: string;
    turno: 'manana' | 'medioDia' | 'tarde';
    score?: number;
    kde_ij?: number;
    kde_ih?: number;
    kde_ih_raw?: number;
    kde_plan?: number;
    zBase?: number;
    projectedPlanCount?: number;
    dayCoverage?: number;
    locked: boolean;
    passIndex: number;
    metadata?: CandidateRowMetadata;
}

export function turnoFromHorarios(horarios: { horaInicio: number }[]): 'manana' | 'medioDia' | 'tarde' {
    const minStart = Math.min(...horarios.map(h => h.horaInicio));
    if (minStart < 12) return 'manana';
    if (minStart < 15) return 'medioDia';
    return 'tarde';
}

/**
 * Construye CandidateRow[] a partir de las asignaciones del worker, el catalogo de grupos
 * y los EcoResumen para reusar los scores ya calculados.
 */
export function buildCandidateRows(
    asignaciones: AsignacionInput[],
    grupos: GrupoDTO[],
    ecoResumenes: KdeWorkerEcoResumen[],
    passIndex: number,
    previousLocks: Set<string> = new Set(),
): CandidateRow[] {
    const ecoScoreIndex = new Map<string, KdeWorkerEcoResumen['asignaciones'][number]>();
    for (const resumen of ecoResumenes) {
        for (const asig of resumen.asignaciones) {
            ecoScoreIndex.set(`${resumen.eco}|${asig.grupo}|${asig.horario}`, asig);
        }
    }

    return asignaciones.map(a => {
        const grupo = grupos.find(g => g.idUeaGrupo === a.idUeaGrupo);
        if (!grupo) {
            return {
                numeroEconomico: a.numeroEconomico,
                idUeaGrupo: a.idUeaGrupo,
                uea: -1,
                claveGrupo: '?',
                horarioStringRaw: '',
                turno: 'manana' as const,
                locked: previousLocks.has(`${a.numeroEconomico}|${a.idUeaGrupo}`),
                passIndex,
            };
        }
        const scoreData = ecoScoreIndex.get(`${a.numeroEconomico}|${grupo.claveGrupo}|${grupo.horarioStringRaw}`);
        return {
            numeroEconomico: a.numeroEconomico,
            idUeaGrupo: a.idUeaGrupo,
            uea: grupo.ueaClave,
            claveGrupo: grupo.claveGrupo,
            horarioStringRaw: grupo.horarioStringRaw,
            turno: turnoFromHorarios(grupo.horarios),
            score: scoreData?.score,
            kde_ij: scoreData?.kde_ij,
            kde_ih: scoreData?.kde_ih,
            kde_ih_raw: scoreData?.kde_ih_raw,
            kde_plan: scoreData?.kde_plan,
            zBase: scoreData?.zBase,
            projectedPlanCount: scoreData?.projectedPlanCount,
            dayCoverage: scoreData?.dayCoverage,
            locked: previousLocks.has(`${a.numeroEconomico}|${a.idUeaGrupo}`),
            passIndex,
        };
    });
}

export function candidateKey(row: { numeroEconomico: number; idUeaGrupo: number }): string {
    return `${row.numeroEconomico}|${row.idUeaGrupo}`;
}

/**
 * Clave por CONTENIDO físico de una asignación (eco + uea + claveGrupo), independiente del
 * `idUeaGrupo` (que se renumera en cada parse y puede colisionar entre generaciones de pases).
 * Se usa para fusionar/excluir filas entre pases sin depender de ids.
 */
export function physicalKey(row: { numeroEconomico: number; uea: number; claveGrupo: string }): string {
    return `${row.numeroEconomico}|${row.uea}|${row.claveGrupo}`;
}
