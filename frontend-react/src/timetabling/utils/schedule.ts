import type { FranjaHorariaDTO, HorarioDB_DTO } from '../dtos';

const DAY_INDEX: Record<string, number> = {
    L: 1,
    M: 2,
    Mi: 3,
    J: 4,
    V: 5,
};

const DAY_LABEL: Record<number, string> = {
    1: 'L',
    2: 'M',
    3: 'Mi',
    4: 'J',
    5: 'V',
};

export function parseHourToDecimal(value: string): number {
    const [hourRaw, minuteRaw = '0'] = value.trim().split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
        throw new Error(`Hora invalida: ${value}`);
    }

    return hour + minute / 60;
}

export function ensureTimeWithSeconds(value: string): string {
    const trimmed = value.trim();
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
        return trimmed;
    }
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        return `${trimmed}:00`;
    }
    throw new Error(`Hora invalida: ${value}`);
}

export function decimalToTime(value: number): string {
    const hour = Math.floor(value);
    const minutes = Math.round((value - hour) * 60);
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseHorarioString(horario: string | null | undefined): FranjaHorariaDTO[] {
    if (!horario) {
        return [];
    }

    return horario
        .split('|')
        .map((fragment) => fragment.trim())
        .filter(Boolean)
        .map((fragment) => {
            const firstColon = fragment.indexOf(':');
            if (firstColon === -1) {
                throw new Error(`Fragmento de horario invalido: ${fragment}`);
            }

            const dayRaw = fragment.slice(0, firstColon);
            const rangeRaw = fragment.slice(firstColon + 1);
            const [startRaw, endRaw] = rangeRaw.split('-');
            const dia = DAY_INDEX[dayRaw];

            if (!dia || !startRaw || !endRaw) {
                throw new Error(`Fragmento de horario invalido: ${fragment}`);
            }

            return {
                dia,
                horaInicio: parseHourToDecimal(startRaw),
                horaFin: parseHourToDecimal(endRaw),
            };
        });
}

export function formatFranjas(franjas: FranjaHorariaDTO[]): string {
    if (franjas.length === 0) {
        return 'Sin horario';
    }

    return franjas
        .map((franja) => {
            const day = DAY_LABEL[franja.dia] ?? String(franja.dia);
            return `${day} ${decimalToTime(franja.horaInicio)}-${decimalToTime(franja.horaFin)}`;
        })
        .join(' | ');
}

export function buildHorarioDbFromRange(range: string, idDiasDeTrabajo = 'L-V'): HorarioDB_DTO {
    const [startRaw, endRaw] = range.split('-');
    if (!startRaw || !endRaw) {
        throw new Error(`Rango de horario invalido: ${range}`);
    }

    return {
        idDiasDeTrabajo,
        horaInicio: ensureTimeWithSeconds(startRaw),
        horaFin: ensureTimeWithSeconds(endRaw),
    };
}

export function buildFlexibleHorarioDb(marker: string): HorarioDB_DTO {
    return {
        idDiasDeTrabajo: marker === '**' ? 'FLEX_TOTAL' : 'FLEX_PARCIAL',
        horaInicio: '00:00:00',
        horaFin: '23:59:00',
    };
}
