import React from 'react'
import ReactDOM from 'react-dom/client'
import MenuTrimestres from './trimestre-menu/MenuTrimestres'
import FuzzySearchInput from './components/FuzzySearchInput'
import { DirectoryPage } from './directory/DirectoryPage';
import { AdminApp } from './usuarios-menu/AdminApp';
import './main.module.css'


let root: ReactDOM.Root | null = null;
let fuzzyRoot: ReactDOM.Root | null = null;
let directoryRoot: ReactDOM.Root | null = null;

// Helper to cleanup all roots
const cleanupRoots = () => {
    if (root) {
        try { root.unmount(); } catch (e) { console.error(e); }
        root = null;
    }
    if (directoryRoot) {
        try { directoryRoot.unmount(); } catch (e) { console.error(e); }
        directoryRoot = null;
    }
    if (adminRoot) {
        try { adminRoot.unmount(); } catch (e) { console.error(e); }
        adminRoot = null;
    }
    // fuzzyRoot is usually independent (search bar), so we might leave it or manage separately. 
    // But if it's in the main container, we should unmount it. 
    // Assuming fuzzy is separate.
};

window.mountMenuTrimestres = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    cleanupRoots();

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

window.mountDirectoryMenu = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    cleanupRoots();

    directoryRoot = ReactDOM.createRoot(container);
    directoryRoot.render(
        <React.StrictMode>
            <DirectoryPage />
        </React.StrictMode>
    );
};

window.unmountDirectoryMenu = () => {
    if (directoryRoot) {
        directoryRoot.unmount();
        directoryRoot = null;
    }
};

window.mountFuzzySearchInput = (containerId: string, onSearch: (term: string) => void, initialValue: string = '') => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    if (fuzzyRoot) {
        fuzzyRoot.unmount();
    }
    fuzzyRoot = ReactDOM.createRoot(container);
    fuzzyRoot.render(
        <React.StrictMode>
            <FuzzySearchInput onSearch={onSearch} initialValue={initialValue} />
        </React.StrictMode>
    );
};

window.unmountFuzzySearchInput = () => {
    if (fuzzyRoot) {
        fuzzyRoot.unmount();
        fuzzyRoot = null;
    }
};

let adminRoot: ReactDOM.Root | null = null;
window.mountAdminApp = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    cleanupRoots();

    adminRoot = ReactDOM.createRoot(container);
    adminRoot.render(
        <React.StrictMode>
            <AdminApp />
        </React.StrictMode>
    );
};

window.unmountAdminApp = () => {
    if (adminRoot) {
        adminRoot.unmount();
        adminRoot = null;
    }
};

// Fallback for standalone dev
const devRoot = document.getElementById('root');
if (devRoot) {
    window.mountMenuTrimestres('root');
}

window.dispatchEvent(new Event('ReactLoaded'));
