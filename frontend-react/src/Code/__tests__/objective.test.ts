import { afterEach, describe, expect, it, vi } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { ViabilidadHuecos } from '../objective/SoftConstraints';
import {
    calcularPenalizacionCargaConsecutivaCandidato,
    calcularPenalizacionCargaConsecutivaDesdeHoras
} from '../objective/CargaConsecutivaHistorica';
import {
    BACKEND_CARGA_CONSECUTIVA_FALLBACK,
    BACKEND_CARGA_CONSECUTIVA_PRIMARIO,
    ENDPOINT_CARGA_CONSECUTIVA,
    PerfilCargaConsecutivaMemoria,
    VERSION_CARGA_CONSECUTIVA,
    cargarPerfilesCargaConsecutivaDesdeBackend
} from '../ml/PerfilCargaConsecutiva';
import { crearGrafoConAsignaciones } from './helpers/helpers';
import { crearGrupo, crearProfesor, franja } from './helpers/fixtures';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('FuncionObjetivoZ con viabilidad positiva y penalizacion historica', () => {
    it('ViabilidadHuecos devuelve [0,1] y aporta positivamente a Z', () => {
        const profesor = crearProfesor({ numeroEconomico: 1, idArea: 10 });
        const g1 = crearGrupo({ idUeaGrupo: 100, idArea: 10, horarios: [franja(1, 8, 10)] });
        const g2 = crearGrupo({ idUeaGrupo: 101, idArea: 10, horarios: [franja(1, 12, 14)] });
        const grafo = crearGrafoConAsignaciones(
            [profesor],
            [g1, g2],
            [
                { numEco: 1, idGrupo: 100 },
                { numEco: 1, idGrupo: 101 }
            ]
        );
        const funcionZ = new FuncionObjetivoZ([{ constraint: new ViabilidadHuecos(), lambda: 2 }]);

        const resultado = funcionZ.evaluarGrafo(grafo);

        expect(resultado.desglose[0].scoreViabilidad).toBeGreaterThanOrEqual(0);
        expect(resultado.desglose[0].scoreViabilidad).toBeLessThanOrEqual(1);
        expect(resultado.desglose[0].valorAportado).toBeGreaterThanOrEqual(0);
        expect(resultado.viabilidadTotal).toBe(resultado.desglose[0].valorAportado);
    });

    it('profesor con tau=6 no penaliza bloque de 6 horas', () => {
        expect(calcularPenalizacionCargaConsecutivaDesdeHoras(6, 6)).toBe(0);
    });

    it('profesor con tau=3 penaliza bloques mayores a 3 horas', () => {
        expect(calcularPenalizacionCargaConsecutivaDesdeHoras(4.5, 3)).toBeCloseTo(0.5);
        expect(calcularPenalizacionCargaConsecutivaDesdeHoras(6, 3)).toBe(1);
    });

    it('la penalizacion candidata depende del bloque que resultaria al agregar el grupo', () => {
        const profesor = crearProfesor({ numeroEconomico: 1, idArea: 10 });
        const grupoBase = crearGrupo({ idUeaGrupo: 200, idArea: 10, horarios: [franja(1, 8, 11)] });
        const grupoExtra = crearGrupo({ idUeaGrupo: 201, idArea: 10, horarios: [franja(1, 11, 12.5)] });
        const grafo = crearGrafoConAsignaciones(
            [profesor],
            [grupoBase, grupoExtra],
            [{ numEco: 1, idGrupo: 200 }]
        );
        const provider = new PerfilCargaConsecutivaMemoria({ '1': 3 });

        const penalizacion = calcularPenalizacionCargaConsecutivaCandidato(grafo, 1, 201, provider);

        expect(penalizacion).toBeCloseTo(0.5);
    });

    it('Z baja cuando el perfil historico no tolera la carga consecutiva resultante', () => {
        const profesor = crearProfesor({ numeroEconomico: 1, idArea: 10 });
        const grupos = [
            crearGrupo({ idUeaGrupo: 300, idArea: 10, horarios: [franja(1, 8, 11)] }),
            crearGrupo({ idUeaGrupo: 301, idArea: 10, horarios: [franja(1, 11, 12.5)] })
        ];
        const grafo = crearGrafoConAsignaciones(
            [profesor],
            grupos,
            [
                { numEco: 1, idGrupo: 300 },
                { numEco: 1, idGrupo: 301 }
            ]
        );

        const zSinPenalizacion = new FuncionObjetivoZ(
            [],
            undefined,
            new PerfilCargaConsecutivaMemoria({ '1': 6 })
        ).evaluarGrafo(grafo);
        const zConPenalizacion = new FuncionObjetivoZ(
            [],
            undefined,
            new PerfilCargaConsecutivaMemoria({ '1': 3 })
        ).evaluarGrafo(grafo);

        expect(zConPenalizacion.Z).toBeLessThan(zSinPenalizacion.Z);
        expect(zConPenalizacion.penalizacionCargaConsecutiva).toBeGreaterThan(0);
    });

    it('grafo sin asignaciones mantiene Z finito', () => {
        const grafo = new GrafoBipartito();
        const funcionZ = new FuncionObjetivoZ([{ constraint: new ViabilidadHuecos(), lambda: 2 }]);

        expect(Number.isFinite(funcionZ.evaluarGrafo(grafo).Z)).toBe(true);
    });
});

describe('PerfilCargaConsecutiva backend', () => {
    it('usa localhost:8000 como fallback cuando 127.0.0.1:8000 falla', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    version: VERSION_CARGA_CONSECUTIVA,
                    items: {
                        '28650': { tauHoras: 3, fallback: false }
                    }
                })
            } as Response);
        vi.stubGlobal('fetch', fetchMock);

        const provider = await cargarPerfilesCargaConsecutivaDesdeBackend([28650]);

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            `${BACKEND_CARGA_CONSECUTIVA_PRIMARIO}${ENDPOINT_CARGA_CONSECUTIVA}`,
            expect.any(Object)
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `${BACKEND_CARGA_CONSECUTIVA_FALLBACK}${ENDPOINT_CARGA_CONSECUTIVA}`,
            expect.any(Object)
        );
        expect(provider.getTauHoras(28650)).toBe(3);
    });
});
