"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

// menuUsuarios.js
// Muestra el nombre del usuario en el menú usando JS
function crearMenuAdministrador() {
  var adminMenu = document.getElementById('admin-menu');
  if (!adminMenu) return;
  adminMenu.innerHTML = ''; // Datos de los botones

  var botones = [{
    id: 'menu-usuario',
    href: null,
    img: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
    alt: 'Usuarios',
    span: 'Usuarios',
    tile: 'datos-tile'
  }, {
    id: 'menu-trimestre',
    href: null,
    img: 'https://cdn-icons-png.flaticon.com/512/2917/2917996.png',
    alt: 'Trimestres',
    span: 'Trimestres',
    tile: 'datos-tile'
  }, {
    id: 'menu-reserva',
    href: null,
    img: 'https://cdn-icons-png.flaticon.com/512/561/561127.png',
    alt: 'Sistema de reserva',
    span: 'Sistema de reserva',
    tile: 'prog-tile'
  }, {
    id: 'menu-directorio',
    href: null,
    img: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
    alt: 'Directorio',
    span: 'Directorio',
    tile: 'prog-tile'
  }];
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
    adminMenu.appendChild(colDiv); // Evento click condicional para cada botón

    a.addEventListener('click', function (e) {
      switch (btn.id) {
        case 'menu-usuario':
          e.preventDefault();
          obtenerUsuarios().then(function (usuarios) {
            if (typeof window.menuUsuarios === 'function') {
              window.menuUsuarios(usuarios);
            } else {
              var msg = 'Función menuUsuarios no disponible en este contexto';
              console.error(msg);

              if (window.Swal && typeof Swal.fire === 'function') {
                Swal.fire({
                  title: 'Error',
                  text: msg,
                  icon: 'error'
                });
              } else {
                alert(msg);
              }
            }
          })["catch"](function (err) {
            console.error('Error al obtener usuarios:', err);
            var msg = err instanceof Error ? err.message + '\n' + err.stack : JSON.stringify(err);

            if (window.Swal && typeof Swal.fire === 'function') {
              Swal.fire({
                title: 'Error',
                text: 'Error al obtener usuarios: ' + msg,
                icon: 'error'
              });
            } else if (window.swal && typeof swal === 'function') {
              try {
                swal('Error', 'Error al obtener usuarios: ' + msg, 'error');
              } catch (e) {
                alert('Error al obtener usuarios: ' + msg);
              }
            } else {
              alert('Error al obtener usuarios: ' + msg);
            }
          });
          break;

        case 'menu-trimestre':
          e.preventDefault();

          try {
            var adminMenuEl = document.getElementById('admin-menu');

            if (window && typeof window.crearMenuTrimestres === 'function') {
              window.crearMenuTrimestres(adminMenuEl);
            } else {
              if (window.Swal && typeof Swal.fire === 'function') {
                Swal.fire({
                  title: 'Trimestres',
                  text: 'Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.',
                  icon: 'info'
                });
              } else if (window.swal && typeof swal === 'function') {
                try {
                  swal('Trimestres', 'Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.', 'info');
                } catch (e) {
                  alert('Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.');
                }
              } else {
                alert('Gestión de trimestres: aquí puedes crear/editar trimestres y sus fechas límite.');
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
            Swal.fire({
              title: 'Sistema de reserva',
              text: 'Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.',
              icon: 'info'
            });
          } else if (window.swal && typeof swal === 'function') {
            try {
              swal('Sistema de reserva', 'Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.', 'info');
            } catch (e) {
              alert('Funcionalidad de Sistema de reserva: aquí puedes mostrar el sistema de reservas.');
            }
          } else {
            // Si existe el módulo menuPrincipalAdmin, úsalo para montar el panel de directorio
            try {
              var _adminMenuEl = document.getElementById('admin-menu');

              if (window.crearMenuPrincipalAdmin) {
                window.crearMenuPrincipalAdmin(_adminMenuEl);
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
} // Promesa para obtener usuarios desde el backend


function obtenerUsuarios() {
  return fetch('controlador/recuperarUsuarioTodos.php').then(function (response) {
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    return response.json();
  });
} // Helper: enviar formulario por POST y devolver Promise con JSON


function postForm(url, dataObj) {
  var body = new URLSearchParams(dataObj).toString();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  }).then(function (response) {
    if (!response.ok) throw new Error('HTTP error ' + response.status);
    return response.json();
  });
}

function menuUsuarios(usuarios) {
  // Obtener contenedor y limpiar
  var adminMenu = document.getElementById('admin-menu');

  if (!adminMenu) {
    console.error('Elemento #admin-menu no encontrado');
    return;
  }

  adminMenu.innerHTML = ''; // Barra superior: botón regresar + título

  var headerBar = document.createElement('div');
  headerBar.className = 'd-flex align-items-center mb-3';
  var backBtn = document.createElement('button');
  backBtn.type = 'button'; // usar clase para que los estilos de la paleta se definan en CSS

  backBtn.className = 'btn btn-sm btn-back';
  backBtn.title = 'Volver'; // Mostrar flecha + texto para mayor claridad

  backBtn.innerHTML = '&#8592; Volver'; // flecha izquierda + texto

  backBtn.addEventListener('click', function () {
    // Reconstruir el menú administrador (volver)
    try {
      crearMenuAdministrador();
    } catch (e) {
      window.location.reload();
    }
  });
  var titleH5 = document.createElement('h5');
  titleH5.className = 'm-0';
  titleH5.textContent = 'Usuarios';
  headerBar.appendChild(backBtn);
  headerBar.appendChild(titleH5);
  adminMenu.appendChild(headerBar); // Crear elementos de tabla

  var table = document.createElement('table');
  table.className = 'table table-striped table-sm users-table';
  var thead = document.createElement('thead');
  var tbody = document.createElement('tbody'); // Determinar cabeceras dinámicamente a partir del primer usuario

  var headers = [];

  if (Array.isArray(usuarios) && usuarios.length > 0) {
    headers = Object.keys(usuarios[0]); // Quitar columnas de id (variantes: id, idUsuario, usuarioId, id_usuario, userId, etc.)

    headers = headers.filter(function (h) {
      var n = String(h).toLowerCase();
      if (n === 'id' || n === 'idusuario' || n === 'id_usuario' || n === 'id_user' || n === 'userid') return false;
      if (n.endsWith('id')) return false; // elimina 'usuarioId', 'userId', etc.

      return true;
    });
  } else {
    // Fallback razonable si no hay usuarios
    headers = ['usuario', 'contraseña', 'intento'];
  }

  var trHead = document.createElement('tr');
  headers.forEach(function (h) {
    var th = document.createElement('th');
    th.textContent = h.charAt(0).toUpperCase() + h.slice(1);
    trHead.appendChild(th);
  }); // Columna extra para funciones

  var thFunc = document.createElement('th');
  thFunc.textContent = 'Funciones asignadas';
  trHead.appendChild(thFunc);
  thead.appendChild(trHead); // Filas

  usuarios.forEach(function (u) {
    var tr = document.createElement('tr');
    headers.forEach(function (h) {
      var td = document.createElement('td'); // Especializar columnas contraseña e intento

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
            send.disabled = true;
            var data = new URLSearchParams();
            data.append('usuario', u.usuario);
            data.append('contraseña', input.value);
            postForm('controlador/actualizarUsuarioContraseña.php', {
              'usuario': u.usuario,
              'contraseña': input.value
            }).then(function (json) {
              if (json && json.ok) {
                td.innerHTML = ''; // Restaurar botón

                var okBtn = document.createElement('button');
                okBtn.textContent = 'Cambiar contraseña';
                okBtn.className = 'btn btn-warning btn-sm';
                okBtn.addEventListener('click', pwdClickHandler);
                td.appendChild(okBtn);
              } else {
                var msg = json && json.msg ? json.msg : JSON.stringify(json);

                if (window.Swal && typeof Swal.fire === 'function') {
                  Swal.fire({
                    title: 'Error',
                    text: 'No se pudo actualizar la contraseña: ' + msg,
                    icon: 'error'
                  });
                } else if (window.swal && typeof swal === 'function') {
                  try {
                    swal('Error', 'No se pudo actualizar la contraseña: ' + msg, 'error');
                  } catch (e) {
                    alert('No se pudo actualizar la contraseña: ' + msg);
                  }
                } else {
                  alert('No se pudo actualizar la contraseña: ' + msg);
                }

                send.disabled = false;
              }
            })["catch"](function (err) {
              console.error('Error actualizar contraseña:', err);
              var msg = err && err.message ? err.message : JSON.stringify(err);

              if (window.Swal && typeof Swal.fire === 'function') {
                Swal.fire({
                  title: 'Error',
                  text: 'Error al actualizar contraseña: ' + msg,
                  icon: 'error'
                });
              } else if (window.swal && typeof swal === 'function') {
                try {
                  swal('Error', 'Error al actualizar contraseña', 'error');
                } catch (e) {
                  alert('Error al actualizar contraseña');
                }
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
      } else if (h === 'intento') {
        // Botón para resetear intento directamente (envía intento=0)
        var btnInt = document.createElement('button');
        btnInt.textContent = u[h];
        btnInt.className = 'btn btn-secondary btn-sm btn-user-intento';
        btnInt.addEventListener('click', function () {
          btnInt.disabled = true;
          var data = new URLSearchParams();
          data.append('usuario', u.usuario);
          data.append('intento', 0);
          postForm('controlador/insertarUsuarioIntento.php', {
            'usuario': u.usuario,
            'intento': 0
          }).then(function (json) {
            if (json && json.ok) {
              btnInt.textContent = json.intento !== undefined ? json.intento : '0';
            } else {
              alert('No se pudo resetear intento: ' + (json.msg || JSON.stringify(json)));
            }
          })["catch"](function (err) {
            console.error('Error reset intento:', err);
            alert('Error al resetear intento');
          })["finally"](function () {
            btnInt.disabled = false;
          });
        });
        td.appendChild(btnInt);
      } else {
        // Mostrar botón de eliminar a la izquierda del nombre de usuario
        if (h === 'usuario') {
          // Limpiar contenido por si acaso
          while (td.firstChild) {
            td.removeChild(td.firstChild);
          }

          var delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn btn-danger btn-sm me-2 btn-user-delete';
          delBtn.title = 'Eliminar usuario';
          delBtn.setAttribute('aria-label', 'Eliminar usuario');
          delBtn.textContent = "\xD7"; // Multiplication sign (×)
          // Handler: confirmar y luego llamar al endpoint que elimina por nombre

          delBtn.addEventListener('click', function () {
            var nombre = u.usuario;
            if (!nombre) return; // Impedir que el usuario en curso se elimine a sí mismo

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
            } // Use SweetAlert if available, otherwise fallback to native confirm


            var doDelete = function doDelete() {
              delBtn.disabled = true; // Show SweetAlert2 loading if available

              var showedLoading = false;

              if (window.Swal && typeof Swal.fire === 'function') {
                showedLoading = true;
                Swal.fire({
                  title: 'Eliminando...',
                  allowOutsideClick: false,
                  didOpen: function didOpen() {
                    Swal.showLoading();
                  }
                });
              }

              postForm('controlador/eliminarUsuarioNombre.php', {
                usuario: nombre
              }).then(function (resp) {
                if (showedLoading && window.Swal && typeof Swal.close === 'function') {
                  try {
                    Swal.close();
                  } catch (e) {
                    /* ignore */
                  }
                }

                if (resp && resp.ok) {
                  if (window && typeof window.swalAlertOpt === 'function') {
                    window.swalAlertOpt('Eliminado', resp.msg || 'Usuario eliminado', 'success');
                  } // Refrescar la tabla de usuarios


                  obtenerUsuarios().then(function (usuarios) {
                    menuUsuarios(usuarios);
                  })["catch"](function (err) {
                    console.error('Error al refrescar usuarios tras eliminar:', err);
                  });
                } else {
                  var msg = resp && resp.msg ? resp.msg : JSON.stringify(resp);

                  if (window.Swal && typeof Swal.fire === 'function') {
                    Swal.fire({
                      title: 'Error',
                      text: 'No se pudo eliminar el usuario: ' + msg,
                      icon: 'error'
                    });
                  } else if (window.swal && typeof swal === 'function') {
                    try {
                      swal('Error', 'No se pudo eliminar el usuario: ' + msg, 'error');
                    } catch (e) {
                      alert('No se pudo eliminar el usuario: ' + msg);
                    }
                  } else {
                    alert('No se pudo eliminar el usuario: ' + msg);
                  }

                  delBtn.disabled = false;
                }
              })["catch"](function (err) {
                if (showedLoading && window.Swal && typeof Swal.close === 'function') {
                  try {
                    Swal.close();
                  } catch (e) {
                    /* ignore */
                  }
                }

                console.error('Error eliminando usuario:', err);

                if (window.Swal && typeof Swal.fire === 'function') {
                  Swal.fire({
                    title: 'Error',
                    text: 'Error al eliminar usuario',
                    icon: 'error'
                  });
                } else if (window.swal && typeof swal === 'function') {
                  try {
                    swal('Error', 'Error al eliminar usuario', 'error');
                  } catch (e) {
                    alert('Error al eliminar usuario');
                  }
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
                  prom.then(function (willDelete) {
                    if (willDelete) doDelete();
                  });
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
          spanUser.textContent = u[h]; // Añadir clase para permitir estilos CSS consistentes (contraste, tamaño, etc.)

          spanUser.className = 'username';
          td.appendChild(delBtn);
          td.appendChild(spanUser);
        } else {
          td.textContent = u[h];
        }
      }

      tr.appendChild(td);
    }); // Celda para funciones

    var tdFunc = document.createElement('td');
    tdFunc.id = 'funciones_' + u.idUsuario; // Botón para mostrar el nombre de la(s) función(es) asignada(s) y permitir ver detalle

    var btn = document.createElement('button');
    btn.textContent = 'Cargando...';
    btn.className = 'btn btn-info btn-sm btn-user-func';
    btn.disabled = true; // Obtener nombre(s) de función por nombre de usuario (POST)

    postForm('controlador/recuperaFuncionUsuarioNombre.php', {
      'usuario': u.usuario
    }).then(function (json) {
      if (json && json.ok && Array.isArray(json.funciones) && json.funciones.length > 0) {
        // Unir los nombres si hay varias funciones
        var nombres = json.funciones.map(function (f) {
          return f.nombre ? f.nombre : typeof f === 'string' ? f : '';
        }).filter(Boolean);
        btn.textContent = nombres.length > 0 ? nombres.join(', ') : 'Sin nombre';
      } else {
        btn.textContent = 'Sin funciones';
      }
    })["catch"](function (err) {
      console.error('Error al obtener funciones por nombre:', err);
      btn.textContent = 'Error';
    })["finally"](function () {
      btn.disabled = false;
    }); // Al hacer clic, reemplazar el botón por un select deslizable con las funciones disponibles

    btn.addEventListener('click', function () {
      // Obtener funciones actuales del usuario y la lista completa de funciones en paralelo
      Promise.all([postForm('controlador/recuperaFuncionUsuarioNombre.php', {
        'usuario': u.usuario
      }), fetch('controlador/recuperarTodasFunciones.php').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })]).then(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            userJson = _ref2[0],
            allFuncsResp = _ref2[1];

        tdFunc.innerHTML = '';
        var currentName = null;

        if (userJson && userJson.ok && Array.isArray(userJson.funciones) && userJson.funciones.length > 0) {
          currentName = userJson.funciones[0].nombre || null;
        } // allFuncsResp may be the raw array or an object { ok: true, funciones: [...] }


        var allFuncs = [];

        if (Array.isArray(allFuncsResp)) {
          allFuncs = allFuncsResp;
        } else if (allFuncsResp && Array.isArray(allFuncsResp.funciones)) {
          allFuncs = allFuncsResp.funciones;
        } // allFuncs expected to be an array of {nombre, descripcion} or similar


        var select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.style.display = 'inline-block';
        select.style.width = 'auto';
        select.style.marginRight = '8px';
        if (!Array.isArray(allFuncs)) allFuncs = []; // If the backend returns objects or strings, normalize to {nombre}

        var options = allFuncs.map(function (f) {
          if (typeof f === 'string') return {
            nombre: f
          };
          return f && f.nombre ? {
            nombre: f.nombre
          } : null;
        }).filter(Boolean); // Ensure currentName is included in options

        if (currentName && !options.some(function (o) {
          return o.nombre === currentName;
        })) {
          options.unshift({
            nombre: currentName
          });
        }

        options.forEach(function (o) {
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
          btnSave.disabled = true; // Enviar request al backend para actualizar: eliminar la función antigua y asignar la nueva

          postForm('controlador/actualizaFuncionUsuario.php', {
            usuario: u.usuario,
            funcion_old: currentName || '',
            funcion_new: nueva
          }).then(function (resp) {
            if (resp && resp.ok) {
              // Actualizar texto del botón y restaurarlo
              btn.textContent = nueva;
              tdFunc.innerHTML = '';
              tdFunc.appendChild(btn);
            } else {
              var msg = resp && resp.msg ? resp.msg : JSON.stringify(resp);

              if (window && typeof window.swalAlertOpt === 'function') {
                window.swalAlertOpt('Error', 'No se pudo actualizar la función: ' + msg, 'error');
              } else {
                alert('No se pudo actualizar la función: ' + msg);
              }

              btnSave.disabled = false;
            }
          })["catch"](function (err) {
            console.error('Error actualizando función del usuario:', err);

            if (window && typeof window.swalAlertOpt === 'function') {
              window.swalAlertOpt('Error', 'Error al actualizar la función del usuario', 'error');
            } else {
              alert('Error al actualizar la función del usuario');
            }

            btnSave.disabled = false;
          });
        });
      })["catch"](function (err) {
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
  adminMenu.appendChild(table); // Añadir fila final con celda que contiene un botón + para agregar nuevo usuario

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
} // Función para obtener funciones de usuario (debes implementar el backend y el render)


function obtenerFuncioUsuario(idUsuario, tdFunc) {
  // Aquí deberías hacer el fetch al backend para obtener las funciones
  // Ejemplo:
  fetch('controlador/recuperaFuncionesUsuario.php?id=' + idUsuario).then(function (resp) {
    return resp.json();
  }).then(function (funciones) {
    tdFunc.innerHTML = '';

    if (!Array.isArray(funciones) || funciones.length === 0) {
      tdFunc.textContent = 'Sin funciones asignadas';
      return;
    }

    var ul = document.createElement('ul');
    funciones.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f.nombre || f;
      ul.appendChild(li);
    });
    tdFunc.appendChild(ul);
  })["catch"](function (err) {
    tdFunc.textContent = 'Error al cargar funciones';
    console.error('Error funciones usuario:', err);
  });
} // Obtener funciones por nombre de usuario (usa POST al endpoint que devuelve {ok:true, funciones: [...]})


function obtenerFuncioUsuarioNombre(usuario, tdFunc) {
  tdFunc.innerHTML = '';
  var cargando = document.createElement('div');
  cargando.textContent = 'Cargando funciones...';
  tdFunc.appendChild(cargando);
  postForm('controlador/recuperaFuncionUsuarioNombre.php', {
    'usuario': usuario
  }).then(function (json) {
    tdFunc.innerHTML = '';

    if (!json || !json.ok || !Array.isArray(json.funciones) || json.funciones.length === 0) {
      tdFunc.textContent = 'Sin funciones asignadas';
      return;
    }

    var ul = document.createElement('ul');
    json.funciones.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f.nombre || f;
      ul.appendChild(li);
    });
    tdFunc.appendChild(ul);
  })["catch"](function (err) {
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
}); // Modal creation and handling for adding a new user

function mostrarModalAgregarUsuario() {
  // If modal already exists, remove it to rebuild
  var existing = document.getElementById('modalAgregarUsuario');
  if (existing) existing.parentNode.removeChild(existing);
  var modal = document.createElement('div');
  modal.id = 'modalAgregarUsuario';
  modal.className = 'modal fade';
  modal.tabIndex = -1;
  modal.setAttribute('role', 'dialog'); // Build modal DOM using createElement instead of innerHTML

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
  formElem.id = 'formAgregarUsuario'; // Username field

  var divUser = document.createElement('div');
  divUser.className = 'mb-3';
  var labelUser = document.createElement('label');
  labelUser.className = 'form-label';
  labelUser.textContent = 'Nombre de usuario';
  var inputUser = document.createElement('input');
  inputUser.type = 'text';
  inputUser.name = 'usuario';
  inputUser.id = 'nuevo_usuario';
  inputUser.className = 'form-control';
  inputUser.required = true;
  divUser.appendChild(labelUser);
  divUser.appendChild(inputUser); // Password field

  var divPwd = document.createElement('div');
  divPwd.className = 'mb-3';
  var labelPwd = document.createElement('label');
  labelPwd.className = 'form-label';
  labelPwd.textContent = 'Contraseña';
  var inputPwd = document.createElement('input');
  inputPwd.type = 'password';
  inputPwd.name = 'contraseña';
  inputPwd.id = 'nuevo_pwd';
  inputPwd.className = 'form-control';
  inputPwd.required = true;
  divPwd.appendChild(labelPwd);
  divPwd.appendChild(inputPwd); // Function select

  var divFunc = document.createElement('div');
  divFunc.className = 'mb-3';
  var labelFunc = document.createElement('label');
  labelFunc.className = 'form-label';
  labelFunc.textContent = 'Función';
  var selectFunc = document.createElement('select');
  selectFunc.name = 'funcion';
  selectFunc.id = 'nuevo_funcion';
  selectFunc.className = 'form-select';
  divFunc.appendChild(labelFunc);
  divFunc.appendChild(selectFunc);
  formElem.appendChild(divUser);
  formElem.appendChild(divPwd);
  formElem.appendChild(divFunc);
  bodyDiv.appendChild(formElem);
  var footerDiv = document.createElement('div');
  footerDiv.className = 'modal-footer';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-secondary';
  btnCancel.setAttribute('data-bs-dismiss', 'modal');
  btnCancel.textContent = 'Cancelar';
  var btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.id = 'guardarNuevoUsuario';
  btnSave.textContent = 'Guardar';
  footerDiv.appendChild(btnCancel);
  footerDiv.appendChild(btnSave);
  content.appendChild(headerDiv);
  content.appendChild(bodyDiv);
  content.appendChild(footerDiv);
  dialog.appendChild(content);
  modal.appendChild(dialog);
  document.body.appendChild(modal); // Populate funciones into select

  var select = modal.querySelector('#nuevo_funcion');
  select.innerHTML = '<option value="">Cargando...</option>';
  fetch('controlador/recuperarTodasFunciones.php').then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (json) {
    select.innerHTML = '';
    var funcs = [];
    if (Array.isArray(json)) funcs = json;else if (json && Array.isArray(json.funciones)) funcs = json.funciones;

    if (!funcs || funcs.length === 0) {
      select.innerHTML = '<option value="">(Sin funciones)</option>';
    } else {
      funcs.forEach(function (f) {
        var name = typeof f === 'string' ? f : f.nombre || '';
        if (!name) return;
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    }
  })["catch"](function (err) {
    console.error('Error al cargar funciones para el modal:', err);
    select.innerHTML = '<option value="">Error al cargar funciones</option>';
  }); // Initialize bootstrap modal (works with Bootstrap 5)

  var bsModal = null;

  try {
    bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } catch (e) {
    // fallback: simple display
    modal.style.display = 'block';
  } // Handle save


  modal.querySelector('#guardarNuevoUsuario').addEventListener('click', function () {
    var _this = this;

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

    this.disabled = true;
    postForm('controlador/agregarUsuario.php', {
      usuario: usuario,
      contraseña: pwd,
      funcion: funcion
    }).then(function (resp) {
      if (resp && resp.ok) {
        if (window && typeof window.swalAlertOpt === 'function') {
          window.swalAlertOpt('Correcto', resp.msg || 'Usuario agregado', 'success');
        } else {
          alert(resp.msg || 'Usuario agregado');
        } // Cerrar modal


        try {
          bsModal.hide();
        } catch (e) {
          modal.parentNode.removeChild(modal);
        } // Refresh users table


        obtenerUsuarios().then(function (usuarios) {
          menuUsuarios(usuarios);
        });
      } else {
        var msg = resp && resp.msg ? resp.msg : JSON.stringify(resp);

        if (window && typeof window.swalAlertOpt === 'function') {
          window.swalAlertOpt('Error', msg, 'error');
        } else {
          alert(msg);
        }

        _this.disabled = false;
      }
    })["catch"](function (err) {
      console.error('Error agregando usuario:', err);

      if (window && typeof window.swalAlertOpt === 'function') {
        window.swalAlertOpt('Error', 'Error al agregar usuario', 'error');
      } else {
        alert('Error al agregar usuario');
      }

      _this.disabled = false;
    });
  });
} // Exponer funciones en window para entornos donde los scripts no definen globals (compatibilidad)


try {
  if (typeof window !== 'undefined') {
    window.menuUsuarios = menuUsuarios;
    window.obtenerUsuarios = obtenerUsuarios;
    window.postForm = postForm;
    window.mostrarModalAgregarUsuario = mostrarModalAgregarUsuario;
  }
} catch (e) {// noop
}