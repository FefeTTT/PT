
import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { importarHorariosProfesores } from '../../api';

interface ImportHorariosProfesoresModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportHorariosProfesoresModal: React.FC<ImportHorariosProfesoresModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Seleccione un archivo JSON');
            return;
        }

        setLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result;
                if (typeof text !== 'string') throw new Error('Error al leer el archivo');

                const json = JSON.parse(text);

                if (typeof json !== 'object' || Array.isArray(json)) {
                    throw new Error('El JSON debe ser un objeto con claves para los días (Ej: "L-V")');
                }

                const res = await importarHorariosProfesores(json);

                if (res.isItOk) {
                    alert(`Importación finalizada.\nProcesados: ${res.processed}\nÉxitos: ${res.successes}\nErrores: ${res.errors}`);
                    onSuccess();
                    onClose();
                } else {
                    throw new Error(res.details ? res.details.join(', ') : 'Error desconocido');
                }

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Error al procesar el archivo');
            } finally {
                setLoading(false);
            }
        };

        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Importar Horarios de Profesores"
            loading={loading}
            error={error}
            formId="formImportHorariosProfesores"
        >
            <form id="formImportHorariosProfesores" onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Archivo JSON de Relación Profesores-Horarios</label>
                    <input
                        type="file"
                        accept=".json"
                        className="form-control"
                        onChange={handleFileChange}
                        required
                    />
                    <div className="form-text">
                        El archivo debe seguir la estructura: Días {"->"} Rango Horario {"->"} numerosEconomicos: [lista de IDs].
                    </div>
                </div>
            </form>
        </BaseModal>
    );
};
