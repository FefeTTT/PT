import { useState, useCallback } from 'react';
import { GrafoBipartito } from '../../Code/models/GrafoBipartito';
import { FSMAsignador, ResultadoAsignacion, EstadoAsignacion } from '../../Code/fsm/FSMAsignador';
import { ReglaBase } from '../../Code/rules/ReglaBase';
import { ReglaArea, ReglaHorario, ReglaMaxN_Horas, ReglaGrupoTieneProgramacion, ReglaHorarioDisjunto } from '../../Code/rules/ReglasImplementacion';
import { ProfesorDTO, GrupoDTO, HorarioDB_DTO } from '../../Code/types/FrontendTypes';


function tieneHorariosDisjuntos(horarios: HorarioDB_DTO[]): boolean { // Función helper para detectar si un profesor tiene horarios disjuntos en un mismo día
    if (horarios.length <= 1) return false;

    const diasMap = new Map<string, { inicio: number, fin: number }[]>();

    for (const h of horarios) {
        if (!diasMap.has(h.idDiasDeTrabajo)) {
            diasMap.set(h.idDiasDeTrabajo, []);
        }

        const parseTime = (t: string) => {
            const [hh, mm] = t.split(':').map(Number);
            return hh + mm / 60;
        };

        diasMap.get(h.idDiasDeTrabajo)!.push({
            inicio: parseTime(h.horaInicio),
            fin: parseTime(h.horaFin)
        });
    }


    for (const bloques of diasMap.values()) {   // revisar por huecos en horario de contratación
        if (bloques.length <= 1) continue;

        bloques.sort((a, b) => a.inicio - b.inicio);

        let currentFin = bloques[0].fin;
        for (let i = 1; i < bloques.length; i++) {
            if (bloques[i].inicio > currentFin) {
                return true;
            }
            currentFin = Math.max(currentFin, bloques[i].fin);
        }
    }
    return false;
}

export function useFSMAsignador() {
    const [grafo, setGrafo] = useState<GrafoBipartito>(new GrafoBipartito());
    const [profesoresDisjuntos, setProfesoresDisjuntos] = useState<Set<number>>(new Set());

    const inicializarDatos = useCallback((profesores: ProfesorDTO[], grupos: GrupoDTO[]) => {
        const tempGrafo = new GrafoBipartito();
        const disjuntosSet = new Set<number>();

        profesores.forEach(p => {
            tempGrafo.registrarProfesor(p);
            if (tieneHorariosDisjuntos(p.horariosContratacion)) {
                disjuntosSet.add(p.numeroEconomico);
            }
        });

        grupos.forEach(g => tempGrafo.registrarGrupo(g));

        setProfesoresDisjuntos(disjuntosSet);
        setGrafo(tempGrafo);
    }, []);

    const intentarAsignacion = useCallback((numeroEconomico: number, idUeaGrupo: number): ResultadoAsignacion => {
        const reglasPipeline: ReglaBase[] = [
            new ReglaGrupoTieneProgramacion(),
            new ReglaArea(),
            new ReglaHorarioDisjunto(profesoresDisjuntos), // Active only for the 1%
            new ReglaHorario(), // Normal validation for 99%
            new ReglaMaxN_Horas(24)
        ];

        const motor = new FSMAsignador(grafo, reglasPipeline);
        const resultado = motor.procesarAsignacion(numeroEconomico, idUeaGrupo);

        if (resultado.estado === EstadoAsignacion.ASIGNACION_OK && resultado.nuevoGrafo) {
            setGrafo(resultado.nuevoGrafo);
        }

        return resultado;
    }, [grafo, profesoresDisjuntos]);

    return {
        grafoActual: grafo,
        inicializarDatos,
        intentarAsignacion
    };
}
