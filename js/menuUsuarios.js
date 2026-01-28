// menuUsuarios.js
// Controlador principal para la gestión de usuarios
// Utiliza: ApiService, UserTable, UserModal

(function (global) {
    'use strict';

    function crearMenuAdministrador() {
        var adminMenu = document.getElementById('admin-menu');
        if (!adminMenu) return;
        adminMenu.innerHTML = '';

        // Datos de los botones
        var botones = [
            {
                id: 'menu-usuario',
                href: null,
                img: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
                alt: 'Usuarios',
                span: 'Usuarios',
                tile: 'datos-tile'
            },
            {
                id: 'menu-trimestre',
                href: null,
                img: 'https://cdn-icons-png.flaticon.com/512/2917/2917996.png',
                alt: 'Trimestres',
                span: 'Trimestres',
                tile: 'datos-tile'
            },
            {
                id: 'menu-reserva',
                href: null,
                img: 'https://cdn-icons-png.flaticon.com/512/561/561127.png',
                alt: 'Sistema de reserva',
                span: 'Sistema de reserva',
                tile: 'prog-tile'
            },
            {
                id: 'menu-directorio',
                href: null,
                img: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                alt: 'Directorio',
                span: 'Directorio',
                tile: 'prog-tile'
            }
        ];

        // Filtrado según rol
        try {
            if (typeof window.FUNCION_ID !== 'undefined') {
                var fid = parseInt(window.FUNCION_ID, 10);
                if (fid === 2) botones = botones.filter(b => b.id === 'menu-directorio');
                else if (fid === 3) botones = botones.filter(b => b.id === 'menu-reserva' || b.id === 'menu-directorio');
                else if (fid === 4) botones = botones.filter(b => b.id === 'menu-trimestre' || b.id === 'menu-directorio');
            }
        } catch (e) {
            console.warn('Filtro FUNCION_ID falló:', e);
        }

        // Render Tiles
        botones.forEach(function (btn) {
            var colDiv = document.createElement('div');
            colDiv.className = 'col-md-6 col-sm-6 col-xs-12';

            var a = document.createElement('a');
            a.id = btn.id;
            if (btn.href) a.href = btn.href;

            var tileDiv = document.createElement('div');
            tileDiv.id = btn.tile;
            tileDiv.className = 'admin-btn-tile';

            var img = document.createElement('img');
            img.src = btn.img;
            img.alt = btn.alt;
            img.className = 'admin-btn-img';

            var span = document.createElement('span');
            span.textContent = btn.span;

            tileDiv.appendChild(img);
            tileDiv.appendChild(span);
            a.appendChild(tileDiv);
            colDiv.appendChild(a);
            adminMenu.appendChild(colDiv);

            // Handler
            a.addEventListener('click', function (e) {
                switch (btn.id) {
                    case 'menu-usuario':
                        e.preventDefault();
                        if (global.menuUsuarios) {
                            // Initial Load via ApiService
                            ApiService.getUsers()
                                .then(users => global.menuUsuarios(users))
                                .catch(err => {
                                    console.error(err);
                                    alert('Error al obtener usuarios');
                                });
                        }
                        break;
                    case 'menu-trimestre':
                        e.preventDefault();
                        if (global.crearMenuTrimestres) global.crearMenuTrimestres(document.getElementById('admin-menu'));
                        else alert('Módulo de trimestres no cargado');
                        break;
                    case 'menu-reserva':
                        e.preventDefault();
                        if (global.Swal && typeof Swal.fire === 'function') {
                            Swal.fire('Sistema de reserva', 'Módulo no implementado actualmente.', 'info');
                        } else {
                            alert('Módulo no implementado actualmente.');
                        }
                        break;

                    case 'menu-directorio':
                        e.preventDefault();
                        if (global.crearMenuDirectorio) global.crearMenuDirectorio();
                        else alert('Directorio no disponible');
                        break;
                }
            });
        });
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