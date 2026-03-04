import { useState, useCallback, useRef } from 'react';
import { GrafoBipartito } from '../../Code/models/GrafoBipartito';
import { GreedyOrchestrator } from '../../Code/greedy/GreedyOrchestrator';
import { ResultadoGreedy } from '../../Code/greedy/GreedyTypes';
import { EstrategiaOrdenamiento } from '../../Code/greedy/GreedyTypes';
import { ProfesorDTO, GrupoDTO } from '../../Code/types/FrontendTypes';

/**
 * Hook de React para ejecutar el GreedyOrchestrator.
 * Mantiene un snapshot pre-ejecución del grafo para rollback atómico.
 */
export function useGreedyAsignacion(estrategia?: EstrategiaOrdenamiento, limiteHoras: number = 24) {
    const [resultado, setResultado] = useState<ResultadoGreedy | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [grafoFinal, setGrafoFinal] = useState<GrafoBipartito | null>(null);

    // Snapshot del grafo antes de la ejecución para rollback
    const _snapshotRef = useRef<GrafoBipartito | null>(null);

    const ejecutar = useCallback((profesores: ProfesorDTO[], grupos: GrupoDTO[]) => {
        setIsProcessing(true);
        setResultado(null);

        // Guardar snapshot pre-ejecución para rollback
        const grafoPreEjecucion = new GrafoBipartito();
        profesores.forEach(p => grafoPreEjecucion.registrarProfesor(p));
        grupos.forEach(g => grafoPreEjecucion.registrarGrupo(g));
        _snapshotRef.current = grafoPreEjecucion;

        try {
            const orquestador = new GreedyOrchestrator(estrategia, limiteHoras);
            const res = orquestador.ejecutar(profesores, grupos);

            // Reconstruir grafo final con las asignaciones exitosas
            const grafoResultado = new GrafoBipartito();
            profesores.forEach(p => grafoResultado.registrarProfesor(p));
            grupos.forEach(g => grafoResultado.registrarGrupo(g));
            for (const asignacion of res.asignaciones) {
                grafoResultado.asignarMutable(asignacion.numeroEconomico, asignacion.idUeaGrupo);
            }

            setResultado(res);
            setGrafoFinal(grafoResultado);
        } catch (error) {
            console.error('[useGreedyAsignacion] Error en ejecución:', error);
            setResultado(null);
            setGrafoFinal(null);
        } finally {
            setIsProcessing(false);
        }
    }, [estrategia, limiteHoras]);

    /** Revierte al estado previo a la ejecución del Greedy. */
    const rollback = useCallback(() => {
        setResultado(null);
        setGrafoFinal(_snapshotRef.current);
    }, []);

    return {
        resultado,
        isProcessing,
        grafoFinal,
        ejecutar,
        rollback
    };
}
