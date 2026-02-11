// menuUsuarios.js
// Controlador principal para la gestión de usuarios
// Utiliza: ApiService, UserTable, UserModal

(function (global) {
    'use strict';

    function crearMenuAdministrador() {
        var adminMenu = document.getElementById('admin-menu');
        if (!adminMenu) return;

        const mount = () => {
            if (typeof window.mountAdminApp === 'function') {
                window.mountAdminApp('admin-menu');
            } else {
                console.error('React mountAdminApp function not found even after wait.');
                adminMenu.innerHTML = '<div class="alert alert-danger">Error loading React Admin App</div>';
            }
        };

        // Mount React Admin App
        if (typeof window.mountAdminApp === 'function') {
            mount();
        } else {
            console.log('React function missing, waiting for bundle...');
            window.addEventListener('ReactLoaded', mount, { once: true });
            // Fallback timeout in case event was missed or bundle fails
            setTimeout(() => {
                if (typeof window.mountAdminApp !== 'function') {
                    console.warn('React load timeout');
                    // Don't error yet, might be very slow.
                }
            }, 5000);
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