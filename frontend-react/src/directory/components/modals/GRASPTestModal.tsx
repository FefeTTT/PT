import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GrafoBipartito } from '../../../Code/models/GrafoBipartito';
import { GraphFSMAsignador } from '../../../Code/fsm/GraphFSMAsignador';
import { ReglasPipeline } from '../../../Code/rules/ReglasPipeline';
import { EstadoAsignacion } from '../../../Code/fsm/FSMAsignador';
import { ProfesorDTO, GrupoDTO } from '../../../Code/types/FrontendTypes';
import { UEA_AREA_MAPPING_REV } from '../../../scripts/utils/constants';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface Candidato {
    eco: number;
    uea: number;
    clave_grupo: {
        idUeaGrupo: number;
        claveGrupo: string;
        inicio: number | null;
        fin: number | null;
    };
}

interface ResultadoCandidato {
    eco: number;
    uea: number;
    grupo: string;
    resultado_fsm: 'OK' | 'FALLO';
    regla_fallo?: string;
    motivo_fsm?: string;
    penalizacion_soft: number | null;
    score_final: number | null;
    resultado_asignacion: 'ASIGNADO' | 'RECHAZADO';
}

interface DebugAsignacion {
    profesorEco: number;
    profesorNombre: string;
    profesorHorarios: any[];
    grupoId: number;
    grupoHorarios: any[];
    claveGrupo: string;
    claveUEA: number;
    nombreUEA: string;
    pSoft: number;
    scoreFinal: number;
}

type NodoFlujo =
    | 'IDLE'
    | 'JSON_GENERADO'
    | 'EVALUANDO_FSM'
    | 'FSM_RECHAZADO'
    | 'EVALUANDO_SOFT'
    | 'DECISION_ASIGNADO'
    | 'ASIGNADO_OK'
    | 'BUSCAR_TRIPLETA'
    | 'COMPLETADO';

const LAMBDA_SOFT = 0.5;
const LIMITE_HORAS_SEMANALES = 24;
const AREAS_VALIDAS = [1100, 1111, 1112, 1113];
const AUTO_ADVANCE_MS = 100;

const NODOS_FLUJO: { id: NodoFlujo; label: string; x: number; y: number }[] = [
    { id: 'JSON_GENERADO',     label: '1. JSON Generado',             x: 250, y: 50 },
    { id: 'EVALUANDO_FSM',    label: '2. FSM (Reglas Duras)',         x: 250, y: 130 },
    { id: 'FSM_RECHAZADO',    label: 'Rechazo por FSM',               x: 500, y: 190 },
    { id: 'EVALUANDO_SOFT',   label: '3. Evaluando P_soft',           x: 250, y: 210 },
    { id: 'DECISION_ASIGNADO', label: '¿Asignado?',                   x: 250, y: 300 },
    { id: 'ASIGNADO_OK',      label: 'Asignación Confirmada',         x: 100, y: 400 },
    { id: 'BUSCAR_TRIPLETA',  label: 'Buscar Siguiente',              x: 400, y: 400 },
];

const FLECHAS: { from: NodoFlujo; to: NodoFlujo; d: string }[] = [
    { from: 'JSON_GENERADO',     to: 'EVALUANDO_FSM',     d: 'M 250 70 L 250 110' },
    { from: 'EVALUANDO_FSM',     to: 'EVALUANDO_SOFT',    d: 'M 250 150 L 250 190' },
    { from: 'EVALUANDO_FSM',     to: 'FSM_RECHAZADO',     d: 'M 340 130 L 500 170' },
    { from: 'FSM_RECHAZADO',     to: 'BUSCAR_TRIPLETA',   d: 'M 500 210 L 400 380' },
    { from: 'EVALUANDO_SOFT',    to: 'DECISION_ASIGNADO', d: 'M 250 230 L 250 270' },
    { from: 'DECISION_ASIGNADO', to: 'ASIGNADO_OK',       d: 'M 210 300 L 100 380' },
    { from: 'DECISION_ASIGNADO', to: 'BUSCAR_TRIPLETA',   d: 'M 290 300 L 400 380' },
    { from: 'BUSCAR_TRIPLETA',   to: 'EVALUANDO_FSM',     d: 'M 490 400 L 610 400 L 610 130 L 343 130' },
];

function DiagramaFlujo({ nodoActivo, visitados }: { nodoActivo: NodoFlujo; visitados: Set<NodoFlujo> }) {
    const getColor = (id: NodoFlujo) => {
        if (id === nodoActivo) return { fill: '#27ae60', stroke: '#2ecc71', sw: 2.5 };
        if (id === 'FSM_RECHAZADO' && nodoActivo === 'FSM_RECHAZADO') return { fill: '#e74c3c', stroke: '#ff6b6b', sw: 2.5 };
        if (visitados.has(id)) return { fill: '#2980b9', stroke: '#3498db', sw: 1.5 };
        return { fill: '#2c2c54', stroke: '#444', sw: 1 };
    };

    return (
        <svg width="100%" height="450" viewBox="0 0 630 450" className="border shadow-sm bg-white rounded">
            <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#888" />
                </marker>
            </defs>
            {FLECHAS.map(({ d }, i) => {
                return (
                    <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke="#555" strokeWidth={2}
                        markerEnd="url(#arrowhead)"
                    />
                );
            })}
            {NODOS_FLUJO.map(nodo => {
                const c = getColor(nodo.id);
                const w = 180;
                const h = 40;

                return (
                    <g key={nodo.id}>
                        {nodo.id === 'DECISION_ASIGNADO' ? (
                            <polygon
                                points={`${nodo.x},${nodo.y - 25} ${nodo.x + 95},${nodo.y} ${nodo.x},${nodo.y + 25} ${nodo.x - 95},${nodo.y}`}
                                fill={nodoActivo === nodo.id ? '#f39c12' : c.fill}
                                stroke={nodoActivo === nodo.id ? '#f1c40f' : c.stroke}
                                strokeWidth={c.sw + 1}
                            />
                        ) : (
                            <rect
                                x={nodo.x - w / 2} y={nodo.y - h / 2}
                                width={w} height={h} rx={10}
                                fill={nodo.id === 'FSM_RECHAZADO' && nodoActivo === 'FSM_RECHAZADO' ? '#e74c3c' : c.fill}
                                stroke={c.stroke}
                                strokeWidth={c.sw + 1}
                            />
                        )}
                        <text
                            x={nodo.x} y={nodo.y + 5}
                            textAnchor="middle" fill="#ffffff"
                            fontSize={13} fontFamily="sans-serif"
                            fontWeight="bold"
                        >
                            {nodo.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function calcularPenalizacionSoft(
    numeroEconomico: number,
    grafo: GrafoBipartito,
    grupoCandidate: GrupoDTO
): { pSoft: number; scoreFinal: number } {
    const w_ij = 1.0;
    const gruposAsignados = grafo.adyacencias.get(numeroEconomico) || [];
    let horasOcupadas = 0;
    for (const idGrupo of gruposAsignados) {
        const g = grafo.grupos.get(idGrupo);
        if (g) {
            for (const f of g.horarios) {
                horasOcupadas += (f.horaFin - f.horaInicio);
            }
        }
    }
    let horasCandidate = 0;
    for (const f of grupoCandidate.horarios) {
        horasCandidate += (f.horaFin - f.horaInicio);
    }
    const pSoft = (horasOcupadas + horasCandidate) / LIMITE_HORAS_SEMANALES;
    const scoreFinal = w_ij - LAMBDA_SOFT * Math.min(pSoft, 1.0);
    return { pSoft: Math.round(pSoft * 1000) / 1000, scoreFinal: Math.round(scoreFinal * 1000) / 1000 };
}

export const GRASPTestModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [claveArea, setClaveArea] = useState<number>(1100);
    const [isLoadingJson, setIsLoadingJson] = useState(false);
    const [candidatosJson, setCandidatosJson] = useState<Candidato[]>([]);
    const [profesoresData, setProfesoresData] = useState<ProfesorDTO[]>([]);
    const [gruposData, setGruposData] = useState<GrupoDTO[]>([]);
    const [jsonDisplay, setJsonDisplay] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    // Lookup maps for names
    const [nombreProfesor, setNombreProfesor] = useState<Map<number, string>>(new Map());
    const [nombreUEA, setNombreUEA] = useState<Map<number, string>>(new Map());

    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [candidatoActual, setCandidatoActual] = useState(-1);
    const [bitacora, setBitacora] = useState<ResultadoCandidato[]>([]);
    const [nodoActivo, setNodoActivo] = useState<NodoFlujo>('IDLE');
    const [nodosVisitados, setNodosVisitados] = useState<Set<NodoFlujo>>(new Set());
    const [debugAsignacion, setDebugAsignacion] = useState<DebugAsignacion | null>(null);

    const grafoRef = useRef<GrafoBipartito | null>(null);
    const motorRef = useRef<GraphFSMAsignador | null>(null);
    const timerRef = useRef<number | null>(null);
    const idxRef = useRef<number>(0);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    const marcarNodo = useCallback((nodo: NodoFlujo) => {
        setNodoActivo(nodo);
        setNodosVisitados(prev => new Set(prev).add(nodo));
    }, []);

    const handleGenerarJson = useCallback(async () => {
        setIsLoadingJson(true);
        setErrorMsg(null);
        setCandidatosJson([]);
        setJsonDisplay('');
        setBitacora([]);
        setCandidatoActual(-1);
        setNodoActivo('IDLE');
        setNodosVisitados(new Set());
        setIsRunning(false);
        setIsPaused(false);
        setDebugAsignacion(null);
        setNombreProfesor(new Map());
        setNombreUEA(new Map());
        if (timerRef.current) clearTimeout(timerRef.current);

        try {
            const response = await fetch(`controlador/candidatosPorArea.php?claveArea=${claveArea}`);
            const data = await response.json();

            if (!data.ok) {
                setErrorMsg(`Error del servidor: ${data.error}`);
                return;
            }
            if (!data.candidatos || data.candidatos.length === 0) {
                setErrorMsg('No se encontraron candidatos para esta área.');
                return;
            }

            setProfesoresData(data.profesores);
            setGruposData(data.grupos);
            setCandidatosJson(data.candidatos);
            setJsonDisplay(JSON.stringify(data.candidatos, null, 2));
            marcarNodo('JSON_GENERADO');
            // Build name lookup maps
            const profMap = new Map<number, string>();
            for (const p of data.profesores) profMap.set(Number(p.numeroEconomico), (p as any).nombre || String(p.numeroEconomico));
            setNombreProfesor(profMap);
            const ueaMap = new Map<number, string>();
            for (const g of data.grupos) if ((g as any).nombreUEA) ueaMap.set(Number((g as any).ueaClave), (g as any).nombreUEA);
            setNombreUEA(ueaMap);
        } catch (err: any) {
            setErrorMsg(`Error de red: ${err.message}`);
        } finally {
            setIsLoadingJson(false);
        }
    }, [claveArea, marcarNodo]);

    const evaluarYAvanzar = useCallback((
        idx: number,
        candidatos: Candidato[],
        motor: GraphFSMAsignador,
        grafo: GrafoBipartito,
        profs: ProfesorDTO[],
        grps: GrupoDTO[]
    ) => {
        if (idx >= candidatos.length) {
            marcarNodo('COMPLETADO');
            setIsRunning(false);
            setIsPaused(false);
            return;
        }

        const candidato = candidatos[idx];
        const idUeaGrupo = candidato.clave_grupo.idUeaGrupo;
        setCandidatoActual(idx);

        // Step 1: Evaluating FSM
        marcarNodo('EVALUANDO_FSM');

        const snapshots = motor.procesarAsignacionStepByStep(candidato.eco, idUeaGrupo);
        const ultimoSnap = snapshots[snapshots.length - 1];

        if (ultimoSnap.estadoAsignacion === EstadoAsignacion.ASIGNACION_OK) {
            // Step 2: FSM OK → Evaluate soft
            marcarNodo('EVALUANDO_SOFT');

            const grupoObj = grafo.grupos.get(idUeaGrupo);
            let pSoft = 0;
            let scoreFinal = 1.0;

            if (grupoObj) {
                const softResult = calcularPenalizacionSoft(candidato.eco, grafo, grupoObj);
                pSoft = softResult.pSoft;
                scoreFinal = softResult.scoreFinal;
            }

            // Step 3: Decision → Assigned
            marcarNodo('DECISION_ASIGNADO');
            marcarNodo('ASIGNADO_OK');

            // Build debug info with professor and UEA horarios
            const profData = profs.find(p => p.numeroEconomico === candidato.eco);
            const grpData = grps.find(g => g.idUeaGrupo === idUeaGrupo);
            setDebugAsignacion({
                profesorEco: candidato.eco,
                profesorNombre: nombreProfesor.get(Number(candidato.eco)) || '',
                profesorHorarios: profData?.horariosContratacion || [],
                grupoId: idUeaGrupo,
                grupoHorarios: grpData?.horarios || [],
                claveGrupo: candidato.clave_grupo.claveGrupo,
                claveUEA: candidato.uea,
                nombreUEA: nombreUEA.get(Number(candidato.uea)) || '',
                pSoft,
                scoreFinal,
            });

            setBitacora(prev => [...prev, {
                eco: candidato.eco,
                uea: candidato.uea,
                grupo: candidato.clave_grupo.claveGrupo,
                resultado_fsm: 'OK',
                penalizacion_soft: pSoft,
                score_final: scoreFinal,
                resultado_asignacion: 'ASIGNADO'
            }]);

            // PAUSE: user must click Continue
            setIsPaused(true);
            idxRef.current = idx + 1;

        } else {
            // FSM failed → show the rejection node
            marcarNodo('FSM_RECHAZADO');
            marcarNodo('BUSCAR_TRIPLETA');

            setBitacora(prev => [...prev, {
                eco: candidato.eco,
                uea: candidato.uea,
                grupo: candidato.clave_grupo.claveGrupo,
                resultado_fsm: 'FALLO',
                regla_fallo: ultimoSnap.reglaNombre,
                motivo_fsm: ultimoSnap.motivo,
                penalizacion_soft: null,
                score_final: null,
                resultado_asignacion: 'RECHAZADO'
            }]);

            // AUTO-ADVANCE after 100ms
            timerRef.current = window.setTimeout(() => {
                evaluarYAvanzar(idx + 1, candidatos, motor, grafo, profs, grps);
            }, AUTO_ADVANCE_MS);
        }
    }, [marcarNodo, nombreProfesor, nombreUEA]);

    const handleIniciarPrueba = useCallback(() => {
        if (candidatosJson.length === 0) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        const grafo = new GrafoBipartito();
        profesoresData.forEach(p => grafo.registrarProfesor(p));
        gruposData.forEach(g => grafo.registrarGrupo(g));

        const reglas = ReglasPipeline.crear(LIMITE_HORAS_SEMANALES);
        const motor = new GraphFSMAsignador(grafo, reglas);

        grafoRef.current = grafo;
        motorRef.current = motor;

        setBitacora([]);
        setCandidatoActual(0);
        setIsRunning(true);
        setIsPaused(false);
        setDebugAsignacion(null);
        setNodosVisitados(new Set());
        idxRef.current = 0;

        evaluarYAvanzar(0, candidatosJson, motor, grafo, profesoresData, gruposData);
    }, [candidatosJson, profesoresData, gruposData, evaluarYAvanzar]);

    const handleContinuar = useCallback(() => {
        if (!motorRef.current || !grafoRef.current) return;
        setIsPaused(false);
        setDebugAsignacion(null);
        evaluarYAvanzar(idxRef.current, candidatosJson, motorRef.current, grafoRef.current, profesoresData, gruposData);
    }, [candidatosJson, profesoresData, gruposData, evaluarYAvanzar]);

    if (!isOpen) return null;

    return (
        <>
        <style>{`
            .grasp-modal-dialog { max-width: 1140px !important; width: 1140px !important; }
        `}</style>
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-scrollable grasp-modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            Prueba de Asignación GRASP por Área
                            <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '13px' }}>PROVISIONAL</span>
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    <div className="modal-body">
                        <div className="row mb-3">
                            {/* ─── Col 1: Entrada + JSON ─── */}
                            <div className="col-md-3">
                                <label className="form-label fw-bold">Clave de Área</label>
                                <div className="d-flex gap-2 align-items-center mb-2">
                                    <select
                                        className="form-select border-secondary shadow-sm"
                                        style={{ maxWidth: '200px' }}
                                        value={claveArea}
                                        onChange={e => setClaveArea(Number(e.target.value))}
                                        disabled={isRunning}
                                    >
                                        {AREAS_VALIDAS.map(a => (
                                            <option key={a} value={a}>
                                                {a} — {UEA_AREA_MAPPING_REV[a] || 'Desconocida'}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleGenerarJson}
                                        disabled={isLoadingJson || isRunning}
                                    >
                                        {isLoadingJson ? 'BD...' : 'Generar JSON'}
                                    </button>
                                </div>

                                {errorMsg && (
                                    <div className="alert alert-danger py-2 px-3" style={{ fontSize: '14px' }}>
                                        {errorMsg}
                                    </div>
                                )}

                                {jsonDisplay && (
                                    <div>
                                        <label className="form-label fw-bold">
                                            JSON ({candidatosJson.length} tripletas)
                                        </label>
                                        <pre
                                            className="p-2 rounded bg-light border shadow-sm text-dark"
                                            style={{ maxHeight: '280px', overflowY: 'auto', fontSize: '13px' }}
                                        >
                                            {jsonDisplay}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {/* ─── Col 2: Diagrama de flujo ─── */}
                            <div className="col-md-5">
                                <DiagramaFlujo nodoActivo={nodoActivo} visitados={nodosVisitados} />
                                {nodoActivo === 'COMPLETADO' && (
                                    <div className="alert alert-success mt-2 py-2 px-3 text-center" style={{ fontSize: '14px' }}>
                                        Prueba completada — {bitacora.length} evaluados
                                    </div>
                                )}
                            </div>

                            {/* ─── Col 3: Controles + Debug ─── */}
                            <div className="col-md-4">
                                <label className="form-label fw-bold">Controles</label>
                                <div className="d-flex gap-2 mb-2">
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={handleIniciarPrueba}
                                        disabled={candidatosJson.length === 0 || isRunning}
                                    >
                                        Iniciar
                                    </button>
                                    <button
                                        className="btn btn-outline-light btn-sm"
                                        onClick={handleContinuar}
                                        disabled={!isPaused}
                                    >
                                        Continuar (asignación realizada)
                                    </button>
                                </div>
                                {isRunning && (
                                    <div className="text-muted mb-2" style={{ fontSize: '14px' }}>
                                        Candidato {candidatoActual + 1} de {candidatosJson.length}
                                        {isPaused && <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '12px' }}>⏸ PAUSADO — Asignación OK</span>}
                                        {!isPaused && <span className="badge bg-info text-dark ms-2" style={{ fontSize: '12px' }}>⚡ Auto (100ms)</span>}
                                    </div>
                                )}

                                {/* Debug panel: shows on assignment */}
                                {debugAsignacion && (
                                    <div className="p-2 rounded mb-2 bg-light border shadow-sm" style={{ fontSize: '13px', maxHeight: '280px', overflowY: 'auto' }}>
                                        <strong className="d-block mb-1 text-dark">Detalle de Asignación #{bitacora.filter(b => b.resultado_asignacion === 'ASIGNADO').length}</strong>
                                        <div className="row">
                                            <div className="col-6">
                                                <strong className="text-dark">Profesor {debugAsignacion.profesorEco} — {debugAsignacion.profesorNombre}</strong>
                                                <div className="text-primary fw-bold">Horario de contratación:</div>
                                                <pre className="text-dark" style={{ fontSize: '12px', margin: 0 }}>
{JSON.stringify(debugAsignacion.profesorHorarios, null, 1)}
                                                </pre>
                                            </div>
                                            <div className="col-6">
                                                <strong className="text-dark">UEA {debugAsignacion.claveUEA} — {debugAsignacion.nombreUEA} [{debugAsignacion.claveGrupo}]</strong>
                                                <div className="text-success fw-bold">Horario de grupo:</div>
                                                <pre className="text-dark" style={{ fontSize: '12px', margin: 0 }}>
{JSON.stringify(debugAsignacion.grupoHorarios, null, 1)}
                                                </pre>
                                            </div>
                                        </div>
                                        <div className="mt-1 fw-bold text-danger">
                                            P_soft={debugAsignacion.pSoft} | Z={debugAsignacion.scoreFinal}
                                        </div>
                                    </div>
                                )}

                                <div className="p-2 rounded border bg-light shadow-sm text-dark mt-2" style={{ fontSize: '13px' }}>
                                    <strong>Fórmula soft [PROVISIONAL]:</strong><br />
                                    <code>Z = w_ij − λ · P_soft</code> | <code>λ={LAMBDA_SOFT}</code> | <code>P_soft = h_ocupadas / {LIMITE_HORAS_SEMANALES}</code>
                                </div>
                            </div>
                        </div>

                        {/* ─── Bitácora ─── */}
                        {bitacora.length > 0 && (
                            <div className="card shadow-sm border mt-3">
                                <div className="card-header fw-bold d-flex justify-content-between py-2 text-dark bg-light" style={{ fontSize: '15px' }}>
                                    <span>Bitácora</span>
                                    <span className="badge bg-info text-dark">
                                        {bitacora.filter(b => b.resultado_asignacion === 'ASIGNADO').length} asignados / {bitacora.length} evaluados
                                    </span>
                                </div>
                                <div className="card-body p-0" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    <table className="table table-sm table-hover mb-0 text-dark" style={{ fontSize: '14px' }}>
                                        <thead className="table-light text-dark fw-bold" style={{ position: 'sticky', top: 0 }}>
                                            <tr>
                                                <th>#</th>
                                                <th>eco</th>
                                                <th>uea</th>
                                                <th>grupo</th>
                                                <th>resultado_fsm</th>
                                                <th>P_soft</th>
                                                <th>Z</th>
                                                <th>resultado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bitacora.map((r, i) => (
                                                <tr
                                                    key={i}
                                                    className="bitacora-row"
                                                    style={{
                                                        background: r.resultado_asignacion === 'ASIGNADO'
                                                            ? 'rgba(39, 174, 96, 0.7)'
                                                            : 'rgba(230, 230, 230, 0.95)'
                                                    }}
                                                >
                                                    <td>{i + 1}</td>
                                                    <td>{r.eco}<br/><span style={{ color: '#000000', fontWeight: 'bold', fontSize: '13px' }}>{nombreProfesor.get(Number(r.eco)) || ''}</span></td>
                                                    <td>{r.uea}<br/><span style={{ color: '#000000', fontWeight: 'bold', fontSize: '13px' }}>{nombreUEA.get(Number(r.uea)) || ''}</span></td>
                                                    <td>{r.grupo}</td>
                                                    <td>
                                                        <span className={`badge ${r.resultado_fsm === 'OK' ? 'bg-success' : 'bg-danger'}`}>
                                                            {r.resultado_fsm}
                                                        </span>
                                                        {r.regla_fallo && (
                                                            <span className="ms-1" style={{ fontSize: '12px', color: '#8b0000', fontWeight: '900' }}>
                                                                {r.regla_fallo}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{r.penalizacion_soft !== null ? r.penalizacion_soft : <span className="text-muted">—</span>}</td>
                                                    <td>{r.score_final !== null ? r.score_final : <span className="text-muted">—</span>}</td>
                                                    <td>
                                                        <span className={`badge ${r.resultado_asignacion === 'ASIGNADO' ? 'bg-success' : 'bg-secondary'}`}>
                                                            {r.resultado_asignacion}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {bitacora.length > 0 && bitacora[bitacora.length - 1].motivo_fsm && (
                            <div className="mt-2 p-3 rounded alert alert-danger border-danger shadow-sm">
                                <strong>Último rechazo FSM:</strong> {bitacora[bitacora.length - 1].motivo_fsm}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};
