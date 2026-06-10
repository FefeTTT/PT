import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import { turnoFromHorarios, type CandidateRow, type CandidateRowMetadata } from './candidateRow';

/** Puntuación de ranking de un candidato: mejor componente entre UEA y horario. */
export function rankKde(detalles: { kde_ij?: number; kde_ih?: number }): number {
    return Math.max(detalles.kde_ij ?? 0, detalles.kde_ih ?? 0);
}

export interface ConteoImparticion {
    /** Veces impartida en los últimos `ventana` (= half_life) trimestres. */
    count: number;
    /** Veces impartida en todo el historial. */
    total: number;
    /** Suma ponderada por recencia (0.5^(edad/halfLife)), espejo del peso de kde_ij. */
    weighted: number;
    /** Trimestre (tri_num) más reciente en que se impartió, o null si nunca. */
    ultimaTri: number | null;
}

export interface HistorialUea {
    /** Trimestre máximo observado en df_hist. */
    maxTri: number;
    /** Tamaño de ventana (en trimestres) usada para `count`. */
    ventana: number;
    /** ¿df_hist tiene observaciones para este eco? (false ⇒ "eco sin historial") */
    tieneHistorial(eco: number): boolean;
    contar(eco: number, uea: number): ConteoImparticion;
}

const CERO: ConteoImparticion = { count: 0, total: 0, weighted: 0, ultimaTri: null };

/**
 * Indexa df_hist una sola vez para poder consultar, por (eco, uea), cuántas veces se ha
 * impartido la UEA en los últimos N (= half_life) trimestres. Mismas claves/campos que usa
 * ZScoreKDE (`eco`, `uea`, `tri_num`), de modo que el conteo es coherente con kde_ij.
 */
export function crearHistorialUea(dfHist: unknown[], halfLife: number): HistorialUea {
    const rows = dfHist as Array<Record<string, unknown>>;
    const ventana = Math.max(1, Math.round(halfLife || 1));
    let maxTri = 0;
    const porClave = new Map<string, number[]>();
    const ecosConHistorial = new Set<number>();

    for (const row of rows) {
        const eco = Number(row.eco);
        const uea = Number(row.uea);
        const tri = Number(row.tri_num);
        if (!Number.isFinite(eco) || !Number.isFinite(uea) || !Number.isFinite(tri)) continue;
        if (tri > maxTri) maxTri = tri;
        ecosConHistorial.add(eco);
        const key = `${eco}|${uea}`;
        const arr = porClave.get(key);
        if (arr) arr.push(tri);
        else porClave.set(key, [tri]);
    }

    return {
        maxTri,
        ventana,
        tieneHistorial: (eco: number) => ecosConHistorial.has(eco),
        contar(eco: number, uea: number): ConteoImparticion {
            const tris = porClave.get(`${eco}|${uea}`);
            if (!tris || tris.length === 0) return CERO;
            const corte = maxTri - ventana; // cuenta los `ventana` trimestres más recientes
            let count = 0;
            let weighted = 0;
            let ultimaTri = 0;
            for (const tri of tris) {
                if (tri > corte) count++;
                weighted += Math.pow(0.5, Math.max(0, maxTri - tri) / halfLife);
                if (tri > ultimaTri) ultimaTri = tri;
            }
            return { count, total: tris.length, weighted: Math.round(weighted * 100) / 100, ultimaTri };
        },
    };
}

/**
 * Construye la metadata de una asignación manual que requirió excepciones FSM:
 *  - `mutuoAcuerdo`: REGLA_HORARIO_LABORAL superada por mutuo acuerdo manual.
 *  - `grupoIgnorado`: REGLA_IGNORAR_GRUPOS (SAI/CPRO) superada con autorización explícita.
 * Devuelve undefined si no se usó ninguna excepción (la fila va sin metadata, como siempre).
 */
export function metadataExcepcionesManual(
    detalles: ZScoreDetails,
    opciones: {
        mutuoAcuerdo?: { aplicada: boolean; motivo?: string };
        grupoIgnorado?: { aplicada: boolean; motivo?: string };
    },
): CandidateRowMetadata | undefined {
    const aplicaMutuo = opciones.mutuoAcuerdo?.aplicada === true;
    const aplicaIgnorado = opciones.grupoIgnorado?.aplicada === true;
    if (!aplicaMutuo && !aplicaIgnorado) return undefined;
    const metadata: CandidateRowMetadata = { origin: 'manual' };
    if (aplicaMutuo) {
        metadata.horarioLaboralAgreement = {
            hayMutuoAcuerdo: true,
            aplicaReglaHorarioLaboral: true,
            modoValidacion: 'manual',
            kdeIhScoreUsado: detalles.kde_ih_raw ?? detalles.kde_ih ?? detalles.h_ih,
            kdeIhUmbralAutomatico: 0.02,
            subestado: 'EXCEPCION_HORARIO_LABORAL',
            motivo: opciones.mutuoAcuerdo?.motivo,
        };
    }
    if (aplicaIgnorado) {
        metadata.grupoIgnoradoAgreement = {
            asignarManualmente: true,
            regla: 'REGLA_IGNORAR_GRUPOS',
            subestado: 'EXCEPCION_GRUPO_IGNORADO',
            modoValidacion: 'manual',
            motivo: opciones.grupoIgnorado?.motivo,
        };
    }
    return metadata;
}

/**
 * Construye la fila `CandidateRow` (bloqueada, en el pase actual) que se inyectará al grafo a
 * partir de un grupo elegido manualmente y los detalles de score ya calculados con evaluarGrupo.
 */
export function grupoToCandidateRow(
    eco: number,
    grupo: GrupoDTO,
    detalles: ZScoreDetails,
    pass: number,
    metadata?: CandidateRowMetadata,
): CandidateRow {
    return {
        numeroEconomico: eco,
        idUeaGrupo: grupo.idUeaGrupo,
        uea: grupo.ueaClave,
        claveGrupo: grupo.claveGrupo,
        horarioStringRaw: grupo.horarioStringRaw,
        turno: turnoFromHorarios(grupo.horarios),
        score: detalles.score,
        kde_ij: detalles.kde_ij,
        kde_ih: detalles.kde_ih,
        kde_ih_raw: detalles.kde_ih_raw,
        kde_plan: detalles.kde_plan,
        zBase: detalles.zBase,
        projectedPlanCount: detalles.projectedPlanCount,
        dayCoverage: detalles.dayCoverage,
        locked: true,
        passIndex: pass,
        metadata,
    };
}
