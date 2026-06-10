import { GrafoBipartito } from '../models/GrafoBipartito';
import {
    IPerfilCargaConsecutivaProvider,
    TAU_MAX_HORAS,
    normalizarTauHoras
} from '../ml/PerfilCargaConsecutiva';

interface FranjaDia {
    dia: number;
    horaInicio: number;
    horaFin: number;
}

function obtenerFranjasProfesor(
    grafo: GrafoBipartito,
    numeroEconomico: number,
    idGrupoExtra?: number
): FranjaDia[] {
    const idsGrupo = [...(grafo.adyacencias.get(numeroEconomico) || [])];
    if (idGrupoExtra !== undefined && !idsGrupo.includes(idGrupoExtra)) {
        idsGrupo.push(idGrupoExtra);
    }

    const franjas: FranjaDia[] = [];
    for (const idGrupo of idsGrupo) {
        const grupo = grafo.grupos.get(idGrupo);
        if (!grupo) continue;

        for (const horario of grupo.horarios) {
            franjas.push({
                dia: horario.dia,
                horaInicio: horario.horaInicio,
                horaFin: horario.horaFin
            });
        }
    }

    return franjas;
}

function agruparPorDia(franjas: FranjaDia[]): Map<number, FranjaDia[]> {
    const mapa = new Map<number, FranjaDia[]>();
    for (const franja of franjas) {
        if (!mapa.has(franja.dia)) {
            mapa.set(franja.dia, []);
        }
        mapa.get(franja.dia)!.push(franja);
    }

    for (const [, franjasDia] of mapa) {
        franjasDia.sort((a, b) => a.horaInicio - b.horaInicio);
    }

    return mapa;
}

export function calcularMaxHorasConsecutivasProfesor(
    grafo: GrafoBipartito,
    numeroEconomico: number,
    idGrupoExtra?: number
): number {
    const franjas = obtenerFranjasProfesor(grafo, numeroEconomico, idGrupoExtra);
    if (franjas.length === 0) return 0;

    let maxHoras = 0;
    const porDia = agruparPorDia(franjas);

    for (const [, franjasDia] of porDia) {
        if (franjasDia.length === 0) continue;

        let inicioBloque = franjasDia[0].horaInicio;
        let finBloque = franjasDia[0].horaFin;

        for (let i = 1; i < franjasDia.length; i++) {
            const franja = franjasDia[i];
            if (franja.horaInicio <= finBloque) {
                finBloque = Math.max(finBloque, franja.horaFin);
                continue;
            }

            maxHoras = Math.max(maxHoras, finBloque - inicioBloque);
            inicioBloque = franja.horaInicio;
            finBloque = franja.horaFin;
        }

        maxHoras = Math.max(maxHoras, finBloque - inicioBloque);
    }

    return maxHoras;
}

export function calcularPenalizacionCargaConsecutivaDesdeHoras(
    horasConsecutivas: number,
    tauHoras: number
): number {
    const tau = normalizarTauHoras(tauHoras);
    if (tau >= TAU_MAX_HORAS) return 0;

    const denominador = TAU_MAX_HORAS - tau;
    if (denominador <= 0) return 0;

    const penalizacion = (horasConsecutivas - tau) / denominador;
    if (!Number.isFinite(penalizacion)) return 0;
    return Math.max(0, Math.min(1, penalizacion));
}

export function calcularPenalizacionCargaConsecutivaCandidato(
    grafo: GrafoBipartito,
    numeroEconomico: number,
    idGrupo: number,
    provider: IPerfilCargaConsecutivaProvider
): number {
    const horasConsecutivas = calcularMaxHorasConsecutivasProfesor(grafo, numeroEconomico, idGrupo);
    return calcularPenalizacionCargaConsecutivaDesdeHoras(
        horasConsecutivas,
        provider.getTauHoras(numeroEconomico)
    );
}

export function calcularPromedioPenalizacionCargaConsecutivaGrafo(
    grafo: GrafoBipartito,
    provider: IPerfilCargaConsecutivaProvider
): number {
    let total = 0;
    let profesoresActivos = 0;

    for (const [numeroEconomico, gruposAsignados] of grafo.adyacencias) {
        if (gruposAsignados.length === 0) continue;

        profesoresActivos++;
        const horasConsecutivas = calcularMaxHorasConsecutivasProfesor(grafo, numeroEconomico);
        total += calcularPenalizacionCargaConsecutivaDesdeHoras(
            horasConsecutivas,
            provider.getTauHoras(numeroEconomico)
        );
    }

    return profesoresActivos > 0 ? total / profesoresActivos : 0;
}
