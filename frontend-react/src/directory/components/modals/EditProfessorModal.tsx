import React, { useState, useEffect } from 'react';
import { useFilters } from '../../hooks/useFilters';
import { BaseModal } from './BaseModal';
import { Professor } from '../../types';

interface EditProfessorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professor: Professor | null;
}

export const EditProfessorModal: React.FC<EditProfessorModalProps> = ({ isOpen, onClose, onSuccess, professor }) => {
    const { filters } = useFilters();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        numeroEconomico: '',
        nombre: '',
        correo_uam_prefix: '',
        correo_personal: '',
        gradoEstudios: '',
        idProfesorTipo: '', // Contrato (optional update)
        celular: ''
    });

    // Populate form when professor changes or modal opens
    useEffect(() => {
        if (isOpen && professor) {
            const emailParts = (professor.correo_uam || '').split('@');
            const prefix = emailParts.length > 0 ? emailParts[0] : '';

            setFormData({
                numeroEconomico: professor.numeroEconomico?.toString() || '',
                nombre: professor.nombre || '',
                correo_uam_prefix: prefix,
                correo_personal: professor.correo_personal || '',
                gradoEstudios: professor.gradoEstudios || '',
                idProfesorTipo: '', // Don't pre-fill contract ID as we might not know it from just 'Professor' object easily without fetching details. 
                // For now, leave empty. If user selects one, it updates.
                celular: professor.celular || ''
            });
            setError(null);
        }
    }, [isOpen, professor]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.numeroEconomico) return 'El número económico es obligatorio';
        if (!/^\d+$/.test(formData.numeroEconomico)) return 'Número económico debe ser numérico';
        if (!formData.nombre) return 'El nombre es obligatorio';
        if (!formData.correo_uam_prefix) return 'El correo UAM es obligatorio';
        if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(formData.correo_uam_prefix)) return 'Correo UAM inválido (solo prefijo)';
        // idProfesorTipo is optional here, unlike Create
        if (formData.celular && !/^\d{0,10}$/.test(formData.celular)) return 'Celular inválido'; // basic check
        if (formData.celular && formData.celular.length !== 10) return 'Celular debe tener 10 dígitos';

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

        if (!professor) return;

        setLoading(true);
        setError(null);

        try {
            // Check duplicates only if relevant fields changed? 
            // The backend update might handle collision checks, but let's assume ValidaProfesorExiste is mostly for new ones.
            // We'll skip duplicate check for now and rely on backend constraints or assume user knows what they are doing.
            // Ideally we should check if numeroEconomico changed and if it conflicts.

            const data = new FormData();
            data.append('idProfesor', professor.idProfesor.toString());
            data.append('numeroEconomico', formData.numeroEconomico);
            data.append('nombre', formData.nombre);
            data.append('correo_uam', formData.correo_uam_prefix + '@azc.uam.mx');
            data.append('correo_personal', formData.correo_personal);
            data.append('gradoEstudios', formData.gradoEstudios);
            data.append('celular', formData.celular);

            if (formData.idProfesorTipo) {
                data.append('idProfesorTipo', formData.idProfesorTipo);
            }

            const res = await fetch('controlador/actualizarProfesor.php', { method: 'POST', body: data });
            const json = await res.json();

            if (!json.ok) throw new Error(json.error || 'Error al actualizar');

            if (json.contrato_warning) {
                alert('Profesor actualizado, pero hubo un aviso con el contrato: ' + json.contrato_warning);
            }

            onSuccess();
            onClose();

        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Editar Profesor"
            loading={loading}
            error={error}
            formId="formEditarProfesor"
        >
            <form id="formEditarProfesor" onSubmit={handleSubmit}>
                <div className="mb-2">
                    <label className="form-label">Número Económico</label>
                    <input
                        name="numeroEconomico"
                        className="form-control"
                        value={formData.numeroEconomico}
                        onChange={handleChange}
                        required
                        disabled // ID usually cannot be changed
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
        </BaseModal>
    );
};
