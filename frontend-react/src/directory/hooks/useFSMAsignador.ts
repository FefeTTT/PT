import { useState, useCallback } from 'react';
import { GrafoBipartito } from '../../Code/models/GrafoBipartito';
import { FSMAsignador, ResultadoAsignacion, EstadoAsignacion } from '../../Code/fsm/FSMAsignador';
import { ReglaBase } from '../../Code/rules/ReglaBase';
import { ReglaArea, ReglaHorario, ReglaMaxN_Horas, ReglaGrupoTieneProgramacion } from '../../Code/rules/ReglasImplementacion';
import { ProfesorDTO, GrupoDTO } from '../../Code/types/FrontendTypes';

export function useFSMAsignador() {
    const [grafo, setGrafo] = useState<GrafoBipartito>(new GrafoBipartito());
    const inicializarDatos = useCallback((profesores: ProfesorDTO[], grupos: GrupoDTO[]) => {
        const tempGrafo = new GrafoBipartito();

        profesores.forEach(p => tempGrafo.registrarProfesor(p));
        grupos.forEach(g => tempGrafo.registrarGrupo(g));

        setGrafo(tempGrafo);
    }, []);

    const intentarAsignacion = useCallback((numeroEconomico: number, idUeaGrupo: number): ResultadoAsignacion => {
        const reglasPipeline: ReglaBase[] = [
            new ReglaGrupoTieneProgramacion(),
            new ReglaArea(),
            new ReglaHorario(), // Normal validation for 99%
            new ReglaMaxN_Horas(24)
        ];

        const motor = new FSMAsignador(grafo, reglasPipeline);
        const resultado = motor.procesarAsignacion(numeroEconomico, idUeaGrupo);

        if (resultado.estado === EstadoAsignacion.ASIGNACION_OK && resultado.nuevoGrafo) {
            setGrafo(resultado.nuevoGrafo);
        }

        return resultado;
    }, [grafo]);

    return {
        grafoActual: grafo,
        inicializarDatos,
        intentarAsignacion
    };
}
