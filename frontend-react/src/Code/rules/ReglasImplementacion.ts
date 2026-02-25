import { ReglaBase, EvaluacionRegla } from './ReglaBase';
import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { SemanaLaboral } from '../models/SemanaLaboral';

export class ReglaArea extends ReglaBase {// Match área profesor y área UEA
    constructor() {
        super('REGLA_AREA');
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        if (profesor.idArea === grupo.idArea) {
            return {
                resultadoExitoso: true,
                motivo: 'El área del profesor coincide de manera exacta con el área de la UEA.'
            };
        }
        return {
            resultadoExitoso: false,
            motivo: `El área de la UEA: ${grupo.idArea} no coincide con el área del profesor: ${profesor.idArea}.`
        };
    }
}

export class ReglaHorario extends ReglaBase { // Comprueba que el horario laboral del profesor englobe el horario del grupo
    constructor() {
        super('REGLA_HORARIOS_COMPATIBLES');
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        const semanaProfesor = new SemanaLaboral(profesor.horariosContratacion);

        for (const franjaGrupo of grupo.horarios) {
            const val = semanaProfesor.intentarAsignarFranja(franjaGrupo);
            if (!val.asignable) {
                if (val.esHoraMuerta) {
                    return {
                        resultadoExitoso: false,
                        motivo: `Restricción de Horario: La clase solicitada (Día ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}) cae en un HUECO NO LABORABLE (Hora muerta) en el horario del profesor.`
                    };
                } else {
                    return {
                        resultadoExitoso: false,
                        motivo: `Restricción de Horario: El profesor no tiene disponibilidad programada para cubrir la clase del Día ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}.`
                    };
                }
            }
        }
        return {
            resultadoExitoso: true,
            motivo: 'El horario laboral del profesor cubre completamente el horario requerido para el grupo.'
        };
    }
}


export class ReglaMaxN_Horas extends ReglaBase {
    private _limiteHorasSemanales: number;

    constructor(horasMaximasSemanales: number = 20) {
        super('REGLA_MAXIMO_N_HORAS_LABORALES');
        this._limiteHorasSemanales = horasMaximasSemanales;
    }

    protected _getDuracionGrupo(grupo: GrupoDTO): number {
        let sumatoria = 0;
        for (const f of grupo.horarios) {
            sumatoria += (f.horaFin - f.horaInicio);
        }
        return sumatoria;
    }

    /**
     * Suma el acumulado de todos los grupos actuales en el grafo.
     * @param numeroEconomico Identificador del Profesor.
     * @param grafo Estado inmutable de validación actual.
     */
    protected _getHorasFrenteAGrupoActuales(numeroEconomico: number, grafo: GrafoBipartito): number {
        const listaClavesUeaAsignadas = grafo.adyacencias.get(numeroEconomico) || [];
        let horasAcumuladas = 0;

        for (const claveUea of listaClavesUeaAsignadas) {
            const grupoObj = grafo.grupos.get(claveUea);
            if (grupoObj) {
                horasAcumuladas += this._getDuracionGrupo(grupoObj);
            }
        }

        return horasAcumuladas;
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, grafo: GrafoBipartito): EvaluacionRegla {
        const horasOcupadas = this._getHorasFrenteAGrupoActuales(profesor.numeroEconomico, grafo);
        const horasQuePideEsteGrupo = this._getDuracionGrupo(grupo);

        const totalProyectado = horasOcupadas + horasQuePideEsteGrupo;

        if (totalProyectado <= this._limiteHorasSemanales) {
            return {
                resultadoExitoso: true,
                motivo: `La asignación es válida. Carga proyectada: ${totalProyectado} hrs (Límite: ${this._limiteHorasSemanales} hrs).`
            };
        }

        return {
            resultadoExitoso: false,
            motivo: `Asignarlo superaría su máxima carga. Carga actual (${horasOcupadas}h) + Grupo a asignar (${horasQuePideEsteGrupo}h) = ${totalProyectado}h (Límite: ${this._limiteHorasSemanales}h).`
        };
    }
}

export class ReglaGrupoTieneProgramacion extends ReglaBase {
    constructor() {
        super('REGLA_GRUPO_TIENE_PROGRAMACION');
    }

    evaluar(_profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        if (!grupo.horarios || grupo.horarios.length === 0) {
            return {
                resultadoExitoso: false,
                motivo: 'El grupo no cuenta con programacion_uea_grupo asignada.'
            };
        }
        return {
            resultadoExitoso: true,
            motivo: 'Regla superada (Validación de Integridad). El grupo cuenta con horarios programados en BD siempre.'
        };
    }
}
