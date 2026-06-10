import { describe, expect, it } from 'vitest';
import { JSONAssignmentAdapter } from '../data/JSONAssignmentAdapter';
import { GrupoDTO } from '../types/AssignmentTypes';

function grupo(overrides: Partial<GrupoDTO>): GrupoDTO {
    return {
        idUeaGrupo: overrides.idUeaGrupo ?? 1,
        idGrupo: overrides.idGrupo ?? overrides.idUeaGrupo ?? 1,
        claveGrupo: overrides.claveGrupo ?? 'CAT01',
        idArea: overrides.idArea ?? '1100',
        ueaClave: overrides.ueaClave ?? 1100001,
        horarios: overrides.horarios ?? [{ dia: 1, horaInicio: 8, horaFin: 10 }],
        horarioStringRaw: overrides.horarioStringRaw ?? 'L:08:00-10:00'
    };
}

describe('FSM de ingesta de grupos', () => {
    it('rechaza grupos PRO/SAI y grupos sin programacion antes de MCV/GRASP', () => {
        const grupos = [
            grupo({ idUeaGrupo: 1, claveGrupo: 'CAT01' }),
            grupo({ idUeaGrupo: 2, claveGrupo: 'CPRO81' }),
            grupo({ idUeaGrupo: 3, claveGrupo: 'CSAI01' }),
            grupo({ idUeaGrupo: 4, claveGrupo: 'CAT02', horarios: [], horarioStringRaw: '' })
        ];

        const resultado = JSONAssignmentAdapter.evaluarGruposPorFSMIngesta(grupos);

        expect(resultado.validos.map(g => g.claveGrupo)).toEqual(['CAT01']);
        expect(resultado.rechazados.map(r => r.reglaFallo)).toEqual([
            'REGLA_IGNORAR_GRUPOS',
            'REGLA_IGNORAR_GRUPOS',
            'REGLA_GRUPO_TIENE_PROGRAMACION'
        ]);
    });
});
