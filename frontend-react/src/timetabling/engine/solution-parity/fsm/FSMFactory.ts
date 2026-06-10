import { GrafoBipartito } from '../models/GrafoBipartito';
import { ReglaBase } from '../rules/ReglaBase';
import { FSMAsignador } from './FSMAsignador';

export class FSMFactory {
    /**
     * Instancia un nuevo pipeline de FSM utilizando una lista inmutable de reglas.
     * @param grafo El grafo bipartito sobre el que actuará el FSM
     * @param reglas Array inmutable de las reglas que evaluará el pipeline
     */
    public static crear(grafo: GrafoBipartito, reglas: readonly ReglaBase[]): FSMAsignador {
        // Hacemos una copia para asegurar que el pipeline interno no se mute accidentalmente
        return new FSMAsignador(grafo, [...reglas]);
    }
}
