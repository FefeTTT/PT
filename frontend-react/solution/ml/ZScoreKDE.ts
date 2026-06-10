import { GrafoBipartito } from '../models/GrafoBipartito';
import { SemanaLaboral } from '../models/SemanaLaboral';
import { FranjaHorariaDTO, GrupoDTO, ProfesorDTO } from '../types/AssignmentTypes';
import { ZScoreDetails, ZScoreFunction } from './IModeloML';

const DAY_COLUMNS = [
    { dia: 1, start: 'lunes_i', end: 'lunes_f' },
    { dia: 2, start: 'martes_i', end: 'martes_f' },
    { dia: 3, start: 'miercoles_i', end: 'miercoles_f' },
    { dia: 4, start: 'jueves_i', end: 'jueves_f' },
    { dia: 5, start: 'viernes_i', end: 'viernes_f' }
] as const;

export type ZScoreKDEMode = 'legacy' | 'kde_ij';

export interface LegacySijhProvider {
    getScoreDetails(profesorId: number, grupoId: number): { score: number; h_ih: number; rhat: number };
}

export interface ZScoreKDEOptions {
    mode?: ZScoreKDEMode;
    steepPower?: number;
    halfLife?: number;
    bandwidthUea?: number;
    bandwidthDay?: number;
    bandwidthHour?: number;
    bandwidthDuration?: number;
    bandwidthPlanUeaCount?: number;
    bandwidthPlanTurno?: number;
    weightKdeIj?: number;
    weightKdeIh?: number;
    weightKdePlan?: number;
    minKdePlan?: number;
    minKdeIj?: number;
    minKdeIh?: number;
    minScore?: number;
}

export interface ZScoreKDEFactoryInput {
    profesores: ProfesorDTO[];
    grupos: GrupoDTO[];
    dfHist: unknown[];
    legacyProvider?: LegacySijhProvider;
    options?: ZScoreKDEOptions;
}

export interface ZScoreKDEFactory {
    funcionZ: ZScoreFunction;
    evaluarGrupo: (eco: number, grupo: GrupoDTO, grafo?: GrafoBipartito) => ZScoreDetails;
    obtenerUeasHistoricas: (eco: number) => number[];
    generarSuperficieEco: (eco: number, ueas: number[], horas: number[], patron?: number[]) => KdeSurfacePoint[];
}

export interface KdeSurfacePoint {
    eco: number;
    uea: number;
    hora: number;
    kde_ij: number;
    kde_ih: number;
    kde_plan?: number;
    score: number;
    dayCoverage: number;
    patternSimilarity?: number;
}

interface HistSlot {
    dia: number;
    start: number;
    end: number;
    center: number;
    duration: number;
}

interface HistObservation {
    eco: number;
    uea: number;
    area: string;
    triNum: number;
    weight: number;
    slots: HistSlot[];
}

type Turno = 'manana' | 'medioDia' | 'tarde';

interface HistPlan {
    eco: number;
    triNum: number;
    weight: number;
    ueaCount: number;
    turnos: Record<Turno, number>;
    patrones: string[];
}

interface KdeEval {
    kdeIj: number;
    kdeIh: number;
    kdeIhRaw: number;
    kdePlan: number;
    zBase: number;
    projectedPlanCount: number;
    dayCoverage: number;
    patternSimilarity: number;
    hourCoverage: number;
    contractCoverage: number;
}

const DEFAULT_OPTIONS: Required<ZScoreKDEOptions> = {
    mode: 'kde_ij',
    steepPower: 2,
    halfLife: 8,
    bandwidthUea: 8,
    bandwidthDay: 0.35,
    bandwidthHour: 1.25,
    bandwidthDuration: 1.5,
    bandwidthPlanUeaCount: 1.0,
    bandwidthPlanTurno: 0.75,
    weightKdeIj: 0.35,
    weightKdeIh: 0.35,
    weightKdePlan: 0.30,
    minKdePlan: 0,
    minKdeIj: 0.02,
    minKdeIh: 0.02,
    minScore: 0.001
};

export function crearZScoreKDE(input: ZScoreKDEFactoryInput): ZScoreKDEFactory {
    const options = { ...DEFAULT_OPTIONS, ...(input.options ?? {}) };
    const gruposPorId = new Map(input.grupos.map(grupo => [grupo.idUeaGrupo, grupo]));
    const profesoresPorEco = new Map(input.profesores.map(profesor => [profesor.numeroEconomico, profesor]));
    const observaciones = prepararObservaciones(input.dfHist, options.halfLife);
    const obsPorEco = agruparPorEco(observaciones);
    const obsPorEcoArea = agruparPorEcoArea(observaciones);
    const planesPorEco = agruparPlanesPorEco(prepararPlanesHistoricos(observaciones));

    const evaluarGrupo = (eco: number, grupo: GrupoDTO, _grafo?: GrafoBipartito): ZScoreDetails => {
        const legacy = input.legacyProvider?.getScoreDetails(eco, grupo.idUeaGrupo) ?? {
            score: 0,
            h_ih: 0,
            rhat: 0
        };

        if (options.mode === 'legacy') {
            return {
                score: legacy.rhat,
                h_ih: legacy.h_ih,
                rhat: legacy.rhat,
                source: 'legacy'
            };
        }

        const kde = evaluarKde(eco, grupo, _grafo, profesoresPorEco.get(eco), obsPorEco, obsPorEcoArea, planesPorEco, options);
        const score = kde.zBase;
        const bloqueo = explicarBloqueoKde(score, kde, options);

        return {
            score,
            h_ih: kde.kdeIh,
            rhat: legacy.rhat,
            kde_ij: kde.kdeIj,
            kde_ih: kde.kdeIh,
            kde_ih_raw: kde.kdeIhRaw,
            kde_plan: kde.kdePlan,
            zBase: kde.zBase,
            projectedPlanCount: kde.projectedPlanCount,
            dayCoverage: kde.dayCoverage,
            patternSimilarity: kde.patternSimilarity,
            hourCoverage: kde.hourCoverage,
            contractCoverage: kde.contractCoverage,
            source: 'kde_ij',
            domainBlocked: bloqueo !== undefined,
            blockReason: bloqueo
        };
    };

    const funcionZ: ZScoreFunction = (eco: number, idUeaGrupo: number, grafo?: GrafoBipartito) => {
        const grupo = gruposPorId.get(idUeaGrupo);
        if (!grupo) {
            return {
                score: 0,
                h_ih: 0,
                rhat: 0,
                source: options.mode,
                domainBlocked: true,
                blockReason: `GRUPO_DESCONOCIDO: idUeaGrupo=${idUeaGrupo}`
            };
        }

        return evaluarGrupo(eco, grupo, grafo);
    };

    return {
        funcionZ,
        evaluarGrupo,
        obtenerUeasHistoricas: (eco: number) => {
            const rows = obsPorEco.get(eco) ?? [];
            return [...new Set(rows.map(row => row.uea))].sort((a, b) => a - b);
        },
        generarSuperficieEco: (eco: number, ueas: number[], horas: number[], patron: number[] = [1, 3, 5]) => {
            const puntos: KdeSurfacePoint[] = [];
            for (const uea of ueas) {
                for (const hora of horas) {
                    const grupo = crearGrupoSintetico(uea, hora, patron);
                    const detalles = evaluarGrupo(eco, grupo);
                    puntos.push({
                        eco,
                        uea,
                        hora,
                        kde_ij: detalles.kde_ij ?? 0,
                        kde_ih: detalles.kde_ih ?? detalles.h_ih,
                        kde_plan: detalles.kde_plan ?? 0,
                        score: detalles.score,
                        dayCoverage: detalles.dayCoverage ?? 0,
                        patternSimilarity: detalles.patternSimilarity ?? detalles.dayCoverage ?? 0
                    });
                }
            }
            return puntos;
        }
    };
}

function prepararObservaciones(dfHist: unknown[], halfLife: number): HistObservation[] {
    const rows = dfHist as Array<Record<string, unknown>>;
    const maxTri = rows.reduce((max, row) => Math.max(max, Number(row.tri_num) || 0), 0);
    const observaciones: HistObservation[] = [];

    for (const row of rows) {
        const eco = Number(row.eco);
        const uea = Number(row.uea);
        const triNum = Number(row.tri_num) || maxTri;
        if (!Number.isFinite(eco) || !Number.isFinite(uea)) continue;

        const slots = extraerSlots(row);
        if (slots.length === 0) continue;

        const age = Math.max(0, maxTri - triNum);
        observaciones.push({
            eco,
            uea,
            area: String(uea).slice(0, 4),
            triNum,
            weight: Math.pow(0.5, age / halfLife),
            slots
        });
    }

    return observaciones;
}

function extraerSlots(row: Record<string, unknown>): HistSlot[] {
    const slots: HistSlot[] = [];

    for (const col of DAY_COLUMNS) {
        const start = parseHora(row[col.start]);
        const end = parseHora(row[col.end]);
        if (start === null || end === null || end <= start) continue;

        slots.push({
            dia: col.dia,
            start,
            end,
            center: (start + end) / 2,
            duration: end - start
        });
    }

    return slots;
}

function agruparPorEco(observaciones: HistObservation[]): Map<number, HistObservation[]> {
    const mapa = new Map<number, HistObservation[]>();
    for (const obs of observaciones) {
        if (!mapa.has(obs.eco)) mapa.set(obs.eco, []);
        mapa.get(obs.eco)!.push(obs);
    }
    return mapa;
}

function agruparPorEcoArea(observaciones: HistObservation[]): Map<string, HistObservation[]> {
    const mapa = new Map<string, HistObservation[]>();
    for (const obs of observaciones) {
        const key = `${obs.eco}:${obs.area}`;
        if (!mapa.has(key)) mapa.set(key, []);
        mapa.get(key)!.push(obs);
    }
    return mapa;
}

function prepararPlanesHistoricos(observaciones: HistObservation[]): HistPlan[] {
    const porEcoTri = new Map<string, HistObservation[]>();

    for (const obs of observaciones) {
        const key = `${obs.eco}:${obs.triNum}`;
        if (!porEcoTri.has(key)) porEcoTri.set(key, []);
        porEcoTri.get(key)!.push(obs);
    }

    const planes: HistPlan[] = [];
    for (const rows of porEcoTri.values()) {
        const first = rows[0];
        const turnos = crearContadorTurnos();
        const patrones = new Set<string>();
        let weight = 0;

        for (const row of rows) {
            turnos[turnoDeSlots(row.slots)]++;
            patrones.add(patronDiasSlots(row.slots));
            weight += row.weight;
        }

        planes.push({
            eco: first.eco,
            triNum: first.triNum,
            weight: weight / rows.length,
            ueaCount: rows.length,
            turnos,
            patrones: [...patrones]
        });
    }

    return planes;
}

function agruparPlanesPorEco(planes: HistPlan[]): Map<number, HistPlan[]> {
    const mapa = new Map<number, HistPlan[]>();
    for (const plan of planes) {
        if (!mapa.has(plan.eco)) mapa.set(plan.eco, []);
        mapa.get(plan.eco)!.push(plan);
    }
    return mapa;
}

function evaluarKde(
    eco: number,
    grupo: GrupoDTO,
    grafo: GrafoBipartito | undefined,
    profesor: ProfesorDTO | undefined,
    obsPorEco: Map<number, HistObservation[]>,
    obsPorEcoArea: Map<string, HistObservation[]>,
    planesPorEco: Map<number, HistPlan[]>,
    options: Required<ZScoreKDEOptions>
): KdeEval {
    const contract = coberturaContrato(profesor, grupo);
    const kdeIj = calcularKdeIj(eco, grupo.ueaClave, obsPorEcoArea, options);
    const semanal = calcularKdeIhSemanal(eco, grupo.horarios, obsPorEco, options);
    const plan = calcularKdePlan(eco, grupo, grafo, planesPorEco, options);
    const zBase = promedioPonderadoKde(kdeIj, semanal.kdeIh, plan.kdePlan, options);

    return {
        kdeIj,
        kdeIh: semanal.kdeIh,
        kdeIhRaw: semanal.kdeIh,
        kdePlan: plan.kdePlan,
        zBase,
        projectedPlanCount: plan.projectedPlanCount,
        dayCoverage: semanal.dayCoverage,
        patternSimilarity: semanal.patternSimilarity,
        hourCoverage: semanal.hourCoverage,
        contractCoverage: contract
    };
}

function calcularKdeIj(
    eco: number,
    uea: number,
    obsPorEcoArea: Map<string, HistObservation[]>,
    options: Required<ZScoreKDEOptions>
): number {
    const area = String(uea).slice(0, 4);
    const observaciones = obsPorEcoArea.get(`${eco}:${area}`) ?? [];
    if (observaciones.length === 0) return 0;

    let numerador = 0;
    let denominador = 0;
    for (const obs of observaciones) {
        const distance = Math.abs(obs.uea - uea) / options.bandwidthUea;
        const kernel = Math.exp(-0.5 * Math.pow(distance, options.steepPower));
        numerador += obs.weight * kernel;
        denominador += obs.weight;
    }

    return denominador > 0 ? redondear(numerador / denominador) : 0;
}

function calcularKdeIhSemanal(
    eco: number,
    horarios: FranjaHorariaDTO[],
    obsPorEco: Map<number, HistObservation[]>,
    options: Required<ZScoreKDEOptions>
): { kdeIh: number; dayCoverage: number; patternSimilarity: number; hourCoverage: number } {
    const observaciones = obsPorEco.get(eco) ?? [];
    if (observaciones.length === 0 || horarios.length === 0) {
        return { kdeIh: 0, dayCoverage: 0, patternSimilarity: 0, hourCoverage: 0 };
    }

    let numerador = 0;
    let denominador = 0;
    let bestCoverage = 0;
    let bestPatternSimilarity = 0;
    let bestHourKernel = 0;

    for (const obs of observaciones) {
        const evaluacion = kernelSemanal(horarios, obs.slots, options);
        numerador += obs.weight * evaluacion.kernel;
        denominador += obs.weight;
        bestCoverage = Math.max(bestCoverage, evaluacion.dayCoverage);
        bestPatternSimilarity = Math.max(bestPatternSimilarity, evaluacion.patternSimilarity);
        bestHourKernel = Math.max(bestHourKernel, evaluacion.hourKernel);
    }

    return {
        kdeIh: denominador > 0 ? redondear(numerador / denominador) : 0,
        dayCoverage: redondear(bestCoverage),
        patternSimilarity: redondear(bestPatternSimilarity),
        hourCoverage: redondear(bestHourKernel)
    };
}

function calcularKdePlan(
    eco: number,
    grupo: GrupoDTO,
    grafo: GrafoBipartito | undefined,
    planesPorEco: Map<number, HistPlan[]>,
    options: Required<ZScoreKDEOptions>
): { kdePlan: number; projectedPlanCount: number } {
    const historicos = planesPorEco.get(eco) ?? [];
    const proyectado = crearPlanProyectado(eco, grupo, grafo);
    if (historicos.length === 0 || proyectado.ueaCount === 0) {
        return { kdePlan: 0, projectedPlanCount: proyectado.ueaCount };
    }

    let numerador = 0;
    let denominador = 0;

    for (const plan of historicos) {
        const countDistance = Math.abs(proyectado.ueaCount - plan.ueaCount) / options.bandwidthPlanUeaCount;
        const countKernel = Math.exp(-0.5 * Math.pow(countDistance, 2));
        const turnoDistance = distanciaTurnos(proyectado.turnos, plan.turnos) / options.bandwidthPlanTurno;
        const turnoKernel = Math.exp(-0.5 * Math.pow(turnoDistance, 2));
        const patternKernel = similitudPatronesPlan(proyectado.patrones, plan.patrones);
        const kernel = countKernel * turnoKernel * patternKernel;

        numerador += plan.weight * kernel;
        denominador += plan.weight;
    }

    return {
        kdePlan: denominador > 0 ? redondear(numerador / denominador) : 0,
        projectedPlanCount: proyectado.ueaCount
    };
}

function crearPlanProyectado(eco: number, grupo: GrupoDTO, grafo: GrafoBipartito | undefined): HistPlan {
    const grupos = new Map<number, GrupoDTO>();
    if (grafo) {
        const asignados = grafo.adyacencias.get(eco) ?? [];
        for (const idGrupo of asignados) {
            const grupoAsignado = grafo.grupos.get(idGrupo);
            if (grupoAsignado) grupos.set(grupoAsignado.idUeaGrupo, grupoAsignado);
        }
    }
    grupos.set(grupo.idUeaGrupo, grupo);

    const turnos = crearContadorTurnos();
    const patrones = new Set<string>();

    for (const item of grupos.values()) {
        turnos[turnoDeHorarios(item.horarios)]++;
        patrones.add(patronDiasHorarios(item.horarios));
    }

    return {
        eco,
        triNum: 0,
        weight: 1,
        ueaCount: grupos.size,
        turnos,
        patrones: [...patrones]
    };
}

function promedioPonderadoKde(
    kdeIj: number,
    kdeIh: number,
    kdePlan: number,
    options: Required<ZScoreKDEOptions>
): number {
    const total = options.weightKdeIj + options.weightKdeIh + options.weightKdePlan;
    if (total <= 0) return 0;
    return redondear(
        ((options.weightKdeIj * kdeIj) +
            (options.weightKdeIh * kdeIh) +
            (options.weightKdePlan * kdePlan)) / total
    );
}

function kernelSemanal(
    horarios: FranjaHorariaDTO[],
    slotsHistoricos: HistSlot[],
    options: Required<ZScoreKDEOptions>
): { kernel: number; dayCoverage: number; patternSimilarity: number; hourKernel: number } {
    const diasCandidato = new Set(horarios.map(franja => franja.dia));
    const diasHistoricos = new Set(slotsHistoricos.map(slot => slot.dia));
    const unionDias = unionSize(diasCandidato, diasHistoricos);
    const interseccionDias = intersectionSize(diasCandidato, diasHistoricos);

    if (unionDias === 0 || interseccionDias === 0) {
        return { kernel: 0, dayCoverage: 0, patternSimilarity: 0, hourKernel: 0 };
    }

    const patternSimilarity = interseccionDias / unionDias;
    const dayDistance = symmetricDifferenceSize(diasCandidato, diasHistoricos) / options.bandwidthDay;
    const dayKernel = Math.exp(-0.5 * Math.pow(dayDistance, options.steepPower));

    let productoHoras = 1;
    let diasConHoraCompatible = 0;

    for (const franja of horarios) {
        const compatibles = slotsHistoricos.filter(slot => slot.dia === franja.dia);
        if (compatibles.length === 0) {
            continue;
        }

        const center = (franja.horaInicio + franja.horaFin) / 2;
        const duration = franja.horaFin - franja.horaInicio;
        let mejor = 0;

        for (const slot of compatibles) {
            const hourDistance = Math.abs(slot.center - center) / options.bandwidthHour;
            const durationDistance = Math.abs(slot.duration - duration) / options.bandwidthDuration;
            const hourKernel = Math.exp(-0.5 * Math.pow(hourDistance, options.steepPower));
            const durationKernel = Math.exp(-0.5 * Math.pow(durationDistance, 2));
            mejor = Math.max(mejor, hourKernel * durationKernel);
        }

        if (mejor > 0) {
            productoHoras *= mejor;
            diasConHoraCompatible++;
        }
    }

    if (diasConHoraCompatible === 0) {
        return { kernel: 0, dayCoverage: patternSimilarity, patternSimilarity, hourKernel: 0 };
    }

    const hourKernel = Math.pow(productoHoras, 1 / diasConHoraCompatible);

    return {
        kernel: dayKernel * hourKernel,
        dayCoverage: patternSimilarity,
        patternSimilarity,
        hourKernel
    };
}

function unionSize(a: Set<number>, b: Set<number>): number {
    return new Set([...a, ...b]).size;
}

function intersectionSize(a: Set<number>, b: Set<number>): number {
    let count = 0;
    for (const value of a) {
        if (b.has(value)) count++;
    }
    return count;
}

function symmetricDifferenceSize(a: Set<number>, b: Set<number>): number {
    let count = 0;
    for (const value of a) {
        if (!b.has(value)) count++;
    }
    for (const value of b) {
        if (!a.has(value)) count++;
    }
    return count;
}

function crearContadorTurnos(): Record<Turno, number> {
    return { manana: 0, medioDia: 0, tarde: 0 };
}

function turnoDeSlots(slots: HistSlot[]): Turno {
    if (slots.length === 0) return 'manana';
    return turnoDesdeHora(Math.min(...slots.map(slot => slot.start)));
}

function turnoDeHorarios(horarios: FranjaHorariaDTO[]): Turno {
    if (horarios.length === 0) return 'manana';
    return turnoDesdeHora(Math.min(...horarios.map(horario => horario.horaInicio)));
}

function turnoDesdeHora(hora: number): Turno {
    if (hora < 12) return 'manana';
    if (hora < 16) return 'medioDia';
    return 'tarde';
}

function patronDiasSlots(slots: HistSlot[]): string {
    return [...new Set(slots.map(slot => slot.dia))].sort((a, b) => a - b).join('-');
}

function patronDiasHorarios(horarios: FranjaHorariaDTO[]): string {
    return [...new Set(horarios.map(horario => horario.dia))].sort((a, b) => a - b).join('-');
}

function distanciaTurnos(a: Record<Turno, number>, b: Record<Turno, number>): number {
    const totalA = totalTurnos(a);
    const totalB = totalTurnos(b);
    if (totalA <= 0 || totalB <= 0) return 1;
    const keys: Turno[] = ['manana', 'medioDia', 'tarde'];
    const suma = keys.reduce((acc, key) => {
        const diff = (a[key] / totalA) - (b[key] / totalB);
        return acc + (diff * diff);
    }, 0);
    return Math.sqrt(suma);
}

function totalTurnos(turnos: Record<Turno, number>): number {
    return turnos.manana + turnos.medioDia + turnos.tarde;
}

function similitudPatronesPlan(patronesCandidato: string[], patronesHistoricos: string[]): number {
    if (patronesCandidato.length === 0 || patronesHistoricos.length === 0) return 0;

    let suma = 0;
    for (const patron of patronesCandidato) {
        let mejor = 0;
        for (const historico of patronesHistoricos) {
            mejor = Math.max(mejor, similitudPatron(patron, historico));
        }
        suma += mejor;
    }

    return suma / patronesCandidato.length;
}

function similitudPatron(a: string, b: string): number {
    const setA = new Set(a.split('-').filter(Boolean).map(Number));
    const setB = new Set(b.split('-').filter(Boolean).map(Number));
    const union = unionSize(setA, setB);
    return union > 0 ? intersectionSize(setA, setB) / union : 0;
}

function coberturaContrato(profesor: ProfesorDTO | undefined, grupo: GrupoDTO): number {
    if (!profesor) return 0;
    const semana = new SemanaLaboral(profesor.horariosContratacion);
    let cubiertos = 0;

    for (const franja of grupo.horarios) {
        if (semana.intentarAsignarFranja(franja).asignable) {
            cubiertos++;
        }
    }

    return grupo.horarios.length > 0 ? cubiertos / grupo.horarios.length : 0;
}

function explicarBloqueoKde(
    score: number,
    kde: KdeEval,
    options: Required<ZScoreKDEOptions>
): string | undefined {
    if (kde.kdeIj < options.minKdeIj) {
        return `KDE_IJ_FUERA_DOMINIO: kde_ij=${kde.kdeIj} < ${options.minKdeIj}`;
    }

    if (kde.kdeIhRaw < options.minKdeIh) {
        return `KDE_IH_PATRON_FUERA_DOMINIO: kde_ih_raw=${kde.kdeIhRaw} < ${options.minKdeIh}; patternSimilarity=${kde.patternSimilarity}`;
    }

    if (
        options.minKdePlan > 0
        && kde.projectedPlanCount > 1
        && kde.kdePlan < options.minKdePlan
    ) {
        return `KDE_PLAN_FUERA_DOMINIO: kde_plan=${kde.kdePlan} < ${options.minKdePlan}; projectedPlanCount=${kde.projectedPlanCount}`;
    }

    if (score < options.minScore) {
        return `Z_KDE_FUERA_DOMINIO: zBase=${score} < ${options.minScore}`;
    }

    return undefined;
}

function crearGrupoSintetico(uea: number, horaInicio: number, dias: number[]): GrupoDTO {
    const horarios = dias.map(dia => ({
        dia,
        horaInicio,
        horaFin: horaInicio + 1.5
    }));

    return {
        idUeaGrupo: -1,
        idGrupo: -1,
        claveGrupo: 'KDE_SURFACE',
        idArea: String(uea).slice(0, 4),
        ueaClave: uea,
        horarios,
        horarioStringRaw: ''
    };
}

function parseHora(value: unknown): number | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;

    const [hRaw, mRaw] = text.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h + (m / 60);
}

function redondear(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1e8) / 1e8;
}
