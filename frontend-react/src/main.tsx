import React from 'react'
import ReactDOM from 'react-dom/client'
import MenuTrimestres from './trimestre-menu/MenuTrimestres'
import FuzzySearchInput from './components/FuzzySearchInput'
import { DirectoryPage } from './directory/DirectoryPage';
import './main.module.css'

// Global interface extension
declare global {
    interface Window {
        mountMenuTrimestres: (containerId: string) => void;
        unmountMenuTrimestres: () => void;
        mountDirectoryMenu: (containerId: string) => void;
        unmountDirectoryMenu: () => void;
        mountFuzzySearchInput: (containerId: string, onSearch: (term: string) => void, initialValue?: string) => void;
        unmountFuzzySearchInput: () => void;
    }
}


let root: ReactDOM.Root | null = null;
let fuzzyRoot: ReactDOM.Root | null = null;
let directoryRoot: ReactDOM.Root | null = null;

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

window.mountDirectoryMenu = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    if (directoryRoot) {
        directoryRoot.unmount();
    }
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

// Fallback for standalone dev
const devRoot = document.getElementById('root');
if (devRoot) {
    window.mountMenuTrimestres('root');
}
