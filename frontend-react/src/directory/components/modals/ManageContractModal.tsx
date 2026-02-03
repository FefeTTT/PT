import React, { useState, useEffect } from 'react';
import { useFilters } from '../../hooks/useFilters';
import { Contract } from '../../types';

interface ManageContractModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professorId: string | number;
    contract?: Contract | null; // If present, edit mode
}

export const ManageContractModal: React.FC<ManageContractModalProps> = ({ isOpen, onClose, onSuccess, professorId, contract }) => {
    const { filters } = useFilters();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        idProfesorTipo: '',
        descripcion: ''
    });

    useEffect(() => {
        if (isOpen) {
            if (contract) {
                setFormData({
                    idProfesorTipo: contract.idProfesorTipo?.toString() || '',
                    descripcion: contract.descripcion || ''
                });
            } else {
                setFormData({
                    idProfesorTipo: '',
                    descripcion: ''
                });
            }
            setError(null);
        }
    }, [isOpen, contract]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.idProfesorTipo) return 'Seleccione el tipo de contrato';
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
            data.append('idProfesorTipo', formData.idProfesorTipo);
            data.append('descripcion', formData.descripcion);

            let url = 'controlador/agregarProfesorContrato.php';
            if (contract) {
                // Edit mode
                data.append('idProfesorContrato', contract.idProfesorContrato?.toString() || '0');
                url = 'controlador/editarProfesorContrato.php';
            }

            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (!json.ok) throw new Error(json.error || 'Error al guardar contrato');

            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isEdit = !!contract;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{isEdit ? 'Editar Contrato' : 'Nuevo Contrato'}</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Tipo de Contrato</label>
                                    <select
                                        name="idProfesorTipo"
                                        className="form-select"
                                        value={formData.idProfesorTipo}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Seleccione tipo...</option>
                                        {filters.profesorTipos.map(t => (
                                            <option key={t.idProfesorTipo} value={t.idProfesorTipo}>{t.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Descripción / Notas</label>
                                    <textarea
                                        name="descripcion"
                                        className="form-control"
                                        value={formData.descripcion}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Detalles adicionales del contrato..."
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
