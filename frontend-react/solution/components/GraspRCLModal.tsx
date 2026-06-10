import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { IAssignmentData } from '../core/IAssignmentData';
import { GrafoBipartito } from '../models/GrafoBipartito';
import { GraphFSMAsignador, StepSnapshot } from '../fsm/GraphFSMAsignador';
import { ReglasPipeline } from '../rules/ReglasPipeline';
import { ProfesorDTO, GrupoDTO } from '../types/AssignmentTypes';
import { EstadoAsignacion } from '../fsm/FSMAsignador';

// Constants
const AREAS_VALIDAS = [1100, 1111, 1112, 1113];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    dataService: IAssignmentData;
}

interface TupleCandidato {
    eco: number;
    uea: number;
    idUeaGrupo: number;
    claveGrupo: string;
    score: number;
    fsmValido?: boolean;
    errorMotivo?: string;
}

export const GraspRCLModal: React.FC<Props> = ({ isOpen, onClose, dataService }) => {
    const [claveArea, setClaveArea] = useState<number>(1100);
    const [isLoading, setIsLoading] = useState(false);
    
    // Core data
    const [grafo, setGrafo] = useState<GrafoBipartito>(new GrafoBipartito());
    const [motorFSM, setMotorFSM] = useState<GraphFSMAsignador | null>(null);

    // Tuples & State
    const [tuplasTodas, setTuplasTodas] = useState<TupleCandidato[]>([]);
    const [tuplasEvaluadas, setTuplasEvaluadas] = useState<TupleCandidato[]>([]);
    const [alpha, setAlpha] = useState<number>(0.5);

    // Selected Tuple for FSM Evaluation Visualizer
    const [tuplaVisualizar, setTuplaVisualizar] = useState<TupleCandidato | null>(null);
    const [fsmSnapshots, setFsmSnapshots] = useState<StepSnapshot[]>([]);

    useEffect(() => {
        // Init logic if needed
    }, []);

    const fetchAndGenerateTuples = async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getCandidatosPorArea(claveArea);
            if (!data.candidatos || data.candidatos.length === 0) {
                alert('No se encontraron candidatos para esta área.');
                setIsLoading(false);
                return;
            }

            const nuevoGrafo = new GrafoBipartito();

            data.profesores.forEach((p: ProfesorDTO) => {
                nuevoGrafo.registrarProfesor(p);
            });
            data.grupos.forEach((g: GrupoDTO) => {
                nuevoGrafo.registrarGrupo(g);
            });

            const reglas = [...ReglasPipeline.getReglasFastFail(), ...ReglasPipeline.getReglasRestantes()];
            const motor = new GraphFSMAsignador(nuevoGrafo, reglas);

            setGrafo(nuevoGrafo);
            setMotorFSM(motor);

            // Generate tuples with mockup score: rand(0.15, 0.75)
            const tuplas: TupleCandidato[] = data.candidatos.map((c: any) => ({
                eco: c.eco,
                uea: c.uea,
                idUeaGrupo: c.clave_grupo.idUeaGrupo,
                claveGrupo: c.clave_grupo.claveGrupo,
                score: Math.random() * (0.75 - 0.15) + 0.15
            }));

            setTuplasTodas(tuplas);
            setTuplasEvaluadas([]); // Re-evaluate whenever tuples are fetched
            setTuplaVisualizar(null);
            setFsmSnapshots([]);

        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Re-evaluate all tuples implicitly behind the scenes to know who is valid
    const evaluarTuplasImplicitamente = useCallback(() => {
        if (!motorFSM) return;
        const evaluadas = tuplasTodas.map(tupla => {
            // Evaluamos en modo silencioso
            const snapshots = motorFSM.procesarAsignacionStepByStep(tupla.eco, tupla.idUeaGrupo);
            const ultimo = snapshots[snapshots.length - 1];
            return {
                ...tupla,
                fsmValido: ultimo && ultimo.estadoAsignacion === EstadoAsignacion.ASIGNACION_OK,
                errorMotivo: ultimo && ultimo.estadoAsignacion !== EstadoAsignacion.ASIGNACION_OK ? ultimo.motivo : undefined
            };
        });
        setTuplasEvaluadas(evaluadas);
    }, [motorFSM, tuplasTodas]);

    // Update evaluated list when Grafo changes or tuples change
    useEffect(() => {
        if (tuplasTodas.length > 0 && motorFSM) {
            evaluarTuplasImplicitamente();
        }
    }, [motorFSM, tuplasTodas, grafo.asignacionesInversas.size]);

    const handleVerFSM = (tupla: TupleCandidato) => {
        if (!motorFSM) return;
        setTuplaVisualizar(tupla);
        // Generamos los pasos pero NO asignamos
        const snapshots = motorFSM.procesarAsignacionStepByStep(tupla.eco, tupla.idUeaGrupo);
        setFsmSnapshots(snapshots);
    };

    // Compute RCL
    const { validos, wMax, wMin, rclThreshold, rclCandidates } = useMemo(() => {
        const v = tuplasEvaluadas.filter(t => t.fsmValido);
        v.sort((a, b) => b.score - a.score);
        
        let maxValue = 0;
        let minValue = 0;
        let threshold = 0;
        let rcl: TupleCandidato[] = [];

        if (v.length > 0) {
            maxValue = v[0].score;
            minValue = v[v.length - 1].score;
            threshold = maxValue - alpha * (maxValue - minValue);
            rcl = v.filter(c => c.score >= threshold);
        }

        return {
            validos: v,
            wMax: maxValue,
            wMin: minValue,
            rclThreshold: threshold,
            rclCandidates: rcl
        };
    }, [tuplasEvaluadas, alpha]);

    const asignarSeleccionado = (tupla: TupleCandidato) => {
        if (!motorFSM || !grafo) return;
        // Asign it for real
        try {
            const nuevoGrafo = grafo.asignar(tupla.eco, tupla.idUeaGrupo);
            setGrafo(nuevoGrafo);
            // Updating motor with new grafo
            motorFSM.actualizarGrafo(nuevoGrafo); 
            // Re-evaluating will happen automatically because grafo.asignacionesInversas mutated
            
            // Generate COMPLETELY new scores to simulate a new GRASP iteration
             const tuplasConNuevoScore: TupleCandidato[] = tuplasTodas.map((c: TupleCandidato) => ({
                ...c,
                score: Math.random() * (0.75 - 0.15) + 0.15
            }));
            setTuplasTodas(tuplasConNuevoScore);
            alert(`Candidato ${tupla.eco} asignado al grupo ${tupla.claveGrupo}!`);
            
        } catch (e: any) {
             alert(`Error al asignar: ${e.message}`);
        }
    };

    const handleAsignarAleatorioFromRCL = () => {
        if (rclCandidates.length === 0) return;
        const idx = Math.floor(Math.random() * rclCandidates.length);
        const seleccionado = rclCandidates[idx];
        asignarSeleccionado(seleccionado);
    };

    if (!isOpen) return null;

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-fullscreen">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">GRASP Tuple Generation & RCL UI</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-3">
                        <div className="row mb-3 align-items-end">
                            <div className="col-auto">
                                <label className="form-label mb-1 fw-bold">Clave de Área</label>
                                <select 
                                    className="form-select" 
                                    value={claveArea} 
                                    onChange={e => setClaveArea(Number(e.target.value))}
                                >
                                    {AREAS_VALIDAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="col-auto">
                                <button className="btn btn-primary fw-bold" onClick={fetchAndGenerateTuples} disabled={isLoading}>
                                    {isLoading ? 'Cargando...' : '1. Generar Tuplas y Scores'}
                                </button>
                            </div>
                            <div className="col-md-4 ms-auto border rounded p-2 bg-light">
                                <label className="form-label mb-1 d-flex justify-content-between fw-bold">
                                    <span>2. Parámetro Alfa (RCL)</span>
                                    <span className="badge bg-secondary">{alpha.toFixed(2)}</span>
                                </label>
                                <input 
                                    type="range" className="form-range" 
                                    min="0" max="1" step="0.05" 
                                    value={alpha} 
                                    onChange={e => setAlpha(parseFloat(e.target.value))}
                                />
                                <small className="text-muted d-block mt-1">0 = Greedy (sólo el mejor), 1 = Random (todos válidos)</small>
                            </div>
                        </div>

                        <div className="row h-100" style={{ minHeight: '75vh' }}>
                            {/* LEFT PANEL: Todas las Tuplas */}
                            <div className="col-md-3 d-flex flex-column border-end">
                                <h6 className="text-secondary fw-bold border-bottom pb-2">Tuplas Generadas ({tuplasTodas.length})</h6>
                                <p className="mb-2 text-muted" style={{fontSize: '0.85rem'}}>
                                    Haga clic en una tupla para visualizar su evaluación FSM.
                                </p>
                                <div className="list-group flex-grow-1 overflow-auto pe-2" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                                    {tuplasEvaluadas.map((t, idx) => {
                                        const isSelected = tuplaVisualizar?.eco === t.eco && tuplaVisualizar?.idUeaGrupo === t.idUeaGrupo;
                                        return (
                                        <button 
                                            key={idx}
                                            className={`list-group-item list-group-item-action mb-1 rounded border shadow-sm ${isSelected ? 'active' : ''}`}
                                            onClick={() => handleVerFSM(t)}
                                            style={{ cursor: 'pointer', borderLeft: t.fsmValido ? '4px solid #28a745' : '4px solid #dc3545' }}
                                        >
                                            <div className="d-flex w-100 justify-content-between align-items-center">
                                                <small className={`mb-1 fw-bold ${isSelected ? 'text-white' : 'text-dark'}`}>Eco: {t.eco}</small>
                                                <small className={`fw-bold ${isSelected ? 'text-white' : 'text-primary'}`}>Score: {t.score.toFixed(3)}</small>
                                            </div>
                                            <p className={`mb-1 ${isSelected ? 'text-white' : 'text-dark'}`} style={{fontSize: '0.85rem'}}>UEA: {t.uea} - Grupo: {t.claveGrupo}</p>
                                            <small>{t.fsmValido ? <span className="badge bg-success">✔ FSM Ok</span> : <span className="badge bg-danger">✖ Rechazado</span>}</small>
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* CENTER PANEL: FSM Visualizer */}
                            <div className="col-md-5 d-flex flex-column border-end pe-3 ps-3">
                                <h6 className="text-secondary fw-bold border-bottom pb-2">Evaluador de Reglas FSM</h6>
                                <p className="text-muted mb-2" style={{fontSize: '0.85rem'}}>
                                    Visualización paso a paso de la tupla seleccionada
                                </p>
                                
                                {!tuplaVisualizar ? (
                                    <div className="h-100 d-flex align-items-center justify-content-center text-muted fs-5">
                                        Selecciona una tupla de la izquierda para analizar...
                                    </div>
                                ) : (
                                    <div className="card shadow-sm border h-100 p-3 overflow-auto bg-light" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                                        <h5 className="mb-3 text-dark fw-bold border-bottom pb-2">Analizando: Profesor {tuplaVisualizar.eco} ➔ Grupo {tuplaVisualizar.claveGrupo}</h5>
                                        
                                        <div className="timeline-fsm px-2">
                                            {fsmSnapshots.map((snap, i) => {
                                                if(snap.estadoAsignacion === EstadoAsignacion.INICIO || snap.estadoAsignacion === EstadoAsignacion.EVALUANDO && !snap.reglaNombre) return null;
                                                
                                                const isFail = snap.estadoAsignacion === EstadoAsignacion.ERROR_REGLA;
                                                const isSuccess = snap.resultadoRegla;
                                                const isOkFinal = snap.estadoAsignacion === EstadoAsignacion.ASIGNACION_OK;

                                                let bgColor = 'bg-secondary';
                                                let icon = '✔';
                                                if (isSuccess || isOkFinal) { bgColor = 'bg-success'; icon = '✅'; }
                                                if (isFail) { bgColor = 'bg-danger'; icon = '❌'; }

                                                const isGlobal = snap.reglaNombre?.includes('ASIGNACION_GLOBAL');
                                                const isHorarioLaboral = snap.reglaNombre?.includes('HorarioLaboral');
                                                const isTraslape = snap.reglaNombre?.includes('Traslape');

                                                return (
                                                    <div key={i} className="mb-3 d-flex align-items-start">
                                                        <div className={`badge ${bgColor} rounded-circle p-2 me-3 fs-5 shadow-sm`}>{icon}</div>
                                                        <div className="w-100 bg-white rounded p-2 border shadow-sm">
                                                            <div className="fw-bold d-flex align-items-center text-dark">
                                                                {snap.reglaNombre || snap.estadoAsignacion}
                                                                {isGlobal && <span className="badge bg-dark ms-2" style={{fontSize: '0.70rem'}}>Valida ocupación O(1) globalmente</span>}
                                                                {isTraslape && <span className="badge bg-danger ms-2" style={{fontSize: '0.70rem'}}>Búsqueda de empalmes con asignaciones previas locales del profesor</span>}
                                                                {isHorarioLaboral && <span className="badge bg-warning text-dark ms-2" style={{fontSize: '0.70rem'}}>Contrato vs horario de grupo</span>}
                                                            </div>
                                                            <div className="text-secondary mt-1 fw-semibold" style={{fontSize: '0.85rem'}}>
                                                                {snap.motivo}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {tuplaVisualizar.fsmValido && (
                                            <div className="mt-4 pt-3 border-top text-center">
                                                 <div className="alert alert-success fw-bold p-2 shadow-sm">Esta tupla fue APROBADA (Score: {tuplaVisualizar.score.toFixed(3)})</div>
                                            </div>
                                        )}
                                        {!tuplaVisualizar.fsmValido && (
                                            <div className="mt-2 pt-2 border-top text-center">
                                                 <div className="alert alert-danger fw-bold p-2 shadow-sm">Esta tupla fue RECHAZADA por la FSM</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* RIGHT PANEL: RCL and Assignment */}
                            <div className="col-md-4 d-flex flex-column ps-3">
                                <h6 className="text-secondary fw-bold border-bottom pb-2">Restricted Candidate List (RCL)</h6>
                                <p className="text-muted mb-2" style={{fontSize: '0.85rem'}}>
                                    Tuplas válidas que superan el umbral α.
                                </p>
                                
                                <div className="card bg-white border p-3 mb-3 text-center shadow-sm">
                                    <h6 className="text-dark fw-bold mb-1">Métricas de Restricción</h6>
                                    <div className="d-flex justify-content-around mt-2">
                                        <div className="text-muted"><small>Max Score</small><br/><span className="fs-5 fw-bold text-dark">{wMax.toFixed(3)}</span></div>
                                        <div className="text-muted"><small>Min Score</small><br/><span className="fs-5 fw-bold text-dark">{wMin.toFixed(3)}</span></div>
                                    </div>
                                    <div className="mt-3 py-2 bg-light border rounded">
                                        <span className="text-muted fw-bold">RCL Threshold:</span>
                                        <span className="ms-2 fs-5 fw-bold text-primary">≥ {rclThreshold.toFixed(3)}</span>
                                    </div>
                                </div>

                                <div className="d-grid mb-3 shadow-sm">
                                    <button 
                                        className="btn btn-success fw-bold p-3 fs-6" 
                                        disabled={rclCandidates.length === 0}
                                        onClick={handleAsignarAleatorioFromRCL}
                                    >
                                        🎰 Confirmar tupla aleatoria desde la RCL ({rclCandidates.length})
                                    </button>
                                </div>

                                <div className="flex-grow-1 overflow-auto pe-2" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                                    {validos.map((t, idx) => {
                                        const inRcl = t.score >= rclThreshold;
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`p-2 mb-2 rounded border shadow-sm d-flex justify-content-between align-items-center ${inRcl ? 'bg-white border-success' : 'bg-light border-light opacity-50'}`}
                                            >
                                                <div>
                                                    <div className={`fw-bold ${inRcl ? 'text-dark' : 'text-secondary'}`}>Prof: {t.eco} ➔ Grupo: {t.claveGrupo}</div>
                                                    <small className={`${inRcl ? 'text-primary fw-bold' : 'text-muted'}`}>Score: {t.score.toFixed(3)}</small>
                                                </div>
                                                {inRcl ? (
                                                    <span className="badge bg-success shadow-sm">En RCL</span>
                                                ) : (
                                                    <span className="badge bg-secondary">Excluido</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {validos.length === 0 && <div className="text-center text-muted fw-bold mt-5">Sin candidatos válidos</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
