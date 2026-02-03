import React, { useState, useEffect } from 'react';
import { Location } from '../../types';

interface ManageLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professorId: string | number;
    location?: Location | null; // If present, edit mode
}

export const ManageLocationModal: React.FC<ManageLocationModalProps> = ({ isOpen, onClose, onSuccess, professorId, location }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        edificio: '',
        piso: '',
        cubiculo: '',
        nombre: '',
        notas: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (location) {
                setFormData({
                    edificio: location.edificio || '',
                    piso: location.piso?.toString() || '',
                    cubiculo: location.cubiculo || '',
                    nombre: location.nombre || '',
                    notas: location.notas || ''
                });
            } else {
                setFormData({
                    edificio: '',
                    piso: '',
                    cubiculo: '',
                    nombre: '',
                    notas: ''
                });
            }
            setError(null);
        }
    }, [isOpen, location]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.edificio) return 'Edificio es obligatorio';
        if (!formData.nombre) return 'Nombre es obligatorio';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) {
            setError(err);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = new FormData();

            if (location) {
                // Edit
                data.append('idLugar', location.idLugar?.toString() || '0');
                // Edit script expects edificio, piso, cubiculo, nombre, notas
                // It does NOT require professorId usually, but let's check script (checked earlier).
            } else {
                // Add
                data.append('idProfesor', professorId.toString());
            }

            data.append('edificio', formData.edificio);
            data.append('piso', formData.piso);
            data.append('cubiculo', formData.cubiculo);
            data.append('nombre', formData.nombre);
            data.append('notas', formData.notas);

            const url = location ? 'controlador/editarLugarProfesor.php' : 'controlador/agregarLugarProfesor.php';
            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (!json.ok) throw new Error(json.msg || json.error || 'Error al guardar lugar');

            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isEdit = !!location;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{isEdit ? 'Editar Ubicación' : 'Nueva Ubicación'}</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-2">
                                    <label className="form-label">Nombre <small className="text-muted">(Desc. corta, ej. Oficina)</small></label>
                                    <input
                                        name="nombre"
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ej. Oficina principal"
                                    />
                                </div>
                                <div className="row">
                                    <div className="col-md-6 mb-2">
                                        <label className="form-label">Edificio</label>
                                        <input
                                            name="edificio"
                                            className="form-control"
                                            value={formData.edificio}
                                            onChange={handleChange}
                                            required
                                            placeholder="Ej. T"
                                        />
                                    </div>
                                    <div className="col-md-6 mb-2">
                                        <label className="form-label">Piso</label>
                                        <input
                                            name="piso"
                                            type="number"
                                            className="form-control"
                                            value={formData.piso}
                                            onChange={handleChange}
                                            placeholder="Ej. 1"
                                        />
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Cubiculo</label>
                                    <input
                                        name="cubiculo"
                                        className="form-control"
                                        value={formData.cubiculo}
                                        onChange={handleChange}
                                        placeholder="Ej. 123"
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Notas</label>
                                    <textarea
                                        name="notas"
                                        className="form-control"
                                        value={formData.notas}
                                        onChange={handleChange}
                                        rows={2}
                                    />
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </>
    );
};
