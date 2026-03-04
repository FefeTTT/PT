import { useState, useCallback } from 'react';
import { GrafoBipartito } from '../../Code/models/GrafoBipartito';
import { FSMAsignador, ResultadoAsignacion, EstadoAsignacion } from '../../Code/fsm/FSMAsignador';
import { ReglasPipeline } from '../../Code/rules/ReglasPipeline';
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
        const reglasPipeline = ReglasPipeline.crear(24);

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
