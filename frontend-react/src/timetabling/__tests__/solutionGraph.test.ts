import { describe, expect, it } from 'vitest';
import type { CandidateRow, CandidateRowMetadata } from '../engine/kde/candidateRow';
import { candidateRowToDTO, dtoToCandidateRow, type CatalogoGrupoDTO } from '../dtos/solutionGraph';

describe('solutionGraph serializers', () => {
    it('preservan kde_ih_raw y metadata en candidateRowToDTO/dtoToCandidateRow', () => {
        const metadata: CandidateRowMetadata = {
            origin: 'manual',
            horarioLaboralAgreement: {
                hayMutuoAcuerdo: true,
                aplicaReglaHorarioLaboral: true,
                modoValidacion: 'manual',
                kdeIhScoreUsado: 0.001,
                kdeIhUmbralAutomatico: 0.02,
                subestado: 'EXCEPCION_HORARIO_LABORAL',
                motivo: 'Aceptado por mutuo acuerdo',
            },
        };
        const row: CandidateRow = {
            numeroEconomico: 100,
            idUeaGrupo: 10,
            uea: 1111001,
            claveGrupo: 'CB01',
            horarioStringRaw: 'L:16:00-17:30',
            turno: 'tarde',
            score: 0.4,
            kde_ij: 0.3,
            kde_ih: 0.2,
            kde_ih_raw: 0.001,
            kde_plan: 0.1,
            zBase: 0.05,
            locked: true,
            passIndex: 2,
            metadata,
        };
        const catalogo = new Map<number, CatalogoGrupoDTO>([[10, {
            idUeaGrupo: 10,
            ueaClave: 1111001,
            claveGrupo: 'CB01',
            horarioRaw: 'L:16:00-17:30',
            horarioCanonico: '1:16-17.5',
        }]]);

        const dto = candidateRowToDTO(row);
        const roundTrip = dtoToCandidateRow(dto, catalogo);

        expect(dto.kde_ih_raw).toBe(0.001);
        expect(dto.metadata).toEqual(metadata);
        expect(roundTrip.kde_ih_raw).toBe(0.001);
        expect(roundTrip.metadata).toEqual(metadata);
    });
});
