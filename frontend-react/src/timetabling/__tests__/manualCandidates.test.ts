import { describe, it, expect } from 'vitest';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';
import type { ZScoreDetails } from '@solution/ml/IModeloML';
import { crearHistorialUea, rankKde, grupoToCandidateRow } from '../engine/kde/manualCandidates';

const grupo = (overrides: Partial<GrupoDTO> = {}): GrupoDTO => ({
    idUeaGrupo: 10,
    idGrupo: 10,
    claveGrupo: 'CB01',
    idArea: '1111',
    ueaClave: 1111001,
    horarios: [
        { dia: 1, horaInicio: 7, horaFin: 8.5 },
        { dia: 3, horaInicio: 7, horaFin: 8.5 },
    ],
    horarioStringRaw: 'L:07:00-08:30|Mi:07:00-08:30',
    ...overrides,
});

describe('rankKde', () => {
    it('usa el mayor valor entre kde_ij y kde_ih', () => {
        expect(rankKde({ kde_ij: 0.3, kde_ih: 0.5 })).toBeCloseTo(0.5);
    });
    it('trata componentes ausentes como 0', () => {
        expect(rankKde({ kde_ij: 0.4 })).toBeCloseTo(0.4);
        expect(rankKde({})).toBe(0);
    });
});

describe('crearHistorialUea', () => {
    const dfHist = [
        { tri_num: 2, eco: '100', uea: '1111001' },
        { tri_num: 10, eco: '100', uea: '1111001' },
        { tri_num: 11, eco: '100', uea: '1111001' },
        { tri_num: 11, eco: '200', uea: '2222002' }, // otro eco => fija maxTri
    ];

    it('cuenta imparticiones en los últimos N (= half_life) trimestres', () => {
        const h = crearHistorialUea(dfHist, 8); // maxTri=11, ventana=8 => corte=3 => tri>3 cuenta
        const c = h.contar(100, 1111001);
        expect(h.maxTri).toBe(11);
        expect(h.ventana).toBe(8);
        expect(c.count).toBe(2);   // tri 10 y 11
        expect(c.total).toBe(3);   // tri 2, 10, 11
        expect(c.ultimaTri).toBe(11);
        expect(c.weighted).toBeGreaterThan(0);
    });

    it('detecta ecos con/sin historial', () => {
        const h = crearHistorialUea(dfHist, 8);
        expect(h.tieneHistorial(100)).toBe(true);
        expect(h.tieneHistorial(999)).toBe(false);
    });

    it('devuelve ceros para un par (eco, uea) sin observaciones', () => {
        const h = crearHistorialUea(dfHist, 8);
        const c = h.contar(100, 9999999);
        expect(c).toEqual({ count: 0, total: 0, weighted: 0, ultimaTri: null });
    });
});

describe('grupoToCandidateRow', () => {
    it('construye una fila bloqueada del pase actual con los scores dados y metadata', () => {
        const detalles: ZScoreDetails = {
            score: 0.7, h_ih: 0.5, rhat: 0, kde_ij: 0.3, kde_ih: 0.5, kde_ih_raw: 0.01, kde_plan: 0.1,
        };
        const metadata = {
            origin: 'manual',
            horarioLaboralAgreement: {
                hayMutuoAcuerdo: true,
                aplicaReglaHorarioLaboral: true,
                kdeIhScoreUsado: 0.01,
                subestado: 'EXCEPCION_HORARIO_LABORAL' as const,
            },
        };
        const row = grupoToCandidateRow(100, grupo(), detalles, 3, metadata);
        expect(row.numeroEconomico).toBe(100);
        expect(row.idUeaGrupo).toBe(10);
        expect(row.uea).toBe(1111001);
        expect(row.claveGrupo).toBe('CB01');
        expect(row.turno).toBe('manana');
        expect(row.kde_ij).toBe(0.3);
        expect(row.kde_ih).toBe(0.5);
        expect(row.kde_ih_raw).toBe(0.01);
        expect(row.locked).toBe(true);
        expect(row.passIndex).toBe(3);
        expect(row.metadata).toEqual(metadata);
    });
});
