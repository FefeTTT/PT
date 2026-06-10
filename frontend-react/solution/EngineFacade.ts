import { IAssignmentData } from './core/IAssignmentData';
import { GrafoBipartito } from './models/GrafoBipartito';
import { GraphFSMAsignador } from './fsm/GraphFSMAsignador';
import { ReglasPipeline } from './rules/ReglasPipeline';
import { GreedyOrchestrator } from './greedy/GreedyOrchestrator';
import { EstrategiaOrdenamiento } from './greedy/GreedyTypes';

export class EngineFacade {
    private dataService: IAssignmentData;

    constructor(dataService: IAssignmentData) {
        this.dataService = dataService;
    }

    /**
     * Crea e inicializa un GrafoBipartito con todos los profesores y grupos de un area.
     */
    public async buildGrafoForArea(areaId: number): Promise<GrafoBipartito> {
        const data = await this.dataService.getCandidatosPorArea(areaId);
        const grafo = new GrafoBipartito();
        
        if (data.profesores) {
            data.profesores.forEach((p: any) => grafo.registrarProfesor(p));
        }
        if (data.grupos) {
            data.grupos.forEach((g: any) => grafo.registrarGrupo(g));
        }

        return grafo;
    }

    /**
     * Ejecuta el pipeline del FSM para un candidato y devuelve los snapshots del paso a paso.
     */
    public runFSM(grafo: GrafoBipartito, numeroEconomico: number, idUeaGrupo: number) {
        const reglas = [...ReglasPipeline.getReglasFastFail(), ...ReglasPipeline.getReglasRestantes()];
        const motor = new GraphFSMAsignador(grafo, reglas);
        return motor.procesarAsignacionStepByStep(numeroEconomico, idUeaGrupo);
    }

    /**
     * Ejecuta el Greedy Orchestrator para una lista de profesores y grupos.
     */
    public runGreedy(profesores: any[], grupos: any[], estrategia?: EstrategiaOrdenamiento) {
        const orquestador = new GreedyOrchestrator(estrategia);
        return orquestador.ejecutar(profesores, grupos);
    }
}
