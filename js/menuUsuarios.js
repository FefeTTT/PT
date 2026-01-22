// menuUsuarios.js
// Muestra el nombre del usuario en el menú usando JS


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

    // Filtrado según rol (expuesto en window.FUNCION_ID)
    try {
        if (typeof window !== 'undefined' && typeof window.FUNCION_ID !== 'undefined') {
            var fid = parseInt(window.FUNCION_ID, 10);
            // Si es usuario consulta (2) => solo Directorio
            if (fid === 2) {
                botones = botones.filter(function (b) { return b.id === 'menu-directorio'; });
            }
            // Si es secretaria (3) => solo Reserva + Directorio
            else if (fid === 3) {
                botones = botones.filter(function (b) { return b.id === 'menu-reserva' || b.id === 'menu-directorio'; });
            }
            // Si es encargado de horarios (4) => Trimestres + Directorio
            else if (fid === 4) {
                botones = botones.filter(function (b) { return b.id === 'menu-trimestre' || b.id === 'menu-directorio'; });
            }
        }
    } catch (e) {
        console.warn('No se pudo aplicar filtro por FUNCION_ID:', e);
    }

    botones.forEach(function (btn) {
        var colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 col-sm-6 col-xs-12';
        colDiv.id = 'filter-image';

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

        // Evento click condicional para cada botón
        a.addEventListener('click', function (e) {
            switch (btn.id) {
                case 'menu-usuario':
                    e.preventDefault();
                    obtenerUsuarios().then(usuarios => {
                        if (typeof window.menuUsuarios === 'function') {
                            window.menuUsuarios(usuarios);
                        } else {
                            var msg = 'Función menuUsuarios no disponible en este contexto';
                            console.error(msg);
                            if (window.Swal && typeof Swal.fire === 'function') {
                                Swal.fire({ title: 'Error', text: msg, icon: 'error' });
                            } else {
                                alert(msg);
                            }
                        }
                    }).catch(err => {
                        console.error('Error al obtener usuarios:', err);
                        var msg = (err instanceof Error) ? (err.message + '\n' + err.stack) : JSON.stringify(err);
                        if (window.Swal && typeof Swal.fire === 'function') {
                            Swal.fire({ title: 'Error', text: 'Error al obtener usuarios: ' + msg, icon: 'error' });
                        } else if (window.swal && typeof swal === 'function') {
                            try { swal('Error', 'Error al obtener usuarios: ' + msg, 'error'); } catch (e) { alert('Error al obtener usuarios: ' + msg); }
                        } else {
                            alert('Error al obtener usuarios: ' + msg);
                        }
                    });
                    break;
                case 'menu-trimestre':
                    e.preventDefault();
                    try {
                        const adminMenuEl = document.getElementById('admin-menu');
                        if (window && typeof window.crearMenuTrimestres === 'function') {
                            window.crearMenuTrimestres(adminMenuEl);
                        } else {
                            // intentar cargar dinámicamente el script si no está presente
                            var scriptUrl = 'js/menuTrimestres.js';
                            var existingScript = document.querySelector('script[src="' + scriptUrl + '"]');
                            if (!existingScript) {
                                var s = document.createElement('script');
                                s.src = scriptUrl;
                                s.onload = function () {
                                    try {
                                        if (window && typeof window.crearMenuTrimestres === 'function') {
                                            window.crearMenuTrimestres(adminMenuEl);
                                            return;
                                        }
                                        // si tras cargar sigue sin existir, mostrar mensaje informativo
                                        if (window.Swal && typeof Swal.fire === 'function') {
                                            Swal.fire({ title: 'Trimestres', text: 'Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.', icon: 'info' });
                                        } else if (window.swal && typeof swal === 'function') {
                                            try { swal('Trimestres', 'Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.', 'info'); } catch (e) { alert('Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.'); }
                                        } else {
                                            alert('Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.');
                                        }
                                    } catch (e) { console.error('Error al invocar crearMenuTrimestres después de cargar script:', e); alert('No se pudo abrir Trimestres. Revisa la consola.'); }
                                };
                                s.onerror = function (ev) {
                                    console.error('Error cargando', scriptUrl, ev);
                                    if (window.Swal && typeof Swal.fire === 'function') {
                                        Swal.fire({ title: 'Trimestres', text: 'No se pudo cargar el módulo de Trimestres. Revisa la consola.', icon: 'error' });
                                    } else {
                                        alert('No se pudo cargar el módulo de Trimestres. Revisa la consola.');
                                    }
                                };
                                document.body.appendChild(s);
                            } else {
                                // el script está presente pero la función no; informar y sugerir revisar la consola
                                if (window.Swal && typeof Swal.fire === 'function') {
                                    Swal.fire({ title: 'Trimestres', text: 'El módulo de Trimestres está cargado pero no disponible. Revisa la consola para detalles.', icon: 'error' });
                                } else {
                                    alert('El módulo de Trimestres está cargado pero no disponible. Revisa la consola para detalles.');
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error iniciando Trimestres:', err);
                        alert('Error al abrir Trimestres. Revisa la consola para más detalles.');
                    }
                    break;
                case 'menu-reserva':
                    e.preventDefault();
                    if (window.Swal && typeof Swal.fire === 'function') {
                        Swal.fire({ title: 'Sistema de reserva', text: 'Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.', icon: 'info' });
                    } else if (window.swal && typeof swal === 'function') {
                        try { swal('Sistema de reserva', 'Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.', 'info'); } catch (e) { alert('Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.'); }
                    } else {
                        // Si existe el módulo menuPrincipalAdmin, úsalo para montar el panel de directorio
                        try {
                            const adminMenuEl = document.getElementById('admin-menu');
                            if (window.crearMenuPrincipalAdmin) {
                                window.crearMenuPrincipalAdmin(adminMenuEl);
                            }
                        } catch (e) {
                            // no crítico
                            console.warn('No se pudo inicializar menuPrincipalAdmin:', e);
                        }
                        alert('Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.');
                    }
                    break;
                case 'menu-directorio':
                    e.preventDefault();
                    try {
                        if (typeof window.crearMenuDirectorio === 'function') {
                            // Llamar a la función que construye el UI del directorio
                            window.crearMenuDirectorio();
                        } else {
                            var msg = 'El directorio no está disponible en este contexto.';
                            console.error(msg);
                            if (window && typeof window.swalAlertOpt === 'function') {
                                window.swalAlertOpt('Directorio', msg, 'info');
                            } else {
                                alert(msg);
                            }
                        }
                    } catch (err) {
                        console.error('Error intentando abrir Directorio:', err);
                        alert('Error al abrir el directorio. Revisa la consola para más detalles.');
                    }
                    break;
                default:
                    break;
            }
        });
    });
}

// Promesa para obtener usuarios desde el backend
function obtenerUsuarios() {
    return fetch('controlador/recuperarUsuarioTodos.php')
        .then(response => {
            if (!response.ok) throw new Error('HTTP error ' + response.status);
            return response.json();
        });
}

// Helper: enviar formulario por POST y devolver Promise con JSON
function postForm(url, dataObj) {
    const body = new URLSearchParams(dataObj).toString();
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    }).then(async response => {
        // Always attempt to parse JSON body so callers can inspect validation details
        const text = await response.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch (e) {
            // Invalid JSON — throw with raw text for debugging
            throw new Error('Invalid JSON response from ' + url + ': ' + e.message + ' \n' + text);
        }
        // attach HTTP status for callers
        if (json && typeof json === 'object') json.__httpStatus = response.status;
        return json;
    });
}

function menuUsuarios(usuarios) {
    // Obtener contenedor y limpiar
    var adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) {
        console.error('Elemento #admin-menu no encontrado');
        return;
    }
    adminMenu.innerHTML = '';

    // Barra superior: botón regresar + título
    var headerBar = document.createElement('div');
    headerBar.className = 'd-flex align-items-center mb-3';
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    // usar clase para que los estilos de la paleta se definan en CSS
    backBtn.className = 'btn btn-sm btn-back';
    backBtn.title = 'Volver';
    // Mostrar flecha + texto para mayor claridad
    backBtn.innerHTML = '&#8592; Volver'; // flecha izquierda + texto
    backBtn.addEventListener('click', function () {
        // Reconstruir el menú administrador (volver)
        try { crearMenuAdministrador(); } catch (e) { window.location.reload(); }
    });
    var titleH5 = document.createElement('h5');
    titleH5.className = 'm-0';
    titleH5.textContent = 'Usuarios';
    headerBar.appendChild(backBtn);
    headerBar.appendChild(titleH5);
    adminMenu.appendChild(headerBar);

    // Crear elementos de tabla
    var table = document.createElement('table');
    table.className = 'table table-striped table-sm users-table';
    var thead = document.createElement('thead');
    var tbody = document.createElement('tbody');

    // Determinar cabeceras dinámicamente a partir del primer usuario
    var headers = [];
    if (Array.isArray(usuarios) && usuarios.length > 0) {
        headers = Object.keys(usuarios[0]);
        // Quitar columnas de id (variantes: id, idUsuario, usuarioId, id_usuario, userId, etc.)
        headers = headers.filter(function (h) {
            var n = String(h).toLowerCase();
            if (n === 'id' || n === 'idusuario' || n === 'id_usuario' || n === 'id_user' || n === 'userid') return false;
            if (n === 'intento') return false;
            if (n.endsWith('id')) return false; // elimina 'usuarioId', 'userId', etc.
            return true;
        });
    } else {
        // Fallback razonable si no hay usuarios
        headers = ['usuario', 'contraseña'];
    }

    var trHead = document.createElement('tr');
    headers.forEach(h => {
        var th = document.createElement('th');
        th.textContent = h.charAt(0).toUpperCase() + h.slice(1);
        trHead.appendChild(th);
    });
    // Columna extra para funciones
    var thFunc = document.createElement('th');
    thFunc.textContent = 'Funciones asignadas';
    trHead.appendChild(thFunc);
    thead.appendChild(trHead);

    // Filas
    usuarios.forEach(u => {
        var tr = document.createElement('tr');
        headers.forEach(h => {
            var td = document.createElement('td');
            // Especializar columnas contraseña e intento
            if (h === 'contraseña') {
                // Mostrar botón para cambiar contraseña
                var btnPwd = document.createElement('button');
                btnPwd.textContent = 'Cambiar contraseña';
                btnPwd.className = 'btn btn-warning btn-sm btn-user-pwd';
                btnPwd.addEventListener('click', function pwdClickHandler() {
                    // Reemplazar contenido por input + botón enviar
                    td.innerHTML = '';
                    var input = document.createElement('input');
                    input.type = 'password';
                    input.className = 'form-control form-control-sm';
                    input.placeholder = 'Nueva contraseña';
                    var send = document.createElement('button');
                    send.textContent = 'Enviar';
                    send.className = 'btn btn-success btn-sm';
                    send.style.marginTop = '4px';
                    send.addEventListener('click', function () {
                        var newPwd = (input.value || '').trim();
                        // Validaciones cliente: no vacío y no igual a la actual (si está disponible)
                        if (!newPwd) {
                            var msgEmpty = 'La contraseña no puede estar vacía.';
                            if (window.Swal && typeof Swal.fire === 'function') {
                                Swal.fire({ title: 'Error', text: msgEmpty, icon: 'warning' });
                            } else if (window.swal && typeof swal === 'function') {
                                try { swal('Error', msgEmpty, 'warning'); } catch (e) { alert(msgEmpty); }
                            } else {
                                alert(msgEmpty);
                            }
                            return;
                        }
                        var currentPwd = u['contraseña'] || u.contrasena || u.password || '';
                        // Note: some backends won't send actual password; only compare if present
                        if (currentPwd && newPwd === String(currentPwd)) {
                            var msgSame = 'La nueva contraseña no puede ser igual a la actual.';
                            if (window.Swal && typeof Swal.fire === 'function') {
                                Swal.fire({ title: 'Error', text: msgSame, icon: 'warning' });
                            } else if (window.swal && typeof swal === 'function') {
                                try { swal('Error', msgSame, 'warning'); } catch (e) { alert(msgSame); }
                            } else {
                                alert(msgSame);
                            }
                            return;
                        }
                        send.disabled = true;
                        var data = new URLSearchParams();
                        data.append('usuario', u.usuario);
                        data.append('contraseña', input.value);
                        postForm('controlador/actualizarUsuarioContraseña.php', { 'usuario': u.usuario, 'contraseña': input.value })
                            .then(json => {
                                if (json && json.ok) {
                                    td.innerHTML = '';
                                    // Restaurar botón
                                    var okBtn = document.createElement('button');
                                    okBtn.textContent = 'Cambiar contraseña';
                                    okBtn.className = 'btn btn-warning btn-sm';
                                    okBtn.addEventListener('click', pwdClickHandler);
                                    td.appendChild(okBtn);
                                } else {
                                    var msg = (json && json.msg) ? json.msg : JSON.stringify(json);
                                    if (window.Swal && typeof Swal.fire === 'function') {
                                        Swal.fire({ title: 'Error', text: 'No se pudo actualizar la contraseña: ' + msg, icon: 'error' });
                                    } else if (window.swal && typeof swal === 'function') {
                                        try { swal('Error', 'No se pudo actualizar la contraseña: ' + msg, 'error'); } catch (e) { alert('No se pudo actualizar la contraseña: ' + msg); }
                                    } else {
                                        alert('No se pudo actualizar la contraseña: ' + msg);
                                    }
                                    send.disabled = false;
                                }
                            }).catch(err => {
                                console.error('Error actualizar contraseña:', err);
                                var msg = (err && err.message) ? err.message : JSON.stringify(err);
                                if (window.Swal && typeof Swal.fire === 'function') {
                                    Swal.fire({ title: 'Error', text: 'Error al actualizar contraseña: ' + msg, icon: 'error' });
                                } else if (window.swal && typeof swal === 'function') {
                                    try { swal('Error', 'Error al actualizar contraseña', 'error'); } catch (e) { alert('Error al actualizar contraseña'); }
                                } else {
                                    alert('Error al actualizar contraseña');
                                }
                                send.disabled = false;
                            });
                    });
                    td.appendChild(input);
                    td.appendChild(send);
                });
                td.appendChild(btnPwd);
            } else {
                // Mostrar botón de eliminar a la izquierda del nombre de usuario
                if (h === 'usuario') {
                    // Limpiar contenido por si acaso
                    while (td.firstChild) td.removeChild(td.firstChild);

                    var delBtn = document.createElement('button');
                    delBtn.type = 'button';
                    delBtn.className = 'btn btn-danger btn-sm me-2 btn-user-delete';
                    delBtn.title = 'Eliminar usuario';
                    delBtn.setAttribute('aria-label', 'Eliminar usuario');
                    delBtn.textContent = '\u00D7'; // Multiplication sign (×)

                    // Handler: confirmar y luego llamar al endpoint que elimina por nombre
                    delBtn.addEventListener('click', function () {
                        var nombre = u.usuario;
                        if (!nombre) return;

                        // Impedir que el usuario en curso se elimine a sí mismo
                        try {
                            var currentUser = null;
                            try {
                                var params = new URLSearchParams(window.location.search);
                                currentUser = params.get('user');
                            } catch (e) {
                                currentUser = null;
                            }
                            if (!currentUser && typeof window.currentUser !== 'undefined') currentUser = window.currentUser;
                            if (!currentUser) {
                                var bw = document.getElementById('bienvenido');
                                if (bw) {
                                    var txt = (bw.textContent || bw.innerText || '').trim();
                                    var m = txt.match(/Bienvenid[oa]\s+(.+)$/i);
                                    if (m && m[1]) currentUser = m[1].trim();
                                }
                            }
                            if (currentUser && String(currentUser).toLowerCase() === String(nombre).toLowerCase()) {
                                var msg = 'No puedes eliminar tu propia cuenta mientras estás conectado.';
                                if (window && typeof window.swalAlertOpt === 'function') {
                                    window.swalAlertOpt('Acción no permitida', msg, 'warning');
                                } else {
                                    alert(msg);
                                }
                                return;
                            }
                        } catch (e) {
                            // En caso de error, no bloquear la operación (pero no debería ocurrir)
                            console.error('Error comprobando usuario actual para autodelete:', e);
                        }

                        // Use SweetAlert if available, otherwise fallback to native confirm
                        var doDelete = function () {
                            delBtn.disabled = true;
                            // Show SweetAlert2 loading if available
                            var showedLoading = false;
                            if (window.Swal && typeof Swal.fire === 'function') {
                                showedLoading = true;
                                Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
                            }

                            postForm('controlador/eliminarUsuarioNombre.php', { usuario: nombre })
                                .then(function (resp) {
                                    if (showedLoading && window.Swal && typeof Swal.close === 'function') {
                                        try { Swal.close(); } catch (e) { /* ignore */ }
                                    }
                                    if (resp && resp.ok) {
                                        if (window && typeof window.swalAlertOpt === 'function') {
                                            window.swalAlertOpt('Eliminado', resp.msg || 'Usuario eliminado', 'success');
                                        }
                                        // Refrescar la tabla de usuarios
                                        obtenerUsuarios().then(function (usuarios) { menuUsuarios(usuarios); }).catch(function (err) {
                                            console.error('Error al refrescar usuarios tras eliminar:', err);
                                        });
                                    } else {
                                        var msg = resp && resp.msg ? resp.msg : JSON.stringify(resp);
                                        if (window.Swal && typeof Swal.fire === 'function') {
                                            Swal.fire({ title: 'Error', text: 'No se pudo eliminar el usuario: ' + msg, icon: 'error' });
                                        } else if (window.swal && typeof swal === 'function') {
                                            try { swal('Error', 'No se pudo eliminar el usuario: ' + msg, 'error'); } catch (e) { alert('No se pudo eliminar el usuario: ' + msg); }
                                        } else {
                                            alert('No se pudo eliminar el usuario: ' + msg);
                                        }
                                        delBtn.disabled = false;
                                    }
                                }).catch(function (err) {
                                    if (showedLoading && window.Swal && typeof Swal.close === 'function') {
                                        try { Swal.close(); } catch (e) { /* ignore */ }
                                    }
                                    console.error('Error eliminando usuario:', err);
                                    if (window.Swal && typeof Swal.fire === 'function') {
                                        Swal.fire({ title: 'Error', text: 'Error al eliminar usuario', icon: 'error' });
                                    } else if (window.swal && typeof swal === 'function') {
                                        try { swal('Error', 'Error al eliminar usuario', 'error'); } catch (e) { alert('Error al eliminar usuario'); }
                                    } else {
                                        alert('Error al eliminar usuario');
                                    }
                                    delBtn.disabled = false;
                                });
                        };

                        if (window.Swal && typeof Swal.fire === 'function') {
                            Swal.fire({
                                title: '¿Eliminar usuario?',
                                text: '¿Eliminar el usuario "' + nombre + '"? Esta acción no se puede deshacer.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Sí, eliminar',
                                cancelButtonText: 'Cancelar',
                                dangerMode: true
                            }).then(function (result) {
                                if (result && (result.isConfirmed || result.value)) {
                                    doDelete();
                                }
                            });
                        } else if (window.swal && typeof swal === 'function') {
                            // swal (older) usually returns a Promise when buttons:true
                            try {
                                var prom = swal({
                                    title: '¿Eliminar usuario?',
                                    text: '¿Eliminar el usuario "' + nombre + '"? Esta acción no se puede deshacer.',
                                    icon: 'warning',
                                    buttons: true,
                                    dangerMode: true
                                });
                                if (prom && typeof prom.then === 'function') {
                                    prom.then(function (willDelete) { if (willDelete) doDelete(); });
                                } else {
                                    // Fallback: immediate confirm
                                    if (confirm('¿Eliminar el usuario "' + nombre + '"? Esta acción no se puede deshacer.')) doDelete();
                                }
                            } catch (e) {
                                if (confirm('¿Eliminar el usuario "' + nombre + '"? Esta acción no se puede deshacer.')) doDelete();
                            }
                        } else {
                            if (confirm('¿Eliminar el usuario "' + nombre + '"? Esta acción no se puede deshacer.')) doDelete();
                        }
                    });

                    var spanUser = document.createElement('span');
                    spanUser.textContent = u[h];
                    // Añadir clase para permitir estilos CSS consistentes (contraste, tamaño, etc.)
                    spanUser.className = 'username';

                    td.appendChild(delBtn);
                    td.appendChild(spanUser);
                } else {
                    td.textContent = u[h];
                }
            }
            tr.appendChild(td);
        });
        // Celda para funciones
        var tdFunc = document.createElement('td');
        tdFunc.id = 'funciones_' + u.idUsuario;
        // Botón para mostrar el nombre de la(s) función(es) asignada(s) y permitir ver detalle
        var btn = document.createElement('button');
        btn.textContent = 'Cargando...';
        btn.className = 'btn btn-info btn-sm btn-user-func';
        btn.disabled = true;

        postForm('controlador/recuperaFuncionUsuarioNombre.php', { 'usuario': u.usuario })
            .then(json => {
                if (json && json.ok && Array.isArray(json.funciones) && json.funciones.length > 0) {
                    var nombres = json.funciones.map(f => (f.nombre ? f.nombre : (typeof f === 'string' ? f : ''))).filter(Boolean);
                    var editIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square ms-1" viewBox="0 0 16 16"><path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/><path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/></svg>';
                    btn.innerHTML = (nombres.length > 0 ? nombres.join(', ') : 'Sin nombre') + ' ' + editIcon;
                } else {
                    btn.textContent = 'Sin funciones';
                }
            }).catch(err => {
                console.error('Error al obtener funciones por nombre:', err);
                btn.textContent = 'Error';
            }).finally(() => {
                btn.disabled = false;
            });

        btn.addEventListener('click', function () {
            // Obtener funciones actuales del usuario y la lista completa de funciones en paralelo
            Promise.all([
                postForm('controlador/recuperaFuncionUsuarioNombre.php', { 'usuario': u.usuario }),
                fetch('controlador/recuperarTodasFunciones.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            ]).then(([userJson, allFuncsResp]) => {
                tdFunc.innerHTML = '';
                var currentName = null;
                if (userJson && userJson.ok && Array.isArray(userJson.funciones) && userJson.funciones.length > 0) {
                    currentName = userJson.funciones[0].nombre || null;
                }

                // allFuncsResp may be the raw array or an object { ok: true, funciones: [...] }
                var allFuncs = [];
                if (Array.isArray(allFuncsResp)) {
                    allFuncs = allFuncsResp;
                } else if (allFuncsResp && Array.isArray(allFuncsResp.funciones)) {
                    allFuncs = allFuncsResp.funciones;
                }

                // allFuncs expected to be an array of {nombre, descripcion} or similar
                var select = document.createElement('select');
                select.className = 'form-select form-select-sm';
                select.style.display = 'inline-block';
                select.style.width = 'auto';
                select.style.marginRight = '8px';

                if (!Array.isArray(allFuncs)) allFuncs = [];
                // If the backend returns objects or strings, normalize to {nombre}
                var options = allFuncs.map(f => {
                    if (typeof f === 'string') return { nombre: f };
                    return (f && f.nombre) ? { nombre: f.nombre } : null;
                }).filter(Boolean);

                // Ensure currentName is included in options
                if (currentName && !options.some(o => o.nombre === currentName)) {
                    options.unshift({ nombre: currentName });
                }

                options.forEach(o => {
                    var opt = document.createElement('option');
                    opt.value = o.nombre;
                    opt.textContent = o.nombre;
                    if (o.nombre === currentName) opt.selected = true;
                    select.appendChild(opt);
                });

                var btnSave = document.createElement('button');
                btnSave.className = 'btn btn-sm btn-primary';
                btnSave.textContent = 'Guardar';

                var btnCancel = document.createElement('button');
                btnCancel.className = 'btn btn-sm btn-secondary ms-2';
                btnCancel.textContent = 'Cancelar';

                tdFunc.appendChild(select);
                tdFunc.appendChild(btnSave);
                tdFunc.appendChild(btnCancel);

                btnCancel.addEventListener('click', function () {
                    // Restaurar botón original
                    tdFunc.innerHTML = '';
                    tdFunc.appendChild(btn);
                });

                btnSave.addEventListener('click', function () {
                    var nueva = select.value;
                    if (!nueva) return;
                    btnSave.disabled = true;
                    // Enviar request al backend para actualizar: eliminar la función antigua y asignar la nueva
                    postForm('controlador/actualizaFuncionUsuario.php', {
                        usuario: u.usuario,
                        funcion_old: currentName || '',
                        funcion_new: nueva
                    }).then(resp => {
                        if (resp && resp.ok) {
                            // Actualizar texto del botón y restaurarlo
                            btn.textContent = nueva;
                            tdFunc.innerHTML = '';
                            tdFunc.appendChild(btn);
                        } else {
                            var msg = (resp && resp.msg) ? resp.msg : JSON.stringify(resp);
                            if (window && typeof window.swalAlertOpt === 'function') {
                                window.swalAlertOpt('Error', 'No se pudo actualizar la función: ' + msg, 'error');
                            } else {
                                alert('No se pudo actualizar la función: ' + msg);
                            }
                            btnSave.disabled = false;
                        }
                    }).catch(err => {
                        console.error('Error actualizando función del usuario:', err);
                        if (window && typeof window.swalAlertOpt === 'function') {
                            window.swalAlertOpt('Error', 'Error al actualizar la función del usuario', 'error');
                        } else {
                            alert('Error al actualizar la función del usuario');
                        }
                        btnSave.disabled = false;
                    });
                });
            }).catch(err => {
                console.error('Error preparando el selector de funciones:', err);
                tdFunc.textContent = 'Error al cargar funciones';
            });
        });
        tdFunc.appendChild(btn);
        tr.appendChild(tdFunc);
        tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    adminMenu.appendChild(table);

    // Añadir fila final con celda que contiene un botón + para agregar nuevo usuario
    var tfoot = document.createElement('tfoot');
    var trFoot = document.createElement('tr');
    var tdAdd = document.createElement('td');
    tdAdd.colSpan = headers.length + 1; // columnas visibles + columna funciones
    tdAdd.className = 'text-end users-tfoot-cell';
    var addBtn = document.createElement('button');
    addBtn.className = 'btn btn-success btn-sm btn-add-user';
    addBtn.innerHTML = '<span style="font-weight:bold; font-size:18px;">+</span> Agregar usuario';
    addBtn.addEventListener('click', function () {
        mostrarModalAgregarUsuario();
    });
    tdAdd.appendChild(addBtn);
    trFoot.appendChild(tdAdd);
    tfoot.appendChild(trFoot);
    table.appendChild(tfoot);
}


function obtenerFuncioUsuario(idUsuario, tdFunc) {
    fetch('controlador/recuperaFuncionesUsuario.php?id=' + idUsuario)
        .then(resp => resp.json())
        .then(funciones => {
            tdFunc.innerHTML = '';
            if (!Array.isArray(funciones) || funciones.length === 0) {
                tdFunc.textContent = 'Sin funciones asignadas';
                return;
            }
            var ul = document.createElement('ul');
            funciones.forEach(f => {
                var li = document.createElement('li');
                li.textContent = f.nombre || f;
                ul.appendChild(li);
            });
            tdFunc.appendChild(ul);
        })
        .catch(err => {
            tdFunc.textContent = 'Error al cargar funciones';
            console.error('Error funciones usuario:', err);
        });
}

// Obtener funciones por nombre de usuario (usa POST al endpoint que devuelve {ok:true, funciones: [...]})
function obtenerFuncioUsuarioNombre(usuario, tdFunc) {
    tdFunc.innerHTML = '';
    var cargando = document.createElement('div');
    cargando.textContent = 'Cargando funciones...';
    tdFunc.appendChild(cargando);

    postForm('controlador/recuperaFuncionUsuarioNombre.php', { 'usuario': usuario })
        .then(json => {
            tdFunc.innerHTML = '';
            if (!json || !json.ok || !Array.isArray(json.funciones) || json.funciones.length === 0) {
                tdFunc.textContent = 'Sin funciones asignadas';
                return;
            }
            var ul = document.createElement('ul');
            json.funciones.forEach(f => {
                var li = document.createElement('li');
                li.textContent = f.nombre || f;
                ul.appendChild(li);
            });
            tdFunc.appendChild(ul);
        }).catch(err => {
            tdFunc.textContent = 'Error al cargar funciones';
            console.error('Error funciones usuario por nombre:', err);
        });
}


document.addEventListener('DOMContentLoaded', function () {
    var bienvenido = document.getElementById('bienvenido');
    var urlParams = new URLSearchParams(window.location.search);
    var userName = urlParams.get('user');
    if (userName && bienvenido) {
        bienvenido.textContent = 'Bienvenido ' + userName;
    }
    crearMenuAdministrador();
});

// Modal creation and handling for adding a new user
function mostrarModalAgregarUsuario() {
    // If modal already exists, remove it to rebuild
    var existing = document.getElementById('modalAgregarUsuario');
    if (existing) existing.parentNode.removeChild(existing);

    var modal = document.createElement('div');
    modal.id = 'modalAgregarUsuario';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    // Build modal DOM using createElement instead of innerHTML
    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'document');

    var content = document.createElement('div');
    content.className = 'modal-content';

    var headerDiv = document.createElement('div');
    headerDiv.className = 'modal-header';
    var title = document.createElement('h5');
    title.className = 'modal-title';
    title.textContent = 'Agregar usuario';
    var btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'btn-close';
    btnClose.setAttribute('data-bs-dismiss', 'modal');
    btnClose.setAttribute('aria-label', 'Close');
    headerDiv.appendChild(title);
    headerDiv.appendChild(btnClose);

    var bodyDiv = document.createElement('div');
    bodyDiv.className = 'modal-body';
    var formElem = document.createElement('form');
    formElem.id = 'formAgregarUsuario';

    // Username field
    var divUser = document.createElement('div'); divUser.className = 'mb-3';
    var labelUser = document.createElement('label'); labelUser.className = 'form-label'; labelUser.textContent = 'Nombre de usuario';
    var inputUser = document.createElement('input'); inputUser.type = 'text'; inputUser.name = 'usuario'; inputUser.id = 'nuevo_usuario'; inputUser.className = 'form-control'; inputUser.required = true;
    divUser.appendChild(labelUser); divUser.appendChild(inputUser);

    // Password field
    var divPwd = document.createElement('div'); divPwd.className = 'mb-3';
    var labelPwd = document.createElement('label'); labelPwd.className = 'form-label'; labelPwd.textContent = 'Contraseña';
    var inputPwd = document.createElement('input'); inputPwd.type = 'password'; inputPwd.name = 'contraseña'; inputPwd.id = 'nuevo_pwd'; inputPwd.className = 'form-control'; inputPwd.required = true;
    divPwd.appendChild(labelPwd); divPwd.appendChild(inputPwd);

    // Function select
    var divFunc = document.createElement('div'); divFunc.className = 'mb-3';
    var labelFunc = document.createElement('label'); labelFunc.className = 'form-label'; labelFunc.textContent = 'Función';
    var selectFunc = document.createElement('select'); selectFunc.name = 'funcion'; selectFunc.id = 'nuevo_funcion'; selectFunc.className = 'form-select';
    divFunc.appendChild(labelFunc); divFunc.appendChild(selectFunc);

    formElem.appendChild(divUser);
    formElem.appendChild(divPwd);
    formElem.appendChild(divFunc);
    bodyDiv.appendChild(formElem);

    var footerDiv = document.createElement('div'); footerDiv.className = 'modal-footer';
    var btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
    var btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.id = 'guardarNuevoUsuario'; btnSave.textContent = 'Guardar';
    footerDiv.appendChild(btnCancel); footerDiv.appendChild(btnSave);

    content.appendChild(headerDiv);
    content.appendChild(bodyDiv);
    content.appendChild(footerDiv);
    dialog.appendChild(content);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Populate funciones into select
    var select = modal.querySelector('#nuevo_funcion');
    select.innerHTML = '<option value="">Cargando...</option>';
    fetch('controlador/recuperarTodasFunciones.php')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(json => {
            select.innerHTML = '';
            var funcs = [];
            if (Array.isArray(json)) funcs = json;
            else if (json && Array.isArray(json.funciones)) funcs = json.funciones;
            if (!funcs || funcs.length === 0) {
                select.innerHTML = '<option value="">(Sin funciones)</option>';
            } else {
                funcs.forEach(f => {
                    var name = (typeof f === 'string') ? f : (f.nombre || '');
                    if (!name) return;
                    var opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    select.appendChild(opt);
                });
            }
        }).catch(err => {
            console.error('Error al cargar funciones para el modal:', err);
            select.innerHTML = '<option value="">Error al cargar funciones</option>';
        });

    // Initialize bootstrap modal (works with Bootstrap 5)
    var bsModal = null;
    try {
        bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    } catch (e) {
        // fallback: simple display
        modal.style.display = 'block';
    }

    // Handle save
    modal.querySelector('#guardarNuevoUsuario').addEventListener('click', function () {
        var usuario = modal.querySelector('#nuevo_usuario').value.trim();
        var pwd = modal.querySelector('#nuevo_pwd').value.trim();
        var funcion = modal.querySelector('#nuevo_funcion').value;
        if (!usuario || usuario.length === 0) {
            if (window && typeof window.swalAlertOpt === 'function') {
                window.swalAlertOpt('Error', 'El nombre de usuario no puede estar vacío', 'error');
            } else {
                alert('El nombre de usuario no puede estar vacío');
            }
            return;
        }
        if (!pwd || pwd.length === 0) {
            if (window && typeof window.swalAlertOpt === 'function') {
                window.swalAlertOpt('Error', 'La contraseña no puede estar vacía', 'error');
            } else {
                alert('La contraseña no puede estar vacía');
            }
            return;
        }

        var originalBtnContent = this.innerHTML;
        this.disabled = true;

        var creatingText = 'Creando ' + (funcion);
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + creatingText + '...';

        postForm('controlador/agregarUsuario.php', { usuario: usuario, contraseña: pwd, funcion: funcion })
            .then(resp => {
                if (resp && resp.ok) {
                    if (window && typeof window.swalAlertOpt === 'function') {
                        window.swalAlertOpt('Correcto', resp.msg || 'Usuario agregado', 'success');
                    } else {
                        alert(resp.msg || 'Usuario agregado');
                    }
                    // Cerrar modal
                    try { bsModal.hide(); } catch (e) { modal.parentNode.removeChild(modal); }
                    // Refresh users table
                    obtenerUsuarios().then(usuarios => { menuUsuarios(usuarios); });
                } else {
                    var msg = resp && resp.msg ? resp.msg : JSON.stringify(resp);
                    if (window && typeof window.swalAlertOpt === 'function') {
                        window.swalAlertOpt('Error', msg, 'error');
                    } else {
                        alert(msg);
                    }
                    this.disabled = false;
                    this.innerHTML = originalBtnContent;
                }
            }).catch(err => {
                console.error('Error agregando usuario:', err);
                if (window && typeof window.swalAlertOpt === 'function') {
                    window.swalAlertOpt('Error', 'Error al agregar usuario', 'error');
                } else {
                    alert('Error al agregar usuario');
                }
                this.disabled = false;
                this.innerHTML = originalBtnContent;
            });
    });
}

// Exponer funciones en window para entornos donde los scripts no definen globals (compatibilidad)
try {
    if (typeof window !== 'undefined') {
        window.menuUsuarios = menuUsuarios;
        window.obtenerUsuarios = obtenerUsuarios;
        window.postForm = postForm;
        window.mostrarModalAgregarUsuario = mostrarModalAgregarUsuario;
    }
} catch (e) {
    // noop
}