import { describe, expect, it } from 'vitest';
import { GreedyOrchestrator } from '../greedy/GreedyOrchestrator';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { crearZScoreKDE } from '../ml/ZScoreKDE';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { ReglaHorarioLaboral } from '../rules/ReglasImplementacion';
import { crearGrupo, crearProfesor, franja, horarioDB } from './helpers/fixtures';

function histRow(eco: number, uea: number, days: number[], start = '10:00:00', end = '11:30:00') {
    const row: Record<string, unknown> = {
        tri: '2026-01-01',
        tri_num: 1,
        uea: String(uea),
        grupo: 'TST',
        eco: String(eco),
        lunes_i: null,
        lunes_f: null,
        martes_i: null,
        martes_f: null,
        miercoles_i: null,
        miercoles_f: null,
        jueves_i: null,
        jueves_f: null,
        viernes_i: null,
        viernes_f: null
    };

    const columns = [
        ['lunes_i', 'lunes_f'],
        ['martes_i', 'martes_f'],
        ['miercoles_i', 'miercoles_f'],
        ['jueves_i', 'jueves_f'],
        ['viernes_i', 'viernes_f']
    ];

    for (const day of days) {
        const pair = columns[day - 1];
        row[pair[0]] = start;
        row[pair[1]] = end;
    }

    return row;
}

describe('ZScoreKDE semanal', () => {
    it('evalua L,M,Mi,V como patron especial completo, no como dias incompletos', () => {
        const profesor = crearProfesor({
            numeroEconomico: 19834,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')]
        });
        const grupoCompleto = crearGrupo({
            idUeaGrupo: 1,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 10, 11.5), franja(2, 10, 11.5), franja(3, 10, 11.5), franja(5, 10, 11.5)]
        });
        const grupoCubierto = crearGrupo({
            idUeaGrupo: 2,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 10, 11.5), franja(3, 10, 11.5), franja(5, 10, 11.5)]
        });

        const factoryParcial = crearZScoreKDE({
            profesores: [profesor],
            grupos: [grupoCompleto, grupoCubierto],
            dfHist: [
                histRow(19834, 1112030, [1, 3, 5]),
                histRow(19834, 1112030, [2, 4])
            ],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.02 }
        });
        const factoryEspecial = crearZScoreKDE({
            profesores: [profesor],
            grupos: [grupoCompleto],
            dfHist: [histRow(19834, 1112030, [1, 2, 3, 5])],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.02 }
        });

        const especialSinSoporte = factoryParcial.evaluarGrupo(19834, grupoCompleto);
        const especialConSoporte = factoryEspecial.evaluarGrupo(19834, grupoCompleto);
        const regularCubierto = factoryParcial.evaluarGrupo(19834, grupoCubierto);

        expect(especialSinSoporte.domainBlocked).toBe(true);
        expect(especialSinSoporte.blockReason).toContain('KDE_IH_PATRON_FUERA_DOMINIO');
        expect(especialSinSoporte.blockReason).not.toContain('DIAS_INCOMPLETOS');
        expect(especialSinSoporte.patternSimilarity).toBeGreaterThan(0);
        expect(especialSinSoporte.score).toBeGreaterThan(0);
        expect(especialSinSoporte.kde_ih_raw).toBeLessThan(0.02);
        expect(especialConSoporte.domainBlocked).toBe(false);
        expect(especialConSoporte.patternSimilarity).toBe(1);
        expect(especialConSoporte.score).toBeGreaterThan(0.9);
        expect(regularCubierto.domainBlocked).toBe(false);
        expect(regularCubierto.patternSimilarity).toBe(1);
        expect(regularCubierto.score).toBeGreaterThan(0.4);
    });

    it('la ejection consulta el dominio Z antes de reparar con un candidato fuera de superficie', async () => {
        const profesor = crearProfesor({
            numeroEconomico: 28650,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')]
        });
        const grupo = crearGrupo({
            idUeaGrupo: 3,
            idArea: 1112,
            ueaClave: 1112034,
            horarios: [franja(2, 10, 11.5), franja(4, 10, 11.5)]
        });
        const grafo = new GrafoBipartito();
        grafo.registrarProfesor(profesor);
        grafo.registrarGrupo(grupo);

        const factory = crearZScoreKDE({
            profesores: [profesor],
            grupos: [grupo],
            dfHist: [histRow(28650, 1112034, [1, 3, 5])],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.001 }
        });
        const funcionObjetivo = new FuncionObjetivoZ([], factory.funcionZ);

        const dominio = await funcionObjetivo.evaluarDominioCandidatoAsync(grafo, 28650, grupo.idUeaGrupo);

        expect(dominio.permitido).toBe(false);
        expect(dominio.rechazos.join(' ')).toContain('FUNCION_Z');
    });

    it('kde_plan favorece planes historicos de 2 UEA para 19834 frente a quedarse en 1', () => {
        const profesor = crearProfesor({
            numeroEconomico: 19834,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')]
        });
        const grupoA = crearGrupo({
            idUeaGrupo: 10,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 10, 11.5), franja(3, 10, 11.5), franja(5, 10, 11.5)]
        });
        const grupoB = crearGrupo({
            idUeaGrupo: 11,
            idArea: 1112,
            ueaClave: 1112034,
            horarios: [franja(2, 10, 11.5), franja(4, 10, 11.5)]
        });
        const factory = crearZScoreKDE({
            profesores: [profesor],
            grupos: [grupoA, grupoB],
            dfHist: [
                histRow(19834, 1112030, [1, 3, 5], '10:00:00', '11:30:00'),
                histRow(19834, 1112034, [2, 4], '10:00:00', '11:30:00')
            ],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.001 }
        });
        const grafoConUna = new GrafoBipartito();
        grafoConUna.registrarProfesor(profesor);
        grafoConUna.registrarGrupo(grupoA);
        grafoConUna.registrarGrupo(grupoB);
        grafoConUna.asignarMutable(19834, grupoA.idUeaGrupo);

        const proyectaUna = factory.evaluarGrupo(19834, grupoA, new GrafoBipartito());
        const proyectaDos = factory.evaluarGrupo(19834, grupoB, grafoConUna);

        expect(proyectaDos.kde_plan).toBeGreaterThan(proyectaUna.kde_plan ?? 0);
        expect(proyectaDos.kde_plan).toBeCloseTo(1, 6);
    });

    it('kde_plan penaliza proyectar 2 tardes para 14416 si su plan historico reciente es de manana', () => {
        const profesor = crearProfesor({
            numeroEconomico: 14416,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '20:00:00')]
        });
        const mananaBase = crearGrupo({
            idUeaGrupo: 20,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 9, 10.5), franja(3, 9, 10.5), franja(5, 9, 10.5)]
        });
        const mananaCandidato = crearGrupo({
            idUeaGrupo: 21,
            idArea: 1112,
            ueaClave: 1112034,
            horarios: [franja(2, 9, 10.5), franja(4, 9, 10.5)]
        });
        const tardeBase = crearGrupo({
            idUeaGrupo: 22,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 16, 17.5), franja(3, 16, 17.5), franja(5, 16, 17.5)]
        });
        const tardeCandidato = crearGrupo({
            idUeaGrupo: 23,
            idArea: 1112,
            ueaClave: 1112034,
            horarios: [franja(2, 16, 17.5), franja(4, 16, 17.5)]
        });
        const factory = crearZScoreKDE({
            profesores: [profesor],
            grupos: [mananaBase, mananaCandidato, tardeBase, tardeCandidato],
            dfHist: [
                histRow(14416, 1112030, [1, 3, 5], '09:00:00', '10:30:00'),
                histRow(14416, 1112034, [2, 4], '09:00:00', '10:30:00')
            ],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.001 }
        });
        const grafoManana = new GrafoBipartito();
        const grafoTarde = new GrafoBipartito();
        for (const grafo of [grafoManana, grafoTarde]) {
            grafo.registrarProfesor(profesor);
            [mananaBase, mananaCandidato, tardeBase, tardeCandidato].forEach(g => grafo.registrarGrupo(g));
        }
        grafoManana.asignarMutable(14416, mananaBase.idUeaGrupo);
        grafoTarde.asignarMutable(14416, tardeBase.idUeaGrupo);

        const planManana = factory.evaluarGrupo(14416, mananaCandidato, grafoManana);
        const planTarde = factory.evaluarGrupo(14416, tardeCandidato, grafoTarde);

        expect(planManana.kde_plan).toBeGreaterThan(planTarde.kde_plan ?? 0);
        expect(planTarde.kde_plan).toBeLessThan(0.25);
    });

    it('separa kde_ih_raw de cobertura contractual para permitir acuerdo horario laboral', () => {
        const profesor = crearProfesor({
            numeroEconomico: 19834,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')]
        });
        const grupoTardeHistorico = crearGrupo({
            idUeaGrupo: 30,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 16, 17.5), franja(3, 16, 17.5), franja(5, 16, 17.5)]
        });
        const factory = crearZScoreKDE({
            profesores: [profesor],
            grupos: [grupoTardeHistorico],
            dfHist: [histRow(19834, 1112030, [1, 3, 5], '16:00:00', '17:30:00')],
            options: { mode: 'kde_ij', minKdeIj: 0.001, minKdeIh: 0.02 }
        });

        const detalles = factory.evaluarGrupo(19834, grupoTardeHistorico);

        expect(detalles.contractCoverage).toBe(0);
        expect(detalles.kde_ih_raw).toBeGreaterThan(0.02);
        expect(detalles.domainBlocked).toBe(false);
        expect(detalles.blockReason ?? '').not.toContain('KDE_IJ_FUERA_DOMINIO');
    });

    it('HayAcuerdoHorarioLaboral relaja el hard constraint solo si se revisa y supera umbral', () => {
        const profesor = crearProfesor({
            numeroEconomico: 50001,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')]
        });
        const grupoTarde = crearGrupo({
            idUeaGrupo: 40,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 16, 17.5)]
        });
        const regla = new ReglaHorarioLaboral();
        const grafo = new GrafoBipartito();

        expect(regla.evaluar(profesor, grupoTarde, grafo).resultadoExitoso).toBe(false);
        expect(regla.evaluar(profesor, grupoTarde, grafo, {
            hayAcuerdoHorarioLaboral: { revisarAcuerdo: 0, umbral: 0.02, score: 1 }
        }).resultadoExitoso).toBe(false);

        const conAcuerdo = regla.evaluar(profesor, grupoTarde, grafo, {
            hayAcuerdoHorarioLaboral: { revisarAcuerdo: 1, umbral: 0.02, score: 0.05 }
        });

        expect(conAcuerdo.resultadoExitoso).toBe(true);
        expect(conAcuerdo.motivo).toContain('HayAcuerdoHorarioLaboral');
    });

    it('solo la asignacion manual con mutuo acuerdo relaja horario fuera de contrato aunque el score sea bajo', () => {
        const profesor = crearProfesor({
            numeroEconomico: 50002,
            idArea: 1112,
            horariosContratacion: [horarioDB('L-V', '07:00:00', '15:00:00')]
        });
        const grupoTarde = crearGrupo({
            idUeaGrupo: 41,
            idArea: 1112,
            ueaClave: 1112030,
            horarios: [franja(1, 16, 17.5)]
        });
        const regla = new ReglaHorarioLaboral();
        const grafo = new GrafoBipartito();
        const scoreBajo = 0.001;

        const automatico = regla.evaluar(profesor, grupoTarde, grafo, {
            modoAsignacion: 'automatic',
            hayAcuerdoHorarioLaboral: { revisarAcuerdo: 1, umbral: 0.02, score: scoreBajo }
        });
        const manualSinMutuoAcuerdo = regla.evaluar(profesor, grupoTarde, grafo, {
            modoAsignacion: 'manual',
            hayAcuerdoHorarioLaboral: { revisarAcuerdo: 1, umbral: 0.02, score: scoreBajo, hayMutuoAcuerdo: false }
        });
        const manualConMutuoAcuerdo = regla.evaluar(profesor, grupoTarde, grafo, {
            modoAsignacion: 'manual',
            hayAcuerdoHorarioLaboral: { revisarAcuerdo: 1, umbral: 0.02, score: scoreBajo, hayMutuoAcuerdo: true }
        });

        expect(automatico.resultadoExitoso).toBe(false);
        expect(manualSinMutuoAcuerdo.resultadoExitoso).toBe(false);
        expect(manualSinMutuoAcuerdo.motivo).toContain('mutuo acuerdo manual no confirmado');
        expect(manualConMutuoAcuerdo.resultadoExitoso).toBe(true);
        expect(manualConMutuoAcuerdo.subestado).toBe('EXCEPCION_HORARIO_LABORAL');
        expect(manualConMutuoAcuerdo.motivo).toContain('mutuo acuerdo manual');
    });

    it('penaltyMask atenúa el zBase y no puede rescatar con bonos positivos', () => {
        const orchestrator = new GreedyOrchestrator();
        const calcularMask = (orchestrator as any)._calcularPenaltyMask.bind(orchestrator);

        expect(calcularMask(0.2, 10)).toBe(0.2);
        expect(calcularMask(2, 10)).toBe(1);
        expect(calcularMask(-1, 10)).toBe(0);

        const zBaseAlto = 0.9;
        const zBaseBajo = 0.05;
        expect(zBaseAlto * calcularMask(0.01, undefined)).toBeCloseTo(0.009, 6);
        expect(zBaseBajo * calcularMask(1, undefined)).toBe(zBaseBajo);
    });
});
