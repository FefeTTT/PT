import { useState, useCallback } from 'react';
import { GrafoBipartito } from '../../Code/models/GrafoBipartito';
import { FSMAsignador, ResultadoAsignacion, EstadoAsignacion } from '../../Code/fsm/FSMAsignador';
import { ReglaBase } from '../../Code/rules/ReglaBase';
import { ReglaArea, ReglaHorario, ReglaMaxN_Horas } from '../../Code/rules/ReglasImplementacion';
import { ProfesorDTO, GrupoDTO } from '../../Code/types/FrontendTypes';

export function useFSMAsignador() {
    // Estado local para mantener inamovilidad y que React propague
    const [grafo, setGrafo] = useState<GrafoBipartito>(new GrafoBipartito());

    const defaultRules: ReglaBase[] = [
        new ReglaArea(), // coincidir areas
        new ReglaHorario(), // que coincidan los horarios
        new ReglaMaxN_Horas(24) // maximo de horas semanales frente a grupos
    ];

    const inicializarDatos = useCallback((profesores: ProfesorDTO[], grupos: GrupoDTO[]) => {
        const tempGrafo = new GrafoBipartito();
        profesores.forEach(p => tempGrafo.registrarProfesor(p));
        grupos.forEach(g => tempGrafo.registrarGrupo(g));

        setGrafo(tempGrafo);
    }, []);

    const intentarAsignacion = useCallback((numeroEconomico: number, idUeaGrupo: number): ResultadoAsignacion => {
        const motor = new FSMAsignador(grafo, defaultRules);
        const resultado = motor.procesarAsignacion(numeroEconomico, idUeaGrupo);

        // Si estado es OK se reescribe el state de React con la copia del Grafo
        if (resultado.estado === EstadoAsignacion.ASIGNACION_OK && resultado.nuevoGrafo) {
            setGrafo(resultado.nuevoGrafo);
        }

        return resultado;
    }, [grafo, defaultRules]);

    return {
        grafoActual: grafo,
        inicializarDatos,
        intentarAsignacion
    };
}
