import { createHash } from 'crypto';
import type { PenaltyObservedPayload } from './PenaltyObservedCache';

const DAY_ORDER = ['L', 'M', 'Mi', 'J', 'V'] as const;
const DAY_RANK = new Map<string, number>(DAY_ORDER.map((day, index) => [day, index]));
const SIMPLE_RANGE_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?-(\d{1,2}):(\d{2})(?::\d{2})?$/;
const SECTION_RE = /^(L|M|Mi|J|V):(\d{1,2}):(\d{2})(?::\d{2})?-(\d{1,2}):(\d{2})(?::\d{2})?$/;

export function canonicalizeTime(hourRaw: string, minuteRaw: string): string {
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new Error(`Hora invalida: ${hourRaw}:${minuteRaw}`);
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
        throw new Error(`Minuto invalido: ${hourRaw}:${minuteRaw}`);
    }
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function canonicalizeHorario(horario: string): string {
    const text = horario.trim();
    if (!text) {
        throw new Error('horario no puede estar vacio.');
    }

    const simple = SIMPLE_RANGE_RE.exec(text);
    if (simple) {
        const start = canonicalizeTime(simple[1], simple[2]);
        const end = canonicalizeTime(simple[3], simple[4]);
        const range = `${start}-${end}`;
        return `L:${range}|Mi:${range}|V:${range}`;
    }

    const sections = text.split('|').map(part => part.trim()).filter(Boolean);
    if (sections.length === 0) {
        throw new Error(`horario invalido: ${horario}`);
    }

    const parsed = sections.map(section => {
        const match = SECTION_RE.exec(section);
        if (!match) {
            throw new Error(`horario invalido: ${horario}`);
        }
        const day = match[1];
        const start = canonicalizeTime(match[2], match[3]);
        const end = canonicalizeTime(match[4], match[5]);
        return {
            day,
            start,
            end,
            rank: DAY_RANK.get(day) ?? 999,
        };
    });

    parsed.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.start !== b.start) return a.start.localeCompare(b.start);
        return a.end.localeCompare(b.end);
    });

    return parsed.map(part => `${part.day}:${part.start}-${part.end}`).join('|');
}

export function sijhKey(eco: string | number, uea: string | number, horario: string): string {
    return `Sijh:v2:${eco}:${uea}:${canonicalizeHorario(horario)}`;
}

export function kdeKey(eco: string | number, horario: string): string {
    return `KDE:v2:${eco}:${canonicalizeHorario(horario)}`;
}

export function canonicalizePenaltyPayload(payload: PenaltyObservedPayload): PenaltyObservedPayload {
    return {
        eco: String(payload.eco).trim(),
        horario: canonicalizeHorario(payload.horario),
        ueas_asignadas_actuales: payload.ueas_asignadas_actuales.map(value => String(value).trim()),
        horarios_asignados_actuales: payload.horarios_asignados_actuales.map(canonicalizeHorario),
        uea_prediccion: String(payload.uea_prediccion).trim(),
        ...(payload.session_id ? { session_id: payload.session_id } : {}),
    };
}

export function serializePenaltyPayload(payload: PenaltyObservedPayload): string {
    const canonical = canonicalizePenaltyPayload(payload);
    return JSON.stringify({
        eco: canonical.eco,
        horario: canonical.horario,
        ueas_asignadas_actuales: canonical.ueas_asignadas_actuales,
        horarios_asignados_actuales: canonical.horarios_asignados_actuales,
        uea_prediccion: canonical.uea_prediccion,
    });
}

// v3: el modelo de penalizacion fue reentrenado (carga = UEAs TOTALES). El bump de
// namespace orfana las entradas v2 cacheadas en Redis y fuerza recomputo fresco.
export function penaltyObservedKey(payload: PenaltyObservedPayload): string {
    return `PenaltyObserved:v3:${createHash('sha1').update(serializePenaltyPayload(payload)).digest('hex')}`;
}
