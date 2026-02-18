import React, { useState } from 'react';
import { DirectoryState, DirectoryItem, Professor, Admin } from './types';
import { useDirectoryData } from './hooks/useDirectoryData';
import { DirectoryFilters } from './components/DirectoryFilters';
import { DirectoryList } from './components/DirectoryList';
import { ProfessorDetails } from './components/ProfessorDetails';
import { AdminDetails } from './components/AdminDetails';
import { CreateProfessorModal } from './components/modals/CreateProfessorModal';
import { CreateAdminModal } from './components/modals/CreateAdminModal';
import { EditProfessorModal } from './components/modals/EditProfessorModal';
import { EditAdminModal } from './components/modals/EditAdminModal';
import { UEA_AREA_MAPPING } from '../scripts/utils/constants';
import profesoresData from '../trimestre-menu/data/gradoYAreaProfesores.json';
import { importarGradoAreaBatch } from './api';
import { GradoAreaImport } from './types';
import { ImportHorariosModal } from './components/modals/ImportHorariosModal';
import { ImportHorariosProfesoresModal } from './components/modals/ImportHorariosProfesoresModal';
export const DirectoryPage: React.FC = () => {
    // 1. Global State
    const [state, setState] = useState<DirectoryState>({
        q: '',
        areaAcademica: '',
        grupoTematico: '',
        profesorAreaTipo: '',
        profesorTipo: '',
        adminTipo: '',
        trimestre: '',
        sort: 'nombre',
        sortDir: 'ASC'
    });

    // 2. Data Fetching
    const { data, loading, error, refresh } = useDirectoryData({
        areaAcademica: state.areaAcademica,
        grupoTematico: state.grupoTematico,
        profesorAreaTipo: state.profesorAreaTipo,
        profesorTipo: state.profesorTipo,
        adminTipo: state.adminTipo,
        trimestre: state.trimestre
    });

    const [selectedItem, setSelectedItem] = useState<DirectoryItem | null>(null);

    const canEdit = (window.FUNCION_ID === 1 || window.FUNCION_ID === 4);

    const [showFilters, setShowFilters] = useState(false);
    const [showCreateProf, setShowCreateProf] = useState(false);
    const [showCreateAdmin, setShowCreateAdmin] = useState(false);
    const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
    const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
    const [showImportHorarios, setShowImportHorarios] = useState(false);
    const [showImportHorariosProfe, setShowImportHorariosProfe] = useState(false);

    // 6. Handlers
    const handleSelect = React.useCallback((item: DirectoryItem) => {
        setSelectedItem(item);
    }, []);

    const handleEditProfessor = (p: Professor) => {
        setEditingProfessor(p);
    };

    const handleDeleteProfessor = (p: Professor) => {
        if (confirm('¿Eliminar profesor?')) {
            alert('Deleted ' + p.idProfesor);
        }
    };

    const handleEditAdmin = (a: Admin) => {
        setEditingAdmin(a);
    };

    const handleDeleteAdmin = (a: Admin) => {
        if (confirm('¿Eliminar administrativo?')) {
            alert('Deleted ' + a.idAdministrativo);
        }
    };

    const handleNewProfessor = () => {
        setShowCreateProf(true);
    };

    const handleNewAdmin = () => {
        setShowCreateAdmin(true);
    };

    const handleBack = () => {
        if (typeof window.mountAdminApp === 'function') {
            window.mountAdminApp('admin-menu');
        } else {
            window.location.href = 'index.php';
        }
    };

    const handleImportGrado = async () => {
        const payload: any[] = [];
        // Iterate object keys: keys are numeroEconomico
        Object.entries(profesoresData as Record<string, GradoAreaImport>).forEach(([numeroEconomico, datos]) => {
            // Map Area name to ID
            const nombreArea = datos.area;
            const idArea = UEA_AREA_MAPPING[nombreArea];

            if (!idArea) {
                console.error(`Area ${nombreArea} no encontrada para número económico ${numeroEconomico}`);
                return;
            }

            payload.push({
                numeroEconomico: parseInt(numeroEconomico),
                grado: datos.grado,
                idArea: idArea
            });

        });

        if (payload.length === 0) {
            alert('No se encontraron datos válidos para importar.');
            return;
        }

        const res = await importarGradoAreaBatch(payload);
        if (res.isItOk) {
            alert(`Importación finalizada.\nProcesados: ${res.processed}\nÉxitos: ${res.successes}\nErrores: ${res.errors}`);
            if (res.errors > 0 || (res.details && res.details.length > 0)) {
                console.error("Detalles de resultados importación grado y área:", res.details);
            }
            refresh();
        } else {
            alert('Error al importar: ' + (res.details ? res.details.join(', ') : 'Error desconocido'));
            console.error("Detalles de resultados importación grado y área:", res.details);
        }
    };

    const handleImportHorarios = () => {
        setShowImportHorarios(true);
    };

    const handleImportHorariosProfe = () => {
        setShowImportHorariosProfe(true);
    };

    return (
        <div className="container-fluid mt-3">
            {/* Modals */}
            {showCreateProf && (
                <CreateProfessorModal
                    isOpen={showCreateProf}
                    onClose={() => setShowCreateProf(false)}
                    onSuccess={() => { refresh(); alert('Profesor creado correctamente'); }}
                />
            )}

            {showCreateAdmin && (
                <CreateAdminModal
                    isOpen={showCreateAdmin}
                    onClose={() => setShowCreateAdmin(false)}
                    onSuccess={() => { refresh(); alert('Administrativo creado correctamente'); }}
                />
            )}

            {editingProfessor && (
                <EditProfessorModal
                    isOpen={!!editingProfessor}
                    professor={editingProfessor}
                    onClose={() => setEditingProfessor(null)}
                    onSuccess={() => { refresh(); alert('Profesor actualizado correctamente'); }}
                />
            )}

            {editingAdmin && (
                <EditAdminModal
                    isOpen={!!editingAdmin}
                    admin={editingAdmin}
                    onClose={() => setEditingAdmin(null)}
                    onSuccess={() => { refresh(); alert('Administrativo actualizado correctamente'); }}
                />
            )}

            {showImportHorarios && (
                <ImportHorariosModal
                    isOpen={showImportHorarios}
                    onClose={() => setShowImportHorarios(false)}
                    onSuccess={() => { refresh(); }}
                />
            )}

            {showImportHorariosProfe && (
                <ImportHorariosProfesoresModal
                    isOpen={showImportHorariosProfe}
                    onClose={() => setShowImportHorariosProfe(false)}
                    onSuccess={() => { refresh(); }}
                />
            )}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center">
                    <button className="btn btn-secondary btn-sm me-2" onClick={handleBack}>
                        <i className="bi bi-arrow-left"></i> Volver
                    </button>
                    <h4 className="mb-0">Directorio de Personal</h4>
                </div>
                <div>
                    {canEdit && (
                        <div className="btn-group me-2">
                            <button className="btn btn-success btn-sm" onClick={handleNewProfessor}>+ Profesor</button>
                            <button className="btn btn-success btn-sm" onClick={handleNewAdmin}>+ Administrativo</button>
                            <button className="btn btn-warning btn-sm" onClick={handleImportGrado}>
                                <i className="bi bi-upload"></i> Importar grado y área
                            </button>
                            <button className="btn btn-warning btn-sm" onClick={handleImportHorarios}>
                                <i className="bi bi-clock"></i> Importar horarios
                            </button>
                            <button className="btn btn-warning btn-sm" onClick={handleImportHorariosProfe}>
                                <i className="bi bi-people"></i> Importar horarios profesores
                            </button>
                        </div>
                    )}
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>
                        <i className={`bi bi-funnel${showFilters ? '-fill' : ''}`}></i> Filtros
                    </button>
                </div>
            </div>

            <DirectoryFilters state={state} setState={setState} isOpen={showFilters} />

            <div className="row">
                {/* Left Panel: List */}
                <div className="col-md-5 col-lg-4 border-end">
                    <div className="mb-2">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Buscar..."
                            value={state.q}
                            onChange={e => setState(s => ({ ...s, q: e.target.value }))}
                        />
                    </div>

                    {loading && <div className="text-center my-3"><div className="spinner-border spinner-border-sm"></div> Cargando...</div>}
                    {error && <div className="alert alert-danger p-1 small">{error}</div>}

                    {!loading && (
                        <DirectoryList
                            data={data}
                            state={state}
                            selectedItem={selectedItem}
                            onSelect={handleSelect}
                        />
                    )}
                </div>

                {/* Right Panel: Details */}
                <div className="col-md-7 col-lg-8">
                    {selectedItem ? (
                        selectedItem.tipo === 'profesor' ? (
                            <ProfessorDetails
                                id={selectedItem.id}
                                canEdit={canEdit}
                                onEdit={handleEditProfessor}
                                onDelete={handleDeleteProfessor}
                            />
                        ) : (
                            <AdminDetails
                                id={selectedItem.id}
                                canEdit={canEdit}
                                onEdit={handleEditAdmin}
                                onDelete={handleDeleteAdmin}
                            />
                        )
                    ) : (
                        <div className="d-flex align-items-center justify-content-center h-100 text-muted" style={{ minHeight: '300px' }}>
                            <div className="text-center">
                                <i className="bi bi-person-lines-fill display-4 text-white"></i>
                                <p className="mt-2 text-white">Selecciona un elemento para ver detalles</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
