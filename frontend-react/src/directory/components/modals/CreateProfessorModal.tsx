import React, { useState, useEffect } from 'react';
import { useFilters } from '../../hooks/useFilters';

interface CreateProfessorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateProfessorModal: React.FC<CreateProfessorModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { filters } = useFilters();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        numeroEconomico: '',
        nombre: '',
        correo_uam_prefix: '',
        correo_personal: '',
        gradoEstudios: '',
        idProfesorTipo: '', // Contrato
        celular: ''
    });

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setFormData({
                numeroEconomico: '',
                nombre: '',
                correo_uam_prefix: '',
                correo_personal: '',
                gradoEstudios: '',
                idProfesorTipo: '',
                celular: ''
            });
            setError(null);
        }
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.numeroEconomico) return 'El número económico es obligatorio';
        if (!/^\d+$/.test(formData.numeroEconomico)) return 'Número económico debe ser numérico';
        if (!formData.nombre) return 'El nombre es obligatorio';
        if (!formData.correo_uam_prefix) return 'El correo UAM es obligatorio';
        if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(formData.correo_uam_prefix)) return 'Correo UAM inválido (solo prefijo)';
        if (!formData.idProfesorTipo) return 'Seleccione el tipo de contrato';
        if (!formData.celular) return 'El celular es obligatorio';
        if (!/^\d{10}$/.test(formData.celular)) return 'Celular debe tener 10 dígitos';
        if (formData.correo_personal && !/@[^@]+\.[^@]+/.test(formData.correo_personal)) return 'Correo personal inválido';
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
            // 1. Check duplicates
            const checkData = new FormData();
            checkData.append('numeroEconomico', formData.numeroEconomico);
            checkData.append('nombre', formData.nombre);
            checkData.append('correo_uam', formData.correo_uam_prefix + '@azc.uam.mx');

            const checkRes = await fetch('controlador/ValidaProfesorExiste.php', { method: 'POST', body: checkData });
            const checkJson = await checkRes.json();

            if (!checkJson.ok) throw new Error(checkJson.error || 'Error verificando duplicados');
            if (checkJson.existsNumero) throw new Error('Ya existe un profesor con ese número económico');
            if (checkJson.existsCorreo) throw new Error('Ya existe un profesor con ese correo UAM');

            // 2. Submit
            const data = new FormData();
            data.append('numeroEconomico', formData.numeroEconomico);
            data.append('nombre', formData.nombre);
            data.append('correo_uam_prefix', formData.correo_uam_prefix);
            data.append('correo_personal', formData.correo_personal);
            data.append('gradoEstudios', formData.gradoEstudios);
            data.append('idProfesorTipo', formData.idProfesorTipo);
            data.append('celular', formData.celular);

            const saveRes = await fetch('controlador/guardarProfesor.php', { method: 'POST', body: data });
            const saveJson = await saveRes.json();

            if (!saveJson.ok) throw new Error(saveJson.error || 'Error al guardar');

            onSuccess();
            onClose();

        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Nuevo Profesor</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <form id="formNuevoProfesor" onSubmit={handleSubmit}>
                                <div className="mb-2">
                                    <label className="form-label">Número Económico</label>
                                    <input
                                        name="numeroEconomico"
                                        className="form-control"
                                        value={formData.numeroEconomico}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Nombre</label>
                                    <input
                                        name="nombre"
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Correo UAM</label>
                                    <div className="input-group">
                                        <input
                                            name="correo_uam_prefix"
                                            className="form-control"
                                            value={formData.correo_uam_prefix}
                                            onChange={handleChange}
                                            required
                                        />
                                        <span className="input-group-text">@azc.uam.mx</span>
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Correo personal</label>
                                    <input
                                        name="correo_personal"
                                        className="form-control"
                                        value={formData.correo_personal}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Grado de estudios</label>
                                    <select
                                        name="gradoEstudios"
                                        className="form-select"
                                        value={formData.gradoEstudios}
                                        onChange={handleChange}
                                    >
                                        <option value="">(ninguno)</option>
                                        <option value="Ingeniería">Ingeniería</option>
                                        <option value="Licenciatura">Licenciatura</option>
                                        <option value="Maestría">Maestría</option>
                                        <option value="Doctorado">Doctorado</option>
                                    </select>
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Tipo de contrato</label>
                                    <select
                                        name="idProfesorTipo"
                                        className="form-select"
                                        value={formData.idProfesorTipo}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Seleccione tipo de contrato</option>
                                        {filters.profesorTipos.map(t => (
                                            <option key={t.idProfesorTipo} value={t.idProfesorTipo}>{t.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Celular</label>
                                    <input
                                        name="celular"
                                        className="form-control"
                                        value={formData.celular}
                                        onChange={handleChange}
                                        required
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
