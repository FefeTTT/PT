import React, { useState } from 'react';
import { GrafoBipartito } from '../../../Code/models/GrafoBipartito';
import { GraphFSMAsignador, StepSnapshot } from '../../../Code/fsm/GraphFSMAsignador';
import { ReglasPipeline } from '../../../Code/rules/ReglasPipeline';
import { EstadoAsignacion } from '../../../Code/fsm/FSMAsignador';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface AsignacionInput {
    numeroEconomico: number;
    idUeaGrupo: number;
}

export const FSMVisualizerModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [jsonInput, setJsonInput] = useState<string>('[\n  {\n    "numeroEconomico": 47399,\n    "idUeaGrupo": 1\n  }\n]');
    // Step managers
    const [assignmentSnapshots, setAssignmentSnapshots] = useState<StepSnapshot[][]>([]);
    const [globalAssignmentIdx, setGlobalAssignmentIdx] = useState<number>(-1);
    const [localStepIdx, setLocalStepIdx] = useState<number>(-1);

    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleLoadJson = async () => {
        setIsLoading(true);
        setAssignmentSnapshots([]);
        setGlobalAssignmentIdx(-1);
        setLocalStepIdx(-1);

        try {
            const parsedInput: AsignacionInput[] = JSON.parse(jsonInput);

            if (!Array.isArray(parsedInput) || parsedInput.length === 0) {
                alert("El JSON debe ser un array con al menos un objeto {numeroEconomico, idUeaGrupo}");
                setIsLoading(false);
                return;
            }

            const grafoCompartido = new GrafoBipartito();

            for (let i = 0; i < parsedInput.length; i++) {
                const req = parsedInput[i];
                const response = await fetch(`controlador/testFSMDatos.php?numeroEconomico=${req.numeroEconomico}&idUeaGrupo=${req.idUeaGrupo}`);
                const data = await response.json();

                if (!data.ok) {
                    alert(`Error al cargar datos BD para ${req.numeroEconomico} - ${req.idUeaGrupo}: ${data.error}`);
                    setIsLoading(false);
                    return;
                }

                grafoCompartido.registrarProfesor(data.profesor);
                grafoCompartido.registrarGrupo(data.grupo);
            }

            const reglasPipeline = ReglasPipeline.crear(24);

            const motorLocal = new GraphFSMAsignador(grafoCompartido, reglasPipeline);

            const calculatedSnapshots: StepSnapshot[][] = [];
            for (const req of parsedInput) {
                const snaps = motorLocal.procesarAsignacionStepByStep(req.numeroEconomico, req.idUeaGrupo);
                calculatedSnapshots.push(snaps);
            }

            setAssignmentSnapshots(calculatedSnapshots);
            setGlobalAssignmentIdx(0);
            setLocalStepIdx(0);

        } catch (error) {
            alert("Error procesando JSON de entrada: " + error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNextStep = () => {
        if (globalAssignmentIdx < 0) return;
        const currentSnaps = assignmentSnapshots[globalAssignmentIdx];

        if (localStepIdx < currentSnaps.length - 1) {
            setLocalStepIdx(localStepIdx + 1);
        } else if (globalAssignmentIdx < assignmentSnapshots.length - 1) {
            setGlobalAssignmentIdx(globalAssignmentIdx + 1);
            setLocalStepIdx(0);
        }
    };

    const handlePrevStep = () => {
        if (globalAssignmentIdx < 0) return;

        if (localStepIdx > 0) {
            setLocalStepIdx(localStepIdx - 1);
        } else if (globalAssignmentIdx > 0) {
            setGlobalAssignmentIdx(globalAssignmentIdx - 1);
            setLocalStepIdx(assignmentSnapshots[globalAssignmentIdx - 1].length - 1);
        }
    };

    if (!isOpen) return null;

    let visibleSnapshots: StepSnapshot[] = [];
    let currentSnapshot: StepSnapshot | null = null;

    if (globalAssignmentIdx >= 0 && assignmentSnapshots[globalAssignmentIdx]) {
        visibleSnapshots = assignmentSnapshots[globalAssignmentIdx].slice(0, localStepIdx + 1).reverse();
        currentSnapshot = assignmentSnapshots[globalAssignmentIdx][localStepIdx];
    }

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">FSM Visualizer (Paso a Paso)</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">

                        <div className="row mb-4">
                            <div className="col-md-5">
                                <label className="form-label fw-bold">Entrada JSON Array</label>
                                <textarea
                                    className="form-control"
                                    rows={6}
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                />
                                <button className="btn btn-primary mt-2 w-100" onClick={handleLoadJson} disabled={isLoading}>
                                    {isLoading ? 'Cargando/Iniciando motor...' : 'Cargar JSON y Comenzar'}
                                </button>
                            </div>
                            <div className="col-md-7">
                                <label className="form-label fw-bold">Controles del FSM Wrapper</label>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-secondary" onClick={handlePrevStep} disabled={globalAssignmentIdx <= 0 && localStepIdx <= 0}>
                                        &laquo; Paso Anterior
                                    </button>
                                    <button className="btn btn-success" onClick={handleNextStep} disabled={globalAssignmentIdx === -1 || (globalAssignmentIdx === assignmentSnapshots.length - 1 && localStepIdx === assignmentSnapshots[globalAssignmentIdx].length - 1)}>
                                        Siguiente Paso &raquo;
                                    </button>
                                </div>
                                <div className="mt-2 text-muted small">
                                    Asignación {globalAssignmentIdx + 1} de {assignmentSnapshots.length} procesadas.
                                </div>
                            </div>
                        </div>

                        {/* Fila de Historial / Reversing UI */}
                        {globalAssignmentIdx >= 0 && currentSnapshot && (
                            <div className="card bg-light">
                                <div className="card-header fw-bold d-flex justify-content-between align-items-center">
                                    <span>
                                        Evaluando [{globalAssignmentIdx + 1}/{assignmentSnapshots.length}]: Prof. {currentSnapshot?.profesorInfo?.numeroEconomico} - Grupo {currentSnapshot?.grupoInfo?.idUeaGrupo}
                                    </span>
                                    <span className="badge bg-dark">
                                        Paso actual: {localStepIdx + 1} / {assignmentSnapshots[globalAssignmentIdx].length}
                                    </span>
                                </div>
                                <div className="card-body p-0">
                                    <table className="table table-hover table-bordered mb-0">
                                        <thead className="table-dark">
                                            <tr>
                                                <th>Regla Evaluada</th>
                                                <th>Estado Retornado</th>
                                                <th>Detalle / Motivo</th>
                                                <th>Métricas/Entradas (Snapshot)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleSnapshots.map((snap) => {
                                                const isLatest = snap.stepIndex === localStepIdx;

                                                let displayEstado = snap.estadoAsignacion as string;
                                                let badgeClass = 'bg-secondary';

                                                if (snap.estadoAsignacion === EstadoAsignacion.ASIGNACION_OK) {
                                                    badgeClass = 'bg-success';
                                                } else if (snap.estadoAsignacion === EstadoAsignacion.ERROR_REGLA) {
                                                    badgeClass = 'bg-danger';
                                                } else if (snap.estadoAsignacion === EstadoAsignacion.EVALUANDO) {
                                                    if (isLatest) {
                                                        badgeClass = 'bg-info text-dark';
                                                        displayEstado = 'EVALUANDO';
                                                    } else {
                                                        badgeClass = 'bg-primary';
                                                        displayEstado = 'APROBADO';
                                                    }
                                                } else if (snap.estadoAsignacion === EstadoAsignacion.INICIO) {
                                                    badgeClass = 'bg-secondary';
                                                }

                                                return (
                                                    <tr key={snap.stepIndex} className={isLatest ? 'table-warning fw-bold' : ''}>
                                                        <td>{snap.reglaNombre || 'FSM CORE'}</td>
                                                        <td>
                                                            <span className={`badge ${badgeClass}`}>
                                                                {displayEstado}
                                                            </span>
                                                        </td>
                                                        <td className={snap.resultadoRegla === false ? 'text-danger' : 'text-success'}>
                                                            {snap.motivo}
                                                        </td>
                                                        <td className="small" style={{ maxWidth: '200px' }}>
                                                            Grafo Total Profesores: {snap.grafoSnapshot.profesores.size}<br />
                                                            Grafo Asignaciones: {snap.grafoSnapshot.asignacionesInversas.size}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {globalAssignmentIdx >= 0 && currentSnapshot && (
                            <div className="mt-4">
                                <label className="form-label fw-bold">Consola de Salida / Contexto FSM (Snapshot Actual)</label>
                                <pre className="bg-dark text-light p-3 rounded" style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '13px' }}>
                                    {JSON.stringify({
                                        profesorInfo: currentSnapshot.profesorInfo,
                                        grupoInfo: currentSnapshot.grupoInfo,
                                        estadoInterno: {
                                            reglaEvaluada: currentSnapshot.reglaNombre,
                                            resultado: currentSnapshot.resultadoRegla,
                                            motivo: currentSnapshot.motivo
                                        }
                                    }, null, 2)}
                                </pre>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};
