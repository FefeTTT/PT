import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import axios from 'axios';

interface UpdateDegreeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    numeroEconomico: string | number;
    currentIdGrado?: string | number;
}

interface Degree {
    idGrado: string | number;
    nombre: string;
}

export const UpdateDegreeModal: React.FC<UpdateDegreeModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    numeroEconomico,
    currentIdGrado
}) => {
    const [degrees, setDegrees] = useState<Degree[]>([]);
    const [selectedDegree, setSelectedDegree] = useState<string | number>(currentIdGrado || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDegrees();
            setSelectedDegree(currentIdGrado || '');
            setError(null);
        }
    }, [isOpen, currentIdGrado]);

    const fetchDegrees = async () => {
        setLoading(true);
        try {
            const res = await axios.get('controlador/recuperaGrados.php');
            if (res.data.isItOk) {
                setDegrees(res.data.grados);
            } else {
                setError('Error al cargar grados académicos');
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
                idGrado: selectedDegree ? parseInt(selectedDegree.toString()) : null
            };

            const res = await axios.post('controlador/actualizarProfesorGrado.php', payload);


            if (res.data && res.data.isItOk === true) {
                onSuccess();
                onClose();
            } else {
                setError(res.data.error || 'Error al actualizar grado');
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
            title="Actualizar Grado Académico"
            loading={loading}
            error={error}
            formId="formUpdateDegree"
        >
            <form id="formUpdateDegree" onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Grado</label>
                    <select
                        className="form-select"
                        value={selectedDegree}
                        onChange={e => setSelectedDegree(e.target.value)}
                    >
                        <option value="">Seleccione...</option>
                        {degrees.map(d => (
                            <option key={d.idGrado} value={d.idGrado}>
                                {d.nombre}
                            </option>
                        ))}
                    </select>
                </div>
            </form>
        </BaseModal>
    );
};
