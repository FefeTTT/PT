import React, { useState, useEffect } from 'react';


interface ManageAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professorId: string | number;
    type: 'area' | 'group';
}

export const ManageAssignmentModal: React.FC<ManageAssignmentModalProps> = ({ isOpen, onClose, onSuccess, professorId, type }) => {
    const [items, setItems] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflictInfo, setConflictInfo] = useState<any | null>(null);

    const [form, setForm] = useState({
        name: '', // areaNombre or grupoNombre
        role: 'integrante',
        confirmReplace: false
    });

    useEffect(() => {
        if (isOpen) {
            setForm({ name: '', role: 'integrante', confirmReplace: false });
            setError(null);
            setConflictInfo(null);
            fetchItems();
        }
    }, [isOpen, type]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const url = type === 'area'
                ? 'controlador/recuperaAreasAcademicas.php'
                : 'controlador/recuperaGruposTematicos.php';

            const res = await fetch(url);
            const json = await res.json();

            if (json.ok) {
                // Deduplicate names
                // Backend returns objects { id, nombre, puesto }
                // We only need unique names
                const list = type === 'area' ? json.areas : json.grupos;
                const names = new Set<string>();
                list.forEach((item: any) => {
                    const n = type === 'area' ? item.nombre : item.nombreGrupo;
                    if (n) names.add(n);
                });
                setItems(Array.from(names).sort());
            } else {
                setError('Error al cargar catálogo');
            }
        } catch (e) {
            console.error(e);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!form.name) {
            setError('Seleccione un elemento');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = new FormData();
            data.append('idProfesor', professorId.toString());
            data.append(type === 'area' ? 'areaNombre' : 'grupoNombre', form.name);
            data.append('rol', form.role);
            if (form.confirmReplace) {
                data.append('confirmReplace', '1');
            }

            const url = type === 'area'
                ? 'controlador/agregarProfesorAreaAcademica.php'
                : 'controlador/agregarProfesorGrupoTematico.php';

            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                onSuccess();
                onClose();
            } else if (json.conflict) {
                setConflictInfo(json.current);
            } else {
                throw new Error(json.error || 'Error al asignar');
            }
        } catch (e: any) {
            setError(e.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReplace = () => {
        setForm(prev => ({ ...prev, confirmReplace: true }));
        submitWithConfirm();
    };

    const submitWithConfirm = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = new FormData();
            data.append('idProfesor', professorId.toString());
            data.append(type === 'area' ? 'areaNombre' : 'grupoNombre', form.name);
            data.append('rol', form.role);
            data.append('confirmReplace', '1'); // Force confirm

            const url = type === 'area'
                ? 'controlador/agregarProfesorAreaAcademica.php'
                : 'controlador/agregarProfesorGrupoTematico.php';

            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                onSuccess();
                onClose();
            } else {
                throw new Error(json.error || 'Error al asignar');
            }
        } catch (e: any) {
            setError(e.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const label = type === 'area' ? 'Área Académica' : 'Grupo Temático';

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Asignar {label}</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}

                            {conflictInfo ? (
                                <div className="alert alert-warning">
                                    <p><strong>¡Conflicto de Jefe!</strong></p>
                                    <p>El profesor <strong>{conflictInfo.nombre || 'Desconocido'}</strong> ya es Jefe de este {label}.</p>
                                    <p>¿Deseas reemplazarlo? El profesor actual pasará a ser "Integrante".</p>
                                    <div className="d-flex justify-content-end gap-2">
                                        <button className="btn btn-secondary btn-sm" onClick={() => setConflictInfo(null)}>Cancelar</button>
                                        <button className="btn btn-warning btn-sm" onClick={handleConfirmReplace}>Sí, reemplazar</button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label className="form-label">{label}</label>
                                        <select
                                            className="form-select"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccione...</option>
                                            {items.map((val: string) => (
                                                <option key={val} value={val}>{val}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Puesto / Rol</label>
                                        <select
                                            className="form-select"
                                            value={form.role}
                                            onChange={e => setForm({ ...form, role: e.target.value })}
                                        >
                                            <option value="integrante">Integrante</option>
                                            <option value="jefe">Jefe</option>
                                        </select>
                                    </div>
                                </form>
                            )}
                        </div>
                        <div className="modal-footer">
                            {!conflictInfo && (
                                <>
                                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                                        {loading ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </>
    );
};
