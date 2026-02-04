import React, { useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { UsersPage } from './UsersPage';

export const AdminApp: React.FC = () => {
    const [view, setView] = useState<'dashboard' | 'users'>('dashboard');

    const handleNavigate = (target: string) => {
        if (target === 'users') {
            setView('users');
        } else if (target === 'trimestres') {
            // Logic to mount the existing trimestres app
            // Attempt to unmount self?? No, trimestres takes over the container usually.
            // But we are in a single "admin-menu" container.
            // If we unmount, we destroy ourselves.
            // Legacy code logic:
            /*
             if (window.mountMenuTrimestres) {
                 adminMenu.innerHTML = '<div id="react-root-trimestres"></div>';
                 window.mountMenuTrimestres('react-root-trimestres');
                 ...
             }
            */
            // So we need to mimic this. 
            // We can perhaps just call the global mount function if it exists.
            if (typeof window.mountMenuTrimestres === 'function') {
                const adminMenu = document.getElementById('admin-menu');
                if (adminMenu) {
                    // Mount Trimestres App directly on the same container
                    // main.tsx will handle unmounting of AdminApp
                    window.mountMenuTrimestres('admin-menu');

                    // Setup exit handler
                    (window as any).onExitTrimestres = function () {
                        if (window.mountAdminApp) window.mountAdminApp('admin-menu');
                        else window.location.reload();
                        delete (window as any).onExitTrimestres;
                    };
                }
            } else {
                window.location.href = 'trimestreM.php';
            }

        } else if (target === 'directory') {
            if (typeof window.mountDirectoryMenu === 'function') {
                const adminMenu = document.getElementById('admin-menu');
                if (adminMenu) {

                    window.mountDirectoryMenu('admin-menu');
                }
            } else {
                if ((window as any).crearMenuDirectorio) (window as any).crearMenuDirectorio();
                else alert('Directorio no disponible');
            }
        }
    };

    return (
        <React.StrictMode>
            <div className="container-fluid p-3">
                {view === 'dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
                {view === 'users' && <UsersPage onBack={() => setView('dashboard')} />}
            </div>
        </React.StrictMode>
    );
};
