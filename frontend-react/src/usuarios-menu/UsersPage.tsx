import React, { useState, useEffect } from 'react';
import { UserTable } from './UserTable';
import { UserModal } from './UserModal';
import { getUsers } from './userAPI';
import { User } from './types';

interface UsersPageProps {
    onBack: () => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ onBack }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const loadUsers = () => {
        setLoading(true);
        getUsers()
            .then(data => setUsers(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadUsers();
    }, []);

    return (
        <div className="users-page">
            <div className="d-flex align-items-center mb-3 justify-content-between">
                <div className="d-flex align-items-center">
                    <button className="btn btn-sm btn-outline-secondary me-3" onClick={onBack} title="Volver">
                        &#8592; Volver
                    </button>
                    <h5 className="m-0">Usuarios</h5>
                </div>
                <div>
                    {/* Placeholder for extra header actions if needed */}
                </div>
            </div>

            {loading ? (
                <div className="text-center p-5">Cargando usuarios...</div>
            ) : (
                <>
                    <UserTable users={users} onUserUpdated={loadUsers} />

                    <div className="mt-4 text-end">
                        <button
                            className="btn btn-success btn-sm d-inline-flex align-items-center gap-2"
                            onClick={() => setShowModal(true)}
                        >
                            <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>+</span> Agregar usuario
                        </button>
                    </div>
                </>
            )}

            <UserModal
                show={showModal}
                onClose={() => setShowModal(false)}
                onUserAdded={loadUsers}
            />
        </div>
    );
};
