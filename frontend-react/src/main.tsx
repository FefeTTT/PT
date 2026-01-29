import React from 'react'
import ReactDOM from 'react-dom/client'
import MenuTrimestres from './trimestre-menu/MenuTrimestres'
import './main.module.css'

// Global interface extension
declare global {
    interface Window {
        mountMenuTrimestres: (containerId: string) => void;
        unmountMenuTrimestres: () => void;
    }
}

let root: ReactDOM.Root | null = null;

window.mountMenuTrimestres = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    if (root) {
        console.warn('MenuTrimestres already mounted, unmounting first.');
        root.unmount();
    }
    root = ReactDOM.createRoot(container);
    root.render(
        <React.StrictMode>
            <MenuTrimestres />
        </React.StrictMode>
    );
};

window.unmountMenuTrimestres = () => {
    if (root) {
        root.unmount();
        root = null;
    }
};

// Fallback for standalone dev
const devRoot = document.getElementById('root');
if (devRoot) {
    window.mountMenuTrimestres('root');
}
