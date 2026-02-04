import React, { useState, useEffect } from 'react';
import { useFilters } from '../../hooks/useFilters';
import { BaseModal } from './BaseModal';
import { Admin } from '../../types';

interface EditAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    admin: Admin | null;
}

export const EditAdminModal: React.FC<EditAdminModalProps> = ({ isOpen, onClose, onSuccess, admin }) => {
    const { filters } = useFilters();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        numeroEconomico: '',
        nombre: '',
        correo_uam_prefix: '',
        correo_personal: '',
        gradoEstudios: '',
        idAdministrativoTipo: '',
        celular: '',
        lugar: '',
        extension: ''
    });

    useEffect(() => {
        if (isOpen && admin) {
            const emailParts = (admin.correo_uam || '').split('@');
            const prefix = emailParts.length > 0 ? emailParts[0] : '';

            setFormData({
                numeroEconomico: admin.numeroEconomico?.toString() || '',
                nombre: admin.nombre || '',
                correo_uam_prefix: prefix,
                correo_personal: admin.correo_personal || '',
                gradoEstudios: admin.gradoEstudios || '',
                idAdministrativoTipo: admin.idAdministrativoTipo?.toString() || '',
                celular: admin.celular || '',
                lugar: admin.lugar || '',
                extension: admin.extension || ''
            });
            setError(null);
        }
    }, [isOpen, admin]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.numeroEconomico) return 'El número económico es obligatorio';
        if (!/^\d+$/.test(formData.numeroEconomico)) return 'Número económico debe ser numérico';
        if (!formData.nombre) return 'El nombre es obligatorio';
        if (!formData.correo_uam_prefix) return 'El correo UAM es obligatorio';
        if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(formData.correo_uam_prefix)) return 'Correo UAM inválido (solo prefijo)';
        if (!formData.idAdministrativoTipo) return 'Seleccione el tipo de administrativo';

        if (formData.celular && !/^\d{0,10}$/.test(formData.celular)) return 'Celular inválido';
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
        if (!admin) return;

        setLoading(true);
        setError(null);

        try {
            const data = new FormData();
            data.append('idAdministrativo', admin.idAdministrativo.toString());
            data.append('numeroEconomico', formData.numeroEconomico);
            data.append('nombre', formData.nombre);
            data.append('correo_uam', formData.correo_uam_prefix + '@azc.uam.mx');
            data.append('correo_personal', formData.correo_personal);
            data.append('gradoEstudios', formData.gradoEstudios);
            data.append('idAdministrativoTipo', formData.idAdministrativoTipo);
            data.append('celular', formData.celular);
            data.append('lugar', formData.lugar);
            data.append('extension', formData.extension);

            const saveRes = await fetch('controlador/actualizarAdministrativo.php', { method: 'POST', body: data });
            const saveJson = await saveRes.json();

            if (!saveJson.ok) throw new Error(saveJson.error || 'Error al actualizar');

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
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Editar Administrativo"
            loading={loading}
            error={error}
            formId="formEditarAdmin"
        >
            <form id="formEditarAdmin" onSubmit={handleSubmit}>
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
                        <option value="Licenciatura">Licenciatura</option>
                        <option value="Maestría">Maestría</option>
                        <option value="Doctorado">Doctorado</option>
                        <option value="Bachillerato">Bachillerato</option>
                        <option value="Técnico">Técnico</option>
                    </select>
                </div>
                <div className="mb-2">
                    <label className="form-label">Tipo de personal</label>
                    <select
                        name="idAdministrativoTipo"
                        className="form-select"
                        value={formData.idAdministrativoTipo}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Seleccione tipo</option>
                        {filters.administrativoTipos.map(t => (
                            <option key={t.idAdministrativoTipo} value={t.idAdministrativoTipo}>{t.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="row">
                    <div className="col-md-6 mb-2">
                        <label className="form-label">Celular</label>
                        <input
                            name="celular"
                            className="form-control"
                            value={formData.celular}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="col-md-6 mb-2">
                        <label className="form-label">Extensión</label>
                        <input
                            name="extension"
                            className="form-control"
                            value={formData.extension}
                            onChange={handleChange}
                        />
                    </div>
                </div>
                <div className="mb-2">
                    <label className="form-label">Lugar/Ubicación</label>
                    <input
                        name="lugar"
                        className="form-control"
                        value={formData.lugar}
                        onChange={handleChange}
                    />
                </div>
            </form>
        </BaseModal>
    );
};
