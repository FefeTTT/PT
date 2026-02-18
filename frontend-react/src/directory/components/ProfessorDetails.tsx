import React, { useState, useEffect } from 'react';
import { useProfessorDetails } from '../hooks/useProfessorDetails';
import { Professor, Location, Contract, EmergencyContact, AreaAssignment, GroupAssignment } from '../types';
import { ManageLocationModal } from './modals/ManageLocationModal';
import { ManageContractModal } from './modals/ManageContractModal';
import { ManageContactModal } from './modals/ManageContactModal';
import { ManageAssignmentModal } from './modals/ManageAssignmentModal';
import { ScheduleModal } from './modals/ScheduleModal';
import { PreferencesModal } from './modals/PreferencesModal';
import { UEA_AREA_MAPPING_REV } from '../../scripts/utils/constants';
import { UpdateAreaModal } from './modals/UpdateAreaModal';
import { UpdateDegreeModal } from './modals/UpdateDegreeModal';

interface ProfessorDetailsProps {
    id: string | number;
    canEdit: boolean; // Derived from window.FUNCION_ID
    onEdit: (prof: Professor) => void;
    onDelete: (prof: Professor) => void;
}

export const ProfessorDetails: React.FC<ProfessorDetailsProps> = ({ id, canEdit, onEdit, onDelete }) => {
    const { details, error, refresh } = useProfessorDetails(id);

    // Location Management State
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);

    // Contract Management State
    const [showContractModal, setShowContractModal] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);

    // Contact Management State
    const [showContactModal, setShowContactModal] = useState(false);
    const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

    // Assignment Management State
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [assignmentType, setAssignmentType] = useState<'area' | 'group'>('area');

    // Schedule & Preferences
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showPreferencesModal, setShowPreferencesModal] = useState(false);

    // Generic Update Area Modal
    const [showAreaModal, setShowAreaModal] = useState(false);

    // Generic Update Degree Modal
    const [showDegreeModal, setShowDegreeModal] = useState(false);
    const [degreesMap, setDegreesMap] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch('controlador/recuperaGrados.php')
            .then(res => res.json())
            .then(data => {
                if (data.isItOk && Array.isArray(data.grados)) {
                    const map: Record<string, string> = {};
                    data.grados.forEach((g: any) => {
                        map[g.idGrado] = g.nombre;
                    });
                    setDegreesMap(map);
                }
            })
            .catch(err => console.error('Error loading degrees:', err));
    }, []);


    // Location Handlers
    const handleAddLocation = () => {
        setEditingLocation(null);
        setShowLocationModal(true);
    };

    const handleEditLocation = (l: Location) => {
        setEditingLocation(l);
        setShowLocationModal(true);
    };

    const handleDeleteLocation = async (l: Location) => {
        if (!confirm(`¿Eliminar ubicación ${l.nombre}?`)) return;
        try {
            const data = new FormData();
            data.append('idProfesor', id.toString());
            data.append('idLugar', l.idLugar?.toString() || '0');

            const res = await fetch('controlador/quitarLugarProfesor.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                refresh();
            } else {
                alert('Error al eliminar: ' + (json.msg || 'Desconocido'));
            }
        } catch (e) {
            alert('Error de conexión al eliminar');
        }
    };

    // Contract Handlers
    const handleAddContract = () => {
        setEditingContract(null);
        setShowContractModal(true);
    };

    const handleEditContract = (c: Contract) => {
        setEditingContract(c);
        setShowContractModal(true);
    };

    const handleDeleteContract = async (c: Contract) => {
        if (!confirm(`¿Eliminar contrato?`)) return;
        try {
            const data = new FormData();
            data.append('idProfesor', id.toString());
            data.append('idProfesorContrato', c.idProfesorContrato?.toString() || '0');

            const res = await fetch('controlador/quitarProfesorContrato.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                refresh();
            } else {
                alert('Error al eliminar: ' + (json.error || 'Desconocido'));
            }
        } catch (e) {
            alert('Error de conexión al eliminar');
        }
    };

    // Contact Handlers
    const handleAddContact = () => {
        setEditingContact(null);
        setShowContactModal(true);
    };

    const handleEditContact = (c: EmergencyContact) => {
        setEditingContact(c);
        setShowContactModal(true);
    };

    const handleDeleteContact = async (c: EmergencyContact) => {
        if (!confirm(`¿Eliminar contacto ${c.nombre}?`)) return;
        try {
            const data = new FormData();
            data.append('idProfesor', id.toString());
            data.append('idProfesorEmergencia', c.idProfesorEmergencia?.toString() || '0');

            const res = await fetch('controlador/quitarProfesorEmergencia.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                refresh();
            } else {
                alert('Error al eliminar: ' + (json.error || 'Desconocido'));
            }
        } catch (e) {
            alert('Error de conexión al eliminar');
        }
    };

    // Assignment Handlers
    const handleAddArea = () => {
        setAssignmentType('area');
        setShowAssignmentModal(true);
    };

    const handleAddGroup = () => {
        setAssignmentType('group');
        setShowAssignmentModal(true);
    };

    const handleRemoveArea = async (a: AreaAssignment) => {
        if (!confirm(`¿Quitar asignación de área: ${a.nombre}?`)) return;
        try {
            const data = new FormData();
            data.append('idProfesor', id.toString());
            data.append('idAreaAcademica', a.idAreaAcademica?.toString() || '0');

            const res = await fetch('controlador/quitarProfesorAreaAcademica.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                refresh();
            } else {
                alert('Error al quitar área: ' + (json.error || 'Desconocido'));
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    const handleRemoveGroup = async (g: GroupAssignment) => {
        if (!confirm(`¿Quitar asignación de grupo: ${g.nombreGrupo}?`)) return;
        try {
            const data = new FormData();
            data.append('idProfesor', id.toString());
            data.append('idGrupoTematico', g.idGrupoTematico?.toString() || '0');

            const res = await fetch('controlador/quitarProfesorGrupoTematico.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                refresh();
            } else {
                alert('Error al quitar grupo: ' + (json.error || 'Desconocido'));
            }
        } catch (e) {
            alert('Error de conexión');
        }
    };

    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!details) return null;

    const { profesor: p, contrato, areas, grupos, lugares, contactos } = details;

    return (
        <div className="card shadow-sm">
            {showLocationModal && (
                <ManageLocationModal
                    isOpen={showLocationModal}
                    onClose={() => setShowLocationModal(false)}
                    onSuccess={() => { refresh(); }}
                    professorId={id}
                    location={editingLocation}
                />
            )}

            {showContractModal && (
                <ManageContractModal
                    isOpen={showContractModal}
                    onClose={() => setShowContractModal(false)}
                    onSuccess={() => { refresh(); }}
                    professorId={id}
                    contract={editingContract}
                />
            )}

            {showContactModal && (
                <ManageContactModal
                    isOpen={showContactModal}
                    onClose={() => setShowContactModal(false)}
                    onSuccess={() => { refresh(); }}
                    professorId={id}
                    contact={editingContact}
                />
            )}

            {showAssignmentModal && (
                <ManageAssignmentModal
                    isOpen={showAssignmentModal}
                    onClose={() => setShowAssignmentModal(false)}
                    onSuccess={() => { refresh(); }}
                    professorId={id}
                    type={assignmentType}
                />
            )}

            {showScheduleModal && (
                <ScheduleModal
                    isOpen={showScheduleModal}
                    onClose={() => setShowScheduleModal(false)}
                    professorId={id}
                />
            )}

            {showPreferencesModal && (
                <PreferencesModal
                    isOpen={showPreferencesModal}
                    onClose={() => setShowPreferencesModal(false)}
                    professorId={id}
                />
            )}

            {showAreaModal && (
                <UpdateAreaModal
                    isOpen={showAreaModal}
                    onClose={() => setShowAreaModal(false)}
                    onSuccess={() => { refresh(); }}
                    numeroEconomico={p.numeroEconomico}
                    currentIdArea={p.idArea}
                />
            )}

            {showDegreeModal && (
                <UpdateDegreeModal
                    isOpen={showDegreeModal}
                    onClose={() => setShowDegreeModal(false)}
                    onSuccess={() => { refresh(); }}
                    numeroEconomico={p.numeroEconomico}
                    currentIdGrado={p.idGrado}
                />
            )}

            {/* Header ... */}
            <div className="card-header d-flex justify-content-between align-items-center bg-white">
                <h5 className="mb-0 text-primary">{p.nombre}</h5>
                {canEdit && (
                    <div>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => onEdit(p)}>
                            <i className="bi bi-pencil"></i> Editar
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(p)}>
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                )}
            </div>
            <div className="card-body">
                {/* Info Rows ... */}
                <div className="row mb-3">
                    <div className="col-md-6">
                        <strong>No. Económico:</strong> {p.numeroEconomico}
                    </div>
                    <div className="col-md-6">
                        <strong>Correo UAM:</strong> <a href={`mailto:${p.correo_uam}`}>{p.correo_uam}</a>
                    </div>
                    <div className="col-md-6">
                        <strong>Celular:</strong> {p.celular || '-'}
                    </div>
                    <div className="col-md-6">
                        <strong>Correo Personal:</strong> {p.correo_personal ? <a href={`mailto:${p.correo_personal}`}>{p.correo_personal}</a> : '-'}
                    </div>
                    <div className="col-md-6 d-flex align-items-center">
                        <strong className="me-2">Área:</strong>
                        {p.idArea ? (UEA_AREA_MAPPING_REV[p.idArea as number] || p.idArea) : '-'}
                        {canEdit && (
                            <button className="btn btn-link btn-sm p-0 ms-2" onClick={() => setShowAreaModal(true)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                        )}
                    </div>
                    <div className="col-md-6 d-flex align-items-center">
                        <strong className="me-2">Grado:</strong>
                        {(p.idGrado && degreesMap[p.idGrado]) || p.gradoEstudios || '-'}
                        {canEdit && (
                            <button className="btn btn-link btn-sm p-0 ms-2" onClick={() => setShowDegreeModal(true)}>
                                <i className="bi bi-pencil-square"></i>
                            </button>
                        )}
                    </div>
                </div>

                <hr />

                {/* Contracts and Areas */}
                <div className="row mb-3">
                    <div className="col-12 col-md-6">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="text-secondary opacity-75 small text-uppercase fw-bold mb-0">Contrato actual</h6>
                            {canEdit && !contrato && (
                                <button className="btn btn-xs btn-outline-success py-0" style={{ fontSize: '0.7rem' }} onClick={handleAddContract}>
                                    + Asignar
                                </button>
                            )}
                        </div>

                        {contrato ? (
                            <div className="alert alert-info py-2 px-3 mb-2 d-flex justify-content-between align-items-start">
                                <div>
                                    {contrato.tipoNombre || contrato.descripcion || 'Sin descripción'}
                                    {contrato.descripcion && contrato.tipoNombre && <div className="small text-muted">{contrato.descripcion}</div>}
                                </div>
                                {canEdit && (
                                    <div style={{ minWidth: '50px', textAlign: 'right' }}>
                                        <button className="btn btn-link btn-sm text-primary p-0 me-2" onClick={() => handleEditContract(contrato)}>
                                            <i className="bi bi-pencil-square"></i>
                                        </button>
                                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleDeleteContract(contrato)}>
                                            <i className="bi bi-trash3"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-muted small">No tiene contrato asignado.</p>
                        )}
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="text-secondary opacity-75 small text-uppercase fw-bold mb-0">Adscripción</h6>
                            {canEdit && (
                                <div>
                                    <button className="btn btn-xs btn-outline-success py-0 me-1" style={{ fontSize: '0.7rem' }} onClick={handleAddArea}>
                                        + Área académica
                                    </button>
                                    <button className="btn btn-xs btn-outline-success py-0" style={{ fontSize: '0.7rem' }} onClick={handleAddGroup}>
                                        + Grupo temático
                                    </button>
                                </div>
                            )}
                        </div>

                        <ul className="list-unstyled small">
                            {areas && areas.length > 0 ? areas.map((a, i) => (
                                <li key={i} className="mb-1 d-flex justify-content-between align-items-center">
                                    <span>
                                        <span className="badge bg-light text-dark border me-1">Área académica</span>
                                        {a.nombre}
                                        {a.puesto && <span className="text-muted ms-1">({a.puesto})</span>}
                                    </span>
                                    {canEdit && (
                                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleRemoveArea(a)}>
                                            <i className="bi bi-trash3" style={{ fontSize: '0.8rem' }}></i>
                                        </button>
                                    )}
                                </li>
                            )) : <li className="text-muted fst-italic">No asignado a área</li>}

                            {grupos && grupos.length > 0 ? grupos.map((g, i) => (
                                <li key={i} className="mb-1 d-flex justify-content-between align-items-center">
                                    <span>
                                        <span className="badge bg-light text-dark border me-1">Grupo</span>
                                        {g.nombreGrupo}
                                        {g.puesto && <span className="text-muted ms-1">({g.puesto})</span>}
                                    </span>
                                    {canEdit && (
                                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleRemoveGroup(g)}>
                                            <i className="bi bi-trash3" style={{ fontSize: '0.8rem' }}></i>
                                        </button>
                                    )}
                                </li>
                            )) : null}
                        </ul>
                    </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3">
                    <h6 className="text-secondary opacity-75 small text-uppercase fw-bold mb-0">Ubicación</h6>
                    {canEdit && (
                        <button className="btn btn-xs btn-outline-success py-0" style={{ fontSize: '0.7rem' }} onClick={handleAddLocation}>
                            + Agregar
                        </button>
                    )}
                </div>

                {lugares && lugares.length > 0 ? (
                    <ul className="list-group list-group-flush mb-3">
                        {lugares.map((l, idx) => (
                            <li key={l.idLugar || idx} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                                <div>
                                    <span>{l.edificio} - {l.piso ? `Piso ${l.piso}` : 'PB'}</span>
                                    <br />
                                    <small className="text-muted">{l.nombre} {l.cubiculo ? `(Cub. ${l.cubiculo})` : ''} {l.notas ? `- ${l.notas}` : ''}</small>
                                </div>
                                {canEdit && (
                                    <div>
                                        <button className="btn btn-link btn-sm text-primary p-0 me-2" onClick={() => handleEditLocation(l)}>
                                            <i className="bi bi-pencil-square"></i>
                                        </button>
                                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleDeleteLocation(l)}>
                                            <i className="bi bi-trash3"></i>
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-muted small mt-1">Sin ubicaciones registradas.</p>}

                {(contactos && contactos.length > 0) || canEdit ? (
                    <>
                        <div className="d-flex justify-content-between align-items-center mt-3">
                            <h6 className="text-secondary opacity-75 small text-uppercase fw-bold mb-0">Contactos de Emergencia</h6>
                            {canEdit && (
                                <button className="btn btn-xs btn-outline-success py-0" style={{ fontSize: '0.7rem' }} onClick={handleAddContact}>
                                    + Agregar
                                </button>
                            )}
                        </div>

                        {contactos && contactos.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table table-sm table-borderless small mb-0 table-hover">
                                    <thead className="text-muted">
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Parentesco</th>
                                            <th>Teléfono</th>
                                            {canEdit && <th>Acciones</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contactos.map((c, i) => (
                                            <tr key={c.idProfesorEmergencia || i}>
                                                <td>{c.nombre}</td>
                                                <td>{c.parentesco}</td>
                                                <td>{c.celular}</td>
                                                {canEdit && (
                                                    <td>
                                                        <button className="btn btn-link btn-sm text-primary p-0 me-2" onClick={() => handleEditContact(c)}>
                                                            <i className="bi bi-pencil-square"></i>
                                                        </button>
                                                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => handleDeleteContact(c)}>
                                                            <i className="bi bi-trash3"></i>
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-muted small mt-1">Sin contactos registrados.</p>}
                    </>
                ) : null}

                <div className="mt-4 pt-3 border-top">
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => setShowScheduleModal(true)}>
                            <i className="bi bi-calendar3 me-1"></i> Ver Horario
                        </button>
                        {canEdit && (
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowPreferencesModal(true)}>
                                <i className="bi bi-gear me-1"></i> Preferencias
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
