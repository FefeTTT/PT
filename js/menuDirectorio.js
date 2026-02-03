// /js/menuDirectorio.js
// Migrated to React.
// This file now bridges the legacy calls to the React App.

function crearMenuDirectorio() {
    const adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) return;

    // Unmount previous components to prevent leaks
    if (window.unmountFuzzySearchInput) {
        try { window.unmountFuzzySearchInput(); } catch (e) { console.warn(e); }
    }
    if (window.unmountMenuTrimestres) {
        try { window.unmountMenuTrimestres(); } catch (e) { console.warn(e); }
    }

    // Ensure we unmount self if re-called (though React does this usually)
    if (window.unmountDirectoryMenu) {
        try { window.unmountDirectoryMenu(); } catch (e) { console.warn(e); }
    }

    // Mount the new React Directory
    if (window.mountDirectoryMenu) {
        window.mountDirectoryMenu('admin-menu');
    } else {
        console.error('mountDirectoryMenu not found. React build might be missing or main.js not loaded.');
        adminMenu.innerHTML = '<div class="alert alert-danger">Error: React app not loaded.</div>';
    }
}

// Global exposure
window.crearMenuDirectorio = crearMenuDirectorio;
