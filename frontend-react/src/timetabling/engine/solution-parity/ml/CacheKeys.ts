import type { PenaltyObservedPayload } from './PenaltyObservedCache';

const DAY_ORDER = ['L', 'M', 'Mi', 'J', 'V'] as const;
const DAY_RANK = new Map<string, number>(DAY_ORDER.map((day, index) => [day, index]));
const WEEKLY_SEGMENT_RE = /^(L|M|Mi|J|V):(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
const SIMPLE_RANGE_RE = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function canonicalizeTime(hourRaw: string, minuteRaw: string): string {
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (
        !Number.isInteger(hour) ||
        !Number.isInteger(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        throw new Error(`Horario invalido: ${hourRaw}:${minuteRaw}`);
    }

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function canonicalizeHorario(horario: string): string {
    const trimmed = String(horario ?? '').trim();
    if (!trimmed) throw new Error('Horario vacio');

    const simple = trimmed.match(SIMPLE_RANGE_RE);
    if (simple) {
        const range = `${canonicalizeTime(simple[1], simple[2])}-${canonicalizeTime(simple[3], simple[4])}`;
        return `L:${range}|Mi:${range}|V:${range}`;
    }

    const seen = new Set<string>();
    const segments = trimmed
        .split('|')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
            const match = part.match(WEEKLY_SEGMENT_RE);
            if (!match) throw new Error(`Formato de horario invalido: ${part}`);

            const day = match[1];
            if (seen.has(day)) throw new Error(`Dia duplicado en horario: ${day}`);
            seen.add(day);

            return {
                day,
                value: `${day}:${canonicalizeTime(match[2], match[3])}-${canonicalizeTime(match[4], match[5])}`,
            };
        });

    if (segments.length === 0) throw new Error('Horario sin segmentos validos');

    return segments
        .sort((a, b) => (DAY_RANK.get(a.day) ?? 99) - (DAY_RANK.get(b.day) ?? 99))
        .map(segment => segment.value)
        .join('|');
}

export function sijhKey(eco: number | string, uea: number | string, horario: string): string {
    return `Sijh:v2:${eco}:${uea}:${canonicalizeHorario(horario)}`;
}

export function kdeKey(eco: number | string, horario: string): string {
    return `KDE:v2:${eco}:${canonicalizeHorario(horario)}`;
}

export function canonicalizePenaltyPayload(payload: PenaltyObservedPayload): PenaltyObservedPayload {
    return {
        eco: String(payload.eco).trim(),
        horario: canonicalizeHorario(payload.horario),
        ueas_asignadas_actuales: [...(payload.ueas_asignadas_actuales ?? [])].map(String),
        horarios_asignados_actuales: [...(payload.horarios_asignados_actuales ?? [])].map(canonicalizeHorario),
        uea_prediccion: String(payload.uea_prediccion).trim(),
        session_id: payload.session_id,
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
    return `PenaltyObserved:v3:${sha1Hex(serializePenaltyPayload(payload))}`;
}

function sha1Hex(input: string): string {
    const bytes = utf8Bytes(input);
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);

    for (let shift = 56; shift >= 0; shift -= 8) {
        bytes.push((bitLength / (2 ** shift)) & 0xff);
    }

    let h0 = 0x67452301;
    let h1 = 0xefcdab89;
    let h2 = 0x98badcfe;
    let h3 = 0x10325476;
    let h4 = 0xc3d2e1f0;

    for (let i = 0; i < bytes.length; i += 64) {
        const words = new Array<number>(80);
        for (let j = 0; j < 16; j++) {
            const offset = i + j * 4;
            words[j] = (
                (bytes[offset] << 24) |
                (bytes[offset + 1] << 16) |
                (bytes[offset + 2] << 8) |
                bytes[offset + 3]
            ) >>> 0;
        }

        for (let j = 16; j < 80; j++) {
            words[j] = leftRotate(words[j - 3] ^ words[j - 8] ^ words[j - 14] ^ words[j - 16], 1);
        }

        let a = h0;
        let b = h1;
        let c = h2;
        let d = h3;
        let e = h4;

        for (let j = 0; j < 80; j++) {
            let f: number;
            let k: number;
            if (j < 20) {
                f = (b & c) | ((~b) & d);
                k = 0x5a827999;
            } else if (j < 40) {
                f = b ^ c ^ d;
                k = 0x6ed9eba1;
            } else if (j < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8f1bbcdc;
            } else {
                f = b ^ c ^ d;
                k = 0xca62c1d6;
            }

            const temp = (leftRotate(a, 5) + f + e + k + words[j]) >>> 0;
            e = d;
            d = c;
            c = leftRotate(b, 30);
            b = a;
            a = temp;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
    }

    return [h0, h1, h2, h3, h4].map(word => word.toString(16).padStart(8, '0')).join('');
}

function leftRotate(value: number, bits: number): number {
    return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function utf8Bytes(input: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
        let codePoint = input.charCodeAt(i);
        if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 0xdc00 && low <= 0xdfff) {
                codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
                i++;
            }
        }

        if (codePoint < 0x80) {
            bytes.push(codePoint);
        } else if (codePoint < 0x800) {
            bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
        } else if (codePoint < 0x10000) {
            bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
        } else {
            bytes.push(
                0xf0 | (codePoint >> 18),
                0x80 | ((codePoint >> 12) & 0x3f),
                0x80 | ((codePoint >> 6) & 0x3f),
                0x80 | (codePoint & 0x3f)
            );
        }
    }
    return bytes;
}
