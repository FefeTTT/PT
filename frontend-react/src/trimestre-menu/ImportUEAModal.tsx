import React, { useState } from 'react';
import Modal from '../components/common/Modal';
import * as API from './api';
import './ImportUEAModal.css';

interface ImportUEAModalProps {
    show: boolean;
    onClose: () => void;
}

const diccionarioPrefijos: { [key: string]: string } = {
    "1100": "TIM",
    "1111": "Física",
    "1112": "Matemáticas",
    "1113": "Química",
};

export default function ImportUEAModal({ show, onClose }: ImportUEAModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<{
        submitting: boolean;
        error: string | null;
        success: string | null;
        details: any | null;
        progress?: number;
        total?: number;
    }>({
        submitting: false,
        error: null,
        success: null,
        details: null,
        progress: 0,
        total: 0
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files && e.target.files[0];
        setFile(selected || null);
        setStatus(prev => ({ ...prev, error: null, success: null, details: null, progress: 0, total: 0 }));
    };

    const getAreaIdByName = (areaName: string): number | null => {
        const entry = Object.entries(diccionarioPrefijos).find(([, val]) => val === areaName);
        return entry ? parseInt(entry[0], 10) : null;
    };

    const handleImport = async () => {
        if (!file) {
            setStatus(prev => ({ ...prev, error: 'Selecciona un archivo JSON' }));
            return;
        }

        setStatus({ submitting: true, error: null, success: null, details: null, progress: 0, total: 0 });

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const jsonUEA = JSON.parse(content);
                const keys = Object.keys(jsonUEA);
                const total = keys.length;

                setStatus(prev => ({ ...prev, total, progress: 0 }));

                let inserted = 0;
                let errors: any[] = [];

                for (let i = 0; i < total; i++) {
                    const clave = keys[i];
                    const item = jsonUEA[clave];
                    const areaName = item.area;
                    const nombre = item.nombre;
                    const areaId = getAreaIdByName(areaName);

                    if (areaId) {
                        try {
                            const res = await API.insertarUEA({
                                clave: parseInt(clave, 10),
                                nombre: nombre,
                                areaId: areaId
                            });

                            if (res.isItOk) {
                                inserted++;
                            } else {
                                errors.push({ clave, error: res.error });
                            }
                        } catch (err: any) {
                            errors.push({ clave, error: err.message || 'Error de red' });
                        }
                    } else {
                        errors.push({ clave, error: `Area '${areaName}' no encontrada en diccionario` });
                    }

                    setStatus(prev => ({ ...prev, progress: i + 1 }));
                }

                setStatus(prev => ({
                    ...prev,
                    submitting: false,
                    success: 'Proceso completado',
                    details: {
                        processed: total,
                        inserted,
                        errors
                    }
                }));

            } catch (err) {
                setStatus(prev => ({ ...prev, submitting: false, error: 'Error al procesar JSON' }));
            }
        };

        reader.readAsText(file);
    };

    const reset = () => {
        setFile(null);
        setStatus({ submitting: false, error: null, success: null, details: null, progress: 0, total: 0 });
        onClose();
    };

    return (
        <Modal
            show={show}
            title="Importar catálogo de UEA (JSON)"
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
                            {status.submitting ? `Procesando... ${status.progress}/${status.total}` : 'Ejecutar importación'}
                        </button>
                    )}
                </>
            }
        >
            <div className="mb-3">
                <p className="small text-muted">
                    El archivo debe ser un JSON donde las claves son las claves de UEA y el valor contiene "area" y "nombre".
                </p>

                <input
                    type="file"
                    className="form-control"
                    accept=".json"
                    onChange={handleFileChange}
                    disabled={status.submitting || !!status.success}
                />
            </div>

            {status.error && <div className="alert alert-danger">{status.error}</div>}

            {status.success && (
                <div className="alert alert-success">
                    <h6 className="alert-heading">{status.success}</h6>
                    {status.details && (
                        <div className="small mt-2">
                            <div>Total procesados: {status.details.processed}</div>
                            <div>Insertados correctamente: {status.details.inserted}</div>
                            {status.details.errors && status.details.errors.length > 0 && (
                                <div className="mt-2 text-danger">
                                    <strong>Errores ({status.details.errors.length}):</strong>
                                    <ul className="mb-0 ps-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                        {status.details.errors.map((e: any, i: number) => (
                                            <li key={i}>Clave {e.clave}: {e.error}</li>
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

