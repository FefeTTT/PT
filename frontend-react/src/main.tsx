import React from 'react'
import ReactDOM from 'react-dom/client'
import MenuTrimestres from './trimestre-menu/MenuTrimestres'
import FuzzySearchInput from './components/FuzzySearchInput'
import { DirectoryPage } from './directory/DirectoryPage';
import { AdminApp } from './usuarios-menu/AdminApp';
import { TimetablingApp } from './timetabling/TimetablingApp';
import './main.module.css'
import './timetabling/styles/taller.css'


let root: ReactDOM.Root | null = null;
let fuzzyRoot: ReactDOM.Root | null = null;
let directoryRoot: ReactDOM.Root | null = null;
let timetablingRoot: ReactDOM.Root | null = null;

const SCROLL_STORAGE_KEY = 'scrollPos';

function debounce(func: () => void, delay: number): () => void {
    let timeout: number | undefined;
    return function() {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(func, delay);
    };
}

function saveVerticalScrollSession(): void {
    const y = Math.max(0, Math.round(window.scrollY || document.documentElement.scrollTop || 0));
    sessionStorage.setItem(SCROLL_STORAGE_KEY, String(y));
}

function isPageReload(): boolean {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return navigation?.type === 'reload';
}

function restoreVerticalScrollFromSession(): void {
    if (!isPageReload()) return;
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    const y = raw == null ? 0 : Number(raw);
    if (!Number.isFinite(y) || y <= 0) return;

    let attempts = 0;
    const restore = () => {
        attempts += 1;
        window.scrollTo({ top: y, behavior: 'auto' });
        const maxScroll = Math.max(
            0,
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0,
        ) - window.innerHeight;
        if (attempts < 40 && maxScroll < y - 2) window.setTimeout(restore, 100);
    };
    window.requestAnimationFrame(restore);
}

function installVerticalScrollSessionPersistence(): void {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.addEventListener('scroll', debounce(saveVerticalScrollSession, 250), { passive: true });
    window.addEventListener('pagehide', saveVerticalScrollSession);
    window.addEventListener('beforeunload', saveVerticalScrollSession);
}

installVerticalScrollSessionPersistence();

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
    if (timetablingRoot) {
        try { timetablingRoot.unmount(); } catch (e) { console.error(e); }
        timetablingRoot = null;
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
    restoreVerticalScrollFromSession();
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
    restoreVerticalScrollFromSession();
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
    restoreVerticalScrollFromSession();
};

window.unmountAdminApp = () => {
    if (adminRoot) {
        adminRoot.unmount();
        adminRoot = null;
    }
};

window.mountTimetablingApp = (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }
    cleanupRoots();

    timetablingRoot = ReactDOM.createRoot(container);
    timetablingRoot.render(
        <React.StrictMode>
            <TimetablingApp />
        </React.StrictMode>
    );
    restoreVerticalScrollFromSession();
};

window.unmountTimetablingApp = () => {
    if (timetablingRoot) {
        timetablingRoot.unmount();
        timetablingRoot = null;
    }
};

// Fallback for standalone dev
const devRoot = document.getElementById('root');
if (devRoot) {
    window.mountTimetablingApp('root');
}

window.dispatchEvent(new Event('ReactLoaded'));
