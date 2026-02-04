import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import FormInput from './common/FormInput';
import FormSelect from './common/FormSelect';
import { getAllFunctions, addUser } from './userAPI';
import { UserFunction } from './types';

interface UserModalProps {
    show: boolean;
    onClose: () => void;
    onUserAdded: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ show, onClose, onUserAdded }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [functionId, setFunctionId] = useState('');
    const [functions, setFunctions] = useState<UserFunction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (show) {
            // Reset form
            setUsername('');
            setPassword('');
            setFunctionId('');
            setError(null);

            // Fetch functions
            getAllFunctions().then(data => {
                const list = Array.isArray(data) ? data : (data.funciones || []);
                setFunctions(list);
            }).catch(err => {
                console.error(err);
                setError('Error cargando funciones');
            });
        }
    }, [show]);

    const handleSave = async () => {
        if (!username || !password || !functionId) {
            setError('Todos los campos son obligatorios');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const resp = await addUser({ usuario: username, contraseña: password }, functionId);
            if (resp.ok) {
                onUserAdded();
                onClose();
            } else {
                setError(resp.msg || 'Error al guardar usuario');
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const functionOptions = functions.map(f => ({
        value: f.nombre,
        label: f.nombre
    }));
    // Add default option
    if (functionOptions.length === 0) {
        functionOptions.push({ value: '', label: 'Cargando o sin funciones...' });
    }

    const footer = (
        <>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
            </button>
        </>
    );

    return (
        <Modal
            show={show}
            title="Agregar Nuevo Usuario"
            onClose={onClose}
            footer={footer}
        >
            {error && <div className="alert alert-danger">{error}</div>}
            <FormInput
                id="new_usuario"
                label="Usuario"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                required
            />
            <FormInput
                id="new_pwd"
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
            />
            <FormSelect
                id="new_funcion"
                label="Función Inicial"
                value={functionId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFunctionId(e.target.value)}
                options={[{ value: '', label: '-- Seleccionar --' }, ...functionOptions]}
            />
        </Modal>
    );
};
