// js/components/userModal.js
(function (global) {
    'use strict';

    const UserModal = {
        show: function () {
            var existing = document.getElementById('modalAgregarUsuario');
            if (existing) existing.parentNode.removeChild(existing);

            var modal = this.createModalDOM();
            document.body.appendChild(modal);

            // Show using Bootstrap API
            try {
                var bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } catch (e) {
                // Fallback for older bootstrap or missing JS
                if (typeof $ === 'function') $(modal).modal('show');
            }
        },

        createModalDOM: function () {
            var modal = document.createElement('div');
            modal.id = 'modalAgregarUsuario';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.setAttribute('role', 'dialog');

            var dialog = document.createElement('div');
            dialog.className = 'modal-dialog';
            dialog.setAttribute('role', 'document');

            var content = document.createElement('div');
            content.className = 'modal-content';

            // Header
            var header = document.createElement('div');
            header.className = 'modal-header';
            header.innerHTML = '<h5 class="modal-title">Agregar Nuevo Usuario</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>';

            // Body
            var body = document.createElement('div');
            body.className = 'modal-body';
            body.innerHTML =
                '<form id="formAgregarUsuario">' +
                '<div class="mb-3">' +
                '<label for="new_usuario" class="form-label">Usuario</label>' +
                '<input type="text" class="form-control" id="new_usuario" name="usuario" required>' +
                '</div>' +
                '<div class="mb-3">' +
                '<label for="new_pwd" class="form-label">Contraseña</label>' +
                '<input type="password" class="form-control" id="new_pwd" name="contraseña" required>' +
                '</div>' +
                '<div class="mb-3">' +
                '<label for="new_funcion" class="form-label">Función Inicial</label>' +
                '<select class="form-select" id="new_funcion" name="funcion">' +
                '<option value="" selected>Cargando...</option>' +
                '</select>' +
                '</div>' +
                '</form>';

            // Footer
            var footer = document.createElement('div');
            footer.className = 'modal-footer';
            footer.innerHTML =
                '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>' +
                '<button type="button" class="btn btn-primary" id="btnGuardarUsuario">Guardar</button>';

            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(footer);
            dialog.appendChild(content);
            modal.appendChild(dialog);

            // Function Loading
            var select = body.querySelector('#new_funcion');
            ApiService.getAllFunctions().then(json => {
                select.innerHTML = '<option value="">-- Seleccionar --</option>';
                var list = Array.isArray(json) ? json : (json.funciones || []);
                list.forEach(f => {
                    var n = f.nombre || f;
                    var opt = document.createElement('option');
                    opt.value = n;
                    opt.textContent = n;
                    select.appendChild(opt);
                });
            }).catch(() => {
                select.innerHTML = '<option value="">Error cargando</option>';
            });

            // Save Handler
            var saveBtn = footer.querySelector('#btnGuardarUsuario');

            saveBtn.addEventListener('click', () => {
                var form = body.querySelector('#formAgregarUsuario');
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }

                var data = new FormData(form);
                var payload = Object.fromEntries(data.entries());

                ApiService.postForm('controlador/agregarUsuario.php', payload)
                    .then(resp => {
                        if (resp && resp.ok) {
                            // Close modal
                            var closeBtn = header.querySelector('.btn-close');
                            if (closeBtn) closeBtn.click();

                            // Refresh Table
                            if (global.menuUsuarios && ApiService.getUsers) {
                                ApiService.getUsers().then(users => global.menuUsuarios(users));
                            }

                            if (global.Swal) Swal.fire('Guardado', 'Usuario agregado correctamente', 'success');
                        } else {
                            if (global.Swal) Swal.fire('Error', 'No se pudo guardar: ' + (resp.msg || ''), 'error');
                        }
                    })
                    .catch(err => {
                        if (global.Swal) Swal.fire('Error', 'Error de conexión', 'error');
                    });
            });

            return modal;
        }
    };

    global.UserModal = UserModal;

})(window);
