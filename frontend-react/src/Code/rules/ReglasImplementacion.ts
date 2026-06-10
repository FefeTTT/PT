import { ReglaBase, EvaluacionRegla } from './ReglaBase';
import { ProfesorDTO, GrupoDTO } from '../types/FrontendTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { SemanaLaboral } from '../models/SemanaLaboral';

function hayTraslapeHorario(grupoA: GrupoDTO, grupoB: GrupoDTO): boolean {
    for (const franjaA of grupoA.horarios) {
        for (const franjaB of grupoB.horarios) {
            if (
                franjaA.dia === franjaB.dia
                && franjaA.horaInicio < franjaB.horaFin
                && franjaB.horaInicio < franjaA.horaFin
            ) {
                return true;
            }
        }
    }

    return false;
}

export class ReglaArea extends ReglaBase {
    constructor() {
        super('REGLA_AREA');
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        if (profesor.idArea === grupo.idArea) {
            return {
                resultadoExitoso: true,
                motivo: 'El area del profesor coincide de manera exacta con el area de la UEA.'
            };
        }

        return {
            resultadoExitoso: false,
            motivo: `El area de la UEA: ${grupo.idArea} no coincide con el area del profesor: ${profesor.idArea}.`
        };
    }
}

export class ReglaHorarioLaboral extends ReglaBase {
    constructor() {
        super('REGLA_HORARIO_LABORAL');
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        const semanaProfesor = SemanaLaboral.obtenerOCrear(
            profesor.numeroEconomico,
            profesor.horariosContratacion
        );

        for (const franjaGrupo of grupo.horarios) {
            const val = semanaProfesor.intentarAsignarFranja(franjaGrupo);
            if (!val.asignable) {
                if (val.esHoraMuerta) {
                    return {
                        resultadoExitoso: false,
                        motivo: `Restriccion de Horario: La clase solicitada (Dia ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}) cae en un hueco no laborable en el horario del profesor.`
                    };
                }

                return {
                    resultadoExitoso: false,
                    motivo: `Restriccion de Horario: El profesor no tiene disponibilidad programada para cubrir la clase del Dia ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}.`
                };
            }
        }

        return {
            resultadoExitoso: true,
            motivo: 'El horario laboral del profesor cubre completamente el horario requerido para el grupo.'
        };
    }
}

export class ReglaTraslapeUEA extends ReglaBase {
    constructor() {
        super('REGLA_TRASLAPE_UEA');
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, grafo: GrafoBipartito): EvaluacionRegla {
        const gruposAsignados = grafo.adyacencias.get(profesor.numeroEconomico);

        if (!gruposAsignados || gruposAsignados.length === 0) {
            return {
                resultadoExitoso: true,
                motivo: 'El profesor no tiene UEAs asignadas con traslape horario.'
            };
        }

        for (const idGrupoAsignado of gruposAsignados) {
            const grupoAsignado = grafo.grupos.get(idGrupoAsignado);
            if (!grupoAsignado) {
                continue;
            }

            if (hayTraslapeHorario(grupoAsignado, grupo)) {
                return {
                    resultadoExitoso: false,
                    motivo: `La UEA ${grupo.ueaClave} (${grupo.idUeaGrupo}) se traslapa con la UEA ya asignada ${grupoAsignado.ueaClave} (${grupoAsignado.idUeaGrupo}).`
                };
            }
        }

        return {
            resultadoExitoso: true,
            motivo: 'La UEA no se traslapa con otras asignaciones del profesor.'
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
            sumatoria += f.horaFin - f.horaInicio;
        }
        return sumatoria;
    }

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
                motivo: `La asignacion es valida. Carga proyectada: ${totalProyectado} hrs (Limite: ${this._limiteHorasSemanales} hrs).`
            };
        }

        return {
            resultadoExitoso: false,
            motivo: `Asignarlo superaria su maxima carga. Carga actual (${horasOcupadas}h) + Grupo a asignar (${horasQuePideEsteGrupo}h) = ${totalProyectado}h (Limite: ${this._limiteHorasSemanales}h).`
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
            motivo: 'Regla superada. El grupo cuenta con horarios programados en BD.'
        };
    }
}
