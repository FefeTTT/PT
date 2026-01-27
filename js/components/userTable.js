// js/components/userTable.js
(function (global) {
    'use strict';

    const UserTable = {
        render: function (container, users) {
            container.innerHTML = '';

            // Header Bar
            this.renderHeader(container);

            // Table Elements
            var table = document.createElement('table');
            table.className = 'table table-striped table-sm users-table';
            var thead = document.createElement('thead');
            var tbody = document.createElement('tbody');

            // Determine Headers
            var headers = this.getHeaders(users);

            // Render Table Header
            var trHead = document.createElement('tr');
            headers.forEach(h => {
                var th = document.createElement('th');
                th.textContent = h.charAt(0).toUpperCase() + h.slice(1);
                trHead.appendChild(th);
            });
            var thFunc = document.createElement('th');
            thFunc.textContent = 'Funciones asignadas';
            trHead.appendChild(thFunc);
            thead.appendChild(trHead);

            // Render Rows
            users.forEach(u => {
                var tr = document.createElement('tr');
                headers.forEach(h => {
                    var td = document.createElement('td');
                    if (h === 'contraseña') {
                        this.renderPasswordCell(td, u);
                    } else if (h === 'usuario') {
                        this.renderUserCell(td, u);
                    } else {
                        td.textContent = u[h];
                    }
                    tr.appendChild(td);
                });

                // Functions Cell
                this.renderFunctionsCell(tr, u);
                tbody.appendChild(tr);
            });

            table.appendChild(thead);
            table.appendChild(tbody);
            container.appendChild(table);

            // Footer (Add User)
            this.renderFooter(table, headers.length);
        },

        renderHeader: function (container) {
            var headerBar = document.createElement('div');
            headerBar.className = 'd-flex align-items-center mb-3';

            var backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'btn btn-sm btn-back';
            backBtn.title = 'Volver';
            backBtn.innerHTML = '&#8592; Volver';
            backBtn.addEventListener('click', function () {
                try {
                    if (typeof crearMenuAdministrador === 'function') {
                        crearMenuAdministrador();
                    } else {
                        window.location.reload();
                    }
                } catch (e) { window.location.reload(); }
            });

            var titleH5 = document.createElement('h5');
            titleH5.className = 'm-0';
            titleH5.textContent = 'Usuarios';

            headerBar.appendChild(backBtn);
            headerBar.appendChild(titleH5);
            container.appendChild(headerBar);
        },

        getHeaders: function (users) {
            if (Array.isArray(users) && users.length > 0) {
                var headers = Object.keys(users[0]);
                return headers.filter(function (h) {
                    var n = String(h).toLowerCase();
                    if (n === 'id' || n === 'idusuario' || n === 'id_usuario' || n === 'id_user' || n === 'userid') return false;
                    if (n === 'intento') return false;
                    if (n.endsWith('id')) return false;
                    return true;
                });
            }
            return ['usuario', 'contraseña'];
        },

        renderPasswordCell: function (td, u) {
            var btnPwd = document.createElement('button');
            btnPwd.textContent = 'Cambiar contraseña';
            btnPwd.className = 'btn btn-warning btn-sm btn-user-pwd';

            var self = this; // closure reference if needed, though arrow funcs preferred

            btnPwd.addEventListener('click', function pwdClickHandler() {
                td.innerHTML = '';
                var input = document.createElement('input');
                input.type = 'password';
                input.className = 'form-control form-control-sm';
                input.placeholder = 'Nueva contraseña';

                var send = document.createElement('button');
                send.textContent = 'Enviar';
                send.className = 'btn btn-success btn-sm';
                send.style.marginTop = '4px';

                var cancel = document.createElement('button');
                cancel.textContent = 'Cancelar';
                cancel.className = 'btn btn-secondary btn-sm ms-2';
                cancel.style.marginTop = '4px';

                cancel.addEventListener('click', function () {
                    td.innerHTML = '';
                    td.appendChild(btnPwd);
                });

                send.addEventListener('click', function () {
                    var newPwd = (input.value || '').trim();
                    if (!newPwd) {
                        self.showAlert('Error', 'La contraseña no puede estar vacía.', 'warning');
                        return;
                    }
                    var currentPwd = u['contraseña'] || u.contrasena || u.password || '';
                    if (currentPwd && newPwd === String(currentPwd)) {
                        self.showAlert('Error', 'La nueva contraseña no puede ser igual a la actual.', 'warning');
                        return;
                    }

                    send.disabled = true;
                    ApiService.updatePassword(u.usuario, input.value)
                        .then(json => {
                            if (json && json.ok) {
                                td.innerHTML = '';
                                // Re-create button (clean start)
                                var newOkBtn = document.createElement('button');
                                newOkBtn.textContent = 'Cambiar contraseña';
                                newOkBtn.className = 'btn btn-warning btn-sm';
                                newOkBtn.addEventListener('click', pwdClickHandler);
                                td.appendChild(newOkBtn);
                            } else {
                                self.showAlert('Error', 'No se pudo actualizar: ' + (json.msg || ''), 'error');
                                send.disabled = false;
                            }
                        }).catch(err => {
                            self.showAlert('Error', 'Error al actualizar contraseña', 'error');
                            send.disabled = false;
                        });
                });

                td.appendChild(input);
                td.appendChild(send);
                td.appendChild(cancel);
            });
            td.appendChild(btnPwd);
        },

        renderUserCell: function (td, u) {
            // Delete Button
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-danger btn-sm me-2 btn-user-delete';
            delBtn.textContent = '\u00D7'; // Multiplication sign

            var self = this;
            delBtn.addEventListener('click', function () {
                self.handleDeleteUser(u.usuario, delBtn);
            });

            var spanUser = document.createElement('span');
            spanUser.textContent = u.usuario;
            spanUser.className = 'username';

            td.appendChild(delBtn);
            td.appendChild(spanUser);
        },

        handleDeleteUser: function (userName, btnElement) {
            // Self-delete check
            if (this.isCurrentUser(userName)) {
                this.showAlert('Acción no permitida', 'No puedes eliminar tu propia cuenta.', 'warning');
                return;
            }

            if (confirm('¿Eliminar el usuario "' + userName + '"? Esta acción no se puede deshacer.')) {
                btnElement.disabled = true;
                ApiService.deleteUserByName(userName)
                    .then(resp => {
                        if (resp && resp.ok) {
                            // Refresh
                            if (global.menuUsuarios && typeof ApiService.getUsers === 'function') {
                                ApiService.getUsers().then(users => global.menuUsuarios(users));
                            } else {
                                // Simple reload fallback or remove row??
                                // Ideally call main controller refresh
                                window.location.reload();
                            }
                        } else {
                            this.showAlert('Error', 'No se pudo eliminar: ' + (resp.msg || ''), 'error');
                            btnElement.disabled = false;
                        }
                    }).catch(err => {
                        this.showAlert('Error', 'Error al eliminar usuario', 'error');
                        btnElement.disabled = false;
                    });
            }
        },

        isCurrentUser: function (userName) {
            // Logic to check current user from URL or DOM
            var params = new URLSearchParams(window.location.search);
            var current = params.get('user');
            if (!current) {
                var bw = document.getElementById('bienvenido');
                if (bw) {
                    var txt = (bw.innerText || '').trim();
                    var m = txt.match(/Bienvenid[oa]\s+(.+)$/i);
                    if (m && m[1]) current = m[1].trim();
                }
            }
            return current && String(current).toLowerCase() === String(userName).toLowerCase();
        },

        renderFunctionsCell: function (tr, u) {
            var tdFunc = document.createElement('td');
            tdFunc.id = 'funciones_' + (u.idUsuario || Math.random());

            var btn = document.createElement('button');
            btn.textContent = 'Cargando...';
            btn.className = 'btn btn-info btn-sm btn-user-func';
            btn.disabled = true;

            // Initial Load
            ApiService.getUserFunctions(u.usuario)
                .then(json => {
                    if (json && json.ok && Array.isArray(json.funciones) && json.funciones.length > 0) {
                        var names = json.funciones.map(f => f.nombre || f).filter(Boolean);
                        // Edit Icon
                        var editIcon = ' \u270E'; // Pencil char simpler than SVG for now
                        btn.textContent = (names.join(', ') || 'Sin nombre') + editIcon;
                    } else {
                        btn.textContent = 'Sin funciones';
                    }
                })
                .catch(() => btn.textContent = 'Error')
                .finally(() => btn.disabled = false);

            var self = this;
            btn.addEventListener('click', function () {
                self.handleEditFunction(u, tdFunc, btn);
            });

            tdFunc.appendChild(btn);
            tr.appendChild(tdFunc);
        },

        handleEditFunction: function (u, tdFunc, originalBtn) {
            Promise.all([
                ApiService.getUserFunctions(u.usuario),
                ApiService.getAllFunctions()
            ]).then(([userJson, allFuncsResp]) => {
                tdFunc.innerHTML = '';

                var currentName = null;
                if (userJson && userJson.ok && Array.isArray(userJson.funciones) && userJson.funciones.length > 0) {
                    currentName = userJson.funciones[0].nombre || null;
                }

                var allFuncs = Array.isArray(allFuncsResp) ? allFuncsResp : (allFuncsResp.funciones || []);

                var select = document.createElement('select');
                select.className = 'form-select form-select-sm d-inline-block w-auto me-2';

                var options = allFuncs.map(f => {
                    if (typeof f === 'string') return { nombre: f };
                    return (f && f.nombre) ? { nombre: f.nombre } : null;
                }).filter(Boolean);

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

                btnCancel.addEventListener('click', () => {
                    tdFunc.innerHTML = '';
                    tdFunc.appendChild(originalBtn);
                });

                btnSave.addEventListener('click', () => {
                    var nueva = select.value;
                    if (!nueva) return;
                    btnSave.disabled = true;
                    ApiService.updateUserFunction(u.usuario, currentName, nueva)
                        .then(resp => {
                            if (resp && resp.ok) {
                                originalBtn.textContent = nueva;
                                tdFunc.innerHTML = '';
                                tdFunc.appendChild(originalBtn);
                            } else {
                                this.showAlert('Error', 'No se pudo actualizar: ' + (resp.msg || ''), 'error');
                                btnSave.disabled = false;
                            }
                        }).catch(() => {
                            this.showAlert('Error', 'Error al guardar función', 'error');
                            btnSave.disabled = false;
                        });
                });

            }).catch(e => {
                console.error(e);
                this.showAlert('Error', 'Error cargando datos para edición', 'error');
                tdFunc.textContent = 'Error';
            });
        },

        renderFooter: function (table, colSpan) {
            var tfoot = document.createElement('tfoot');
            var trFoot = document.createElement('tr');
            var tdAdd = document.createElement('td');
            tdAdd.colSpan = colSpan + 1;
            tdAdd.className = 'text-end users-tfoot-cell';

            var addBtn = document.createElement('button');
            addBtn.className = 'btn btn-success btn-sm btn-add-user';
            addBtn.innerHTML = '<span style="font-weight:bold; font-size:18px;">+</span> Agregar usuario';

            addBtn.addEventListener('click', function () {
                if (window.UserModal) {
                    window.UserModal.show();
                } else {
                    alert('Modal de usuario no cargado');
                }
            });

            tdAdd.appendChild(addBtn);
            trFoot.appendChild(tdAdd);
            tfoot.appendChild(trFoot);
            table.appendChild(tfoot);
        },

        showAlert: function (title, text, icon) {
            if (global.Swal && typeof Swal.fire === 'function') {
                Swal.fire({ title: title, text: text, icon: icon });
            } else {
                alert(title + ': ' + text);
            }
        }
    };

    global.UserTable = UserTable;

})(window);
