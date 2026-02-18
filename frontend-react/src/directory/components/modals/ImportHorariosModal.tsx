
import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { importarHorarios } from '../../api';

interface ImportHorariosModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const ImportHorariosModal: React.FC<ImportHorariosModalProps> = ({ isOpen, onClose, onSuccess }) => {
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
                const res = await importarHorarios(json);

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
            title="Importar Horarios de Trabajo"
            loading={loading}
            error={error}
            formId="formImportHorarios"
        >
            <form id="formImportHorarios" onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Archivo JSON de Horarios</label>
                    <input
                        type="file"
                        accept=".json"
                        className="form-control"
                        onChange={handleFileChange}
                        required
                    />
                    <div className="form-text">
                        El JSON debe contener un objeto donde las llaves son los códigos de días (ej. "L-V") y los valores son arreglos de rangos horarios (ej. "07:00-10:00").
                    </div>
                </div>
            </form>
        </BaseModal>
    );
};
