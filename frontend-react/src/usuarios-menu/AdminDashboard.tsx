import React from 'react';

interface DashboardProps {
    onNavigate: (view: string) => void;
}

export const AdminDashboard: React.FC<DashboardProps> = ({ onNavigate }) => {

    // Checks for function ID based filtering (legacy logic)
    const getTiles = () => {
        let tiles = [
            {
                id: 'menu-usuario',
                img: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
                alt: 'Usuarios',
                title: 'Usuarios',
                action: () => onNavigate('users'),
                tileClass: 'datos-tile'
            },
            {
                id: 'menu-trimestre',
                img: 'https://cdn-icons-png.flaticon.com/512/2917/2917996.png',
                alt: 'Trimestres',
                title: 'Trimestres',
                action: () => {
                    if (typeof window.mountMenuTrimestres === 'function') {
                        try {
                            // Use a specific container or clearing mechanism if needed, 
                            // but typically we might just tell the parent to switch mode 
                            // or mounting happens outside this component's scope.
                            // However, legacy replaced the innerHTML of 'admin-menu'.
                            // In React, we might need a 'Trimestres' view wrapper.
                            onNavigate('trimestres');
                        } catch (e) { console.error(e) }
                    } else {
                        window.location.href = 'trimestreM.php';
                    }
                },
                tileClass: 'datos-tile'
            },
            {
                id: 'menu-reserva',
                img: 'https://cdn-icons-png.flaticon.com/512/561/561127.png',
                alt: 'Sistema de reserva',
                title: 'Sistema de reserva',
                action: () => alert('Módulo no implementado actualmente.'),
                tileClass: 'prog-tile'
            },
            {
                id: 'menu-directorio',
                img: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                alt: 'Directorio',
                title: 'Directorio',
                action: () => {
                    // Legacy: if (global.crearMenuDirectorio) global.crearMenuDirectorio();
                    // We should check if we can simply call the legacy global or if we migrated it.
                    // The user mentions directory/DirectoryPage in main.tsx, so we can probably mount it.
                    onNavigate('directory');
                },
                tileClass: 'prog-tile'
            }
        ];

        // Filter based on window.FUNCION_ID (legacy global)
        const fid = (window as any).FUNCION_ID;
        if (typeof fid !== 'undefined') {
            const id = parseInt(fid, 10);
            if (id === 2) tiles = tiles.filter(b => b.id === 'menu-directorio');
            else if (id === 3) tiles = tiles.filter(b => b.id === 'menu-reserva' || b.id === 'menu-directorio');
            else if (id === 4) tiles = tiles.filter(b => b.id === 'menu-trimestre' || b.id === 'menu-directorio');
        }
        return tiles;
    };

    const tiles = getTiles();

    return (
        <div className="row">
            {tiles.map(tile => (
                <div key={tile.id} className="col-md-6 col-sm-6 col-xs-12">
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); tile.action(); }}
                        style={{ textDecoration: 'none' }}
                    >
                        <div id={tile.tileClass} className="admin-btn-tile">
                            <img src={tile.img} alt={tile.alt} className="admin-btn-img" />
                            <span>{tile.title}</span>
                        </div>
                    </a>
                </div>
            ))}
        </div>
    );
};
