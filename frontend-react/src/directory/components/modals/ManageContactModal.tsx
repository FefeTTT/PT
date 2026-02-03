import React, { useState, useEffect } from 'react';
import { EmergencyContact } from '../../types';

interface ManageContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professorId: string | number;
    contact?: EmergencyContact | null; // If present, edit mode
}

export const ManageContactModal: React.FC<ManageContactModalProps> = ({ isOpen, onClose, onSuccess, professorId, contact }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        nombre: '',
        parentesco: '',
        celular: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (contact) {
                setFormData({
                    nombre: contact.nombre || '',
                    parentesco: contact.parentesco || '',
                    celular: contact.celular || ''
                });
            } else {
                setFormData({
                    nombre: '',
                    parentesco: '',
                    celular: ''
                });
            }
            setError(null);
        }
    }, [isOpen, contact]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.nombre) return 'Nombre es obligatorio';
        if (!formData.parentesco) return 'Parentesco es obligatorio';
        if (!formData.celular) return 'Celular es obligatorio';
        if (!/^\d{10}$/.test(formData.celular)) return 'Celular debe tener 10 dígitos';
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
            data.append('idProfesor', professorId.toString());
            data.append('nombre', formData.nombre);
            data.append('parentesco', formData.parentesco);
            data.append('celular', formData.celular);

            let url = 'controlador/agregarProfesorEmergencia.php';
            if (contact) {
                // Edit
                data.append('idProfesorEmergencia', contact.idProfesorEmergencia?.toString() || '0');
                url = 'controlador/editarProfesorEmergencia.php';
            }

            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (!json.ok) throw new Error(json.error || 'Error al guardar contacto');

            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isEdit = !!contact;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{isEdit ? 'Editar Contacto de Emergencia' : 'Nuevo Contacto de Emergencia'}</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Nombre</label>
                                    <input
                                        name="nombre"
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nombre completo"
                                    />
                                </div>
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Parentesco</label>
                                        <input
                                            name="parentesco"
                                            className="form-control"
                                            value={formData.parentesco}
                                            onChange={handleChange}
                                            required
                                            placeholder="Ej. Padre, Esposo(a)"
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label">Celular (10 dígitos)</label>
                                        <input
                                            name="celular"
                                            type="tel"
                                            className="form-control"
                                            value={formData.celular}
                                            onChange={handleChange}
                                            required
                                            maxLength={10}
                                            placeholder="Ej. 5512345678"
                                        />
                                    </div>
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
