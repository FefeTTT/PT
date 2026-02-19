import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';

export interface EvaluacionRegla {
    resultadoExitoso: boolean;
    motivo?: string;
}

export abstract class ReglaBase { // Clase padre de la cual heredan todas las reglas de la asignación para la FSM
    public readonly nombreRegla: string;

    constructor(nombre: string) {
        this.nombreRegla = nombre;
    }

    abstract evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, grafo: GrafoBipartito): EvaluacionRegla;
}
