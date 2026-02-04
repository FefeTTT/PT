import React, { useState } from 'react';
import { User, UserFunction } from './types';
import { updatePassword, deleteUser, getUserFunctions, updateUserFunction, getAllFunctions } from './userAPI';


interface UserTableProps {
    users: User[];
    onUserUpdated: () => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, onUserUpdated }) => {

    // Headers logic similar to legacy
    const getHeaders = (uList: User[]) => {
        if (uList.length > 0) {
            const keys = Object.keys(uList[0]);
            return keys.filter(h => {
                const n = h.toLowerCase();
                if (['id', 'idusuario', 'id_usuario', 'id_user', 'userid', 'intento'].includes(n)) return false;
                if (n.endsWith('id')) return false;
                return true;
            });
        }
        return ['usuario', 'contraseña'];
    };

    const headers = getHeaders(users);

    return (
        <div className="table-responsive">
            <table className="table table-striped table-sm users-table">
                <thead>
                    <tr>
                        {headers.map(h => (
                            <th key={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</th>
                        ))}
                        <th>Funciones asignadas</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u, idx) => (
                        <UserRow
                            key={u.idUsuario || u.usuario || idx}
                            user={u}
                            headers={headers}
                            onUpdate={onUserUpdated}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Sub-component for individual rows to manage state better
const UserRow: React.FC<{ user: User, headers: string[], onUpdate: () => void }> = ({ user, headers, onUpdate }) => {
    const [editingPwd, setEditingPwd] = useState(false);
    const [editingFunc, setEditingFunc] = useState(false);
    const [newPwd, setNewPwd] = useState('');
    const [functions, setFunctions] = useState<string>('Cargando...');
    const [loadingFunc, setLoadingFunc] = useState(false);

    // Function editing state
    const [allFuncs, setAllFuncs] = useState<UserFunction[]>([]);
    const [selectedFunc, setSelectedFunc] = useState('');
    const [currentFuncName, setCurrentFuncName] = useState('');

    // Load functions on mount
    React.useEffect(() => {
        setLoadingFunc(true);
        getUserFunctions(user.usuario).then(resp => {
            if (resp.ok && resp.funciones.length > 0) {
                const names = resp.funciones.map(f => f.nombre).join(', ');
                setFunctions(names || 'Sin nombre');
                setCurrentFuncName(resp.funciones[0].nombre); // Assume single function for edit logic for now as per legacy
            } else {
                setFunctions('Sin funciones');
                setCurrentFuncName('');
            }
        }).finally(() => setLoadingFunc(false));
    }, [user.usuario, editingFunc]); // Reload when editing finishes

    const handleDelete = async () => {
        if (!window.confirm(`¿Eliminar el usuario "${user.usuario}"?`)) return;
        const res = await deleteUser(user.usuario);
        if (res.ok) onUpdate();
        else alert('Error: ' + (res.msg || 'No se pudo eliminar'));
    };

    const handlePwdCheck = async () => {
        if (!newPwd) return alert('La contraseña no puede estar vacía');
        const res = await updatePassword(user.usuario, newPwd);
        if (res.ok) {
            setEditingPwd(false);
            setNewPwd('');
            alert('Contraseña actualizada');
        } else {
            alert('Error: ' + res.msg);
        }
    };

    const startEditFunc = async () => {
        setEditingFunc(true);
        try {
            const af = await getAllFunctions();
            const list = Array.isArray(af) ? af : (af.funciones || []);
            setAllFuncs(list);
            setSelectedFunc(currentFuncName);
        } catch (e) {
            console.error(e);
            setEditingFunc(false);
            alert('Error cargando funciones');
        }
    };

    const saveFunc = async () => {
        if (!selectedFunc) return;
        const res = await updateUserFunction(user.usuario, currentFuncName, selectedFunc);
        if (res.ok) {
            setEditingFunc(false);
            onUpdate(); // Refresh whole list?? or just row state
            // Re-fetch functions for this row is handled by useEffect on editingFunc change
        } else {
            alert('Error: ' + res.msg);
        }
    };

    return (
        <tr>
            {headers.map(h => {
                if (h === 'contraseña') {
                    return (
                        <td key={h}>
                            {editingPwd ? (
                                <div className="d-flex align-items-center gap-2">
                                    <input
                                        type="password"
                                        className="form-control form-control-sm"
                                        placeholder="Nueva contraseña"
                                        value={newPwd}
                                        onChange={e => setNewPwd(e.target.value)}
                                    />
                                    <button className="btn btn-success btn-sm" onClick={handlePwdCheck}>Ok</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => setEditingPwd(false)}>Cancelar</button>
                                </div>
                            ) : (
                                <button className="btn btn-warning btn-sm" onClick={() => setEditingPwd(true)}>
                                    Cambiar contraseña
                                </button>
                            )}
                        </td>
                    );
                } else if (h === 'usuario') {
                    return (
                        <td key={h}>
                            <button className="btn btn-danger btn-sm me-2" onClick={handleDelete}>&times;</button>
                            <span>{user[h]}</span>
                        </td>
                    );
                } else {
                    return <td key={h}>{user[h]}</td>;
                }
            })}
            <td>
                {editingFunc ? (
                    <div className="d-flex align-items-center gap-2">
                        <select
                            className="form-select form-select-sm"
                            value={selectedFunc}
                            onChange={e => setSelectedFunc(e.target.value)}
                        >
                            {allFuncs.map(f => <option key={f.nombre} value={f.nombre}>{f.nombre}</option>)}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={saveFunc}>Guardar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingFunc(false)}>Cancelar</button>
                    </div>
                ) : (
                    <button className="btn btn-info btn-sm" disabled={loadingFunc} onClick={startEditFunc}>
                        {functions} {'\u270E'}
                    </button>
                )}
            </td>
        </tr>
    );
};
