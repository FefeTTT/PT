import { GrafoBipartito } from '../models/GrafoBipartito';

export type ZScoreDetails = {
    score: number;
    h_ih: number;
    rhat: number;
    kde_ij?: number;
    kde_ih?: number;
    kde_ih_raw?: number;
    kde_plan?: number;
    zBase?: number;
    scoreRcl?: number;
    penaltyMask?: number;
    projectedPlanCount?: number;
    dayCoverage?: number;
    patternSimilarity?: number;
    hourCoverage?: number;
    contractCoverage?: number;
    source?: 'legacy' | 'kde_ij' | 'uniform';
    domainBlocked?: boolean;
    blockReason?: string;
};

/**
* ZScoreFunction encapsula la evaluación Z para el GRASP.
*/
export type ZScoreFunction = (eco: number, idUeaGrupo: number, grafo?: GrafoBipartito) => ZScoreDetails;

export interface ZScoreDomainOptions {
    minScore?: number;
    minHIh?: number;
}

export function explicarBloqueoZScore(
    detalles: ZScoreDetails,
    options: ZScoreDomainOptions = {}
): string | undefined {
    const minScore = options.minScore ?? 0.0;
    const minHIh = options.minHIh ?? 0.05;

    if (detalles.domainBlocked) {
        return detalles.blockReason ?? 'Z_DOMAIN_BLOCK';
    }

    if (!Number.isFinite(detalles.score) || detalles.score <= minScore) {
        return `Z_SCORE_FUERA_DOMINIO: score=${detalles.score}`;
    }

    if (detalles.source === 'kde_ij') {
        return undefined;
    }

    if (!Number.isFinite(detalles.h_ih) || detalles.h_ih < minHIh) {
        return `PODA_KDE: h_ih=${detalles.h_ih} < ${minHIh}`;
    }

    return undefined;
}

/**
 * Implementación por defecto: peso uniforme w_ig = 1 para todo par.
 * Usada cuando el modelo externo aún no está integrado.
 */
export const funcionZUniforme: ZScoreFunction = (_eco: number, _idUeaGrupo: number, _grafo?: GrafoBipartito) => {
    return { score: 1.0, h_ih: 1.0, rhat: 1.0, zBase: 1.0, source: 'uniform' };
};
