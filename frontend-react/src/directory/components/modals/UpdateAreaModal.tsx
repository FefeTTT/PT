import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import axios from 'axios';

interface UpdateAreaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    numeroEconomico: string | number;
    currentIdArea?: string | number;
}

interface Area {
    idArea: string | number;
    nombre: string;
}

export const UpdateAreaModal: React.FC<UpdateAreaModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    numeroEconomico,
    currentIdArea
}) => {
    const [areas, setAreas] = useState<Area[]>([]);
    const [selectedArea, setSelectedArea] = useState<string | number>(currentIdArea || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAreas();
            setSelectedArea(currentIdArea || '');
            setError(null);
        }
    }, [isOpen, currentIdArea]);

    const fetchAreas = async () => {
        setLoading(true);
        try {
            const res = await axios.get('controlador/recuperaAreas.php');
            if (res.data.isItOk) {
                setAreas(res.data.areas);
            } else {
                setError('Error al cargar áreas');
            }
        } catch (e) {
            console.error(e);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                numeroEconomico: numeroEconomico,
                idArea: selectedArea ? parseInt(selectedArea.toString()) : null
            };

            const res = await axios.post('controlador/actualizarProfesorArea.php', payload);

            if (res.data && (res.data['isItOk'] === true || res.data.isItOk === true)) {
                onSuccess();
                onClose();
            } else {
                setError(res.data.error || 'Error al actualizar área');
            }
        } catch (e: any) {
            console.error(e);
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Actualizar Área de Conocimiento"
            loading={loading}
            error={error}
            formId="formUpdateArea"
        >
            <form id="formUpdateArea" onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Área</label>
                    <select
                        className="form-select"
                        value={selectedArea}
                        onChange={e => setSelectedArea(e.target.value)}
                    >
                        <option value="">Seleccione...</option>
                        {areas.map(a => (
                            <option key={a.idArea} value={a.idArea}>
                                {a.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </form>
        </BaseModal>
    );
};
