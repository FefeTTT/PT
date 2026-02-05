import React, { useState, useEffect, useMemo } from 'react';
import * as API from './api';
import Fuse from 'fuse.js';
import FuzzySearchInput from '../components/FuzzySearchInput';
import LoadingLabel from '../components/common/LoadingLabel';

interface Props {
    trimestre: API.Trimestre;
    onBack: () => void;
}

interface ProfessorRow {
    idProfesor: number;
    numeroEconomico: number;
    nombre: string;
    enTrimestre: number; // 1 or 0
}

const ProfesoresTrimestre: React.FC<Props> = ({ trimestre, onBack }) => {
    const [professors, setProfessors] = useState<ProfessorRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>('');
    const [togglingId, setTogglingId] = useState<number | null>(null);

    useEffect(() => {
        loadProfessors();
    }, [trimestre.idTrimestre]);

    const loadProfessors = async () => {
        setLoading(true);
        try {
            const data = await API.fetchProfesoresTrimestre(trimestre.idTrimestre);
            if (data.ok && data.profesores) {
                setProfessors(data.profesores);
            } else {
                setError(data.msg || 'Error al cargar profesores');
            }
        } catch (e) {
            setError('Error de red');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (p: ProfessorRow) => {
        if (togglingId) return; // Prevent double clicks
        const action = p.enTrimestre === 1 ? 'exclude' : 'include';
        // Optimistic update? Maybe safer to wait for server since it affects other tables.
        // But for UX, we can show a spinner on the button.
        setTogglingId(p.idProfesor);

        try {
            // Use numeroEconomico as the ID for backend operations
            const res = await API.toggleProfesorTrimestre(trimestre.idTrimestre, p.numeroEconomico, action);
            if (res.ok) {
                // Update local state
                setProfessors(prev => prev.map(prof => {
                    if (prof.idProfesor === p.idProfesor) {
                        return { ...prof, enTrimestre: action === 'include' ? 1 : 0 };
                    }
                    return prof;
                }));
            } else {
                alert('No se pudo actualizar: ' + (res.error || 'Error desconocido'));
            }
        } catch (e) {
            alert('Error de red al actualizar');
        } finally {
            setTogglingId(null);
        }
    };

    const fuse = useMemo(() => {
        return new Fuse(professors, {
            keys: ['nombre', 'numeroEconomico'],
            threshold: 0.3,
            ignoreLocation: true
        });
    }, [professors]);

    const filteredProfessors = useMemo(() => {
        if (!filter) return professors;
        return fuse.search(filter).map(result => result.item);
    }, [fuse, filter, professors]);

    const displayed = filteredProfessors.slice(0, 100); // Limit rendering for perf

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    <button className="btn btn-outline-secondary btn-sm me-3" onClick={onBack}>
                        &larr; Volver
                    </button>
                    <h5 className="m-0">
                        Profesores en {trimestre.periodoNombre} {trimestre.anio}
                        <small className="text-muted ms-2" style={{ fontSize: '0.8rem' }}>
                            ({trimestre.fechaLimite ? `Límite: ${trimestre.fechaLimite}` : 'Sin fecha límite'})
                        </small>
                    </h5>
                </div>
                <div>
                    <span className="badge bg-info text-dark">Total: {professors.filter(p => p.enTrimestre).length} asignados</span>
                </div>
            </div>

            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="mb-3" style={{ maxWidth: '400px' }}>
                    <FuzzySearchInput
                        initialValue={filter}
                        onSearch={setFilter}
                        placeholder="Buscar por nombre o número económico..."
                    />
                </div>

                {loading ? <LoadingLabel /> : (
                    <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <table className="table table-hover table-sm align-middle">
                            <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th>Estatus</th>
                                    <th>No. Eco</th>
                                    <th>Nombre</th>
                                    <th className="text-end">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.map(p => {
                                    const isIncluded = p.enTrimestre === 1;
                                    const isProcessing = togglingId === p.idProfesor;
                                    return (
                                        <tr key={p.idProfesor} className={isIncluded ? 'table-success' : ''}>
                                            <td>
                                                {isIncluded ?
                                                    <span className="badge bg-success">Incluido</span> :
                                                    <span className="badge bg-light text-muted border">Excluido</span>
                                                }
                                            </td>
                                            <td>{p.numeroEconomico}</td>
                                            <td>{p.nombre}</td>
                                            <td className="text-end">
                                                <button
                                                    className={`btn btn-sm ${isIncluded ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                                    onClick={() => handleToggle(p)}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? '...' : (isIncluded ? 'Quitar' : 'Agregar')}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredProfessors.length === 0 && (
                                    <tr><td colSpan={4} className="text-center text-muted p-4">No se encontraron profesores</td></tr>
                                )}
                                {filteredProfessors.length > 100 && (
                                    <tr><td colSpan={4} className="text-center text-muted small">Mostrando primeros 100 resultados...</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfesoresTrimestre;
