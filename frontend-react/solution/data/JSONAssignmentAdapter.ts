import { ProfesorDTO, GrupoDTO, FranjaHorariaDTO, HorarioDB_DTO } from '../types/AssignmentTypes';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { EstadoAsignacion } from '../fsm/FSMAsignador';
import { FSMFactory } from '../fsm/FSMFactory';
import { ReglasPipeline } from '../rules/ReglasPipeline';

const mapDiasAIndex: Record<string, number> = {
    'L': 1,
    'M': 2,
    'Mi': 3,
    'J': 4,
    'V': 5
};

export interface RechazoGrupoIngesta {
    idUeaGrupo: number;
    ueaClave: number;
    claveGrupo: string;
    reglaFallo: string;
    motivo: string;
}

export class JSONAssignmentAdapter {
    /**
     * Extrae profesores recibiendo los objetos JSON en memoria (Para uso en Browser sin FS)
     */
    static parsearProfesoresDesdeObjeto(rawEcoHorario: any, rawAreaProfesor: any, rawIrregulares?: any): ProfesorDTO[] {
        const profesores: ProfesorDTO[] = [];
        JSONAssignmentAdapter.procesarRegulares(rawEcoHorario, rawAreaProfesor, profesores);
        if (rawIrregulares) {
            JSONAssignmentAdapter.procesarIrregulares(rawIrregulares, rawAreaProfesor, profesores);
        }
        return profesores;
    }

    private static procesarRegulares(rawEcoHorario: any, rawAreaProfesor: any, profesores: ProfesorDTO[]): void {
        for (const [ecoStr, horarioStr] of Object.entries(rawEcoHorario)) {
            const numeroEconomico = parseInt(ecoStr, 10);
            if (isNaN(numeroEconomico)) continue;

            const areasStringArr = (rawAreaProfesor as any)[ecoStr] || [];
            
            const [horaInicioStr, horaFinStr] = (horarioStr as string).split('-');
            
            const horariosContratacion: HorarioDB_DTO[] = [
                {
                    idDiasDeTrabajo: 'L-V',
                    horaInicio: `${horaInicioStr}:00`,
                    horaFin: `${horaFinStr}:00`
                }
            ];

            profesores.push({
                numeroEconomico,
                idArea: areasStringArr,
                horariosContratacion
            });
        }
    }

    private static procesarIrregulares(rawIrregulares: any, rawAreaProfesor: any, profesores: ProfesorDTO[]): void {
        for (const [ecoStr, data] of Object.entries(rawIrregulares)) {
            const numeroEconomico = parseInt(ecoStr, 10);
            if (isNaN(numeroEconomico)) continue;

            const areasStringArr = (rawAreaProfesor as any)[ecoStr] || [];
            
            const horariosContratacion: HorarioDB_DTO[] = [];
            const inferidoArr = (data as any).inferido || [];
            
            for (const franja of inferidoArr) {
                let hIn = franja.inicio;
                let hOut = franja.fin;
                if (hIn.split(':').length === 2) hIn += ":00";
                if (hOut.split(':').length === 2) hOut += ":00";
                
                horariosContratacion.push({
                    idDiasDeTrabajo: franja.dia,
                    horaInicio: hIn,
                    horaFin: hOut
                });
            }

            profesores.push({
                numeroEconomico,
                idArea: areasStringArr,
                horariosContratacion
            });
        }
    }

    /**
     * Extrae grupos de la programación de grupos recibiendo el objeto JSON en memoria (Para uso en Browser sin FS)
     */
    static parsearGruposDesdeObjeto(rawProg: any): GrupoDTO[] {
        const grupos: GrupoDTO[] = [];
        let globalIdCounter = 1;

        for (const [ueaStr, subgruposArr] of Object.entries(rawProg)) {
            const idAreaUEA = ueaStr.substring(0, 4);
            const ueaClave = parseInt(ueaStr, 10);

            for (const subgrupoObj of (subgruposArr as any[])) {
                if (!subgrupoObj.horario) continue; 

                const claveGrupo = subgrupoObj.grupo; 
                const franjasDto: FranjaHorariaDTO[] = [];
                const horariopipes = (subgrupoObj.horario as string).split('|');

                for (const fragment of horariopipes) {
                    const primerCol = fragment.indexOf(':');
                    const diaRaw = fragment.substring(0, primerCol);
                    const rangeRaw = fragment.substring(primerCol + 1); 
                    
                    const [inicioHm, finHm] = rangeRaw.split('-');
                    const [inH, inM] = inicioHm.split(':').map(Number);
                    const [outH, outM] = finHm.split(':').map(Number);
                    
                    const diaNum = mapDiasAIndex[diaRaw];
                    if (diaNum) {
                        franjasDto.push({
                            dia: diaNum,
                            horaInicio: inH + (inM / 60),
                            horaFin: outH + (outM / 60)
                        });
                    }
                }

                if (franjasDto.length > 0) {
                    grupos.push({
                        idUeaGrupo: globalIdCounter++,
                        idGrupo: globalIdCounter * 100, // Dummy
                        claveGrupo,
                        idArea: idAreaUEA,
                        ueaClave,
                        horarios: franjasDto,
                        horarioStringRaw: subgrupoObj.horario
                    });
                }
            }
        }
        return grupos;
    }

    /**
     * Aplica una FSM de ingesta con reglas puramente del grupo.
     * Esto evita que grupos SAI/CPRO o sin programacion entren al MCV,
     * al grafo inicial o a fases posteriores como reparacion/ejection.
     */
    static evaluarGruposPorFSMIngesta(grupos: GrupoDTO[]): {
        validos: GrupoDTO[];
        rechazados: RechazoGrupoIngesta[];
    } {
        const ecoIngesta = -1;
        const profesorIngesta: ProfesorDTO = {
            numeroEconomico: ecoIngesta,
            idArea: [],
            horariosContratacion: []
        };

        const grafo = new GrafoBipartito();
        grafo.registrarProfesor(profesorIngesta);
        for (const grupo of grupos) {
            grafo.registrarGrupo(grupo);
        }

        const fsmIngesta = FSMFactory.crear(grafo, ReglasPipeline.getReglasIngestaGrupos());
        const validos: GrupoDTO[] = [];
        const rechazados: RechazoGrupoIngesta[] = [];

        for (const grupo of grupos) {
            const evaluacion = fsmIngesta.procesarAsignacion(ecoIngesta, grupo.idUeaGrupo);
            if (evaluacion.estado === EstadoAsignacion.ASIGNACION_OK) {
                validos.push(grupo);
                continue;
            }

            rechazados.push({
                idUeaGrupo: grupo.idUeaGrupo,
                ueaClave: grupo.ueaClave,
                claveGrupo: grupo.claveGrupo,
                reglaFallo: evaluacion.error?.reglaFallo ?? 'INGESTA_DESCONOCIDA',
                motivo: evaluacion.error?.motivo ?? 'Grupo rechazado por la FSM de ingesta.'
            });
        }

        return { validos, rechazados };
    }

    static filtrarGruposPorFSMIngesta(
        grupos: GrupoDTO[],
        opciones: { log?: boolean } = {}
    ): GrupoDTO[] {
        const resultado = JSONAssignmentAdapter.evaluarGruposPorFSMIngesta(grupos);

        if (opciones.log !== false && resultado.rechazados.length > 0) {
            console.log(
                `FSM ingesta grupos: ${resultado.validos.length} validos, ${resultado.rechazados.length} rechazados.`
            );
            const resumen = resultado.rechazados.reduce<Record<string, number>>((acc, rechazo) => {
                acc[rechazo.reglaFallo] = (acc[rechazo.reglaFallo] ?? 0) + 1;
                return acc;
            }, {});
            console.table(resumen);
        }

        return resultado.validos;
    }

    /**
     * Identifica los MCV basados en cuellos de botella 
     * en relación con el número de franjas horarias y su duración.
     */
    static identificarMCV(grupos: GrupoDTO[]): void {
        const ueaFreq = new Map<number, number>();
        for (const g of grupos) {
            ueaFreq.set(g.ueaClave, (ueaFreq.get(g.ueaClave) || 0) + 1);
        }

        //   - Primero por rareza (UEAs con menos grupos totales en la programación)
        //   - Segundo por complejidad intrínseca (más franjas y más horas)
        const sorted = [...grupos].sort((a, b) => {
            const freqA = ueaFreq.get(a.ueaClave) || 0;
            const freqB = ueaFreq.get(b.ueaClave) || 0;

            if (freqA !== freqB) return freqA - freqB; // Ascendente por rareza

            const franjasA = a.horarios.length;
            const franjasB = b.horarios.length;
            if (franjasA !== franjasB) return franjasB - franjasA; // Descendente por complejidad
            
            const durA = a.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
            const durB = b.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
            return durB - durA;
        });

        console.log(`\n=== IDENTIFICANDO MCV (Most Constrained Variables) ===`);
        for (let i = 0; i < Math.min(10, sorted.length); i++) {
            const grp = sorted[i];
            const dur = grp.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
            console.log(`[Top ${i+1}] UEA: ${grp.ueaClave} - Gpo: ${grp.claveGrupo} | Franjas: ${grp.horarios.length} | Hrs totales: ${dur}`);
        }
        console.log(`=== FIN MCV ===\n`);
    }
}
