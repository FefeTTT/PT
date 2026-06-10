import axios from 'axios';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { IModeloML } from '../ml/IModeloML';
import { EvaluationContext, ISoftConstraint } from './SoftConstraints';
import { ModeloPenaltyCached } from '../ml/ModeloPenaltyCached';
import { PenaltyObservedCache, PenaltyObservedPayload, PenaltyObservedResponse } from '../ml/PenaltyObservedCache';
import { canonicalizeHorario } from '../ml/CacheKeys';

interface PenaltyFinetunedResponse {
    eco: string;
    total_penalty: number;
    loads: number[];
    best_5: any[];
    projected_uea_count?: number;
    load_probability?: number;
    load_probabilities?: number[];
    load_density_ratio?: number;
    load_density_ratios?: number[];
}

export interface EvaluacionPenaltyCargaCandidato {
    penalty: number;
    viabilidad: number;
    totalPenalty: number;
    projectedUeaCount: number;
    loadPenalty?: number;
    loadProbability?: number;
    penaltyProbability?: number;
    loadDensityRatio?: number;
    blocked: boolean;
    blockReason?: string;
}

export interface ViabilidadPenalizacionCargaOptions {
    domainBlockThreshold?: number;
    loadProbabilityThreshold?: number;
    penaltyScale?: number;
}

export class ViabilidadPenalizacionCarga implements ISoftConstraint {
    readonly nombre = 'VIABILIDAD_PENALIZACION_CARGA';

    private _pythonBaseUrl: string;
    private _modeloPenalty?: ModeloPenaltyCached;
    private _observedCache?: PenaltyObservedCache;
    private readonly _domainBlockThreshold: number;
    private readonly _loadProbabilityThreshold: number;
    private readonly _penaltyScale: number;

    private _memoPenalty = new Map<number, { hash: string, penalty: number }>();

    constructor(
        pythonBaseUrl: string = 'http://127.0.0.1:8000',
        modeloPenalty?: ModeloPenaltyCached,
        observedCache?: PenaltyObservedCache,
        options: ViabilidadPenalizacionCargaOptions = {}
    ) {
        this._pythonBaseUrl = pythonBaseUrl;
        this._modeloPenalty = modeloPenalty;
        this._observedCache = observedCache;
        this._domainBlockThreshold = options.domainBlockThreshold ?? -1.5;
        this._loadProbabilityThreshold = options.loadProbabilityThreshold ?? 0.05;
        this._penaltyScale = options.penaltyScale ?? 1.0;
    }

    evaluar(grafo: GrafoBipartito, _modelo: IModeloML): number {
        if (this._observedCache) {
            throw new Error('ViabilidadPenalizacionCarga con observedCache requiere evaluarAsync().');
        }

        let viabilidadTotalAcumulada = 0;
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const asignaciones = grafo.adyacencias.get(numEco) || [];
            if (asignaciones.length === 0) continue;
            profesoresActivos++;

            const hash = [...asignaciones].sort().join(',');
            const cached = this._memoPenalty.get(numEco);

            if (cached && cached.hash === hash) {
                viabilidadTotalAcumulada += this._normalizarPenalty(cached.penalty);
            } else {
                this._actualizarPenaltyProfesor(numEco, grafo, hash);
                const baseline = this._getBaselinePenalty(numEco, grafo);
                viabilidadTotalAcumulada += this._normalizarPenalty(baseline);
            }
        }

        return profesoresActivos > 0 ? viabilidadTotalAcumulada / profesoresActivos : 1.0;
    }

    async evaluarAsync(grafo: GrafoBipartito, _modelo: IModeloML, context?: EvaluationContext): Promise<number> {
        if (!this._modeloPenalty || !this._modeloPenalty.tieneEstadisticosPenalty) {
            throw new Error('ViabilidadPenalizacionCarga async requiere ModeloPenaltyCached con estadisticos reales inicializados.');
        }

        if (!this._observedCache) {
            throw new Error('ViabilidadPenalizacionCarga async requiere PenaltyObservedCache.');
        }

        const promesas: Promise<number>[] = [];
        let profesoresActivos = 0;

        for (const [numEco] of grafo.profesores) {
            const asignaciones = grafo.adyacencias.get(numEco) || [];
            if (asignaciones.length === 0) continue;

            profesoresActivos++;
            const payload = this._crearPayloadProfesor(numEco, grafo);
            promesas.push(
                this._observedCache
                    .getOrFetchResponse(payload, { ...context, eco: numEco })
                    .then(response => this._viabilidadDesdeResponse(response).viabilidad)
            );
        }

        if (profesoresActivos === 0) return 1.0;

        const viabilidades = await Promise.all(promesas);
        const suma = viabilidades.reduce((acc, value) => acc + value, 0);
        return suma / profesoresActivos;
    }

    async evaluarCandidatoAsync(
        grafo: GrafoBipartito,
        numEco: number,
        idGrupoCandidato: number,
        context?: EvaluationContext
    ): Promise<EvaluacionPenaltyCargaCandidato> {
        if (!this._modeloPenalty || !this._modeloPenalty.tieneEstadisticosPenalty) {
            throw new Error('ViabilidadPenalizacionCarga candidato requiere ModeloPenaltyCached con estadisticos reales inicializados.');
        }

        if (!this._observedCache) {
            throw new Error('ViabilidadPenalizacionCarga candidato requiere PenaltyObservedCache.');
        }

        const payload = this._crearPayloadProfesorConCandidato(numEco, grafo, idGrupoCandidato);
        const response = await this._observedCache.getOrFetchResponse(payload, {
            ...context,
            eco: numEco,
            idGrupoCandidato,
        });

        const projectedUeaCount = response.projected_uea_count ?? this._contarUeasProyectadas(grafo, numEco, idGrupoCandidato);
        const totalPenalty = response.total_penalty;
        const loadPenalty = this._obtenerLoadPenalty(response, projectedUeaCount);
        const loadProbability = this._obtenerLoadProbability(response, projectedUeaCount);
        const loadDensityRatio = this._obtenerLoadDensityRatio(response, projectedUeaCount);
        const viability = this._viabilidadDesdeResponse(response, loadProbability);
        const blockReason = this._evaluarBloqueoDominio(
            totalPenalty,
            loadPenalty,
            projectedUeaCount,
            loadProbability
        );

        return {
            penalty: totalPenalty,
            viabilidad: viability.viabilidad,
            totalPenalty,
            projectedUeaCount,
            loadPenalty,
            loadProbability,
            penaltyProbability: viability.penaltyProbability,
            loadDensityRatio,
            blocked: blockReason !== undefined,
            blockReason,
        };
    }

    private _normalizarPenalty(penalty: number): number {
        if (!this._modeloPenalty) return penalty;
        return this._normalizarConEstadisticos(penalty);
    }

    private _normalizarConEstadisticos(penalty: number): number {
        return (2 * this._sigmoid(penalty / this._penaltyScale)) - 1;
    }

    private _viabilidadDesdeResponse(
        response: PenaltyObservedResponse,
        loadProbabilityOverride?: number
    ): { viabilidad: number; penaltyProbability: number } {
        const loadProbability = loadProbabilityOverride ?? response.load_probability ?? 1.0;
        const totalProbability = this._sigmoid(response.total_penalty / this._penaltyScale);
        const penaltyProbability = Math.min(this._clampProbability(loadProbability), totalProbability);
        return {
            penaltyProbability,
            viabilidad: (2 * penaltyProbability) - 1,
        };
    }

    private _sigmoid(value: number): number {
        return 1.0 / (1.0 + Math.exp(-value));
    }

    private _clampProbability(value: number): number {
        if (!Number.isFinite(value)) return 0.0;
        return Math.max(0.0, Math.min(1.0, value));
    }

    private _obtenerLoadPenalty(
        response: PenaltyObservedResponse,
        projectedUeaCount: number
    ): number | undefined {
        const loadIndex = projectedUeaCount - 2;
        if (!response.loads || loadIndex < 0 || loadIndex >= response.loads.length) return undefined;

        const loadPenalty = response.loads[loadIndex];
        return Number.isFinite(loadPenalty) ? loadPenalty : undefined;
    }

    private _obtenerLoadProbability(
        response: PenaltyObservedResponse,
        projectedUeaCount: number
    ): number | undefined {
        if (typeof response.load_probability === 'number' && Number.isFinite(response.load_probability)) {
            return this._clampProbability(response.load_probability);
        }

        const loadIndex = projectedUeaCount - 2;
        if (!response.load_probabilities || loadIndex < 0 || loadIndex >= response.load_probabilities.length) {
            return undefined;
        }

        const value = response.load_probabilities[loadIndex];
        return Number.isFinite(value) ? this._clampProbability(value) : undefined;
    }

    private _obtenerLoadDensityRatio(
        response: PenaltyObservedResponse,
        projectedUeaCount: number
    ): number | undefined {
        if (typeof response.load_density_ratio === 'number' && Number.isFinite(response.load_density_ratio)) {
            return this._clampProbability(response.load_density_ratio);
        }

        const loadIndex = projectedUeaCount - 2;
        if (!response.load_density_ratios || loadIndex < 0 || loadIndex >= response.load_density_ratios.length) {
            return undefined;
        }

        const value = response.load_density_ratios[loadIndex];
        return Number.isFinite(value) ? this._clampProbability(value) : undefined;
    }

    private _evaluarBloqueoDominio(
        totalPenalty: number,
        loadPenalty: number | undefined,
        projectedUeaCount: number,
        loadProbability?: number
    ): string | undefined {
        if (loadProbability !== undefined && loadProbability < this._loadProbabilityThreshold) {
            return `PODA_CARGA_KDE_ECO: load_probability=${loadProbability} < ${this._loadProbabilityThreshold} para W=${projectedUeaCount}`;
        }

        if (totalPenalty <= this._domainBlockThreshold) {
            return `PENALTY_TOTAL_FUERA_DOMINIO: total_penalty=${totalPenalty} <= ${this._domainBlockThreshold}`;
        }

        if (loadPenalty !== undefined && loadPenalty <= this._domainBlockThreshold) {
            return `PENALTY_LOAD_FUERA_DOMINIO: loads[${projectedUeaCount - 2}]=${loadPenalty} <= ${this._domainBlockThreshold}`;
        }

        return undefined;
    }

    private _contarUeasProyectadas(
        grafo: GrafoBipartito,
        numEco: number,
        idGrupoCandidato: number
    ): number {
        // La CARGA es el numero de asignaciones (grupos) del profesor, no de UEAs
        // distintas. Cada idGrupo equivale a una asignacion (clave_grupo, uea, horario),
        // por lo que se deduplica por id de grupo (NO por ueaClave). Esto concuerda con
        // el backend (projected_uea_count = numero de asignaciones) cuando este no lo
        // devuelve y se usa este fallback.
        const asignaciones = [...(grafo.adyacencias.get(numEco) || []), idGrupoCandidato];
        const grupos = new Set<number>(asignaciones);

        return grupos.size;
    }

    private _getBaselinePenalty(numEco: number, grafo: GrafoBipartito): number {
        if (!this._modeloPenalty) return 0;
        const asignaciones = grafo.adyacencias.get(numEco) || [];
        let suma = 0;
        for (const idG of asignaciones) {
            const g = grafo.grupos.get(idG);
            if (g) {
                suma += this._modeloPenalty.getPenaltyBase(numEco, g.horarioStringRaw) || 0;
            }
        }
        return asignaciones.length > 0 ? suma / asignaciones.length : 0;
    }

    private _crearPayloadProfesor(numEco: number, grafo: GrafoBipartito): PenaltyObservedPayload {
        const asignaciones = grafo.adyacencias.get(numEco) || [];
        return this._crearPayloadDesdeAsignaciones(numEco, grafo, asignaciones);
    }

    private _crearPayloadProfesorConCandidato(
        numEco: number,
        grafo: GrafoBipartito,
        idGrupoCandidato: number
    ): PenaltyObservedPayload {
        const asignaciones = [...(grafo.adyacencias.get(numEco) || []), idGrupoCandidato];
        return this._crearPayloadDesdeAsignaciones(numEco, grafo, asignaciones);
    }

    private _crearPayloadDesdeAsignaciones(
        numEco: number,
        grafo: GrafoBipartito,
        asignaciones: number[]
    ): PenaltyObservedPayload {
        const ueas: string[] = [];
        const horarios: string[] = [];

        for (const idG of asignaciones) {
            const g = grafo.grupos.get(idG);
            if (!g) {
                throw new Error(`No existe el grupo ${idG} al construir payload de penalty para eco ${numEco}.`);
            }

            ueas.push(g.ueaClave.toString());
            horarios.push(canonicalizeHorario(g.horarioStringRaw));
        }

        if (horarios.length === 0) {
            throw new Error(`No hay asignaciones activas para construir payload de penalty del eco ${numEco}.`);
        }

        return {
            eco: numEco.toString(),
            horario: horarios[horarios.length - 1],
            ueas_asignadas_actuales: ueas.slice(0, -1),
            horarios_asignados_actuales: horarios.slice(0, -1),
            uea_prediccion: ueas[ueas.length - 1],
        };
    }

    private async _actualizarPenaltyProfesor(numEco: number, grafo: GrafoBipartito, hash: string): Promise<void> {
        const payload = this._crearPayloadProfesor(numEco, grafo);

        try {
            const res = await axios.post<PenaltyFinetunedResponse>(
                `${this._pythonBaseUrl}/get_horario_penalty_finetuned`,
                payload
            );

            if (res.data) {
                this._memoPenalty.set(numEco, { hash, penalty: res.data.total_penalty });
            }
        } catch (e) {
            // Legacy sync path keeps previous silent-fail behavior.
        }
    }
}
