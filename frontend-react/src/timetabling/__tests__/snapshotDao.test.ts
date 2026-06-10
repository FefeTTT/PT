import { describe, it, expect } from 'vitest';
import { SnapshotDAO, type SnapshotDTO } from '../dao/SnapshotDAO';
import type { GrupoDTO } from '@solution/types/AssignmentTypes';

const grupo = (idUeaGrupo: number, ueaClave: number, clave: string, area: string, horario: string): GrupoDTO =>
    ({ idUeaGrupo, ueaClave, claveGrupo: clave, idArea: area, horarioStringRaw: horario, horarios: [] } as unknown as GrupoDTO);

const snap: SnapshotDTO = {
    id: 7,
    timestamp: 1234,
    configs: { mode: 'kde_ij', seed: 1, k: 48, alpha: 0.25 } as SnapshotDTO['configs'],
    locked: [{ cacheKey: '1:111:x', numeroEconomico: 1, idUeaGrupo: 10, bloqueado: true, indicePase: 0 }],
    unlocked: [{ cacheKey: '2:222:y', numeroEconomico: 2, idUeaGrupo: 20, bloqueado: false, indicePase: 1 }],
    finishes: [99],
    pase: 2,
    convergio: false,
    grafo: {
        profesores: [],
        grupos: [
            grupo(10, 111, 'G10', 'A', 'L:07:00-08:30'),
            grupo(20, 222, 'G20', 'B', 'Ma:09:00-10:30'),
        ],
        adyacencias: [],
        asignacionesInversas: [],
    },
};

describe('SnapshotDAO.toEstadoSolucion', () => {
    it('reensambla un EstadoSolucionDTO restaurable desde el snapshot', () => {
        const dto = SnapshotDAO.toEstadoSolucion(snap);

        expect(dto.pase).toBe(2);
        expect(dto.convergio).toBe(false);
        expect(dto.configGrasp).toBe(snap.configs);
        expect(dto.grafo).toBe(snap.grafo);

        // locked + unlocked se fusionan en candidatos.
        expect(dto.candidatos).toHaveLength(2);
        expect(dto.candidatos.map((c) => c.idUeaGrupo).sort((a, b) => a - b)).toEqual([10, 20]);

        // El catálogo se deriva de grafo.grupos (uea/clave por id).
        expect(dto.catalogo).toHaveLength(2);
        const cat10 = dto.catalogo?.find((c) => c.idUeaGrupo === 10);
        expect(cat10?.ueaClave).toBe(111);
        expect(cat10?.claveGrupo).toBe('G10');
    });
});
