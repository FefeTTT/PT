// menuUsuarios.js
// Controlador principal para la gestión de usuarios
// Utiliza: ApiService, UserTable, UserModal

(function (global) {
    'use strict';

    function crearMenuAdministrador() {
        var adminMenu = document.getElementById('admin-menu');
        if (!adminMenu) return;

        // Mount React Admin App
        if (typeof window.mountAdminApp === 'function') {
            window.mountAdminApp('admin-menu');
        } else {
            console.error('React mountAdminApp function not found, legacy fallback prevented in this migration phase.');
            adminMenu.innerHTML = '<div class="alert alert-danger">Error loading React Admin App</div>';
        }
    }

    // Main entry point for User Management View
    function menuUsuarios(usuarios) {
        var adminMenu = document.getElementById('admin-menu');
        if (!adminMenu) return;

        if (global.UserTable) {
            global.UserTable.render(adminMenu, usuarios);
        } else {
            adminMenu.innerHTML = '<div class="alert alert-danger">Error: Componente UserTable no cargado</div>';
        }
    }

    function mostrarModalAgregarUsuario() {
        if (global.UserModal) {
            global.UserModal.show();
        } else {
            console.error('UserModal missing');
        }
    }

    // Exposiciones globales
    global.crearMenuAdministrador = crearMenuAdministrador;
    global.menuUsuarios = menuUsuarios;
    global.mostrarModalAgregarUsuario = mostrarModalAgregarUsuario;

    // Auto-init on load
    document.addEventListener('DOMContentLoaded', function () {
        var bienvenido = document.getElementById('bienvenido');

        if (window.USER_NAME && bienvenido) {
            bienvenido.textContent = 'Bienvenido ' + window.USER_NAME;
        }
        crearMenuAdministrador();
    });

})(window);