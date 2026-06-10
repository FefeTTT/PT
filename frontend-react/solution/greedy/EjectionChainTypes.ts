import { GrafoBipartito } from '../models/GrafoBipartito';

export interface NodoCadena {
    profesorEyectado: number;
    grupoQueDesea: number;
}

export interface CadenaEyeccion {
    nodos: NodoCadena[];
    longitudTotal: number;
}

export interface DiagnosticoRechazoFSM {
    iteracion: number;
    profesorVictima: number;
    profesorCandidato: number;
    idGrupoAfectado: number;
    reglaQueRechazo: string;
    motivoDetallado: string;
}

export interface DiagnosticoDeltaZ {
    iteracion: number;
    profesorVictima: number;
    profesorCandidato: number;
    idGrupoAfectado: number;
    zAntes: number;
    zDespues: number;
    deltaZ: number;
    longitidCadena: number;
}

export interface TelemetriaEjectionChain {
    mejorasAceptadas: number;
    rechazosPorFSM: number;
    rechazosPorDeltaNegativo: number;
    rechazosPorDominiVacio: number;
    deltaZAcumulado: number;
    distribucionDeltaZ: DiagnosticoDeltaZ[];
    rechazosFSMDetallados: DiagnosticoRechazoFSM[];
    frecuenciaRechazosPorRegla: Map<string, number>;
}

export interface ResultadoOptimizacionBFS {
    mejoras: number;
    iteracionesEjecutadas: number;
    telemetria: TelemetriaEjectionChain;
    grafoFinal: GrafoBipartito;
}

export interface InstantaneaEstadoBFS {
    iteracionActual: number;
    zActual: number;
    mejorasHastaAhora: number;
    sinMejoraConsecutiva: number;
    grafoActual: GrafoBipartito;
}
