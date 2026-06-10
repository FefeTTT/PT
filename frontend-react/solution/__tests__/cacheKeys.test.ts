import { describe, expect, it } from 'vitest';
import {
    canonicalizeHorario,
    penaltyObservedKey,
    serializePenaltyPayload,
    sijhKey,
} from '../ml/CacheKeys';
import type { PenaltyObservedPayload } from '../ml/PenaltyObservedCache';

function payload(overrides: Partial<PenaltyObservedPayload> = {}): PenaltyObservedPayload {
    return {
        eco: '19834',
        horario: 'Mi:08:30-10:00|L:08:30-10:00|V:08:30-10:00',
        ueas_asignadas_actuales: ['1112022'],
        horarios_asignados_actuales: ['08:30-10:00'],
        uea_prediccion: '1112030',
        ...overrides,
    };
}

describe('CacheKeys horario canonico', () => {
    it('ordena el horario semanal en L, M, Mi, J, V', () => {
        expect(canonicalizeHorario('Mi:08:30-10:00|L:08:30-10:00|V:08:30-10:00'))
            .toBe('L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00');
    });

    it('expande rangos simples a L, Mi, V por compatibilidad legacy', () => {
        expect(canonicalizeHorario('7:00-8:30'))
            .toBe('L:07:00-08:30|Mi:07:00-08:30|V:07:00-08:30');
    });

    it('preserva patrones M/J como horario semanal completo', () => {
        expect(canonicalizeHorario('J:08:30-10:00|M:08:30-10:00'))
            .toBe('M:08:30-10:00|J:08:30-10:00');
    });

    it('rechaza horarios invalidos', () => {
        expect(() => canonicalizeHorario('Sab:08:30-10:00')).toThrow(/invalido/);
    });

    it('usa namespaces v2 para Sijh y PenaltyObserved', () => {
        expect(sijhKey(19834, 1112030, '08:30-10:00'))
            .toBe('Sijh:v2:19834:1112030:L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00');
        expect(penaltyObservedKey(payload())).toMatch(/^PenaltyObserved:v3:/);
        expect(serializePenaltyPayload(payload())).toContain('L:08:30-10:00|Mi:08:30-10:00|V:08:30-10:00');
    });
});
