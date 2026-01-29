import React, { useState } from 'react';
import Modal from '../components/common/Modal';
import * as API from './api';
import './ImportUEAModal.css';

interface ImportUEAModalProps {
    show: boolean;
    onClose: () => void;
}

export default function ImportUEAModal({ show, onClose }: ImportUEAModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<{
        submitting: boolean;
        error: string | null;
        success: string | null;
        details: any | null;
    }>({
        submitting: false,
        error: null,
        success: null,
        details: null
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files && e.target.files[0];
        setFile(selected || null);
        setStatus(prev => ({ ...prev, error: null, success: null, details: null }));
    };

    const handleImport = async () => {
        if (!file) {
            setStatus(prev => ({ ...prev, error: 'Selecciona un archivo CSV' }));
            return;
        }

        setStatus({ submitting: true, error: null, success: null, details: null });

        try {
            const res = await API.importarUEA(file);
            if (res.ok) {
                setStatus(prev => ({
                    ...prev,
                    success: 'Importación completada',
                    details: res
                }));
            } else {
                setStatus(prev => ({ ...prev, error: res.error || 'Error al importar' }));
            }
        } catch (e) {
            setStatus(prev => ({ ...prev, error: 'Error de red' }));
        } finally {
            setStatus(prev => ({ ...prev, submitting: false }));
        }
    };

    const reset = () => {
        setFile(null);
        setStatus({ submitting: false, error: null, success: null, details: null });
        onClose();
    };

    return (
        <Modal
            show={show}
            title="Importar catálogo de UEA (CSV)"
            onClose={reset}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={reset}>Cerrar</button>
                    {!status.success && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleImport}
                            disabled={!file || status.submitting}
                        >
                            {status.submitting ? 'Importando...' : 'Ejecutar importación'}
                        </button>
                    )}
                </>
            }
        >
            <div className="mb-3">
                <p className="small text-muted">
                    El CSV debe tener las columnas en este orden (sin cabecera obligatoria): <strong>claveUEA, nombreUEA, idArea</strong>.
                </p>

                <input
                    type="file"
                    className="form-control"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={status.submitting || !!status.success}
                />
            </div>

            {status.error && <div className="alert alert-danger">{status.error}</div>}

            {status.success && (
                <div className={`alert ${(status.details?.errors?.length > 0 && status.details?.inserted === 0) ? 'alert-danger' :
                        (status.details?.errors?.length > 0 && status.details?.inserted > 0) ? 'alert-warning' :
                            'alert-success'
                    }`}>
                    <h6 className="alert-heading">{status.success}</h6>
                    {status.details && (
                        <div className="small mt-2">
                            <div>Procesados: {status.details.processed}</div>
                            <div>Insertados: {status.details.inserted}</div>
                            <div>Actualizados: {status.details.updated}</div>
                            {status.details.errors && status.details.errors.length > 0 && (
                                <div className="mt-2 text-danger">
                                    <strong>Errores ({status.details.errors.length}):</strong>
                                    <ul className="mb-0 ps-3" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                        {status.details.errors.map((e: any, i: number) => (
                                            <li key={i}>Línea {e.line}: {e.error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
};
