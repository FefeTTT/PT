import { describe, expect, it } from 'vitest';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { FSMAsignador } from '../fsm/FSMAsignador';
import { FuncionObjetivoZ } from '../objective/FuncionObjetivoZ';
import { ISoftConstraint } from '../objective/SoftConstraints';
import { funcionZUniforme } from '../ml/IModeloML';
import { EjectionChain } from '../greedy/EjectionChain';
import { GreedyOrchestrator } from '../greedy/GreedyOrchestrator';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';

class ConstraintAsyncPrueba implements ISoftConstraint {
    readonly nombre = 'ASYNC_PRUEBA';
    public llamadasAsync = 0;

    evaluar(): number {
        return 0;
    }

    async evaluarAsync(): Promise<number> {
        this.llamadasAsync++;
        return 0.5;
    }
}

function profesor(): ProfesorDTO {
    return {
        numeroEconomico: 999999,
        idArea: ['9999'],
        horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '08:00:00', horaFin: '18:00:00' }]
    };
}

function grupo(): GrupoDTO {
    return {
        idUeaGrupo: 1,
        idGrupo: 1,
        claveGrupo: 'TST01',
        idArea: '9999',
        ueaClave: 9999001,
        horarios: [{ dia: 1, horaInicio: 8, horaFin: 10 }],
        horarioStringRaw: 'L:08:00-10:00'
    };
}

describe('rutas async de GRASP', () => {
    it('FuncionObjetivoZ.evaluarGrafoAsync usa evaluarAsync cuando existe', async () => {
        const constraint = new ConstraintAsyncPrueba();
        const grafo = new GrafoBipartito();
        const p = profesor();
        const g = grupo();
        grafo.registrarProfesor(p);
        grafo.registrarGrupo(g);
        grafo.asignarMutable(p.numeroEconomico, g.idUeaGrupo);

        const funcionZ = new FuncionObjetivoZ([{ constraint, lambda: 2 }], funcionZUniforme);
        const resultado = await funcionZ.evaluarGrafoAsync(grafo);

        expect(constraint.llamadasAsync).toBe(1);
        expect(resultado.Z).toBe(2);
    });

    it('EjectionChain.mejorarAsync resuelve sin bloquear en grafos sin movimientos', async () => {
        const grafo = new GrafoBipartito();
        const fsm = new FSMAsignador(grafo, []);
        const funcionZ = new FuncionObjetivoZ();
        const ejection = new EjectionChain(0, 0);

        const resultado = await ejection.mejorarSolucionAsync(grafo, fsm, funcionZ, []);

        expect(resultado.reparaciones).toBe(0);
        expect(resultado.mejoras).toBe(0);
    });

    it('GreedyOrchestrator.ejecutarAsync puede correr sin RCL de penalty si no se configura constraint de penalty', async () => {
        const orchestrator = new GreedyOrchestrator(undefined, funcionZUniforme, [], undefined, undefined, {
            k: 1,
            alpha: 0,
            disableLogs: true
        });

        const profesorReal: ProfesorDTO = {
            numeroEconomico: 28650,
            idArea: ['1112'],
            horariosContratacion: [{ idDiasDeTrabajo: 'L-V', horaInicio: '10:00:00', horaFin: '18:00:00' }]
        };
        const grupoReal: GrupoDTO = {
            idUeaGrupo: 111203401,
            idGrupo: 111203401,
            claveGrupo: 'CCB01',
            idArea: '1112',
            ueaClave: 1112034,
            horarios: [
                { dia: 1, horaInicio: 11.5, horaFin: 13 },
                { dia: 3, horaInicio: 11.5, horaFin: 13 },
                { dia: 5, horaInicio: 11.5, horaFin: 13 }
            ],
            horarioStringRaw: 'L:11:30-13:00|Mi:11:30-13:00|V:11:30-13:00'
        };

        const resultado = await orchestrator.ejecutarAsync([profesorReal], [grupoReal]);

        expect(resultado.asignaciones).toEqual([
            { numeroEconomico: 28650, idUeaGrupo: 111203401 }
        ]);
    });
});
