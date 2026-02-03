import React from 'react';
import { useAdminDetails } from '../hooks/useAdminDetails';
import { Admin } from '../types';

interface AdminDetailsProps {
    id: string | number;
    canEdit: boolean;
    onEdit: (admin: Admin) => void;
    onDelete: (admin: Admin) => void;
}

export const AdminDetails: React.FC<AdminDetailsProps> = ({ id, canEdit, onEdit, onDelete }) => {
    const { details, loading, error } = useAdminDetails(id);

    if (loading) return <div className="p-3 text-center"><div className="spinner-border text-primary" role="status"></div></div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!details) return null;

    const { administrativo: a } = details;

    return (
        <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center bg-white">
                <h5 className="mb-0 text-primary">{a.nombre}</h5>
                {canEdit && (
                    <div>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => onEdit(a)}>
                            <i className="bi bi-pencil"></i> Editar
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(a)}>
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                )}
            </div>
            <div className="card-body">
                <div className="row mb-3">
                    <div className="col-md-6">
                        <strong>No. Económico:</strong> {a.numeroEconomico}
                    </div>
                    <div className="col-md-6">
                        <strong>Correo UAM:</strong> {a.correo_uam}
                    </div>
                    <div className="col-md-6">
                        <strong>Tipo:</strong> {a.tipoNombre || 'Administrativo'}
                    </div>
                    <div className="col-md-6">
                        <strong>Lugar:</strong> {a.lugar || '-'}
                    </div>
                    <div className="col-md-6">
                        <strong>Extensión:</strong> {a.extension || '-'}
                    </div>
                </div>
            </div>
        </div>
    );
};
