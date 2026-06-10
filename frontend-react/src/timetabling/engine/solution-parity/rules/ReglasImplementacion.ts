import { ContextoRegla, ReglaBase, EvaluacionRegla } from './ReglaBase';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { SemanaLaboral } from '../models/SemanaLaboral';

let ecosVigentesRegular: Record<string, string> | null = null;
let ecosVigentesIrregular: Record<string, string> | null = null;
let areaProfesor: Record<string, string[]> | null = null;

export interface ReglasCatalogosBrowser {
    ecosVigentesRegular: Record<string, string>;
    ecosVigentesIrregular: Record<string, string>;
    areaProfesor: Record<string, string[]>;
}

export function configurarCatalogosReglas(catalogos: ReglasCatalogosBrowser): void {
    ecosVigentesRegular = catalogos.ecosVigentesRegular;
    ecosVigentesIrregular = catalogos.ecosVigentesIrregular;
    areaProfesor = catalogos.areaProfesor;
}

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
        if (profesor.idArea.includes(grupo.idArea)) {
            return {
                resultadoExitoso: true,
                motivo: 'El área del profesor coincide con el área de la UEA.'
            };
        }

        return {
            resultadoExitoso: false,
            motivo: `El área de la UEA (${grupo.idArea}) no se encuentra entre las áreas del profesor (${profesor.idArea.join(', ')}).`
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
                    motivo: `La UEA ${grupo.claveGrupo} se traslapa con la UEA ya asignada ${grupoAsignado.claveGrupo}.`
                };
            }
        }

        return {
            resultadoExitoso: true,
            motivo: 'La UEA no se traslapa con otras asignaciones del profesor.'
        };
    }
}

export class ReglaMaxHorasDiarias extends ReglaBase {
    private _limiteHorasDiarias: number;

    constructor(horasMaximasDiarias: number = 4.5) {
        super('REGLA_MAXIMO_HORAS_DIARIAS');
        this._limiteHorasDiarias = horasMaximasDiarias;
    }

    protected _getDuracionGrupoEnDia(grupo: GrupoDTO, dia: number): number {
        let sumatoria = 0;
        for (const f of grupo.horarios) {
            if (f.dia === dia) {
                sumatoria += f.horaFin - f.horaInicio;
            }
        }
        return sumatoria;
    }

    protected _getHorasDiaActuales(numeroEconomico: number, dia: number, grafo: GrafoBipartito): number {
        const listaClavesUeaAsignadas = grafo.adyacencias.get(numeroEconomico) || [];
        let horasAcumuladas = 0;

        for (const claveUea of listaClavesUeaAsignadas) {
            const grupoObj = grafo.grupos.get(claveUea);
            if (grupoObj) {
                horasAcumuladas += this._getDuracionGrupoEnDia(grupoObj, dia);
            }
        }

        return horasAcumuladas;
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, grafo: GrafoBipartito): EvaluacionRegla {
        const diasDelGrupo = Array.from(new Set(grupo.horarios.map(h => h.dia)));

        for (const dia of diasDelGrupo) {
            const horasOcupadasDia = this._getHorasDiaActuales(profesor.numeroEconomico, dia, grafo);
            const horasQuePideEsteGrupoDia = this._getDuracionGrupoEnDia(grupo, dia);
            const totalProyectadoDia = horasOcupadasDia + horasQuePideEsteGrupoDia;

            if (totalProyectadoDia > this._limiteHorasDiarias) {
                return {
                    resultadoExitoso: false,
                    motivo: `Asignarlo superaria la carga diaria maxima el Dia ${dia}. Carga actual (${horasOcupadasDia}h) + Grupo a asignar (${horasQuePideEsteGrupoDia}h) = ${totalProyectadoDia}h (Limite: ${this._limiteHorasDiarias}h).`
                };
            }
        }

        return {
            resultadoExitoso: true,
            motivo: `La asignacion es valida. No supera el limite de ${this._limiteHorasDiarias} hrs diarias en los dias de clase.`
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

export class ReglaAsignacionGlobal extends ReglaBase {
    constructor() {
        super('REGLA_ASIGNACION_GLOBAL');
    }

    evaluar(_profesor: ProfesorDTO, grupo: GrupoDTO, grafo: GrafoBipartito): EvaluacionRegla {
        if (grafo.asignacionesInversas.has(grupo.idUeaGrupo)) {
            const colision = grafo.asignacionesInversas.get(grupo.idUeaGrupo);
            return {
                resultadoExitoso: false,
                motivo: `El grupo ya ha sido asignado al profesor ${colision}.`
            };
        }

        return {
            resultadoExitoso: true,
            motivo: 'El grupo no se encuentra asignado a ningún profesor.'
        };
    }
}

export interface ReglaIgnorarGruposOpciones {
    /**
     * Permite que el GRASP asigne grupos SAI/CPRO automáticamente. Default: false.
     * NINGÚN call-site de producción debe pasarlo en true; existe solo como opt-in explícito.
     */
    asignarAutomaticamente?: boolean;
}

export class ReglaIgnorarGrupos extends ReglaBase {
    private static readonly GRUPOS_IGNORADOS = ['SAI', 'PRO'];
    private readonly _opciones: ReglaIgnorarGruposOpciones;

    constructor(opciones: ReglaIgnorarGruposOpciones = {}) {
        super('REGLA_IGNORAR_GRUPOS');
        this._opciones = opciones;
    }

    /**
     * Limpia y tokeniza la clave del grupo, luego verifica si algún token
     * coincide exactamente con SAI o CPRO. Evita falsos positivos como "SAINT".
     *
     * Excepciones (espejo de solution/rules/ReglasImplementacion.ts):
     *  1. `opciones.asignarAutomaticamente === true` → éxito sin subestado (opt-in global).
     *  2. Contexto manual con `asignacionGruposIgnorados.asignarManualmente === true` →
     *     éxito con subestado `EXCEPCION_GRUPO_IGNORADO`.
     *  3. En cualquier otro caso el grupo SAI/CPRO es rechazado (hard-fail, como siempre).
     */
    evaluar(_profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito, contexto?: ContextoRegla): EvaluacionRegla {
        const nombreLimpio = grupo.claveGrupo.trim().toUpperCase();
        const ignorado = ReglaIgnorarGrupos.GRUPOS_IGNORADOS.find(tag => nombreLimpio.includes(tag));

        if (!ignorado) {
            return {
                resultadoExitoso: true,
                motivo: 'El grupo no es un grupo SAI o CPRO, puede ser asignado.'
            };
        }

        if (this._opciones.asignarAutomaticamente === true) {
            return {
                resultadoExitoso: true,
                motivo: `El grupo ${grupo.claveGrupo} (tipo SAI/CPRO) se permite por configuración explícita asignarAutomaticamente=true.`
            };
        }

        const esAsignacionManual = contexto?.modoAsignacion === 'manual';
        if (esAsignacionManual && contexto?.asignacionGruposIgnorados?.asignarManualmente === true) {
            return {
                resultadoExitoso: true,
                subestado: 'EXCEPCION_GRUPO_IGNORADO',
                excepcionesAplicadas: ['EXCEPCION_GRUPO_IGNORADO'],
                motivo: `Grupo ${grupo.claveGrupo} (tipo SAI/CPRO) asignado manualmente con autorización explícita.`
            };
        }

        return {
            resultadoExitoso: false,
            motivo: `El grupo ${grupo.claveGrupo} es ignorado por contener "${ignorado}" (tipo SAI/CPRO).`
        };
    }
}

export class ReglaProfesorVigente extends ReglaBase {
    constructor(
        _fileRegular: string = 'ecos_vigentes_con_horario_regular.json',
        _fileIrregular: string = 'ecos_vigentes_con_horario_irregular.json'
    ) {
        super('REGLA_PROFESOR_VIGENTE');
        ecosVigentesRegular ??= {};
        ecosVigentesIrregular ??= {};
    }

    evaluar(profesor: ProfesorDTO, _grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        const ecoStr = profesor.numeroEconomico.toString();
        if (ecosVigentesRegular![ecoStr] || ecosVigentesIrregular![ecoStr]) {
            return { resultadoExitoso: true, motivo: 'El profesor es vigente.' };
        }
        return {
            resultadoExitoso: false,
            motivo: `El profesor ${profesor.numeroEconomico} no figura como vigente en los catálogos.`
        };
    }
}

export class ReglaAreasVistas extends ReglaBase {
    constructor(_fileAreaProfesor: string = 'area_profesor.json') {
        super('REGLA_AREAS_VISTAS');
        areaProfesor ??= {};
    }

    evaluar(profesor: ProfesorDTO, grupo: GrupoDTO, _grafo: GrafoBipartito): EvaluacionRegla {
        const ecoStr = profesor.numeroEconomico.toString();
        const areasVistas = areaProfesor![ecoStr] || [];
        if (areasVistas.includes(grupo.idArea.toString())) {
            return { resultadoExitoso: true, motivo: 'El área del grupo es un área históricamente vista por el profesor.' };
        }
        return {
            resultadoExitoso: false,
            motivo: `El área de la UEA (${grupo.idArea}) no ha sido vista históricamente por el profesor.`
        };
    }
}
