import React, { useState, useEffect } from 'react';
import { Location } from '../../types';

interface ManageLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    professorId: string | number;
    location?: Location | null; // If present, edit mode
}

interface Edificio {
    idEdificio: number;
    nombreEdificio: string;
}

interface Piso {
    idPiso: number;
    nombrePiso: string;
    idEdificio: number;
}

export const ManageLocationModal: React.FC<ManageLocationModalProps> = ({ isOpen, onClose, onSuccess, professorId, location }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [edificios, setEdificios] = useState<Edificio[]>([]);
    const [pisos, setPisos] = useState<Piso[]>([]);

    const [formData, setFormData] = useState({
        edificio: '',
        piso: '',
        nombre: ''
    });

    // Helper to find ID from name (since backend expects name but we need ID for filtering)
    const getEdificioId = (name: string) => edificios.find(e => e.nombreEdificio === name)?.idEdificio;

    useEffect(() => {
        if (isOpen) {
            fetchEdificios();
            if (location) {
                setFormData({
                    edificio: location.edificio || '',
                    piso: location.piso?.toString() || '',
                    nombre: location.nombre || ''
                });
            } else {
                setFormData({
                    edificio: '',
                    piso: '',
                    nombre: ''
                });
            }
            setError(null);
        }
    }, [isOpen, location]);

    // When edificio changes (or is set initially), fetch pisos
    useEffect(() => {
        if (formData.edificio && edificios.length > 0) {
            const id = getEdificioId(formData.edificio);
            if (id) {
                fetchPisos(id);
            } else {
                // New building or not in list
                setPisos([]);
            }
        } else {
            setPisos([]);
        }
    }, [formData.edificio, edificios]);


    const fetchEdificios = async () => {
        try {
            const res = await fetch('controlador/recuperaEdificios.php');
            const data = await res.json();
            if (Array.isArray(data)) {
                setEdificios(data);
            }
        } catch (e) {
            console.error("Error fetching edificios", e);
        }
    };

    const fetchPisos = async (idEdificio: number) => {
        try {
            const res = await fetch(`controlador/recuperaPisos.php?idEdificio=${idEdificio}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setPisos(data);
            } else {
                setPisos([]);
            }
        } catch (e) {
            console.error("Error fetching pisos", e);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () => {
        if (!formData.edificio) return 'Edificio es obligatorio';
        if (!formData.piso) return 'Piso es obligatorio';
        if (!formData.nombre) return 'Cubículo/Nombre es obligatorio';
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
            const data = new FormData();

            if (location) {
                // Edit
                data.append('idLugar', location.idLugar?.toString() || '0');
            } else {
                // Add
                data.append('idProfesor', professorId.toString());
            }

            data.append('edificio', formData.edificio);
            data.append('piso', formData.piso);
            data.append('nombre', formData.nombre);

            const url = location ? 'controlador/editarLugarProfesor.php' : 'controlador/agregarLugarProfesor.php';
            const res = await fetch(url, { method: 'POST', body: data });
            const json = await res.json();

            if (!json.ok) throw new Error(json.msg || json.error || 'Error al guardar lugar');
            if (json.error) throw new Error(json.error);

            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isEdit = !!location;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">{isEdit ? 'Editar Ubicación' : 'Nueva Ubicación'}</h5>
                            <button type="button" className="btn-close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <form onSubmit={handleSubmit}>
                                <div className="row">
                                    <div className="col-md-6 mb-2">
                                        <label className="form-label">Edificio</label>
                                        <div className="input-group">
                                            <select
                                                name="edificio"
                                                className="form-select"
                                                value={formData.edificio}
                                                onChange={handleChange}
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {edificios.map(e => (
                                                    <option key={e.idEdificio} value={e.nombreEdificio}>{e.nombreEdificio}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="col-md-6 mb-2">
                                        <label className="form-label">Piso</label>
                                        <div className="input-group">
                                            <input
                                                list="pisos-list"
                                                name="piso"
                                                className="form-control"
                                                value={formData.piso}
                                                onChange={handleChange}
                                                placeholder="Seleccionar o escribir"
                                                required
                                                disabled={!formData.edificio}
                                            />
                                            <datalist id="pisos-list">
                                                {pisos.map(p => (
                                                    <option key={p.idPiso} value={p.nombrePiso} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <label className="form-label">Cubículo</label>
                                    <input
                                        name="nombre"
                                        className="form-control"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ej. 128-A"
                                    />
                                    <div className="form-text">Número de cubículo.</div>
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
