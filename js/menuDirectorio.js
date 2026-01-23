// /js/menuDirectorio.js
// Interfaz de directorio de profesores: lista filtrable a la izquierda y detalle a la derecha.

function crearMenuDirectorio() {
    const adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) return;

    let isBulkMode = false; // Moved to top to avoid TDZ

    while (adminMenu.firstChild) adminMenu.removeChild(adminMenu.firstChild);

    // Header (back button + title)
    const header = document.createElement('div');
    header.className = 'd-flex align-items-center mb-3';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-sm btn-back me-2';
    backBtn.title = 'Volver';
    backBtn.textContent = '← Volver';
    backBtn.addEventListener('click', function () {
        try { crearMenuAdministrador(); } catch (e) { window.location.reload(); }
    });
    header.appendChild(backBtn);

    const title = document.createElement('h5');
    title.className = 'm-0';
    title.textContent = 'Directorio';
    header.appendChild(title);
    adminMenu.appendChild(header);

    // Container flex
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px';

    // Left panel (30%)
    const left = document.createElement('div');
    left.style.flex = '0 0 30%';
    const nav = document.createElement('div');
    nav.className = 'mb-2';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Buscar por nombre o número económico';
    input.className = 'form-control mb-2';
    input.id = 'dir-search-input';
    nav.appendChild(input);

    var canCreate = false;
    try {
        if (typeof window.FUNCION_ID !== 'undefined') {
            var fid = parseInt(window.FUNCION_ID, 10);
            // Permitir solo a Admin
            if (fid === 1 || fid === 4) canCreate = true;
        }
    } catch (e) { console.warn('Error verificando permisos para botones de creación:', e); }

    if (canCreate) {
        const nuevoBtn = document.createElement('button');
        nuevoBtn.className = 'btn btn-primary btn-sm mb-2';
        nuevoBtn.textContent = 'Nuevo profesor';
        nuevoBtn.addEventListener('click', mostrarModalNuevoProfesor);
        nav.appendChild(nuevoBtn);

        // Nuevo administrativo (botón junto a Nuevo profesor)
        const nuevoAdminBtn = document.createElement('button');
        nuevoAdminBtn.className = 'btn btn-secondary btn-sm mb-2 ms-2';
        nuevoAdminBtn.textContent = 'Nuevo administrativo';
        nuevoAdminBtn.addEventListener('click', mostrarModalNuevoAdministrativo);
        nav.appendChild(nuevoAdminBtn);

        // Importar profesores (botón junto a Nuevo administrativo)
        const importarProfBtn = document.createElement('button');
        importarProfBtn.className = 'btn btn-info btn-sm mb-2 ms-2';
        importarProfBtn.textContent = 'Importar profesores (CSV)';
        importarProfBtn.addEventListener('click', function () {
            window.location.href = 'scripts/formImportarProfesores.php';
        });
        nav.appendChild(importarProfBtn);

        // Bulk Edit Button
        const bulkBtn = document.createElement('button');
        bulkBtn.className = 'btn btn-warning btn-sm mb-2 ms-2';
        bulkBtn.textContent = 'Modo Edición Masiva';
        bulkBtn.onclick = function () {
            isBulkMode = !isBulkMode;
            if (isBulkMode) {
                document.getElementById('bulk-toolbar').classList.remove('d-none');
            } else {
                document.getElementById('bulk-toolbar').classList.add('d-none');
            }
            loadList(state.q);
        };
        nav.appendChild(bulkBtn);
    }


    // Toggle button to show/hide filters and sort controls
    const toggleFiltersBtn = document.createElement('button');
    toggleFiltersBtn.type = 'button';
    toggleFiltersBtn.className = 'btn btn-outline-secondary btn-sm mb-2 ms-2';
    toggleFiltersBtn.id = 'btnToggleFiltros';
    toggleFiltersBtn.setAttribute('aria-expanded', 'false');
    toggleFiltersBtn.textContent = 'Mostrar filtros';
    toggleFiltersBtn.addEventListener('click', function () {
        const controlsRef = document.getElementById('dir-controls');
        if (!controlsRef) return;
        // Use Bootstrap utility 'd-none' to reliably hide/show regardless of inline/class styles
        const hidden = controlsRef.classList.toggle('d-none');
        if (hidden) {
            toggleFiltersBtn.textContent = 'Mostrar filtros';
            toggleFiltersBtn.setAttribute('aria-expanded', 'false');
        } else {
            toggleFiltersBtn.textContent = 'Ocultar filtros';
            toggleFiltersBtn.setAttribute('aria-expanded', 'true');
        }
    });
    nav.appendChild(toggleFiltersBtn);

    left.appendChild(nav);

    // Table list
    const listWrap = document.createElement('div');
    listWrap.style.maxHeight = '60vh';
    listWrap.style.overflow = 'auto';
    const table = document.createElement('table');
    table.className = 'table table-sm table-hover';
    const thead = document.createElement('thead');
    // Build table header using DOM methods (avoid innerHTML)
    const trHead = document.createElement('tr');
    if (isBulkMode) {
        const thCheck = document.createElement('th');
        const checkAll = document.createElement('input');
        checkAll.type = 'checkbox';
        checkAll.onclick = function () {
            const boxes = document.querySelectorAll('.prof-check');
            boxes.forEach(b => b.checked = checkAll.checked);
        };
        thCheck.appendChild(checkAll);
        trHead.appendChild(thCheck);
    }
    const thName = document.createElement('th'); thName.textContent = 'Nombre';
    const thNum = document.createElement('th'); thNum.textContent = 'No. Económico';
    trHead.appendChild(thName);
    trHead.appendChild(thNum);
    thead.appendChild(trHead);
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    listWrap.appendChild(table);
    left.appendChild(listWrap);

    // Right panel (70%)
    const right = document.createElement('div');
    right.style.flex = '1 1 70%';
    right.id = 'dir-right-panel';
    // Build placeholder card with DOM methods
    const placeholderCard = document.createElement('div');
    placeholderCard.className = 'card';
    const placeholderBody = document.createElement('div');
    placeholderBody.className = 'card-body';
    placeholderBody.textContent = 'Seleccione un registro a la izquierda para ver sus detalles.';
    placeholderCard.appendChild(placeholderBody);
    right.appendChild(placeholderCard);

    // Bulk Action Toolbar (Initially Hidden)
    const bulkToolbar = document.createElement('div');
    bulkToolbar.id = 'bulk-toolbar';
    bulkToolbar.className = 'd-none alert alert-info mt-2';
    bulkToolbar.style.display = 'flex';
    bulkToolbar.style.alignItems = 'center';
    bulkToolbar.style.gap = '10px';

    // Select Tipo Dropdown
    const selTipo = document.createElement('select');
    selTipo.className = 'form-select form-select-sm';
    selTipo.style.maxWidth = '200px';
    selTipo.innerHTML = '<option value="">Seleccione tipo...</option>';
    // Load types
    fetch('controlador/recuperarProfesorTipos.php')
        .then(r => r.json())
        .then(res => {
            if (res.ok && res.data) {
                res.data.forEach(t => {
                    const op = document.createElement('option');
                    op.value = t.idProfesorTipo;
                    op.textContent = t.nombre;
                    selTipo.appendChild(op);
                });
            }
        });
    bulkToolbar.appendChild(selTipo);

    // Select All Button
    const btnSelectAll = document.createElement('button');
    btnSelectAll.className = 'btn btn-outline-secondary btn-sm';
    btnSelectAll.textContent = 'Seleccionar todos';
    btnSelectAll.onclick = function () {
        const boxes = document.querySelectorAll('.prof-check');
        const allChecked = Array.from(boxes).every(b => b.checked);
        boxes.forEach(b => b.checked = !allChecked);
        // Also update the header checkbox if it exists
        const headerCheck = document.querySelector('thead input[type="checkbox"]');
        if (headerCheck) headerCheck.checked = !allChecked;
    };
    bulkToolbar.appendChild(btnSelectAll);

    // Apply Button
    const btnApply = document.createElement('button');
    btnApply.className = 'btn btn-primary btn-sm';
    btnApply.textContent = 'Aplicar cambios';
    btnApply.onclick = function () {
        const checked = document.querySelectorAll('.prof-check:checked');

        const showSwal = (title, text, icon) => {
            if (window.Swal && typeof Swal.fire === 'function') Swal.fire(title, text, icon);
            else if (window.swal) try { new swal(title, text, icon); } catch (_) { alert(text); }
            else alert(text);
        };

        if (checked.length === 0) { showSwal('Atención', 'Seleccione al menos un profesor.', 'warning'); return; }
        const tipoId = selTipo.value;
        if (!tipoId) { showSwal('Atención', 'Seleccione un tipo de investigador.', 'warning'); return; }

        const ids = Array.from(checked).map(c => c.value);

        const confirmCallback = (isConfirmed) => {
            if (!isConfirmed) return;
            fetch('controlador/actualizarTipoProfesorMasivo.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids, idTipo: tipoId })
            })
                .then(r => r.json())
                .then(res => {
                    if (res.ok) {
                        showSwal('Éxito', `Actualizados: ${res.updated}, Errores: ${res.errors}`, 'success');
                        // exit bulk mode
                        isBulkMode = false;
                        bulkToolbar.classList.add('d-none');
                        loadList(state.q);
                    } else {
                        showSwal('Error', (res.error || 'Desconocido'), 'error');
                    }
                })
                .catch(e => showSwal('Error', 'Error de red: ' + e, 'error'));
        };

        if (window.Swal && typeof Swal.fire === 'function') {
            Swal.fire({
                title: '¿Estás seguro?',
                text: `¿Asignar el tipo seleccionado a ${ids.length} profesores?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, aplicar',
                cancelButtonText: 'Cancelar'
            }).then(result => confirmCallback(result.isConfirmed));
        } else if (confirm(`¿Asignar el tipo seleccionado a ${ids.length} profesores?`)) {
            confirmCallback(true);
        }
    };
    bulkToolbar.appendChild(btnApply);

    // Cancel Button
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-secondary btn-sm';
    btnCancel.textContent = 'Cancelar';
    btnCancel.onclick = function () {
        isBulkMode = false;
        bulkToolbar.classList.add('d-none');
        loadList(state.q);
    };
    bulkToolbar.appendChild(btnCancel);

    left.insertBefore(bulkToolbar, listWrap);

    container.appendChild(left);
    container.appendChild(right);
    adminMenu.appendChild(container);

    // let isBulkMode = false; // Moved to top

    // Helper: fetch list of profesores with optional params (returns a Promise)
    function fetchProfesores(params = {}) {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        // send name-based filters for areaAcademica and grupoTematico (frontend uses unique names)
        if (params.areaAcademica) qs.set('areaAcademicaName', params.areaAcademica);
        if (params.grupoTematico) qs.set('grupoTematicoName', params.grupoTematico);
        // usar profesorAreaTipo en lugar de area
        if (params.profesorAreaTipo) qs.set('profesorAreaTipo', params.profesorAreaTipo);
        if (params.profesorTipo) qs.set('profesorTipo', params.profesorTipo);
        if (params.trimestre) qs.set('trimestre', params.trimestre);
        if (params.sort) qs.set('sort', params.sort);
        if (params.sortDir) qs.set('sortDir', params.sortDir);
        const url = 'controlador/recuperarProfesores.php' + (qs.toString() ? ('?' + qs.toString()) : '');
        return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    // Helper: fetch list of administrativos con q/sort/sortDir
    function fetchAdministrativos(params = {}) {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.sort) qs.set('sort', params.sort);
        if (params.sortDir) qs.set('sortDir', params.sortDir);
        if (params.idAdministrativoTipo) qs.set('idAdministrativoTipo', params.idAdministrativoTipo);
        const url = 'controlador/recuperarAdministrativos.php' + (qs.toString() ? ('?' + qs.toString()) : '');
        return fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    // Helper: fetch filter option lists
    function fetchFilters() {
        return fetch('controlador/recuperaFiltrosProfesores.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    // Helper: normalizar nombre de día (quita acentos y pasa a minúsculas) para comparar "Miércoles" vs "Miercoles"
    function normDia(s) {
        try {
            return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (_) {
            return String(s || '').toLowerCase();
        }
    }

    // current filter/sort state
    const state = {
        q: '',
        areaAcademica: '',
        grupoTematico: '',
        profesorAreaTipo: '',
        profesorTipo: '',
        adminTipo: '',
        trimestre: '',
        sort: 'nombre',
        sortDir: 'ASC'
    };

    function loadList(q) {
        if (typeof q === 'string') state.q = q;
        // Cargar profesores y administrativos en paralelo (respetando opciones "Sin profesores" / "Sin administrativos")
        const profPromise = (state.profesorTipo === '__no_profesores') ? Promise.resolve({ ok: true, profesores: [] }) : fetchProfesores(state);
        const adminParams = { q: state.q, sort: state.sort, sortDir: state.sortDir };
        if (state.adminTipo) adminParams.idAdministrativoTipo = state.adminTipo;
        const adminPromise = (state.adminTipo === '__no_administrativos') ? Promise.resolve({ ok: true, administrativos: [] }) : fetchAdministrativos(adminParams);

        Promise.allSettled([profPromise, adminPromise]).then(results => {
            const profRes = results[0];
            const adminRes = results[1];
            let profesores = [];
            let administrativos = [];

            if (profRes.status === 'fulfilled' && profRes.value && profRes.value.ok) {
                profesores = Array.isArray(profRes.value.profesores) ? profRes.value.profesores : [];
            } else {
                console.warn('Fallo al cargar profesores:', profRes.reason || profRes.value);
            }
            if (adminRes.status === 'fulfilled' && adminRes.value && adminRes.value.ok) {
                administrativos = Array.isArray(adminRes.value.administrativos) ? adminRes.value.administrativos : [];
            } else {
                console.warn('Fallo al cargar administrativos:', adminRes.reason || adminRes.value);
            }

            // Combinar y normalizar
            const combined = [];
            profesores.forEach(p => combined.push({ tipo: 'profesor', id: p.idProfesor, nombre: p.nombre || '', numeroEconomico: (p.numeroEconomico ?? ''), raw: p }));
            administrativos.forEach(a => combined.push({ tipo: 'administrativo', id: a.idAdministrativo, nombre: a.nombre || '', numeroEconomico: (a.numeroEconomico ?? ''), raw: a }));

            // Ordenar combinado según state.sort/state.sortDir
            const sortKey = state.sort === 'numeroEconomico' ? 'numeroEconomico' : 'nombre';
            combined.sort((x, y) => {
                const ax = (x[sortKey] ?? '').toString().toLowerCase();
                const ay = (y[sortKey] ?? '').toString().toLowerCase();
                if (ax < ay) return state.sortDir === 'ASC' ? -1 : 1;
                if (ax > ay) return state.sortDir === 'ASC' ? 1 : -1;
                return 0;
            });

            // Render
            while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
            if (combined.length === 0) {
                const trE = document.createElement('tr');
                const tdE = document.createElement('td'); tdE.colSpan = 2; tdE.textContent = 'Sin resultados';
                trE.appendChild(tdE); tbody.appendChild(trE);
                return;
            }

            combined.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id;
                tr.dataset.tipo = item.tipo;

                if (isBulkMode) {
                    const tdCheck = document.createElement('td');
                    if (item.tipo === 'profesor') {
                        const chk = document.createElement('input');
                        chk.type = 'checkbox';
                        chk.className = 'prof-check';
                        chk.value = item.numeroEconomico;
                        // stop propagation to prevent row click selection
                        chk.onclick = function (e) { e.stopPropagation(); };
                        tdCheck.appendChild(chk);
                    }
                    tr.appendChild(tdCheck);
                }

                const tdName = document.createElement('td');
                const nameSpan = document.createElement('span'); nameSpan.textContent = item.nombre;
                const badge = document.createElement('small'); badge.className = 'text-muted ms-1'; badge.textContent = item.tipo === 'profesor' ? '(Prof.)' : '(Adm.)';
                tdName.appendChild(nameSpan); tdName.appendChild(badge);

                const tdNum = document.createElement('td'); tdNum.textContent = (item.numeroEconomico !== undefined && item.numeroEconomico !== null) ? item.numeroEconomico : '';
                tr.appendChild(tdName);
                tr.appendChild(tdNum);

                // Resaltar jefes solo para profesores cuando hay filtros de área/grupo
                if (item.tipo === 'profesor') {
                    const p = item.raw || {};
                    try {
                        if (state.areaAcademica && p.isJefeArea && Number(p.isJefeArea) === 1) tr.classList.add('table-warning');
                        else if (state.grupoTematico && p.isJefeGrupo && Number(p.isJefeGrupo) === 1) tr.classList.add('table-warning');
                    } catch (_) { /* ignore */ }
                }

                tr.addEventListener('click', () => selectRow(item, tr));
                tbody.appendChild(tr);
            });
        }).catch(err => {
            console.error('Error cargando listas:', err);
            while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
            const errTr = document.createElement('tr');
            const errTd = document.createElement('td'); errTd.colSpan = 2; errTd.textContent = 'Error al cargar directorio'; errTr.appendChild(errTd); tbody.appendChild(errTr);
        });
    }

    // select row highlight
    let lastSelected = null;
    function selectRow(item, trElem) {
        if (lastSelected) lastSelected.classList.remove('table-primary');
        trElem.classList.add('table-primary');
        lastSelected = trElem;
        if (item.tipo === 'profesor') showDetails(item.id);
        else showAdministrativoDetails(item.id);
    }
    function selectProfesor(id, trElem) {
        if (lastSelected) lastSelected.classList.remove('table-primary');
        trElem.classList.add('table-primary');
        lastSelected = trElem;
        showDetails(id);
    }

    function fetchAdministrativoById(id) {
        return fetch('controlador/recuperarAdministrativoPorId.php?id=' + encodeURIComponent(id)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    function showAdministrativoDetails(id) {
        fetchAdministrativoById(id).then(json => {
            if (!json.ok) {
                const panelErr = document.getElementById('dir-right-panel');
                while (panelErr.firstChild) panelErr.removeChild(panelErr.firstChild);
                const alertDiv = document.createElement('div'); alertDiv.className = 'alert alert-warning';
                alertDiv.textContent = 'No se pudo cargar el administrativo';
                panelErr.appendChild(alertDiv);
                return;
            }
            const a = json.administrativo || {};
            const panel = document.getElementById('dir-right-panel');
            while (panel.firstChild) panel.removeChild(panel.firstChild);
            const card = document.createElement('div'); card.className = 'card';
            const body = document.createElement('div'); body.className = 'card-body';

            // Top toolbar with actions (Editar)
            const toolbar = document.createElement('div');
            toolbar.className = 'd-flex justify-content-between align-items-center mb-2';
            const leftMenu = document.createElement('div'); leftMenu.className = 'd-flex gap-2 align-items-center';
            toolbar.appendChild(leftMenu);
            const rightMenu = document.createElement('div');
            // Editar administrativo button
            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn btn-outline-primary btn-sm me-2';
            btnEdit.title = 'Editar administrativo';
            btnEdit.textContent = 'Editar';
            rightMenu.appendChild(btnEdit);
            // Delete administrativo button (similar UX to profesor delete)
            const btnDeleteAdmin = document.createElement('button');
            btnDeleteAdmin.type = 'button';
            btnDeleteAdmin.className = 'btn btn-danger btn-sm btn-admin-delete';
            btnDeleteAdmin.title = 'Eliminar administrativo';
            btnDeleteAdmin.textContent = '✕';
            rightMenu.appendChild(btnDeleteAdmin);
            toolbar.appendChild(rightMenu);
            body.appendChild(toolbar);

            const h5 = document.createElement('h5');
            h5.textContent = a.nombre || '';
            const small = document.createElement('small'); small.className = 'text-muted';
            small.textContent = ' (' + ((a.numeroEconomico !== undefined && a.numeroEconomico !== null) ? a.numeroEconomico : '') + ')';
            h5.appendChild(small);
            body.appendChild(h5);

            const pTipo = document.createElement('p');
            const strongTipo = document.createElement('strong'); strongTipo.textContent = 'Tipo:';
            pTipo.appendChild(strongTipo);
            pTipo.appendChild(document.createTextNode(' ' + (a.tipoNombre || '(sin tipo)')));
            body.appendChild(pTipo);

            const pCorreoUAM = document.createElement('p');
            const strongUAM = document.createElement('strong'); strongUAM.textContent = 'Correo UAM:';
            pCorreoUAM.appendChild(strongUAM); pCorreoUAM.appendChild(document.createTextNode(' ' + (a.correo_uam || '')));
            body.appendChild(pCorreoUAM);

            const pCorreoPers = document.createElement('p');
            const strongPers = document.createElement('strong'); strongPers.textContent = 'Correo personal:';
            pCorreoPers.appendChild(strongPers); pCorreoPers.appendChild(document.createTextNode(' ' + (a.correo_personal || '')));
            body.appendChild(pCorreoPers);

            const pGrado = document.createElement('p');
            const strongGrado = document.createElement('strong'); strongGrado.textContent = 'Grado de estudios:';
            pGrado.appendChild(strongGrado); pGrado.appendChild(document.createTextNode(' ' + (a.gradoEstudios || '')));
            body.appendChild(pGrado);

            const pCel = document.createElement('p');
            const strongCel = document.createElement('strong'); strongCel.textContent = 'Celular:';
            pCel.appendChild(strongCel); pCel.appendChild(document.createTextNode(' ' + (a.celular || '')));
            body.appendChild(pCel);

            const pLugar = document.createElement('p');
            const strongLugar = document.createElement('strong'); strongLugar.textContent = 'Lugar:';
            pLugar.appendChild(strongLugar); pLugar.appendChild(document.createTextNode(' ' + (a.lugar || '')));
            body.appendChild(pLugar);

            const pExt = document.createElement('p');
            const strongExt = document.createElement('strong'); strongExt.textContent = 'Extensión:';
            pExt.appendChild(strongExt); pExt.appendChild(document.createTextNode(' ' + (a.extension || '')));
            body.appendChild(pExt);

            card.appendChild(body);
            panel.appendChild(card);

            // Delete administrativo handler
            btnDeleteAdmin.addEventListener('click', function () {
                function doDeleteAdmin() {
                    btnDeleteAdmin.disabled = true;
                    const params = new URLSearchParams();
                    params.set('idAdministrativo', a.idAdministrativo || a.id || '');
                    fetch('controlador/eliminarAdministrativoCompleto.php', { method: 'POST', body: params })
                        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                        .then(json => {
                            if (json.ok) {
                                if (window.Swal && typeof Swal.fire === 'function') {
                                    Swal.fire('Eliminado', 'Administrativo eliminado correctamente', 'success');
                                } else if (window.swal) { try { new swal('Eliminado', 'Administrativo eliminado correctamente', 'success'); } catch (e) { alert('Administrativo eliminado correctamente'); } }
                                else alert('Administrativo eliminado correctamente');
                                crearMenuDirectorio();
                            } else throw new Error(json.error || 'Error al eliminar');
                        })
                        .catch(err => {
                            console.error('Error eliminando administrativo:', err);
                            if (window.Swal && typeof Swal.fire === 'function') Swal.fire('Error', err.message || 'Error', 'error');
                            else if (window.swal) { try { new swal('Error', err.message || 'Error', 'error'); } catch (e) { alert('Error: ' + (err.message || err)); } }
                            else alert('Error: ' + (err.message || err));
                        })
                        .finally(() => { btnDeleteAdmin.disabled = false; });
                }

                const confirmText = 'Se eliminarán todas las referencias y el administrativo. ¿Desea continuar?';
                if (window.Swal && typeof Swal.fire === 'function') {
                    Swal.fire({ title: 'Confirmar eliminación', text: confirmText, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' }).then(result => { if (result && result.isConfirmed) doDeleteAdmin(); });
                } else if (window.swal) {
                    try { const p = window.swal({ title: 'Confirmar eliminación', text: confirmText, icon: 'warning', buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } }, dangerMode: true }); if (p && typeof p.then === 'function') { p.then(w => { if (w) doDeleteAdmin(); }); return; } } catch (e) { }
                    try { const inst = new window.swal({ title: 'Confirmar eliminación', text: confirmText, icon: 'warning', buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } }, dangerMode: true }); if (inst && typeof inst.then === 'function') { inst.then(w => { if (w) doDeleteAdmin(); }); return; } } catch (e) { }
                    try { window.swal({ title: 'Confirmar eliminación', text: confirmText, icon: 'warning', buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } }, dangerMode: true }, function (w) { if (w) doDeleteAdmin(); }); return; } catch (e) { }
                    if (confirm(confirmText)) doDeleteAdmin();
                } else {
                    if (confirm(confirmText)) doDeleteAdmin();
                }
            });

            // Editar modal handler: opens a modal prefilled with current administrativo data
            btnEdit.addEventListener('click', function () {
                const existing = document.getElementById('modalEditarAdministrativo'); if (existing) existing.remove();
                const modal = document.createElement('div'); modal.id = 'modalEditarAdministrativo'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Editar administrativo'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formEditarAdministrativo';

                function fieldEdit(lbl, name, type = 'text', val = '') {
                    const w = document.createElement('div'); w.className = 'mb-2';
                    const l = document.createElement('label'); l.className = 'form-label'; l.textContent = lbl;
                    const i = document.createElement('input'); i.type = type; i.name = name; i.className = 'form-control'; i.value = val !== undefined ? val : '';
                    w.appendChild(l); w.appendChild(i); return w;
                }

                form.appendChild(fieldEdit('Número Económico', 'numeroEconomico', 'text', a.numeroEconomico || ''));
                form.appendChild(fieldEdit('Nombre', 'nombre', 'text', a.nombre || ''));
                form.appendChild(fieldEdit('Correo UAM', 'correo_uam', 'email', a.correo_uam || ''));
                form.appendChild(fieldEdit('Correo personal', 'correo_personal', 'email', a.correo_personal || ''));

                // gradoEstudios select
                const wrapperGr = document.createElement('div'); wrapperGr.className = 'mb-2'; const lblGr = document.createElement('label'); lblGr.className = 'form-label'; lblGr.textContent = 'Grado de estudios'; wrapperGr.appendChild(lblGr);
                const selGr = document.createElement('select'); selGr.name = 'gradoEstudios'; selGr.className = 'form-select';['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(ninguno)'; if ((a.gradoEstudios || '') === optText) o.selected = true; selGr.appendChild(o); }); wrapperGr.appendChild(selGr); form.appendChild(wrapperGr);

                // Tipo administrativo select (populate from server)
                const wrapperTipoEdit = document.createElement('div'); wrapperTipoEdit.className = 'mb-2'; const lblTipoEdit = document.createElement('label'); lblTipoEdit.className = 'form-label'; lblTipoEdit.textContent = 'Tipo'; wrapperTipoEdit.appendChild(lblTipoEdit);
                const selTipoEdit = document.createElement('select'); selTipoEdit.name = 'idAdministrativoTipo'; selTipoEdit.className = 'form-select'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; selTipoEdit.appendChild(opt0); wrapperTipoEdit.appendChild(selTipoEdit); form.appendChild(wrapperTipoEdit);

                form.appendChild(fieldEdit('Celular', 'celular', 'tel', a.celular || ''));
                form.appendChild(fieldEdit('Lugar', 'lugar', 'text', a.lugar || ''));
                form.appendChild(fieldEdit('Extensión', 'extension', 'text', a.extension || ''));

                const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'idAdministrativo'; hiddenId.value = a.idAdministrativo || ''; form.appendChild(hiddenId);

                bodyM.appendChild(form);

                const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancelE = document.createElement('button'); btnCancelE.type = 'button'; btnCancelE.className = 'btn btn-secondary'; btnCancelE.setAttribute('data-bs-dismiss', 'modal'); btnCancelE.textContent = 'Cancelar'; const btnSaveE = document.createElement('button'); btnSaveE.type = 'button'; btnSaveE.className = 'btn btn-primary'; btnSaveE.id = 'btnGuardarEditarAdministrativo'; btnSaveE.textContent = 'Guardar cambios'; footer.appendChild(btnCancelE); footer.appendChild(btnSaveE);

                content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                const bs = new bootstrap.Modal(modal); bs.show();

                // populate administrativotipo options
                fetch('controlador/recuperaFiltrosAdministrativos.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
                    if (!j || !j.ok) return;
                    const tipos = Array.isArray(j.administrativoTipos) ? j.administrativoTipos : (Array.isArray(j.administrativotipos) ? j.administrativotipos : []);
                    tipos.forEach(t => {
                        const o = document.createElement('option'); o.value = String(t.idAdministrativoTipo || t.id || ''); o.textContent = t.nombre || t.descripcion || String(t.idAdministrativoTipo || ''); selTipoEdit.appendChild(o);
                    });
                    // preselect current type if present
                    try { if (a.idAdministrativoTipo) selTipoEdit.value = a.idAdministrativoTipo; } catch (_) { }
                }).catch(err => { console.warn('No se pudieron cargar tipos administrativos:', err); });

                // Save handler (uses Promises + parses server JSON on error)
                btnSaveE.addEventListener('click', async function () {
                    const correoUAM = (form.querySelector('input[name="correo_uam"]').value || '').trim().toLowerCase();
                    const correoPersonal = (form.querySelector('input[name="correo_personal"]').value || '').trim();
                    const numeroEco = (form.querySelector('input[name="numeroEconomico"]').value || '').trim();
                    const celularVal = (form.querySelector('input[name="celular"]').value || '').trim();
                    const tipoVal = (form.querySelector('select[name="idAdministrativoTipo"]') || {}).value || '';

                    if (!correoUAM.endsWith('@azc.uam.mx')) { if (window.swal) new swal('Error', 'El correo UAM debe tener dominio @azc.uam.mx', 'error'); else alert('El correo UAM debe tener dominio @azc.uam.mx'); return; }
                    if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) { if (window.swal) new swal('Error', 'Correo personal inválido', 'error'); else alert('Correo personal inválido'); return; }
                    if (!/^\d+$/.test(numeroEco)) { if (window.swal) new swal('Error', 'Número económico debe ser numérico', 'error'); else alert('Número económico debe ser numérico'); return; }
                    if (celularVal !== '') {
                        if (!/^\d+$/.test(celularVal)) { if (window.swal) new swal('Error', 'Celular debe ser un número', 'error'); else alert('Celular debe ser un número'); return; }
                        if (celularVal.length !== 10) { if (window.swal) new swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error'); else alert('Celular debe tener exactamente 10 dígitos'); return; }
                    }
                    if (!tipoVal) { if (window.swal) new swal('Error', 'Selecciona el tipo', 'error'); else alert('Selecciona el tipo'); return; }

                    const fd = new FormData(form);
                    // ensure celular is normalized
                    fd.set('celular', celularVal);
                    btnSaveE.disabled = true;
                    try {
                        const resp = await fetch('controlador/actualizarAdministrativo.php', { method: 'POST', body: fd });
                        let json = null;
                        try { json = await resp.json(); } catch (e) { /* ignore */ }
                        if (!resp.ok) {
                            const msg = (json && json.error) ? json.error : ('HTTP ' + resp.status);
                            throw new Error(msg);
                        }
                        if (!json || !json.ok) throw new Error((json && json.error) ? json.error : 'Error al actualizar administrativo');
                        bs.hide();
                        // refresh list and reselect updated administrativo
                        crearMenuDirectorio();
                        setTimeout(() => {
                            const rows = document.querySelectorAll('table.table tbody tr');
                            rows.forEach(r => { if (r.dataset.tipo === 'administrativo' && r.dataset.id == (json.administrativo && json.administrativo.idAdministrativo)) { r.click(); } });
                        }, 400);
                    } catch (err) { console.error('Error actualizando administrativo:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error al actualizar administrativo: ' + (err.message || '')); }
                    finally { btnSaveE.disabled = false; }
                });
            });
        }).catch(err => {
            console.error('Error fetching administrativo por id:', err);
            const panelErr = document.getElementById('dir-right-panel');
            while (panelErr.firstChild) panelErr.removeChild(panelErr.firstChild);
            const alertDiv = document.createElement('div'); alertDiv.className = 'alert alert-danger';
            alertDiv.textContent = 'Error al cargar datos del administrativo';
            panelErr.appendChild(alertDiv);
        });
    }

    function fetchProfesorById(id) {
        return fetch('controlador/recuperarProfesorPorId.php?id=' + encodeURIComponent(id)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    function showDetails(id) {
        try { console.debug('showDetails called', id); } catch (e) { }
        fetchProfesorById(id).then(json => {
            if (!json.ok) {
                const panelErr = document.getElementById('dir-right-panel');
                while (panelErr.firstChild) panelErr.removeChild(panelErr.firstChild);
                const alertDiv = document.createElement('div'); alertDiv.className = 'alert alert-warning';
                alertDiv.textContent = 'No se pudo cargar el profesor';
                panelErr.appendChild(alertDiv);
                return;
            }
            const p = json.profesor;
            const areas = json.areas || [];
            const grupos = json.grupos || [];
            const contrato = json.contrato || null;
            const contactos = json.contactos || [];
            const lugares = json.lugares || [];

            // Build details card using DOM methods (avoid innerHTML)
            const panel = document.getElementById('dir-right-panel');
            while (panel.firstChild) panel.removeChild(panel.firstChild);
            const card = document.createElement('div'); card.className = 'card';
            const body = document.createElement('div'); body.className = 'card-body';

            // Top toolbar: left side for menu placeholders, right side for actions (delete X)
            const toolbar = document.createElement('div');
            toolbar.className = 'd-flex justify-content-between align-items-center mb-2';

            const leftMenu = document.createElement('div');
            leftMenu.className = 'd-flex gap-2 align-items-center';
            // placeholder for future menu items (edit, export...)
            // placeholder for future left menu items (export...)
            toolbar.appendChild(leftMenu);

            const rightMenu = document.createElement('div');
            // Delete button (X) placed at the extreme right
            // Edit button (moved to the right next to delete for consistency)
            const btnEdit = document.createElement('button');
            btnEdit.type = 'button';
            btnEdit.className = 'btn btn-outline-primary btn-sm me-2';
            btnEdit.title = 'Editar profesor';
            btnEdit.textContent = 'Editar';
            rightMenu.appendChild(btnEdit);

            // Horarios button
            const btnHorarios = document.createElement('button');
            btnHorarios.type = 'button';
            btnHorarios.className = 'btn btn-outline-secondary btn-sm me-2';
            btnHorarios.title = 'Ver horarios/programación';
            btnHorarios.textContent = 'Horarios';
            rightMenu.appendChild(btnHorarios);
            // Botón Preferencias
            const btnPreferencias = document.createElement('button');
            btnPreferencias.type = 'button';
            btnPreferencias.className = 'btn btn-outline-secondary btn-sm me-2';
            btnPreferencias.title = 'Ver horarios preferidos';
            btnPreferencias.textContent = 'Preferencias';
            rightMenu.appendChild(btnPreferencias);

            // Delete button (X) placed at the extreme right
            const btnDelete = document.createElement('button');
            btnDelete.type = 'button';
            btnDelete.className = 'btn btn-danger btn-sm';
            btnDelete.title = 'Eliminar profesor';
            btnDelete.style.minWidth = '40px';
            btnDelete.style.lineHeight = '1';
            btnDelete.textContent = '✕';
            rightMenu.appendChild(btnDelete);
            toolbar.appendChild(rightMenu);

            body.appendChild(toolbar);

            const h5 = document.createElement('h5');
            h5.textContent = p.nombre || '';
            const small = document.createElement('small'); small.className = 'text-muted'; small.textContent = ' (' + ((p.numeroEconomico !== undefined && p.numeroEconomico !== null) ? p.numeroEconomico : '') + ')';
            h5.appendChild(small);
            body.appendChild(h5);

            // Contenedor y carga de disponibilidad para este profesor (Promesas)
            const contDisponProfesor = document.createElement('div');
            contDisponProfesor.className = 'dir-disponibilidad mt-2';
            contDisponProfesor.textContent = 'Cargando disponibilidad...';
            body.appendChild(contDisponProfesor);

            (function () {
                try { console.debug('Solicitando disponibilidad para profesor', p.numeroEconomico); } catch (e) { }
                fetch('controlador/recuperaDisponibilidadProfesorTrimestre.php?numeroEconomico=' + encodeURIComponent(p.numeroEconomico), { credentials: 'same-origin' })
                    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(function (json) {
                        while (contDisponProfesor.firstChild) contDisponProfesor.removeChild(contDisponProfesor.firstChild);
                        if (!json.ok) { const err = document.createElement('div'); err.className = 'text-muted small'; err.textContent = 'No se pudo obtener disponibilidad'; contDisponProfesor.appendChild(err); return; }
                        const trim = json.trimestre || null;
                        const disp = json.disposicion || null;
                        const badge = document.createElement('span'); badge.className = 'dir-trimestre-badge me-2';
                        if (!disp) { badge.classList.add('dir-sin-registro'); badge.textContent = 'Sin registro'; }
                        else if (parseInt(disp.estado) === 1) { badge.classList.add('dir-disponible'); badge.textContent = 'Disponible'; }
                        else { badge.classList.add('dir-no-disponible'); badge.textContent = 'No disponible'; }
                        contDisponProfesor.appendChild(badge);
                        if (trim) { const info = document.createElement('small'); info.className = 'text-muted'; const anio = trim['año'] !== undefined ? trim['año'] : (trim.anio || ''); const periodo = trim.periodoNombre || trim.sigla || ''; info.textContent = 'Trimestre: ' + (anio || '') + (periodo ? (' — ' + periodo) : ''); contDisponProfesor.appendChild(info); }
                    })
                    .catch(function (err) { while (contDisponProfesor.firstChild) contDisponProfesor.removeChild(contDisponProfesor.firstChild); const errDiv = document.createElement('div'); errDiv.className = 'text-danger small'; errDiv.textContent = 'Error cargando disponibilidad'; contDisponProfesor.appendChild(errDiv); console.error('Error obteniendo disponibilidad:', err); });
            })();

            // Mostrar tipo de profesor (desde contrato) antes del correo UAM
            const pTipoProfesor = document.createElement('p');
            const strongTipo = document.createElement('strong'); strongTipo.textContent = 'Tipo de profesor:';
            pTipoProfesor.appendChild(strongTipo);
            const tipoText = (contrato && contrato.tipoNombre) ? contrato.tipoNombre : '(sin tipo)';
            pTipoProfesor.appendChild(document.createTextNode(' ' + tipoText));

            const pCorreoUAM = document.createElement('p');
            const strongUAM = document.createElement('strong'); strongUAM.textContent = 'Correo UAM:';
            pCorreoUAM.appendChild(strongUAM);
            pCorreoUAM.appendChild(document.createTextNode(' ' + (p.correo_uam || '')));

            const pCorreoPersonal = document.createElement('p');
            const strongPersonal = document.createElement('strong'); strongPersonal.textContent = 'Correo personal:';
            pCorreoPersonal.appendChild(strongPersonal);
            pCorreoPersonal.appendChild(document.createTextNode(' ' + (p.correo_personal || '')));

            const pGrado = document.createElement('p');
            const strongGrado = document.createElement('strong'); strongGrado.textContent = 'Grado de estudios:';
            pGrado.appendChild(strongGrado);
            pGrado.appendChild(document.createTextNode(' ' + (p.gradoEstudios || '')));

            const pCel = document.createElement('p');
            const strongCel = document.createElement('strong'); strongCel.textContent = 'Celular:';
            pCel.appendChild(strongCel);
            pCel.appendChild(document.createTextNode(' ' + (p.celular || '')));

            // Insert tipo antes de correo UAM as requested
            body.appendChild(pTipoProfesor);
            body.appendChild(pCorreoUAM);
            body.appendChild(pCorreoPersonal);
            body.appendChild(pGrado);
            body.appendChild(pCel);

            body.appendChild(document.createElement('hr'));

            const hAreas = document.createElement('h6'); hAreas.textContent = 'Áreas académicas'; body.appendChild(hAreas);
            // Add button to add professor to an area
            const btnAddArea = document.createElement('button');
            btnAddArea.type = 'button';
            btnAddArea.className = 'btn btn-sm btn-outline-success ms-2';
            btnAddArea.textContent = '+ Agregar';
            hAreas.appendChild(btnAddArea);
            if (!areas || areas.length === 0) {
                const none = document.createElement('p'); none.className = 'text-muted'; none.textContent = '(ninguna)'; body.appendChild(none);
            } else {
                const ul = document.createElement('ul');
                areas.forEach(a => {
                    const li = document.createElement('li');
                    // main text
                    const span = document.createElement('span'); span.textContent = (a.nombre || '') + ' - ' + (a.puesto || '');
                    li.appendChild(span);
                    // Edit button (left of remove)
                    const btnEditar = document.createElement('button');
                    btnEditar.type = 'button';
                    btnEditar.className = 'btn btn-sm btn-outline-primary me-2';
                    btnEditar.textContent = 'Editar';
                    btnEditar.title = 'Editar asignación de área';
                    btnEditar.dataset.idAreaAcademica = a.idAreaAcademica || a.id || '';
                    btnEditar.dataset.puesto = a.puesto || '';
                    btnEditar.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const currentAreaId = btnEditar.dataset.idAreaAcademica;
                        if (!currentAreaId) { alert('ID de área no disponible'); return; }
                        // build modal to change role
                        const existing = document.getElementById('modalEditarArea'); if (existing) existing.remove();
                        const modal = document.createElement('div'); modal.id = 'modalEditarArea'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Editar asignación de área'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formEditarArea';
                        // show area name as read-only
                        const lblArea = document.createElement('p'); lblArea.className = 'mb-2'; lblArea.textContent = (a.nombre || ''); bodyM.appendChild(lblArea);
                        // role select
                        const divRol = document.createElement('div'); divRol.className = 'mb-2'; const lblR = document.createElement('label'); lblR.className = 'form-label'; lblR.textContent = 'Rol'; divRol.appendChild(lblR); const selR = document.createElement('select'); selR.className = 'form-select'; selR.name = 'nuevoRol';['integrante', 'jefe'].forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = (r === 'jefe' ? 'Jefe' : 'Integrante'); if ((a.puesto || '').toLowerCase().includes('jef') && r === 'jefe') o.selected = true; if (!(a.puesto || '').toLowerCase().includes('jef') && r === 'integrante') o.selected = true; selR.appendChild(o); }); divRol.appendChild(selR); form.appendChild(divRol);
                        const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'idAreaAcademica'; hiddenId.value = currentAreaId; form.appendChild(hiddenId);
                        const hiddenProf = document.createElement('input'); hiddenProf.type = 'hidden'; hiddenProf.name = 'idProfesor'; hiddenProf.value = p.idProfesor; form.appendChild(hiddenProf);
                        bodyM.appendChild(form);
                        const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar cambios'; footer.appendChild(btnCancel); footer.appendChild(btnSave);
                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bs = new bootstrap.Modal(modal); bs.show();

                        btnSave.addEventListener('click', function () {
                            // Use an async IIFE for clearer control flow and proper finally handling
                            (async function () {
                                const fd = new FormData(form);
                                try {
                                    btnSave.disabled = true;
                                    const resp = await fetch('controlador/editarProfesorAreaAcademica.php', { method: 'POST', body: fd });
                                    const res = await resp.json();
                                    if (!res.ok && res.conflict) {
                                        // ask for confirmation and retry with confirmReplace
                                        const retry = async () => {
                                            fd.append('confirmReplace', '1');
                                            const r2resp = await fetch('controlador/editarProfesorAreaAcademica.php', { method: 'POST', body: fd });
                                            const r2 = await r2resp.json();
                                            if (r2.ok) { if (window.Swal) Swal.fire('Listo', 'Cambio aplicado', 'success'); else alert('Cambio aplicado'); bs.hide(); showDetails(p.idProfesor); }
                                            else throw new Error(r2.error || 'Error');
                                        };

                                        const cur = res.current || {};
                                        const text = 'El área ya tiene un jefe: ' + (cur.nombre || '') + (cur.numeroEconomico ? (' (' + cur.numeroEconomico + ')') : '') + '. ¿Desea reemplazarlo?';
                                        if (window.Swal) {
                                            const ans = await Swal.fire({ title: 'Conflicto', text: text, icon: 'warning', showCancelButton: true });
                                            if (ans.isConfirmed) { try { await retry(); } catch (e) { if (window.Swal) Swal.fire('Error', e.message || 'Error', 'error'); else alert('Error: ' + (e.message || e)); } }
                                        } else if (confirm(text)) {
                                            try { await retry(); } catch (e) { alert('Error: ' + (e.message || e)); }
                                        }
                                    } else if (res.ok) {
                                        if (window.Swal) Swal.fire('Guardado', 'Asignación actualizada', 'success'); else alert('Asignación actualizada');
                                        bs.hide(); showDetails(p.idProfesor);
                                    } else {
                                        throw new Error(res.error || 'Error al actualizar');
                                    }
                                } catch (err) {
                                    console.error('Error editando area:', err);
                                    if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err));
                                } finally {
                                    btnSave.disabled = false;
                                }
                            })();
                        });
                    });
                    // create action container to place Edit and Quitar together on the right
                    const actionDiv = document.createElement('div');
                    actionDiv.className = 'd-inline-flex align-items-center float-end';
                    actionDiv.style.gap = '6px';

                    // remove button (placed in action container)
                    const btnQuitar = document.createElement('button');
                    btnQuitar.type = 'button';
                    btnQuitar.className = 'btn btn-sm btn-outline-danger';
                    btnQuitar.textContent = 'Quitar';
                    btnQuitar.title = 'Quitar de esta área académica';
                    // attach ids (expecting a.idAreaAcademica exists)
                    btnQuitar.dataset.idAreaAcademica = a.idAreaAcademica || a.id || '';
                    btnQuitar.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const idArea = btnQuitar.dataset.idAreaAcademica;
                        if (!idArea) { alert('ID de área no disponible'); return; }
                        function doQuitar() {
                            const params = new URLSearchParams();
                            params.set('idProfesor', p.idProfesor);
                            params.set('idAreaAcademica', idArea);
                            btnQuitar.disabled = true;
                            fetch('controlador/quitarProfesorAreaAcademica.php', { method: 'POST', body: params }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(res => {
                                if (res.ok) {
                                    if (window.Swal) Swal.fire('Quitado', 'Profesor removido del área', 'success'); else alert('Profesor removido del área');
                                    showDetails(p.idProfesor);
                                } else throw new Error(res.error || 'Error');
                            }).catch(err => { console.error('Error quitando area:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                                .finally(() => { btnQuitar.disabled = false; });
                        }
                        if (window.Swal) {
                            Swal.fire({ title: 'Confirmar', text: '¿Quitar al profesor de esta área?', icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) doQuitar(); });
                        } else if (confirm('¿Quitar al profesor de esta área?')) doQuitar();
                    });
                    // append buttons into the action container so they appear adjacent on the right
                    // Remove extra margin classes on the edit button to keep spacing consistent
                    btnEditar.className = 'btn btn-sm btn-outline-primary';
                    actionDiv.appendChild(btnEditar);
                    actionDiv.appendChild(btnQuitar);
                    li.appendChild(actionDiv);
                    ul.appendChild(li);
                });
                body.appendChild(ul);
            }

            const hGrupos = document.createElement('h6'); hGrupos.textContent = 'Grupos temáticos'; body.appendChild(hGrupos);
            const btnAddGrupo = document.createElement('button');
            btnAddGrupo.type = 'button';
            btnAddGrupo.className = 'btn btn-sm btn-outline-success ms-2';
            btnAddGrupo.textContent = '+ Agregar';
            hGrupos.appendChild(btnAddGrupo);
            if (!grupos || grupos.length === 0) {
                const none = document.createElement('p'); none.className = 'text-muted'; none.textContent = '(ninguno)'; body.appendChild(none);
            } else {
                const ul = document.createElement('ul');
                grupos.forEach(g => {
                    const li = document.createElement('li');
                    const span = document.createElement('span'); span.textContent = (g.nombreGrupo || '') + ' - ' + (g.puesto || '');
                    li.appendChild(span);
                    // create action container for group actions (Edit + Quitar)
                    const actionDivG = document.createElement('div');
                    actionDivG.className = 'd-inline-flex align-items-center float-end';
                    actionDivG.style.gap = '6px';

                    // Edit button for grupo temático
                    const btnEditarG = document.createElement('button');
                    btnEditarG.type = 'button';
                    btnEditarG.className = 'btn btn-sm btn-outline-primary';
                    btnEditarG.textContent = 'Editar';
                    btnEditarG.title = 'Editar asignación de grupo temático';
                    btnEditarG.dataset.idGrupoTematico = g.idGrupoTematico || g.id || '';
                    btnEditarG.dataset.puesto = g.puesto || '';
                    btnEditarG.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const currentGrupoId = btnEditarG.dataset.idGrupoTematico;
                        if (!currentGrupoId) { alert('ID de grupo no disponible'); return; }
                        // build modal to change role for grupo
                        const existingG = document.getElementById('modalEditarGrupo'); if (existingG) existingG.remove();
                        const modal = document.createElement('div'); modal.id = 'modalEditarGrupo'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Editar asignación de grupo'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formEditarGrupo';
                        // show grupo name
                        const lblGrupo = document.createElement('p'); lblGrupo.className = 'mb-2'; lblGrupo.textContent = (g.nombreGrupo || ''); bodyM.appendChild(lblGrupo);
                        // role select
                        const divRol = document.createElement('div'); divRol.className = 'mb-2'; const lblR = document.createElement('label'); lblR.className = 'form-label'; lblR.textContent = 'Rol'; divRol.appendChild(lblR); const selR = document.createElement('select'); selR.className = 'form-select'; selR.name = 'nuevoRol';['integrante', 'jefe'].forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = (r === 'jefe' ? 'Jefe' : 'Integrante'); if ((g.puesto || '').toLowerCase().includes('jef') && r === 'jefe') o.selected = true; if (!(g.puesto || '').toLowerCase().includes('jef') && r === 'integrante') o.selected = true; selR.appendChild(o); }); divRol.appendChild(selR); form.appendChild(divRol);
                        const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'idGrupoTematico'; hiddenId.value = currentGrupoId; form.appendChild(hiddenId);
                        const hiddenProf = document.createElement('input'); hiddenProf.type = 'hidden'; hiddenProf.name = 'idProfesor'; hiddenProf.value = p.idProfesor; form.appendChild(hiddenProf);
                        bodyM.appendChild(form);
                        const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar cambios'; footer.appendChild(btnCancel); footer.appendChild(btnSave);
                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bs = new bootstrap.Modal(modal); bs.show();

                        btnSave.addEventListener('click', function () {
                            (async function () {
                                const fd = new FormData(form);
                                try {
                                    btnSave.disabled = true;
                                    const resp = await fetch('controlador/editarProfesorGrupoTematico.php', { method: 'POST', body: fd });
                                    const res = await resp.json();
                                    if (!res.ok && res.conflict) {
                                        const cur = res.current || {};
                                        const text = 'El grupo ya tiene un jefe: ' + (cur.nombre || '') + (cur.numeroEconomico ? (' (' + cur.numeroEconomico + ')') : '') + '. ¿Desea reemplazarlo?';
                                        const retry = async () => {
                                            fd.append('confirmReplace', '1');
                                            const r2resp = await fetch('controlador/editarProfesorGrupoTematico.php', { method: 'POST', body: fd });
                                            const r2 = await r2resp.json();
                                            if (r2.ok) { if (window.Swal) Swal.fire('Listo', 'Cambio aplicado', 'success'); else alert('Cambio aplicado'); bs.hide(); showDetails(p.idProfesor); }
                                            else throw new Error(r2.error || 'Error');
                                        };
                                        if (window.Swal) { const ans = await Swal.fire({ title: 'Conflicto', text: text, icon: 'warning', showCancelButton: true }); if (ans.isConfirmed) { try { await retry(); } catch (e) { if (window.Swal) Swal.fire('Error', e.message || 'Error', 'error'); else alert('Error: ' + (e.message || e)); } } }
                                        else if (confirm(text)) { try { await retry(); } catch (e) { alert('Error: ' + (e.message || e)); } }
                                    } else if (res.ok) { if (window.Swal) Swal.fire('Guardado', 'Asignación actualizada', 'success'); else alert('Asignación actualizada'); bs.hide(); showDetails(p.idProfesor); }
                                    else { throw new Error(res.error || 'Error al actualizar'); }
                                } catch (err) { console.error('Error editando grupo:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); }
                                finally { btnSave.disabled = false; }
                            })();
                        });
                    });

                    // Quitar button
                    const btnQuitarG = document.createElement('button');
                    btnQuitarG.type = 'button';
                    btnQuitarG.className = 'btn btn-sm btn-outline-danger';
                    btnQuitarG.textContent = 'Quitar';
                    btnQuitarG.title = 'Quitar de este grupo temático';
                    btnQuitarG.dataset.idGrupoTematico = g.idGrupoTematico || g.id || '';
                    btnQuitarG.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const idG = btnQuitarG.dataset.idGrupoTematico;
                        if (!idG) { alert('ID de grupo no disponible'); return; }
                        function doQuitarG() {
                            const params = new URLSearchParams(); params.set('idProfesor', p.idProfesor); params.set('idGrupoTematico', idG);
                            btnQuitarG.disabled = true;
                            fetch('controlador/quitarProfesorGrupoTematico.php', { method: 'POST', body: params }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(res => {
                                if (res.ok) { if (window.Swal) Swal.fire('Quitado', 'Profesor removido del grupo', 'success'); else alert('Profesor removido del grupo'); showDetails(p.idProfesor); } else throw new Error(res.error || 'Error');
                            }).catch(err => { console.error('Error quitando grupo:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                                .finally(() => { btnQuitarG.disabled = false; });
                        }
                        if (window.Swal) { Swal.fire({ title: 'Confirmar', text: '¿Quitar al profesor de este grupo?', icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) doQuitarG(); }); }
                        else if (confirm('¿Quitar al profesor de este grupo?')) doQuitarG();
                    });

                    actionDivG.appendChild(btnEditarG);
                    actionDivG.appendChild(btnQuitarG);
                    li.appendChild(actionDivG);
                    ul.appendChild(li);
                    ul.appendChild(li);
                });
                body.appendChild(ul);
            }

            // Handler: open modal to add professor to area
            btnAddArea.addEventListener('click', function () {
                // fetch filter lists to populate area names
                fetch('controlador/recuperaFiltrosProfesores.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(json => {
                        if (!json.ok) throw new Error('No se pudieron cargar áreas');
                        // dedupe by nombre
                        const areaMap = new Map();
                        json.areaAcademicas.forEach(a => { if (!areaMap.has(a.nombre)) areaMap.set(a.nombre, a); });
                        // build modal
                        const existing = document.getElementById('modalAgregarArea'); if (existing) existing.remove();
                        const modal = document.createElement('div'); modal.id = 'modalAgregarArea'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Agregar a área académica'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body';
                        const form = document.createElement('form'); form.id = 'formAgregarArea';
                        // select area name — exclude areas the professor already has
                        const divSel = document.createElement('div'); divSel.className = 'mb-2'; const lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = 'Área'; divSel.appendChild(lbl);
                        const sel = document.createElement('select'); sel.className = 'form-select'; sel.name = 'areaNombre'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; sel.appendChild(opt0);
                        // build set of already assigned area names for this professor
                        const assignedAreaNames = new Set((areas || []).map(a => a.nombre));
                        let addedAreaOption = false;
                        areaMap.forEach(a => {
                            if (assignedAreaNames.has(a.nombre)) return; // skip already assigned
                            const o = document.createElement('option'); o.value = a.nombre; o.textContent = a.nombre; sel.appendChild(o); addedAreaOption = true;
                        });
                        divSel.appendChild(sel); form.appendChild(divSel);
                        // role select
                        const divRol = document.createElement('div'); divRol.className = 'mb-2'; const lblR = document.createElement('label'); lblR.className = 'form-label'; lblR.textContent = 'Rol'; divRol.appendChild(lblR); const selR = document.createElement('select'); selR.className = 'form-select'; selR.name = 'rol';['integrante', 'jefe'].forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = (r === 'jefe' ? 'Jefe' : 'Integrante'); selR.appendChild(o); }); divRol.appendChild(selR); form.appendChild(divRol);
                        const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'idProfesor'; hidden.value = p.idProfesor; form.appendChild(hidden);
                        bodyM.appendChild(form);
                        const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Agregar'; footer.appendChild(btnCancel); footer.appendChild(btnSave);
                        // If there are no available areas to add, disable save and show info
                        if (!addedAreaOption) {
                            const info = document.createElement('div'); info.className = 'alert alert-info'; info.style.margin = '0 1rem 0 0'; info.textContent = 'Todas las áreas disponibles ya están asignadas a este profesor.'; bodyM.appendChild(info);
                            btnSave.disabled = true;
                        }
                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bs = new bootstrap.Modal(modal); bs.show();

                        btnSave.addEventListener('click', function () {
                            const fd = new FormData(form);
                            // First try adding; if conflict returned, ask confirm and retry with confirmReplace
                            fetch('controlador/agregarProfesorAreaAcademica.php', { method: 'POST', body: fd }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(res => {
                                if (res.conflict) {
                                    const cur = res.current;
                                    const text = 'El área ya tiene un jefe: ' + (cur.nombre || '') + ' (' + (cur.numeroEconomico || '') + '). ¿Desea reemplazarlo?';
                                    if (window.Swal) {
                                        Swal.fire({ title: 'Reemplazar jefe?', text: text, icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) { fd.set('confirmReplace', '1'); fetch('controlador/agregarProfesorAreaAcademica.php', { method: 'POST', body: fd }).then(r => r.json()).then(r2 => { if (r2.ok) { Swal.fire('Listo', 'Se reemplazó al jefe', 'success'); bs.hide(); showDetails(p.idProfesor); } else { Swal.fire('Error', r2.error || 'Error', 'error'); } }); } });
                                    } else if (confirm(text)) {
                                        fd.set('confirmReplace', '1'); fetch('controlador/agregarProfesorAreaAcademica.php', { method: 'POST', body: fd }).then(r => r.json()).then(r2 => { if (r2.ok) { alert('Se reemplazó al jefe'); bs.hide(); showDetails(p.idProfesor); } else alert('Error: ' + (r2.error || 'Error')); });
                                    }
                                } else if (res.ok) {
                                    if (window.Swal) Swal.fire('Listo', 'Profesor agregado', 'success'); else alert('Profesor agregado');
                                    bs.hide(); showDetails(p.idProfesor);
                                } else {
                                    throw new Error(res.error || 'Error');
                                }
                            }).catch(err => { console.error('Error agregando area:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); });
                        });
                    }).catch(err => { console.error('Error cargando áreas:', err); if (window.Swal) Swal.fire('Error', 'No se pudieron cargar áreas', 'error'); else alert('No se pudieron cargar áreas'); });
            });

            // Handler for adding to grupo temático
            btnAddGrupo.addEventListener('click', function () {
                fetch('controlador/recuperaFiltrosProfesores.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(json => {
                        if (!json.ok) throw new Error('No se pudieron cargar grupos');
                        const grupoMap = new Map(); json.gruposTematicos.forEach(g => { if (!grupoMap.has(g.nombreGrupo)) grupoMap.set(g.nombreGrupo, g); });
                        const existing = document.getElementById('modalAgregarGrupo'); if (existing) existing.remove();
                        const modal = document.createElement('div'); modal.id = 'modalAgregarGrupo'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Agregar a grupo temático'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formAgregarGrupo';
                        const divSel = document.createElement('div'); divSel.className = 'mb-2'; const lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = 'Grupo'; divSel.appendChild(lbl);
                        const sel = document.createElement('select'); sel.className = 'form-select'; sel.name = 'grupoNombre'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; sel.appendChild(opt0);
                        // exclude grupos the professor already belongs to
                        const assignedGrupoNames = new Set((grupos || []).map(g => g.nombreGrupo));
                        let addedGrupoOption = false;
                        grupoMap.forEach(g => {
                            if (assignedGrupoNames.has(g.nombreGrupo)) return;
                            const o = document.createElement('option'); o.value = g.nombreGrupo; o.textContent = g.nombreGrupo; sel.appendChild(o); addedGrupoOption = true;
                        });
                        divSel.appendChild(sel); form.appendChild(divSel);
                        const divRol = document.createElement('div'); divRol.className = 'mb-2'; const lblR = document.createElement('label'); lblR.className = 'form-label'; lblR.textContent = 'Rol'; divRol.appendChild(lblR); const selR = document.createElement('select'); selR.className = 'form-select'; selR.name = 'rol';['integrante', 'jefe'].forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = (r === 'jefe' ? 'Jefe' : 'Integrante'); selR.appendChild(o); }); divRol.appendChild(selR); form.appendChild(divRol);
                        const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'idProfesor'; hidden.value = p.idProfesor; form.appendChild(hidden);
                        bodyM.appendChild(form); const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Agregar'; footer.appendChild(btnCancel); footer.appendChild(btnSave);
                        // If no grupos available, show message and disable save
                        if (!addedGrupoOption) {
                            const info = document.createElement('div'); info.className = 'alert alert-info'; info.style.margin = '0 1rem 0 0'; info.textContent = 'Todos los grupos disponibles ya contienen a este profesor.'; bodyM.appendChild(info);
                            btnSave.disabled = true;
                        }

                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal); const bs = new bootstrap.Modal(modal); bs.show();

                        btnSave.addEventListener('click', function () {
                            const fd = new FormData(form);
                            fetch('controlador/agregarProfesorGrupoTematico.php', { method: 'POST', body: fd }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(res => {
                                if (res.conflict) {
                                    const cur = res.current; const text = 'El grupo ya tiene un jefe: ' + (cur.nombre || '') + ' (' + (cur.numeroEconomico || '') + '). ¿Desea reemplazarlo?';
                                    if (window.Swal) { Swal.fire({ title: 'Reemplazar jefe?', text: text, icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) { fd.set('confirmReplace', '1'); fetch('controlador/agregarProfesorGrupoTematico.php', { method: 'POST', body: fd }).then(r => r.json()).then(r2 => { if (r2.ok) { Swal.fire('Listo', 'Se reemplazó al jefe', 'success'); bs.hide(); showDetails(p.idProfesor); } else Swal.fire('Error', r2.error || 'Error', 'error'); }); } }); }
                                    else if (confirm(text)) { fd.set('confirmReplace', '1'); fetch('controlador/agregarProfesorGrupoTematico.php', { method: 'POST', body: fd }).then(r => r.json()).then(r2 => { if (r2.ok) { alert('Se reemplazó al jefe'); bs.hide(); showDetails(p.idProfesor); } else alert('Error: ' + (r2.error || 'Error')); }); }
                                } else if (res.ok) { if (window.Swal) Swal.fire('Listo', 'Profesor agregado', 'success'); else alert('Profesor agregado'); bs.hide(); showDetails(p.idProfesor); } else { throw new Error(res.error || 'Error'); }
                            }).catch(err => { console.error('Error agregando grupo:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); });
                        });
                    }).catch(err => { console.error('Error cargando grupos:', err); if (window.Swal) Swal.fire('Error', 'No se pudieron cargar grupos', 'error'); else alert('No se pudieron cargar grupos'); });
            });

            // Sección: Lugares asociados
            const hLugares = document.createElement('h6'); hLugares.textContent = 'Lugares'; body.appendChild(hLugares);
            const btnAddLugar = document.createElement('button');
            btnAddLugar.type = 'button';
            btnAddLugar.className = 'btn btn-sm btn-outline-success ms-2';
            btnAddLugar.textContent = '+ Agregar';
            hLugares.appendChild(btnAddLugar);
            const contLugares = document.createElement('div');
            if (!lugares || lugares.length === 0) {
                const noneL = document.createElement('p'); noneL.className = 'text-muted'; noneL.textContent = '(ninguno)'; contLugares.appendChild(noneL);
            } else {
                const ulL = document.createElement('ul');
                lugares.forEach(l => {
                    const li = document.createElement('li');
                    li.className = 'd-flex align-items-center justify-content-between';
                    const ed = (l.edificio || ''); const piso = (l.piso !== undefined && l.piso !== null) ? String(l.piso) : '';
                    const cub = (l.cubiculo || ''); const nom = (l.nombre || ''); const nt = l.notas ? (' (' + l.notas + ')') : '';
                    const left = document.createElement('div');
                    left.textContent = ed + (piso ? (' / Piso ' + piso) : '') + (cub ? (' / Cubículo ' + cub) : '') + ' — ' + nom + nt;

                    // Action buttons container (Editar + Quitar) aligned to the right
                    const actionDiv = document.createElement('div');
                    actionDiv.className = 'd-inline-flex align-items-center';
                    actionDiv.style.gap = '6px';

                    // Editar button
                    const btnEditarLugar = document.createElement('button');
                    btnEditarLugar.type = 'button';
                    btnEditarLugar.className = 'btn btn-sm btn-outline-primary';
                    btnEditarLugar.textContent = 'Editar';
                    btnEditarLugar.title = 'Editar lugar';
                    btnEditarLugar.dataset.idLugar = l.idLugar || l.id || '';
                    btnEditarLugar.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const idLugar = btnEditarLugar.dataset.idLugar;
                        if (!idLugar) { if (window.Swal) Swal.fire('Error', 'ID de lugar no disponible', 'error'); else alert('ID de lugar no disponible'); return; }
                        // remove existing modal if present
                        const existing = document.getElementById('modalEditarLugar'); if (existing) existing.remove();
                        const modal = document.createElement('div'); modal.id = 'modalEditarLugar'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Editar lugar'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formEditarLugar';

                        function field(lbl, name, type = 'text', val = '') {
                            const w = document.createElement('div'); w.className = 'mb-2';
                            const l = document.createElement('label'); l.className = 'form-label'; l.textContent = lbl;
                            const i = document.createElement('input'); i.type = type; i.name = name; i.className = 'form-control'; if (val !== undefined) i.value = val;
                            w.appendChild(l); w.appendChild(i); return w;
                        }

                        form.appendChild(field('Edificio', 'edificio', 'text', l.edificio || ''));
                        form.appendChild(field('Piso', 'piso', 'number', (l.piso !== undefined && l.piso !== null) ? String(l.piso) : ''));
                        form.appendChild(field('Cubículo', 'cubiculo', 'text', l.cubiculo || ''));
                        form.appendChild(field('Nombre del lugar', 'nombre', 'text', l.nombre || ''));
                        form.appendChild(field('Notas', 'notas', 'text', l.notas || ''));
                        const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'idLugar'; hidden.value = idLugar; form.appendChild(hidden);
                        const hiddenProf = document.createElement('input'); hiddenProf.type = 'hidden'; hiddenProf.name = 'idProfesor'; hiddenProf.value = p.idProfesor; form.appendChild(hiddenProf);

                        bodyM.appendChild(form);
                        const footer = document.createElement('div'); footer.className = 'modal-footer';
                        const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
                        const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar';
                        footer.appendChild(btnCancel); footer.appendChild(btnSave);
                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bs = new bootstrap.Modal(modal); bs.show();

                        btnSave.addEventListener('click', function () {
                            // use Promise-based fetch
                            const fd = new FormData(form);
                            btnSave.disabled = true;
                            fetch('controlador/editarLugarProfesor.php', { method: 'POST', body: fd })
                                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                                .then(res => {
                                    if (!res.ok) throw new Error(res.error || 'Error al guardar lugar');
                                    if (window.Swal) Swal.fire('Guardado', 'Lugar actualizado', 'success'); else alert('Lugar actualizado');
                                    bs.hide();
                                    showDetails(p.idProfesor);
                                })
                                .catch(err => { console.error('Error editando lugar:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                                .finally(() => { btnSave.disabled = false; });
                        });
                    });

                    // Quitar button
                    const btnQuitarLugar = document.createElement('button');
                    btnQuitarLugar.type = 'button';
                    btnQuitarLugar.className = 'btn btn-sm btn-outline-danger';
                    btnQuitarLugar.textContent = 'Quitar';
                    btnQuitarLugar.title = 'Quitar lugar del profesor';
                    btnQuitarLugar.dataset.idLugar = l.idLugar || l.id || '';
                    btnQuitarLugar.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const idLugar = btnQuitarLugar.dataset.idLugar;
                        if (!idLugar) { if (window.Swal) Swal.fire('Error', 'ID de lugar no disponible', 'error'); else alert('ID de lugar no disponible'); return; }
                        function doQuitar() {
                            btnQuitarLugar.disabled = true;
                            const params = new URLSearchParams(); params.set('idProfesor', p.idProfesor); params.set('idLugar', idLugar);
                            fetch('controlador/quitarLugarProfesor.php', { method: 'POST', body: params })
                                .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                                .then(res => {
                                    if (!res.ok) throw new Error(res.error || 'Error al quitar lugar');
                                    if (window.Swal) Swal.fire('Quitado', 'Lugar desasociado', 'success'); else alert('Lugar desasociado');
                                    showDetails(p.idProfesor);
                                })
                                .catch(err => { console.error('Error quitando lugar:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                                .finally(() => { btnQuitarLugar.disabled = false; });
                        }
                        if (window.Swal) { Swal.fire({ title: 'Confirmar', text: '¿Quitar este lugar del profesor?', icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) doQuitar(); }); }
                        else if (confirm('¿Quitar este lugar del profesor?')) doQuitar();
                    });

                    actionDiv.appendChild(btnEditarLugar);
                    actionDiv.appendChild(btnQuitarLugar);
                    li.appendChild(left);
                    li.appendChild(actionDiv);
                    ulL.appendChild(li);
                });
                contLugares.appendChild(ulL);
            }
            body.appendChild(contLugares);

            // Modal para agregar lugar al profesor
            btnAddLugar.addEventListener('click', function () {
                const existing = document.getElementById('modalAgregarLugar'); if (existing) existing.remove();
                const modal = document.createElement('div'); modal.id = 'modalAgregarLugar'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
                const content = document.createElement('div'); content.className = 'modal-content';
                const header = document.createElement('div'); header.className = 'modal-header';
                const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Agregar lugar';
                const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
                header.appendChild(title); header.appendChild(btnClose);
                const bodyM = document.createElement('div'); bodyM.className = 'modal-body';
                const form = document.createElement('form'); form.id = 'formAgregarLugar';
                function field(lbl, name, type = 'text') {
                    const w = document.createElement('div'); w.className = 'mb-2';
                    const l = document.createElement('label'); l.className = 'form-label'; l.textContent = lbl;
                    const i = document.createElement('input'); i.type = type; i.name = name; i.className = 'form-control';
                    w.appendChild(l); w.appendChild(i); return w;
                }
                form.appendChild(field('Edificio', 'edificio'));
                form.appendChild(field('Piso', 'piso', 'number'));
                form.appendChild(field('Cubículo', 'cubiculo'));
                form.appendChild(field('Nombre del lugar', 'nombre'));
                form.appendChild(field('Notas', 'notas'));
                bodyM.appendChild(form);
                const footer = document.createElement('div'); footer.className = 'modal-footer';
                const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
                const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar';
                footer.appendChild(btnCancel); footer.appendChild(btnSave);
                content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer);
                dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                const bsModal = new bootstrap.Modal(modal); bsModal.show();

                btnSave.addEventListener('click', function () {
                    const fd = new FormData(form); fd.append('idProfesor', p.idProfesor);
                    const edif = (fd.get('edificio') || '').toString().trim(); const nom = (fd.get('nombre') || '').toString().trim();
                    if (!edif || !nom) { if (window.swal) new swal('Error', 'Edificio y Nombre son obligatorios', 'error'); else alert('Edificio y Nombre son obligatorios'); return; }
                    btnSave.disabled = true;
                    fetch('controlador/agregarLugarProfesor.php', { method: 'POST', body: fd })
                        .then(r => r.json())
                        .then(resp => {
                            if (!resp.ok) throw new Error(resp.error || 'Error');
                            if (window.swal) new swal('Guardado', 'Lugar agregado', 'success'); else alert('Lugar agregado');
                            bsModal.hide();
                            showDetails(p.idProfesor);
                        })
                        .catch(err => { console.error('Error guardando lugar:', err); if (window.swal) new swal('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                        .finally(() => { btnSave.disabled = false; });
                });
            });

            const hContrato = document.createElement('h6'); hContrato.textContent = 'Contrato'; body.appendChild(hContrato);
            // Button to add a contrato (if any)
            const btnAddContrato = document.createElement('button');
            btnAddContrato.type = 'button';
            btnAddContrato.className = 'btn btn-sm btn-outline-success ms-2';
            btnAddContrato.textContent = '+ Agregar contrato';
            hContrato.appendChild(btnAddContrato);
            if (!contrato) {
                const none = document.createElement('p'); none.className = 'text-muted'; none.textContent = '(sin contrato registrado)'; body.appendChild(none);
            } else {
                // show contract with an action container (Quitar) aligned to the right
                const wrap = document.createElement('div'); wrap.className = 'd-flex align-items-center';
                const pC = document.createElement('p'); pC.className = 'mb-0'; pC.textContent = (contrato.tipoNombre || '') + ' — ' + (contrato.descripcion || '');
                wrap.appendChild(pC);

                const actionDivContract = document.createElement('div');
                actionDivContract.className = 'd-inline-flex align-items-center ms-auto';
                actionDivContract.style.gap = '6px';

                // Edit button for contrato
                const btnEditarContrato = document.createElement('button');
                btnEditarContrato.type = 'button';
                btnEditarContrato.className = 'btn btn-sm btn-outline-primary';
                btnEditarContrato.textContent = 'Editar';
                btnEditarContrato.title = 'Editar contrato';
                btnEditarContrato.dataset.idProfesorContrato = contrato.idProfesorContrato || contrato.id || '';

                btnEditarContrato.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    const existing = document.getElementById('modalEditarContrato'); if (existing) existing.remove();
                    // fetch tipos to build select and preselect current
                    fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (json) {
                        if (!json.ok) throw new Error('No se pudieron cargar tipos');
                        const tipos = json.profesorTipos || [];
                        const modal = document.createElement('div'); modal.id = 'modalEditarContrato'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                        const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Editar contrato'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                        const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formEditarContrato';

                        // tipo select
                        const divTipo = document.createElement('div'); divTipo.className = 'mb-2'; const lblTipo = document.createElement('label'); lblTipo.className = 'form-label'; lblTipo.textContent = 'Tipo de contrato'; divTipo.appendChild(lblTipo);
                        const selTipo = document.createElement('select'); selTipo.className = 'form-select'; selTipo.name = 'idProfesorTipo'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; selTipo.appendChild(opt0);
                        tipos.forEach(function (t) { const o = document.createElement('option'); o.value = t.idProfesorTipo; o.textContent = t.nombre; selTipo.appendChild(o); });
                        divTipo.appendChild(selTipo); form.appendChild(divTipo);

                        // descripcion
                        const divDesc = document.createElement('div'); divDesc.className = 'mb-2'; const lblDesc = document.createElement('label'); lblDesc.className = 'form-label'; lblDesc.textContent = 'Descripción'; divDesc.appendChild(lblDesc);
                        const ta = document.createElement('textarea'); ta.className = 'form-control'; ta.name = 'descripcion'; ta.rows = 3; divDesc.appendChild(ta); form.appendChild(divDesc);

                        const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'idProfesorContrato'; hiddenId.value = contrato.idProfesorContrato || contrato.id || '';
                        const hiddenProf = document.createElement('input'); hiddenProf.type = 'hidden'; hiddenProf.name = 'idProfesor'; hiddenProf.value = p.idProfesor;
                        form.appendChild(hiddenId); form.appendChild(hiddenProf);
                        bodyM.appendChild(form);

                        const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar cambios'; footer.appendChild(btnCancel); footer.appendChild(btnSave);

                        content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bs = new bootstrap.Modal(modal); bs.show();

                        // prefill
                        try { if (typeof contrato.idProfesorTipo !== 'undefined') selTipo.value = contrato.idProfesorTipo; } catch (e) { }
                        try { ta.value = contrato.descripcion || ''; } catch (e) { }

                        btnSave.addEventListener('click', function () {
                            if (!selTipo.value) { if (window.Swal) Swal.fire('Error', 'Seleccione un tipo de contrato', 'error'); else alert('Seleccione un tipo de contrato'); return; }
                            btnSave.disabled = true;
                            const fd = new FormData(form);
                            fetch('controlador/editarProfesorContrato.php', { method: 'POST', body: fd }).then(function (resp) { if (!resp.ok) return resp.json(); return resp.json(); }).then(function (res) {
                                if (!res.ok) throw new Error(res.error || 'Error actualizando contrato');
                                if (window.Swal) Swal.fire('Guardado', 'Contrato actualizado', 'success'); else alert('Contrato actualizado');
                                bs.hide(); setTimeout(function () { showDetails(p.idProfesor); }, 200);
                            }).catch(function (err) { console.error('Error actualizando contrato:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); }).finally(function () { btnSave.disabled = false; });
                        });

                    }).catch(function (err) { console.error('Error cargando tipos:', err); if (window.Swal) Swal.fire('Error', 'No se pudieron cargar tipos de contrato', 'error'); else alert('No se pudieron cargar tipos de contrato'); });
                });

                const btnQuitarContrato = document.createElement('button');
                btnQuitarContrato.type = 'button';
                btnQuitarContrato.className = 'btn btn-sm btn-outline-danger';
                btnQuitarContrato.textContent = 'Quitar';
                btnQuitarContrato.title = 'Quitar contrato';
                btnQuitarContrato.dataset.idProfesorContrato = contrato.idProfesorContrato || contrato.id || '';

                btnQuitarContrato.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    const idC = btnQuitarContrato.dataset.idProfesorContrato;
                    if (!idC) { alert('ID de contrato no disponible'); return; }
                    function doQuitarContrato() {
                        const params = new URLSearchParams(); params.set('idProfesor', p.idProfesor); params.set('idProfesorContrato', idC);
                        btnQuitarContrato.disabled = true;
                        fetch('controlador/quitarProfesorContrato.php', { method: 'POST', body: params }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (res) {
                            if (res.ok) { if (window.Swal) Swal.fire('Quitado', 'Contrato eliminado', 'success'); else alert('Contrato eliminado'); showDetails(p.idProfesor); } else throw new Error(res.error || 'Error');
                        }).catch(function (err) { console.error('Error quitando contrato:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); }).finally(function () { btnQuitarContrato.disabled = false; });
                    }
                    if (window.Swal) { Swal.fire({ title: 'Confirmar', text: '¿Quitar este contrato?', icon: 'warning', showCancelButton: true }).then(function (ans) { if (ans.isConfirmed) doQuitarContrato(); }); }
                    else if (confirm('¿Quitar este contrato?')) doQuitarContrato();
                });

                actionDivContract.appendChild(btnEditarContrato);
                actionDivContract.appendChild(btnQuitarContrato);
                wrap.appendChild(actionDivContract);
                body.appendChild(wrap);
            }

            // If a contrato exists, disable the add button to enforce single-contract rule
            try {
                if (contrato) {
                    btnAddContrato.disabled = true;
                    btnAddContrato.title = 'Ya existe un contrato para este profesor';
                    btnAddContrato.setAttribute('aria-disabled', 'true');
                    // add Bootstrap disabled visual if available
                    btnAddContrato.classList.add('disabled');
                } else {
                    btnAddContrato.disabled = false;
                    btnAddContrato.removeAttribute('aria-disabled');
                    btnAddContrato.classList.remove('disabled');
                }
            } catch (e) {
                // if for some reason btnAddContrato is not available, ignore
                console.warn('No se pudo modificar estado de btnAddContrato:', e);
            }

            // Handler: open modal to add contrato
            btnAddContrato.addEventListener('click', function () {
                // fetch profesor tipos for select
                fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (json) {
                    if (!json.ok) throw new Error('No se pudieron cargar tipos');
                    const tipos = json.profesorTipos || [];
                    const existing = document.getElementById('modalAgregarContrato'); if (existing) existing.remove();
                    const modal = document.createElement('div'); modal.id = 'modalAgregarContrato'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                    const dialog = document.createElement('div'); dialog.className = 'modal-dialog'; const content = document.createElement('div'); content.className = 'modal-content';
                    const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Agregar contrato'; header.appendChild(title); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                    const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const form = document.createElement('form'); form.id = 'formAgregarContrato';

                    // tipo select
                    const divTipo = document.createElement('div'); divTipo.className = 'mb-2'; const lblTipo = document.createElement('label'); lblTipo.className = 'form-label'; lblTipo.textContent = 'Tipo de contrato'; divTipo.appendChild(lblTipo);
                    const selTipo = document.createElement('select'); selTipo.className = 'form-select'; selTipo.name = 'idProfesorTipo'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; selTipo.appendChild(opt0);
                    tipos.forEach(function (t) { const o = document.createElement('option'); o.value = t.idProfesorTipo; o.textContent = t.nombre; selTipo.appendChild(o); });
                    divTipo.appendChild(selTipo); form.appendChild(divTipo);

                    // descripcion
                    const divDesc = document.createElement('div'); divDesc.className = 'mb-2'; const lblDesc = document.createElement('label'); lblDesc.className = 'form-label'; lblDesc.textContent = 'Descripción'; divDesc.appendChild(lblDesc);
                    const ta = document.createElement('textarea'); ta.className = 'form-control'; ta.name = 'descripcion'; ta.rows = 3; divDesc.appendChild(ta); form.appendChild(divDesc);

                    const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'idProfesor'; hidden.value = p.idProfesor; form.appendChild(hidden);
                    bodyM.appendChild(form);
                    const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar'; const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Agregar'; footer.appendChild(btnCancel); footer.appendChild(btnSave);
                    content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                    const bs = new bootstrap.Modal(modal); bs.show();

                    btnSave.addEventListener('click', function () {
                        const idTipoVal = selTipo.value;
                        const descVal = ta.value.trim();
                        if (!idTipoVal) { if (window.Swal) Swal.fire('Error', 'Seleccione un tipo de contrato', 'error'); else alert('Seleccione un tipo de contrato'); return; }
                        btnSave.disabled = true;
                        const fd = new FormData(form);
                        fetch('controlador/agregarProfesorContrato.php', { method: 'POST', body: fd }).then(function (resp) { if (!resp.ok) return resp.json(); return resp.json(); }).then(function (res) {
                            if (!res.ok) { throw new Error(res.error || 'Error al guardar contrato'); }
                            if (window.Swal) Swal.fire('Guardado', 'Contrato agregado', 'success'); else alert('Contrato agregado');
                            bs.hide(); setTimeout(function () { showDetails(p.idProfesor); }, 200);
                        }).catch(function (err) { console.error('Error agregando contrato:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })['finally'](function () { btnSave.disabled = false; });
                    });
                }).catch(function (err) { console.error('Error cargando tipos:', err); if (window.Swal) Swal.fire('Error', 'No se pudieron cargar tipos de contrato', 'error'); else alert('No se pudieron cargar tipos de contrato'); });
            });

            const hContactos = document.createElement('h6'); hContactos.textContent = 'Contactos de emergencia'; body.appendChild(hContactos);
            // Add button to add emergency contact
            const btnAddContacto = document.createElement('button');
            btnAddContacto.type = 'button'; btnAddContacto.className = 'btn btn-sm btn-outline-success ms-2'; btnAddContacto.textContent = '+ Agregar';
            hContactos.appendChild(btnAddContacto);

            if (!contactos || contactos.length === 0) {
                const none = document.createElement('p'); none.className = 'text-muted'; none.textContent = '(ninguno)'; body.appendChild(none);
            } else {
                const ul = document.createElement('ul');
                contactos.forEach(c => {
                    const li = document.createElement('li');
                    const span = document.createElement('span');
                    const raw = (c.celular === null || c.celular === undefined) ? '' : String(c.celular).trim();
                    let fmt = raw;
                    // format 10-digit celular as 2-4-4 (e.g., "12 3456 7890")
                    if (/^\d{10}$/.test(raw)) fmt = raw.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
                    span.textContent = (c.nombre || '') + ' — ' + (c.parentesco || '') + ' — ' + (fmt || '');
                    li.appendChild(span);

                    // Edit button for each contact
                    const btnEditarC = document.createElement('button');
                    btnEditarC.type = 'button';
                    btnEditarC.className = 'btn btn-sm btn-outline-primary me-2';
                    btnEditarC.textContent = 'Editar';
                    btnEditarC.title = 'Editar contacto de emergencia';
                    btnEditarC.dataset.idProfesorEmergencia = c.idProfesorEmergencia || c.id || '';
                    btnEditarC.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const existing = document.getElementById('modalEditarContacto');
                        if (existing) existing.remove();

                        const modal = document.createElement('div'); modal.id = 'modalEditarContacto'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                        const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
                        const content = document.createElement('div'); content.className = 'modal-content';
                        const headerDiv = document.createElement('div'); headerDiv.className = 'modal-header';
                        const titleH5 = document.createElement('h5'); titleH5.className = 'modal-title'; titleH5.textContent = 'Editar contacto de emergencia';
                        const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
                        headerDiv.appendChild(titleH5); headerDiv.appendChild(btnClose);

                        const bodyDiv = document.createElement('div'); bodyDiv.className = 'modal-body';
                        const form = document.createElement('form'); form.id = 'formEditarContacto';

                        // Nombre
                        const w1 = document.createElement('div'); w1.className = 'mb-2';
                        const l1 = document.createElement('label'); l1.className = 'form-label'; l1.textContent = 'Nombre del contacto';
                        const i1 = document.createElement('input'); i1.name = 'nombre'; i1.className = 'form-control'; i1.required = true; i1.value = c.nombre || '';
                        w1.appendChild(l1); w1.appendChild(i1); form.appendChild(w1);

                        // Parentesco select
                        const w2 = document.createElement('div'); w2.className = 'mb-2';
                        const l2 = document.createElement('label'); l2.className = 'form-label'; l2.textContent = 'Parentesco';
                        const sel = document.createElement('select'); sel.name = 'parentesco'; sel.className = 'form-select'; sel.required = true;
                        ['', 'hijos', 'nietos', 'conyugues', 'otros'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(Seleccione)'; sel.appendChild(o); });
                        if (['', 'hijos', 'nietos', 'conyugues', 'otros'].includes((c.parentesco || '').toString())) sel.value = c.parentesco || ''; else sel.value = 'otros';
                        w2.appendChild(l2); w2.appendChild(sel); form.appendChild(w2);

                        const w2b = document.createElement('div'); w2b.className = 'mb-2 d-none'; w2b.id = 'cont_parentesco_otro_edit';
                        const l2b = document.createElement('label'); l2b.className = 'form-label'; l2b.textContent = 'Especifique parentesco';
                        const i2b = document.createElement('input'); i2b.name = 'parentesco_otro'; i2b.className = 'form-control'; i2b.placeholder = 'Describa el parentesco';
                        if (!['', 'hijos', 'nietos', 'conyugues', 'otros'].includes((c.parentesco || '').toString())) i2b.value = c.parentesco || '';
                        w2b.appendChild(l2b); w2b.appendChild(i2b); form.appendChild(w2b);

                        // Celular
                        const w3 = document.createElement('div'); w3.className = 'mb-2';
                        const l3 = document.createElement('label'); l3.className = 'form-label'; l3.textContent = 'Celular (10 dígitos)';
                        const i3 = document.createElement('input'); i3.name = 'celular'; i3.className = 'form-control'; i3.required = true; i3.type = 'tel'; i3.value = c.celular || '';
                        w3.appendChild(l3); w3.appendChild(i3); form.appendChild(w3);

                        // hidden fields
                        const hiddenId = document.createElement('input'); hiddenId.type = 'hidden'; hiddenId.name = 'idProfesorEmergencia'; hiddenId.value = btnEditarC.dataset.idProfesorEmergencia;
                        const hiddenProfesor = document.createElement('input'); hiddenProfesor.type = 'hidden'; hiddenProfesor.name = 'idProfesor'; hiddenProfesor.value = p.idProfesor;
                        form.appendChild(hiddenId); form.appendChild(hiddenProfesor);

                        bodyDiv.appendChild(form);

                        const footer = document.createElement('div'); footer.className = 'modal-footer';
                        const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
                        const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.id = 'btnGuardarEditarContacto'; btnSave.textContent = 'Guardar';
                        footer.appendChild(btnCancel); footer.appendChild(btnSave);

                        content.appendChild(headerDiv); content.appendChild(bodyDiv); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        const bsModal = new bootstrap.Modal(modal); bsModal.show();

                        // show/hide custom parentesco
                        sel.addEventListener('change', function () { if (sel.value === 'otros') { w2b.classList.remove('d-none'); i2b.required = true; } else { w2b.classList.add('d-none'); i2b.required = false; } });
                        if (sel.value === 'otros') { w2b.classList.remove('d-none'); i2b.required = true; } else { w2b.classList.add('d-none'); i2b.required = false; }

                        document.getElementById('btnGuardarEditarContacto').addEventListener('click', function () {
                            const nombreVal = form.querySelector('input[name="nombre"]').value.trim();
                            let parentVal = form.querySelector('select[name="parentesco"]').value;
                            const parentOt = form.querySelector('input[name="parentesco_otro"]').value.trim();
                            const celularVal = form.querySelector('input[name="celular"]').value.trim();

                            if (!nombreVal) { if (window.swal) Swal.fire('Error', 'Nombre requerido', 'error'); else alert('Nombre requerido'); return; }
                            if (!parentVal) { if (window.swal) Swal.fire('Error', 'Parentesco requerido', 'error'); else alert('Parentesco requerido'); return; }
                            if (parentVal === 'otros') { if (!parentOt) { if (window.swal) Swal.fire('Error', 'Especifique el parentesco', 'error'); else alert('Especifique el parentesco'); return; } parentVal = parentOt; }
                            if (!/^[0-9]{10}$/.test(celularVal)) { if (window.swal) Swal.fire('Error', 'Celular debe tener 10 dígitos', 'error'); else alert('Celular debe tener 10 dígitos'); return; }

                            const fd = new FormData(form);
                            btnSave.disabled = true;
                            fetch('controlador/editarProfesorEmergencia.php', { method: 'POST', body: fd }).then(r => { if (!r.ok) return r.json(); return r.json(); }).then(res => {
                                if (!res.ok) { const msg = res.error || 'Error actualizando contacto'; if (window.Swal) Swal.fire('Error', msg, 'error'); else alert(msg); btnSave.disabled = false; return; }
                                bsModal.hide(); setTimeout(() => showDetails(p.idProfesor), 200);
                            }).catch(err => { console.error('Error actualizando contacto:', err); if (window.swal) Swal.fire('Error', 'No se pudo actualizar contacto', 'error'); else alert('No se pudo actualizar contacto'); btnSave.disabled = false; });
                        });
                    });

                    // Quitar button for each contact
                    const btnQuitarC = document.createElement('button');
                    btnQuitarC.type = 'button';
                    btnQuitarC.className = 'btn btn-sm btn-outline-danger ms-2 float-end';
                    btnQuitarC.textContent = 'Quitar';
                    btnQuitarC.title = 'Quitar este contacto de emergencia';
                    btnQuitarC.dataset.idProfesorEmergencia = c.idProfesorEmergencia || c.id || '';
                    btnQuitarC.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        const idCE = btnQuitarC.dataset.idProfesorEmergencia;
                        if (!idCE) { alert('ID de contacto no disponible'); return; }
                        function doQuitarContact() {
                            const params = new URLSearchParams(); params.set('idProfesor', p.idProfesor); params.set('idProfesorEmergencia', idCE);
                            btnQuitarC.disabled = true;
                            fetch('controlador/quitarProfesorEmergencia.php', { method: 'POST', body: params }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(res => {
                                if (res.ok) { if (window.Swal) Swal.fire('Quitado', 'Contacto eliminado', 'success'); else alert('Contacto eliminado'); showDetails(p.idProfesor); }
                                else throw new Error(res.error || 'Error');
                            }).catch(err => { console.error('Error quitando contacto:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); })
                                .finally(() => { btnQuitarC.disabled = false; });
                        }
                        if (window.Swal) { Swal.fire({ title: 'Confirmar', text: '¿Quitar este contacto de emergencia?', icon: 'warning', showCancelButton: true }).then(ans => { if (ans.isConfirmed) doQuitarContact(); }); }
                        else if (confirm('¿Quitar este contacto de emergencia?')) doQuitarContact();
                    });
                    // group Edit and Quitar into an action container so both appear at the extreme right
                    const actionDivC = document.createElement('div');
                    actionDivC.className = 'd-inline-flex align-items-center float-end';
                    actionDivC.style.gap = '6px';

                    // normalize classes (spacing managed by container)
                    btnEditarC.className = 'btn btn-sm btn-outline-primary';
                    btnQuitarC.className = 'btn btn-sm btn-outline-danger';

                    actionDivC.appendChild(btnEditarC);
                    actionDivC.appendChild(btnQuitarC);
                    li.appendChild(actionDivC);
                    ul.appendChild(li);
                });
                body.appendChild(ul);
            }

            // Handler: open modal to add contacto de emergencia
            btnAddContacto.addEventListener('click', function () {
                // remove existing modal if any
                const existing = document.getElementById('modalAgregarContacto');
                if (existing) existing.remove();

                const modal = document.createElement('div'); modal.id = 'modalAgregarContacto'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
                const content = document.createElement('div'); content.className = 'modal-content';

                const headerDiv = document.createElement('div'); headerDiv.className = 'modal-header';
                const titleH5 = document.createElement('h5'); titleH5.className = 'modal-title'; titleH5.textContent = 'Agregar contacto de emergencia';
                const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
                headerDiv.appendChild(titleH5); headerDiv.appendChild(btnClose);

                const bodyDiv = document.createElement('div'); bodyDiv.className = 'modal-body';
                const form = document.createElement('form'); form.id = 'formAgregarContacto';

                // Nombre
                const w1 = document.createElement('div'); w1.className = 'mb-2';
                const l1 = document.createElement('label'); l1.className = 'form-label'; l1.textContent = 'Nombre del contacto';
                const i1 = document.createElement('input'); i1.name = 'nombre'; i1.className = 'form-control'; i1.required = true;
                w1.appendChild(l1); w1.appendChild(i1); form.appendChild(w1);

                // Parentesco select
                const w2 = document.createElement('div'); w2.className = 'mb-2';
                const l2 = document.createElement('label'); l2.className = 'form-label'; l2.textContent = 'Parentesco';
                const sel = document.createElement('select'); sel.name = 'parentesco'; sel.className = 'form-select'; sel.required = true;
                ['', 'hijos', 'nietos', 'conyugues', 'otros'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(Seleccione)'; sel.appendChild(o); });
                w2.appendChild(l2); w2.appendChild(sel); form.appendChild(w2);

                // Custom parentesco when 'otros' selected
                const w2b = document.createElement('div'); w2b.className = 'mb-2 d-none'; w2b.id = 'cont_parentesco_otro';
                const l2b = document.createElement('label'); l2b.className = 'form-label'; l2b.textContent = 'Especifique parentesco';
                const i2b = document.createElement('input'); i2b.name = 'parentesco_otro'; i2b.className = 'form-control'; i2b.placeholder = 'Describa el parentesco';
                w2b.appendChild(l2b); w2b.appendChild(i2b); form.appendChild(w2b);

                // Celular
                const w3 = document.createElement('div'); w3.className = 'mb-2';
                const l3 = document.createElement('label'); l3.className = 'form-label'; l3.textContent = 'Celular (10 dígitos)';
                const i3 = document.createElement('input'); i3.name = 'celular'; i3.className = 'form-control'; i3.required = true; i3.type = 'tel';
                w3.appendChild(l3); w3.appendChild(i3); form.appendChild(w3);

                bodyDiv.appendChild(form);

                const footer = document.createElement('div'); footer.className = 'modal-footer';
                const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
                const btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.id = 'btnGuardarContacto'; btnSave.textContent = 'Guardar';
                footer.appendChild(btnCancel); footer.appendChild(btnSave);

                content.appendChild(headerDiv); content.appendChild(bodyDiv); content.appendChild(footer);
                dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);

                const bsModal = new bootstrap.Modal(modal); bsModal.show();

                // show/hide custom parentesco
                sel.addEventListener('change', function () { if (sel.value === 'otros') { w2b.classList.remove('d-none'); i2b.required = true; } else { w2b.classList.add('d-none'); i2b.required = false; } });

                document.getElementById('btnGuardarContacto').addEventListener('click', function () {
                    const nombreVal = form.querySelector('input[name="nombre"]').value.trim();
                    let parentVal = form.querySelector('select[name="parentesco"]').value;
                    const parentOt = form.querySelector('input[name="parentesco_otro"]').value.trim();
                    const celularVal = form.querySelector('input[name="celular"]').value.trim();

                    if (!nombreVal) { if (window.Swal) Swal.fire('Error', 'Nombre requerido', 'error'); else alert('Nombre requerido'); return; }
                    if (!parentVal) { if (window.Swal) Swal.fire('Error', 'Parentesco requerido', 'error'); else alert('Parentesco requerido'); return; }
                    if (parentVal === 'otros') {
                        if (!parentOt) { if (window.Swal) Swal.fire('Error', 'Especifique el parentesco', 'error'); else alert('Especifique el parentesco'); return; }
                        parentVal = parentOt;
                    }
                    if (!/^[0-9]{10}$/.test(celularVal)) { if (window.Swal) Swal.fire('Error', 'Celular debe tener 10 dígitos', 'error'); else alert('Celular debe tener 10 dígitos'); return; }

                    // submit
                    const fd = new FormData(); fd.append('idProfesor', p.idProfesor); fd.append('nombre', nombreVal); fd.append('parentesco', parentVal); fd.append('celular', celularVal);
                    btnSave.disabled = true;
                    fetch('controlador/agregarProfesorEmergencia.php', { method: 'POST', body: fd }).then(r => { if (!r.ok) return r.json(); return r.json(); }).then(res => {
                        if (res.ok) { if (window.Swal) Swal.fire('Guardado', 'Contacto agregado', 'success'); else alert('Contacto agregado'); bsModal.hide(); showDetails(p.idProfesor); } else { throw new Error(res.error || 'Error al guardar'); }
                    }).catch(err => { console.error('Error guardando contacto:', err); if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error: ' + (err.message || err)); }).finally(() => { btnSave.disabled = false; });
                });
            });

            card.appendChild(body);
            panel.appendChild(card);

            // Modal Horarios actualizado (tabla pivot días)
            if (typeof btnHorarios !== 'undefined') {
                btnHorarios.addEventListener('click', function () {
                    fetch('controlador/recuperarTrimestresProgramacionProfesor.php?idProfesor=' + encodeURIComponent(p.idProfesor))
                        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                        .then(json => {
                            if (!json.ok) throw new Error(json.error || 'Error');
                            const trimestres = json.trimestres || [];
                            if (trimestres.length === 0) { if (window.swal) new swal('Sin programación', 'El profesor no tiene programación en ningún trimestre.', 'info'); else alert('El profesor no tiene programación en ningún trimestre.'); return; }
                            const existing = document.getElementById('modalHorariosProfesor'); if (existing) existing.remove();
                            const modal = document.createElement('div'); modal.id = 'modalHorariosProfesor'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                            const dialog = document.createElement('div'); dialog.className = 'modal-dialog modal-xl';
                            const content = document.createElement('div'); content.className = 'modal-content';
                            const header = document.createElement('div'); header.className = 'modal-header'; const titleH = document.createElement('h5'); titleH.className = 'modal-title'; titleH.textContent = 'Programación del profesor'; header.appendChild(titleH); const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(btnC);
                            const bodyM = document.createElement('div'); bodyM.className = 'modal-body';
                            const selWrap = document.createElement('div'); selWrap.className = 'mb-2'; const lblSel = document.createElement('label'); lblSel.className = 'form-label'; lblSel.textContent = 'Trimestre'; selWrap.appendChild(lblSel);
                            const selTrim = document.createElement('select'); selTrim.className = 'form-select'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; selTrim.appendChild(opt0);
                            trimestres.forEach(t => { const o = document.createElement('option'); o.value = t.idTrimestre; const left = (t.año !== undefined && t.año !== null) ? String(t.año) : ''; const right = t.sigla || ''; o.textContent = right ? (left + ' - ' + right) : left; selTrim.appendChild(o); }); selWrap.appendChild(selTrim); bodyM.appendChild(selWrap);
                            const table = document.createElement('table'); table.className = 'table table-sm dir-horarios-table';
                            const thead = document.createElement('thead'); const trH = document.createElement('tr');['UEA', 'Grupo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Salón'].forEach(c => { const th = document.createElement('th'); th.textContent = c; trH.appendChild(th); }); thead.appendChild(trH); table.appendChild(thead); const tbody = document.createElement('tbody'); table.appendChild(tbody); bodyM.appendChild(table);
                            const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCloseF = document.createElement('button'); btnCloseF.type = 'button'; btnCloseF.className = 'btn btn-secondary'; btnCloseF.setAttribute('data-bs-dismiss', 'modal'); btnCloseF.textContent = 'Cerrar'; footer.appendChild(btnCloseF);
                            content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal); const bs = new bootstrap.Modal(modal); bs.show();
                            function normDia(s) { try { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) { return String(s || '').toLowerCase(); } }
                            function cargarProgramacion(idTr) {
                                while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
                                if (!idTr) return;
                                fetch('controlador/recuperarProgramacionProfesorTrimestre.php?idProfesor=' + encodeURIComponent(p.idProfesor) + '&idTrimestre=' + encodeURIComponent(idTr))
                                    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                                    .then(data => {
                                        if (!data.ok) throw new Error(data.error || 'Error');
                                        const rows = data.programacion || [];
                                        if (rows.length === 0) {
                                            const trE = document.createElement('tr'); const tdE = document.createElement('td'); tdE.colSpan = 8; tdE.textContent = 'Sin programación en este trimestre'; trE.appendChild(tdE); tbody.appendChild(trE); return;
                                        }
                                        // Agrupar por UEA|Grupo|Salon
                                        const agrupado = new Map();
                                        rows.forEach(rw => {
                                            const key = rw.claveUEA + '|' + rw.claveGrupo + '|' + (rw.salon || '');
                                            if (!agrupado.has(key)) agrupado.set(key, { uea: rw.claveUEA + ' ' + (rw.ueaNombre || ''), grupo: rw.claveGrupo, salon: rw.salon || '', horarios: [] });
                                            agrupado.get(key).horarios.push(rw);
                                        });
                                        // Por cada grupo una fila única con días en columnas
                                        agrupado.forEach(entry => {
                                            const tr = document.createElement('tr');
                                            const tdUEA = document.createElement('td'); tdUEA.textContent = entry.uea; tr.appendChild(tdUEA);
                                            const tdGrupo = document.createElement('td'); tdGrupo.textContent = entry.grupo; tr.appendChild(tdGrupo);
                                            // Mapa día -> lista de horarios para combinar múltiples rangos en una celda
                                            const diaMap = new Map();
                                            entry.horarios.forEach(h => {
                                                const dKey = normDia(h.dia);
                                                if (!diaMap.has(dKey)) diaMap.set(dKey, []);
                                                diaMap.get(dKey).push(h);
                                            });
                                            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach(d => {
                                                const td = document.createElement('td');
                                                const key = normDia(d);
                                                if (diaMap.has(key)) {
                                                    diaMap.get(key).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
                                                    diaMap.get(key).forEach(h => {
                                                        const span = document.createElement('div'); span.className = 'horario-cell'; span.textContent = h.horaInicio + ' - ' + h.horaFin; td.appendChild(span);
                                                    });
                                                }
                                                tr.appendChild(td);
                                            });
                                            const tdSalon = document.createElement('td'); tdSalon.textContent = entry.salon; tr.appendChild(tdSalon);
                                            tbody.appendChild(tr);
                                        });
                                    })
                                    .catch(err => {
                                        console.error('Error cargando programación:', err);
                                        const trErr = document.createElement('tr'); const tdErr = document.createElement('td'); tdErr.colSpan = 8; tdErr.textContent = 'Error cargando programación'; trErr.appendChild(tdErr); tbody.appendChild(trErr);
                                    });
                            }
                            selTrim.addEventListener('change', () => cargarProgramacion(selTrim.value));
                        }).catch(err => { console.error('Error trimestres programación:', err); if (window.swal) new swal('Error', 'No se pudieron cargar trimestres.', 'error'); else alert('No se pudieron cargar trimestres.'); });
                });
            }
            // Modal Preferencias
            if (typeof btnPreferencias !== 'undefined') {
                btnPreferencias.addEventListener('click', function () {
                    fetch('controlador/recuperarTrimestresPreferenciasProfesor.php?idProfesor=' + encodeURIComponent(p.idProfesor))
                        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                        .then(json => {
                            if (!json.ok) throw new Error(json.error || 'Error'); const trimestres = json.trimestres || []; if (trimestres.length === 0) { if (window.swal) new swal('Sin preferencias', 'El profesor no tiene preferencias en ningún trimestre.', 'info'); else alert('El profesor no tiene preferencias en ningún trimestre.'); return; }
                            const existing = document.getElementById('modalPreferenciasProfesor'); if (existing) existing.remove();
                            const modal = document.createElement('div'); modal.id = 'modalPreferenciasProfesor'; modal.className = 'modal fade'; modal.tabIndex = -1; modal.setAttribute('role', 'dialog');
                            const dialog = document.createElement('div'); dialog.className = 'modal-dialog modal-xl'; const content = document.createElement('div'); content.className = 'modal-content';
                            const header = document.createElement('div'); header.className = 'modal-header'; const title = document.createElement('h5'); title.className = 'modal-title'; title.textContent = 'Preferencias del profesor'; const btnC = document.createElement('button'); btnC.type = 'button'; btnC.className = 'btn-close'; btnC.setAttribute('data-bs-dismiss', 'modal'); header.appendChild(title); header.appendChild(btnC);
                            const bodyM = document.createElement('div'); bodyM.className = 'modal-body'; const selWrap = document.createElement('div'); selWrap.className = 'mb-2'; const lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = 'Trimestre'; selWrap.appendChild(lbl); const selTrim = document.createElement('select'); selTrim.className = 'form-select'; const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '(seleccione)'; selTrim.appendChild(opt0); trimestres.forEach(t => { const o = document.createElement('option'); o.value = t.idTrimestre; const left = (t.año !== undefined && t.año !== null) ? String(t.año) : ''; const right = t.sigla || ''; o.textContent = right ? (left + ' - ' + right) : left; selTrim.appendChild(o); }); selWrap.appendChild(selTrim); bodyM.appendChild(selWrap);
                            const table = document.createElement('table'); table.className = 'table table-sm dir-horarios-table dir-preferencias-grid';
                            const slots = ['07:00', '08:30', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:30'];
                            const thead = document.createElement('thead'); const trH = document.createElement('tr');['Día', ...slots].forEach(c => { const th = document.createElement('th'); th.textContent = c; trH.appendChild(th); }); thead.appendChild(trH); table.appendChild(thead); const tbody = document.createElement('tbody'); table.appendChild(tbody); bodyM.appendChild(table);
                            const footer = document.createElement('div'); footer.className = 'modal-footer'; const btnCloseF = document.createElement('button'); btnCloseF.type = 'button'; btnCloseF.className = 'btn btn-secondary'; btnCloseF.setAttribute('data-bs-dismiss', 'modal'); btnCloseF.textContent = 'Cerrar'; footer.appendChild(btnCloseF);
                            content.appendChild(header); content.appendChild(bodyM); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal); const bs = new bootstrap.Modal(modal); bs.show();
                            function cargarPreferencias(idTr) {
                                while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
                                if (!idTr) return;
                                // Preparar contenedor de metadatos (profesor, número de grupos, UEAs y observaciones)
                                let meta = bodyM.querySelector('.pref-meta');
                                if (!meta) {
                                    meta = document.createElement('div');
                                    meta.className = 'pref-meta mb-3';
                                    // Insertar antes de la tabla de grid de horarios preferidos
                                    bodyM.insertBefore(meta, table);
                                }
                                // Limpiar meta evitando innerHTML inseguro
                                while (meta.firstChild) meta.removeChild(meta.firstChild);
                                const fd = new FormData(); fd.append('idTrimestre', idTr); fd.append('idProfesor', p.idProfesor);
                                fetch('controlador/recuperarPreferenciasProfesorTrimestre.php', { method: 'POST', body: fd })
                                    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                                    .then(data => {
                                        if (!data.ok) throw new Error(data.msg || 'Error');
                                        const pref = data.data;
                                        if (!pref) {
                                            // Mostrar mensaje en meta y tabla
                                            const alert = document.createElement('div'); alert.className = 'alert alert-info'; alert.textContent = 'Sin preferencias en este trimestre'; meta.appendChild(alert);
                                            const trE = document.createElement('tr'); const tdE = document.createElement('td'); tdE.colSpan = slots.length + 1; tdE.textContent = 'Sin preferencias en este trimestre'; trE.appendChild(tdE); tbody.appendChild(trE); return;
                                        }
                                        // Construir sección de metadatos
                                        const profesor = pref.profesor || {};
                                        const preferenciaBase = pref.preferencia || {};
                                        const ueasPref = Array.isArray(pref.ueas) ? pref.ueas.slice().sort((a, b) => (a.prioridad || 0) - (b.prioridad || 0)) : [];
                                        // Profesor nombre y número económico
                                        const hProf = document.createElement('p'); hProf.className = 'mb-1';
                                        const strongProf = document.createElement('strong'); strongProf.textContent = 'Profesor:'; hProf.appendChild(strongProf);
                                        hProf.appendChild(document.createTextNode(' ' + (profesor.nombre || '') + (profesor.numeroEconomico ? ' (' + profesor.numeroEconomico + ')' : '')));
                                        meta.appendChild(hProf);
                                        // Número de grupos
                                        const pGrupos = document.createElement('p'); pGrupos.className = 'mb-1';
                                        const strongGr = document.createElement('strong'); strongGr.textContent = 'Número de grupos preferidos:'; pGrupos.appendChild(strongGr);
                                        const ngVal = (preferenciaBase.noGrupos !== null && preferenciaBase.noGrupos !== undefined) ? preferenciaBase.noGrupos : '(sin especificar)';
                                        pGrupos.appendChild(document.createTextNode(' ' + ngVal)); meta.appendChild(pGrupos);
                                        // Tabla de UEAs
                                        const hUEA = document.createElement('h6'); hUEA.textContent = 'UEAs seleccionadas'; meta.appendChild(hUEA);
                                        if (ueasPref.length === 0) {
                                            const pNo = document.createElement('p'); pNo.className = 'text-muted'; pNo.textContent = '(sin UEAs preferidas)'; meta.appendChild(pNo);
                                        } else {
                                            const tblU = document.createElement('table'); tblU.className = 'table table-sm pref-meta-table';
                                            const theadU = document.createElement('thead'); const trUH = document.createElement('tr');
                                            ['Prioridad', 'Clave', 'Nombre'].forEach(c => { const th = document.createElement('th'); th.textContent = c; trUH.appendChild(th); });
                                            theadU.appendChild(trUH); tblU.appendChild(theadU);
                                            const tbodyU = document.createElement('tbody');
                                            ueasPref.forEach(u => {
                                                const trU = document.createElement('tr');
                                                const tdPri = document.createElement('td'); tdPri.textContent = (u.prioridad !== undefined && u.prioridad !== null) ? u.prioridad : ''; trU.appendChild(tdPri);
                                                const tdClave = document.createElement('td'); tdClave.textContent = u.claveUEA || ''; trU.appendChild(tdClave);
                                                const tdNom = document.createElement('td'); tdNom.textContent = u.nombre || ''; trU.appendChild(tdNom);
                                                tbodyU.appendChild(trU);
                                            });
                                            tblU.appendChild(tbodyU); meta.appendChild(tblU);
                                        }
                                        // Observaciones
                                        const hObs = document.createElement('h6'); hObs.textContent = 'Observaciones'; meta.appendChild(hObs);
                                        const pObs = document.createElement('p'); pObs.className = 'mb-2'; pObs.textContent = (preferenciaBase.observaciones && preferenciaBase.observaciones.trim() !== '') ? preferenciaBase.observaciones : '(sin observaciones)'; meta.appendChild(pObs);
                                        const horarios = pref.horarios || [];
                                        if (horarios.length === 0) { const trE = document.createElement('tr'); const tdE = document.createElement('td'); tdE.colSpan = slots.length + 1; tdE.textContent = 'Sin horarios preferidos'; trE.appendChild(tdE); tbody.appendChild(trE); return; }
                                        // Construir mapa día -> set de slots activos
                                        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                                        const diaSlots = new Map(); dias.forEach(d => diaSlots.set(d, new Set()));
                                        horarios.forEach(h => {
                                            const diaNorm = dias.find(d => normDia(d) === normDia(h.dia));
                                            if (!diaNorm) return;
                                            const start = (h.horaInicio || '').substring(0, 5); // HH:MM
                                            // Marcar todos los slots cuyo inicio coincide exactamente con horaInicio
                                            if (slots.includes(start)) diaSlots.get(diaNorm).add(start);
                                        });
                                        // Render filas por día
                                        dias.forEach(d => {
                                            const tr = document.createElement('tr');
                                            const tdDia = document.createElement('td'); tdDia.textContent = d; tr.appendChild(tdDia);
                                            slots.forEach(s => {
                                                const td = document.createElement('td'); td.className = 'pref-slot';
                                                if (diaSlots.get(d).has(s)) {
                                                    const span = document.createElement('span'); span.className = 'preferencia-cell preferencia-slot-active'; span.textContent = '✔'; span.title = 'Preferido ' + s; td.appendChild(span);
                                                } else {
                                                    td.classList.add('preferencia-slot-empty');
                                                }
                                                tr.appendChild(td);
                                            });
                                            tbody.appendChild(tr);
                                        });
                                    })
                                    .catch(err => {
                                        console.error('Error cargando preferencias:', err);
                                        const trErr = document.createElement('tr'); const tdErr = document.createElement('td'); tdErr.colSpan = slots.length + 1; tdErr.textContent = 'Error cargando preferencias'; trErr.appendChild(tdErr); tbody.appendChild(trErr);
                                    });
                            }
                            selTrim.addEventListener('change', () => cargarPreferencias(selTrim.value));
                        }).catch(err => { console.error('Error trimestres preferencias:', err); if (window.swal) new swal('Error', 'No se pudieron cargar trimestres de preferencias.', 'error'); else alert('No se pudieron cargar trimestres de preferencias.'); });
                });
            }

            // Delete logic: confirmation compatible con SweetAlert2 (Swal.fire), SweetAlert v1 (swal)
            // y `confirm()` como fallback. Muestra botón explícito "No" para cancelar.
            btnDelete.addEventListener('click', function () {
                function doDelete() {
                    btnDelete.disabled = true;
                    const params = new URLSearchParams();
                    params.set('idProfesor', p.idProfesor);
                    fetch('controlador/eliminarProfesorCompleto.php', { method: 'POST', body: params })
                        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                        .then(json => {
                            if (json.ok) {
                                // Preferir Swal si existe, luego swal, luego alert
                                if (window.Swal && typeof Swal.fire === 'function') {
                                    Swal.fire('Eliminado', 'Profesor eliminado correctamente', 'success');
                                } else if (window.swal) {
                                    try { // algunos builds requieren `new swal(...)`
                                        const maybe = (typeof window.swal === 'function') ? window.swal : (function (o) { return new window.swal(o); });
                                        const res = maybe('Eliminado', 'Profesor eliminado correctamente', 'success');
                                        if (res && typeof res.then === 'function') res.catch(() => { });
                                    } catch (e) { try { new swal('Eliminado', 'Profesor eliminado correctamente', 'success'); } catch (_) { alert('Profesor eliminado correctamente'); } }
                                } else {
                                    alert('Profesor eliminado correctamente');
                                }
                                // refresh the directory view
                                crearMenuDirectorio();
                            } else {
                                throw new Error(json.error || 'Error al eliminar');
                            }
                        })
                        .catch(err => {
                            console.error('Error eliminando profesor:', err);
                            if (window.Swal && typeof Swal.fire === 'function') Swal.fire('Error', err.message || 'Error', 'error');
                            else if (window.swal) { try { const maybe = (typeof window.swal === 'function') ? window.swal : (function (o) { return new window.swal(o); }); maybe('Error', err.message || 'Error', 'error'); } catch (_) { alert('Error: ' + (err.message || err)); } }
                            else alert('Error: ' + (err.message || err));
                        })
                        .finally(() => { btnDelete.disabled = false; });
                }

                const confirmText = 'Se eliminarán todas las referencias y el profesor. ¿Desea continuar?';

                // 1) SweetAlert2
                if (window.Swal && typeof Swal.fire === 'function') {
                    Swal.fire({
                        title: 'Confirmar eliminación',
                        text: confirmText,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí',
                        cancelButtonText: 'No'
                    }).then(result => { if (result && result.isConfirmed) doDelete(); });

                    // 2) SweetAlert (v1) - try function call, constructor, and callback patterns
                } else if (window.swal) {
                    try {
                        // Preferir llamada como función que devuelve Promise
                        if (typeof window.swal === 'function') {
                            const p = window.swal({
                                title: 'Confirmar eliminación',
                                text: confirmText,
                                icon: 'warning',
                                buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } },
                                dangerMode: true,
                            });
                            if (p && typeof p.then === 'function') {
                                p.then(willDelete => { if (willDelete) doDelete(); });
                                return;
                            }
                        }
                    } catch (e) { /* fallthrough to other patterns */ }

                    try {
                        // Some builds expose swal as a constructor/class
                        const inst = new window.swal({
                            title: 'Confirmar eliminación',
                            text: confirmText,
                            icon: 'warning',
                            buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } },
                            dangerMode: true,
                        });
                        if (inst && typeof inst.then === 'function') {
                            inst.then(willDelete => { if (willDelete) doDelete(); });
                            return;
                        }
                    } catch (e) { /* fallthrough */ }

                    try {
                        // Older API: swal(options, callback)
                        window.swal({
                            title: 'Confirmar eliminación',
                            text: confirmText,
                            icon: 'warning',
                            buttons: { cancel: { text: 'No', value: false }, confirm: { text: 'Sí', value: true } },
                            dangerMode: true,
                        }, function (willDelete) { if (willDelete) doDelete(); });
                        return;
                    } catch (e) { /* fallback to native */ }

                    // Fallback to native confirm if all swal attempts fail
                    if (confirm(confirmText)) doDelete();

                    // 3) Native fallback
                } else {
                    if (confirm(confirmText)) doDelete();
                }
            });

            // Editar: abrir modal prellenado con los campos solicitados
            btnEdit.addEventListener('click', function () {
                // Remove any existing edit modal
                const existing = document.getElementById('modalEditarProfesor');
                if (existing) existing.remove();

                const modal = document.createElement('div');
                modal.id = 'modalEditarProfesor';
                modal.className = 'modal fade';
                modal.tabIndex = -1;
                modal.setAttribute('role', 'dialog');

                const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
                const content = document.createElement('div'); content.className = 'modal-content';

                // Header
                const headerDiv = document.createElement('div'); headerDiv.className = 'modal-header';
                const titleH5 = document.createElement('h5'); titleH5.className = 'modal-title'; titleH5.textContent = 'Editar profesor';
                const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
                headerDiv.appendChild(titleH5); headerDiv.appendChild(btnClose);

                // Body / form
                const bodyDiv = document.createElement('div'); bodyDiv.className = 'modal-body';
                const formElem = document.createElement('form'); formElem.id = 'formEditarProfesor';

                function createFieldEdit(labelText, name, required, value) {
                    const wrapper = document.createElement('div'); wrapper.className = 'mb-2';
                    const label = document.createElement('label'); label.className = 'form-label'; label.textContent = labelText;
                    const input = document.createElement('input'); input.name = name; input.className = 'form-control'; if (required) input.required = true; if (value !== undefined) input.value = value;
                    wrapper.appendChild(label); wrapper.appendChild(input);
                    return wrapper;
                }

                // numeroEconomico, nombre, correo_uam, correo_personal, celular, gradoEstudios selector
                formElem.appendChild(createFieldEdit('Número Económico', 'numeroEconomico', true, p.numeroEconomico || ''));
                formElem.appendChild(createFieldEdit('Nombre', 'nombre', true, p.nombre || ''));
                formElem.appendChild(createFieldEdit('Correo UAM', 'correo_uam', true, p.correo_uam || ''));
                formElem.appendChild(createFieldEdit('Correo personal', 'correo_personal', false, p.correo_personal || ''));

                // Tipo de profesor (select) - poblará opciones desde el servidor y preseleccionará el tipo actual si existe
                const wrapperTipo = document.createElement('div'); wrapperTipo.className = 'mb-2';
                const lblTipo = document.createElement('label'); lblTipo.className = 'form-label'; lblTipo.textContent = 'Tipo de profesor';
                const selTipo = document.createElement('select'); selTipo.name = 'idProfesorTipo'; selTipo.className = 'form-select';
                const optTipo0 = document.createElement('option'); optTipo0.value = ''; optTipo0.textContent = '(sin seleccionar)'; selTipo.appendChild(optTipo0);
                wrapperTipo.appendChild(lblTipo); wrapperTipo.appendChild(selTipo);
                formElem.appendChild(wrapperTipo);

                // Poblar opciones del select con los tipos disponibles
                (function populateTipoSelect() {
                    fetch('controlador/recuperaFiltrosProfesores.php')
                        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                        .then(json => {
                            if (!json || !json.ok) return;
                            const tipos = Array.isArray(json.profesorTipos) ? json.profesorTipos : [];
                            tipos.forEach(t => {
                                const o = document.createElement('option');
                                o.value = t.idProfesorTipo !== undefined ? t.idProfesorTipo : (t.id || '');
                                o.textContent = t.nombre || (t.nombreTipo || '');
                                selTipo.appendChild(o);
                            });
                            // preselect if contrato info is present
                            try {
                                if (typeof contrato !== 'undefined' && contrato && contrato.idProfesorTipo) {
                                    selTipo.value = contrato.idProfesorTipo;
                                }
                            } catch (e) { /* ignore */ }
                        }).catch(err => { console.warn('No se pudieron cargar tipos de profesor:', err); });
                })();

                formElem.appendChild(createFieldEdit('Celular (10 dígitos)', 'celular', false, p.celular || ''));

                // gradoEstudios select
                const wrapperGrado = document.createElement('div'); wrapperGrado.className = 'mb-2';
                const labelGrado = document.createElement('label'); labelGrado.className = 'form-label'; labelGrado.textContent = 'Grado de estudios';
                const selGrado = document.createElement('select'); selGrado.name = 'gradoEstudios'; selGrado.className = 'form-select';
                ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(ninguno)'; if (p.gradoEstudios === optText) o.selected = true; selGrado.appendChild(o); });
                wrapperGrado.appendChild(labelGrado); wrapperGrado.appendChild(selGrado);
                formElem.appendChild(wrapperGrado);

                // hidden id
                const idInput = document.createElement('input'); idInput.type = 'hidden'; idInput.name = 'idProfesor'; idInput.value = p.idProfesor;
                formElem.appendChild(idInput);

                bodyDiv.appendChild(formElem);

                // Footer
                const footerDiv = document.createElement('div'); footerDiv.className = 'modal-footer';
                const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
                const btnSave = document.createElement('button'); btnSave.id = 'btnActualizarProfesor'; btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar cambios';
                footerDiv.appendChild(btnCancel); footerDiv.appendChild(btnSave);

                content.appendChild(headerDiv); content.appendChild(bodyDiv); content.appendChild(footerDiv);
                dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);

                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();

                // Save handler
                function guardarCambios(fd) {
                    return fetch('controlador/actualizarProfesor.php', { method: 'POST', body: fd }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
                }

                document.getElementById('btnActualizarProfesor').addEventListener('click', function () {
                    const form = document.getElementById('formEditarProfesor');
                    // client-side validations: celular, correo UAM and correo personal
                    const celVal = form.querySelector('input[name="celular"]').value.trim();
                    const correoUAM = form.querySelector('input[name="correo_uam"]').value.trim().toLowerCase();
                    const correoPersonal = form.querySelector('input[name="correo_personal"]').value.trim();

                    if (celVal === '' || celVal === null || celVal === undefined) {
                        if (window.swal) new swal('Error', 'Celular es obligatorio', 'error'); else alert('Celular es obligatorio');
                        return;
                    }
                    if (!/^\d+$/.test(celVal)) {
                        if (window.swal) new swal('Error', 'Celular debe ser un número', 'error'); else alert('Celular debe ser un número');
                        return;
                    }
                    if (celVal.length !== 10) {
                        if (window.swal) new swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error'); else alert('Celular debe tener exactamente 10 dígitos');
                        return;
                    }
                    if (!correoUAM.endsWith('@azc.uam.mx')) {
                        if (window.swal) new swal('Error', 'El correo UAM debe tener dominio @azc.uam.mx', 'error'); else alert('El correo UAM debe tener dominio @azc.uam.mx');
                        return;
                    }
                    if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) {
                        if (window.swal) new swal('Error', 'Correo personal inválido', 'error'); else alert('Correo personal inválido');
                        return;
                    }
                    const data = new FormData(form);
                    guardarCambios(data).then(json => {
                        if (!json.ok) {
                            if (window.swal) new swal('Error', json.error || 'Error', 'error'); else alert('Error: ' + (json.error || ''));
                            return;
                        }
                        bsModal.hide();
                        // refresh directory and reselect updated professor
                        crearMenuDirectorio();
                        setTimeout(() => {
                            const rows = document.querySelectorAll('table.table tbody tr');
                            rows.forEach(r => { if (r.dataset.id == json.profesor.idProfesor) { r.click(); } });
                        }, 400);
                    }).catch(err => {
                        console.error('Error actualizando profesor:', err);
                        if (window.swal) new swal('Error', err.message || 'Error', 'error'); else alert('Error al actualizar el profesor');
                    });
                });
            });
        }).catch(err => {
            console.error('Error fetching profesor por id:', err);
            const panelErr = document.getElementById('dir-right-panel');
            while (panelErr.firstChild) panelErr.removeChild(panelErr.firstChild);
            const alertDiv = document.createElement('div'); alertDiv.className = 'alert alert-danger';
            alertDiv.textContent = 'Error al cargar datos del profesor';
            panelErr.appendChild(alertDiv);
        });
    }

    // small helper to escape HTML
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; });
    }

    // Search handler with debounce
    let timer = null;
    input.addEventListener('input', function (e) {
        clearTimeout(timer);
        timer = setTimeout(() => loadList(input.value.trim()), 250);
    });

    // Build navigator controls (sort buttons + filters)
    const controls = document.createElement('div');
    controls.className = 'mb-2 d-flex flex-wrap gap-2 align-items-center';
    controls.id = 'dir-controls';
    // start hidden when entering the directorio
    controls.classList.add('d-none');

    // Sort buttons
    const sortBtnName = document.createElement('button');
    sortBtnName.className = 'btn btn-outline-secondary btn-sm';
    sortBtnName.textContent = 'Ordenar por nombre ↑';
    sortBtnName.addEventListener('click', function () {
        if (state.sort === 'nombre') state.sortDir = (state.sortDir === 'ASC') ? 'DESC' : 'ASC'; else { state.sort = 'nombre'; state.sortDir = 'ASC'; }
        sortBtnName.textContent = 'Ordenar por nombre ' + (state.sort === 'nombre' ? (state.sortDir === 'ASC' ? '↑' : '↓') : '');
        sortBtnNum.textContent = 'Ordenar por número económico';
        loadList();
    });
    controls.appendChild(sortBtnName);

    const sortBtnNum = document.createElement('button');
    sortBtnNum.className = 'btn btn-outline-secondary btn-sm';
    sortBtnNum.textContent = 'Ordenar por número económico';
    sortBtnNum.addEventListener('click', function () {
        if (state.sort === 'numeroEconomico') state.sortDir = (state.sortDir === 'ASC') ? 'DESC' : 'ASC'; else { state.sort = 'numeroEconomico'; state.sortDir = 'ASC'; }
        sortBtnNum.textContent = 'Ordenar por número económico ' + (state.sort === 'numeroEconomico' ? (state.sortDir === 'ASC' ? '↑' : '↓') : '');
        sortBtnName.textContent = 'Ordenar por nombre';
        loadList();
    });
    controls.appendChild(sortBtnNum);

    // Filter selects
    function createSelect(placeholder) {
        const sel = document.createElement('select');
        sel.className = 'form-select form-select-sm';
        const opt = document.createElement('option'); opt.value = ''; opt.textContent = placeholder + ' (Todos)'; sel.appendChild(opt);
        return sel;
    }

    const selAreaAcad = createSelect('Área académica');
    const selGrupo = createSelect('Grupo temático');
    // Reemplazar select de 'Área' por 'Tipo área profesor' (profesorAreaTipo)
    const selProfAreaTipo = createSelect('Tipo área profesor');
    const selProfTipo = createSelect('Tipo de profesor');
    selProfTipo.classList.add('prof-type');
    // insertar opción 'Sin profesores' justo debajo de '(Todos)'
    (function () { const optNoProf = document.createElement('option'); optNoProf.value = '__no_profesores'; optNoProf.textContent = 'Sin profesores'; selProfTipo.appendChild(optNoProf); })();
    // Select para Tipo de administrativo
    const selAdminTipo = createSelect('Tipo de administrativo');
    selAdminTipo.classList.add('admin-type');
    // insertar opción 'Sin administrativos' justo debajo de '(Todos)'
    (function () { const optNoAdmin = document.createElement('option'); optNoAdmin.value = '__no_administrativos'; optNoAdmin.textContent = 'Sin administrativos'; selAdminTipo.appendChild(optNoAdmin); })();
    const selTrim = createSelect('Trimestre');

    // apply filter change
    [selAreaAcad, selGrupo, selProfAreaTipo, selProfTipo, selAdminTipo, selTrim].forEach(s => {
        s.addEventListener('change', function () {
            state.areaAcademica = selAreaAcad.value;
            state.grupoTematico = selGrupo.value;
            state.profesorAreaTipo = selProfAreaTipo.value;
            state.profesorTipo = selProfTipo.value;
            state.adminTipo = selAdminTipo.value;
            state.trimestre = selTrim.value;
            loadList();
        });
    });

    controls.appendChild(selAreaAcad);
    controls.appendChild(selGrupo);
    controls.appendChild(selProfAreaTipo);
    controls.appendChild(selProfTipo);
    controls.appendChild(selAdminTipo);
    controls.appendChild(selTrim);

    // Insert controls above the table (append to nav so it's guaranteed to be a child)
    nav.appendChild(controls);

    // Populate filter options from server
    fetchFilters().then(json => {
        if (!json.ok) return;
        // areas academicas: deduplicate by nombre so each area appears once in the select
        const areaMap = new Map();
        json.areaAcademicas.forEach(a => { if (!areaMap.has(a.nombre)) areaMap.set(a.nombre, a); });
        areaMap.forEach(a => {
            const o = document.createElement('option');
            o.value = a.nombre; // use nombre as the value so selection groups jefe+miembros
            o.textContent = a.nombre;
            selAreaAcad.appendChild(o);
        });

        // grupos tematicos: deduplicate by nombreGrupo
        const grupoMap = new Map();
        json.gruposTematicos.forEach(g => { if (!grupoMap.has(g.nombreGrupo)) grupoMap.set(g.nombreGrupo, g); });
        grupoMap.forEach(g => {
            const o = document.createElement('option');
            o.value = g.nombreGrupo;
            o.textContent = g.nombreGrupo;
            selGrupo.appendChild(o);
        });
        // profesorAreaTipos
        if (json.profesorAreaTipos) {
            json.profesorAreaTipos.forEach(t => { const o = document.createElement('option'); o.value = t.idProfesorAreaTipo; o.textContent = t.descripcion; selProfAreaTipo.appendChild(o); });
        }
        json.profesorTipos.forEach(t => { const o = document.createElement('option'); o.value = t.idProfesorTipo; o.textContent = t.nombre; selProfTipo.appendChild(o); });
        json.trimestres.forEach(t => {
            const o = document.createElement('option');
            o.value = t.idTrimestre;
            // Mostrar "AÑO - SIGLA"; si falta sigla usar nombre como respaldo. No mostrar fechaLimite.
            const left = (t.año !== undefined && t.año !== null && String(t.año).trim() !== '') ? String(t.año) : (t.nombre ? String(t.nombre) : '');
            const right = (t.sigla ? String(t.sigla) : (t.nombre && String(t.nombre) !== left ? String(t.nombre) : ''));
            o.textContent = right ? (left + ' - ' + right) : left;
            selTrim.appendChild(o);
        });
        // Cargar tipos de administrativo desde su endpoint y poblar el select
        fetch('controlador/recuperaFiltrosAdministrativos.php')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(j => {
                if (!j || !j.ok) return;
                const tipos = Array.isArray(j.administrativoTipos) ? j.administrativoTipos : (Array.isArray(j.administrativotipo) ? j.administrativotipo : []);
                tipos.forEach(t => {
                    const o = document.createElement('option');
                    o.value = t.idAdministrativoTipo || t.id || '';
                    o.textContent = t.nombre || t.descripcion || String(t.idAdministrativoTipo || '');
                    selAdminTipo.appendChild(o);
                });
            }).catch(err => { console.warn('No se pudieron cargar tipos administrativos:', err); });
    }).catch(err => { console.warn('No se pudieron cargar filtros:', err); });

    // initial
    loadList();
}

// Modal for creating new profesor
function mostrarModalNuevoProfesor() {
    const existing = document.getElementById('modalNuevoProfesor');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modalNuevoProfesor';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');

    const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
    const content = document.createElement('div'); content.className = 'modal-content';

    // Header
    const headerDiv = document.createElement('div'); headerDiv.className = 'modal-header';
    const titleH5 = document.createElement('h5'); titleH5.className = 'modal-title'; titleH5.textContent = 'Nuevo profesor';
    const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
    headerDiv.appendChild(titleH5); headerDiv.appendChild(btnClose);

    // Body / form
    const bodyDiv = document.createElement('div'); bodyDiv.className = 'modal-body';
    const formElem = document.createElement('form'); formElem.id = 'formNuevoProfesor';

    function createField(labelText, name, required) {
        const wrapper = document.createElement('div'); wrapper.className = 'mb-2';
        const label = document.createElement('label'); label.className = 'form-label'; label.textContent = labelText;
        const input = document.createElement('input'); input.name = name; input.className = 'form-control'; if (required) input.required = true;
        wrapper.appendChild(label); wrapper.appendChild(input);
        return wrapper;
    }

    formElem.appendChild(createField('Número Económico', 'numeroEconomico', true));
    formElem.appendChild(createField('Nombre', 'nombre', true));

    const divEmail = document.createElement('div'); divEmail.className = 'mb-2';
    const labelEmail = document.createElement('label'); labelEmail.className = 'form-label'; labelEmail.textContent = 'Correo UAM';
    const groupEmail = document.createElement('div'); groupEmail.className = 'input-group';
    const inputEmail = document.createElement('input'); inputEmail.name = 'correo_uam_prefix'; inputEmail.className = 'form-control'; inputEmail.required = true;
    const suffixEmail = document.createElement('span'); suffixEmail.className = 'input-group-text'; suffixEmail.textContent = '@azc.uam.mx';
    groupEmail.appendChild(inputEmail); groupEmail.appendChild(suffixEmail);
    divEmail.appendChild(labelEmail); divEmail.appendChild(groupEmail);
    formElem.appendChild(divEmail);
    formElem.appendChild(createField('Correo personal', 'correo_personal', false));

    // gradoEstudios select (same options used in editar modal)
    const wrapperGradoNew = document.createElement('div'); wrapperGradoNew.className = 'mb-2';
    const labelGradoNew = document.createElement('label'); labelGradoNew.className = 'form-label'; labelGradoNew.textContent = 'Grado de estudios';
    const selGradoNew = document.createElement('select'); selGradoNew.name = 'gradoEstudios'; selGradoNew.className = 'form-select';
    ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(ninguno)'; selGradoNew.appendChild(o); });
    wrapperGradoNew.appendChild(labelGradoNew); wrapperGradoNew.appendChild(selGradoNew);
    formElem.appendChild(wrapperGradoNew);

    // Tipo de contrato (select obligatorio) - se poblará desde el servidor
    const wrapperContrato = document.createElement('div'); wrapperContrato.className = 'mb-2';
    const labelContrato = document.createElement('label'); labelContrato.className = 'form-label'; labelContrato.textContent = 'Tipo de contrato';
    const selContrato = document.createElement('select'); selContrato.name = 'idProfesorTipo'; selContrato.className = 'form-select';
    const CONTRATO_DEFAULT_TEXT = 'Seleccione tipo de contrato';
    const optCDefault = document.createElement('option'); optCDefault.value = ''; optCDefault.textContent = CONTRATO_DEFAULT_TEXT; selContrato.appendChild(optCDefault);
    wrapperContrato.appendChild(labelContrato); wrapperContrato.appendChild(selContrato);
    formElem.appendChild(wrapperContrato);
    formElem.appendChild(createField('Celular', 'celular', false));

    bodyDiv.appendChild(formElem);

    // Poblar tipos de contrato usando directamente el endpoint
    (function loadTiposContrato() {
        fetch('controlador/recuperaFiltrosProfesores.php')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(j => {
                if (!j || !j.ok) return;
                const tipos = Array.isArray(j.profesorTipos) ? j.profesorTipos : (Array.isArray(j.profesortipos) ? j.profesortipos : []);
                tipos.forEach(t => {
                    const o = document.createElement('option');
                    o.value = String(t.idProfesorTipo || t.id || '');
                    o.textContent = t.nombre || t.descripcion || String(t.idProfesorTipo || '');
                    selContrato.appendChild(o);
                });
            }).catch(err => { console.warn('No se pudieron cargar tipos de contrato:', err); });
    })();

    // Footer
    const footerDiv = document.createElement('div'); footerDiv.className = 'modal-footer';
    const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
    const btnSave = document.createElement('button'); btnSave.id = 'btnGuardarProfesor'; btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar';
    footerDiv.appendChild(btnCancel); footerDiv.appendChild(btnSave);

    content.appendChild(headerDiv); content.appendChild(bodyDiv); content.appendChild(footerDiv);
    dialog.appendChild(content);
    modal.appendChild(dialog);

    document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Helper to POST form data for crear profesor (returns a Promise)
    function guardarProfesor(formData) {
        return fetch('controlador/guardarProfesor.php', { method: 'POST', body: formData }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    document.getElementById('btnGuardarProfesor').addEventListener('click', function () {
        const form = document.getElementById('formNuevoProfesor');
        // Client-side validations
        // Construct full email from prefix + suffix
        const prefix = form.querySelector('input[name="correo_uam_prefix"]').value.trim();
        const correoUAM = prefix ? (prefix + '@azc.uam.mx').toLowerCase() : '';

        const correoPersonal = form.querySelector('input[name="correo_personal"]').value.trim();
        const numeroEco = form.querySelector('input[name="numeroEconomico"]').value.trim();
        const celularVal = form.querySelector('input[name="celular"]').value.trim();

        if (!numeroEco) {
            if (window.swal) new swal('Error', 'El número económico es obligatorio', 'error'); else alert('El número económico es obligatorio');
            return;
        }

        if (!prefix) {
            if (window.swal) new swal('Error', 'El correo UAM es obligatorio', 'error'); else alert('El correo UAM es obligatorio');
            return;
        }

        const emailLocalPartRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
        if (!emailLocalPartRegex.test(prefix)) {
            if (window.swal) new swal('Error', 'El correo UAM contiene caracteres inválidos', 'error'); else alert('El correo UAM contiene caracteres inválidos');
            return;
        }

        if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) {
            if (window.swal) new swal('Error', 'Correo personal inválido', 'error'); else alert('Correo personal inválido');
            return;
        }

        if (!/^\d+$/.test(numeroEco)) {
            if (window.swal) new swal('Error', 'Número económico debe ser numérico', 'error'); else alert('Número económico debe ser numérico');
            return;
        }

        if (celularVal === '') {
            if (window.swal) new swal('Error', 'El celular es obligatorio', 'error'); else alert('El celular es obligatorio');
            return;
        }

        if (!/^\d+$/.test(celularVal)) {
            if (window.swal) new swal('Error', 'Celular debe ser un número', 'error'); else alert('Celular debe ser un número');
            return;
        }

        if (celularVal.length !== 10) {
            if (window.swal) new swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error'); else alert('Celular debe tener exactamente 10 dígitos');
            return;
        }

        // Before submitting, check duplicates server-side via checkProfesorExiste.php for better UX
        const checkPayload = new FormData();
        checkPayload.append('numeroEconomico', numeroEco);
        checkPayload.append('nombre', form.querySelector('input[name="nombre"]').value.trim());
        checkPayload.append('correo_uam', correoUAM);
        fetch('controlador/ValidaProfesorExiste.php', { method: 'POST', body: checkPayload }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(check => {
            if (!check.ok) {
                throw new Error(check.error || 'Error verificando duplicados');
            }
            if (check.existsNumero) {
                const msg = 'Ya existe un profesor con ese número económico' + (check.existingNumero && check.existingNumero.nombre ? (': ' + check.existingNumero.nombre) : '');
                if (window.swal) new swal('Error', msg, 'error'); else alert(msg);
                return;
            }
            if (check.existsCorreo) {
                const msg = 'Ya existe un profesor con ese correo UAM' + (check.existingCorreo && check.existingCorreo.nombre ? (': ' + check.existingCorreo.nombre) : '');
                if (window.swal) new swal('Error', msg, 'error'); else alert(msg);
                return;
            }
            // not duplicated — proceed to create
            const data = new FormData(form);
            return guardarProfesor(data).then(json => {
                if (!json.ok) {
                    alert('Error: ' + (json.error || ''));
                    return;
                }
                bsModal.hide();
                setTimeout(() => {
                    crearMenuDirectorio();
                    setTimeout(() => {
                        const rows = document.querySelectorAll('table.table tbody tr');
                        rows.forEach(r => { if (r.dataset.id == json.profesor.idProfesor) { r.click(); } });
                    }, 400);
                }, 200);
            }).catch(err => {
                console.error('Error guardando profesor:', err);
                alert('Error al guardar el profesor');
            });
        }).catch(err => {
            console.error('Error verificando duplicados:', err);
            if (window.swal) new swal('Error', 'No se pudo verificar duplicados. Intente de nuevo.', 'error'); else alert('No se pudo verificar duplicados. Intente de nuevo.');
        });
    });
}

// Modal para crear nuevo administrativo (similar al de profesor)
function mostrarModalNuevoAdministrativo() {
    const existing = document.getElementById('modalNuevoAdministrativo');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modalNuevoAdministrativo';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');

    const dialog = document.createElement('div'); dialog.className = 'modal-dialog';
    const content = document.createElement('div'); content.className = 'modal-content';

    // Header
    const headerDiv = document.createElement('div'); headerDiv.className = 'modal-header';
    const titleH5 = document.createElement('h5'); titleH5.className = 'modal-title'; titleH5.textContent = 'Nuevo administrativo';
    const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss', 'modal'); btnClose.setAttribute('aria-label', 'Close');
    headerDiv.appendChild(titleH5); headerDiv.appendChild(btnClose);

    // Body / form
    const bodyDiv = document.createElement('div'); bodyDiv.className = 'modal-body';
    const formElem = document.createElement('form'); formElem.id = 'formNuevoAdministrativo';

    function createField(labelText, name, required, type = 'text') {
        const wrapper = document.createElement('div'); wrapper.className = 'mb-2';
        const label = document.createElement('label'); label.className = 'form-label'; label.textContent = labelText;
        const input = document.createElement('input'); input.name = name; input.className = 'form-control'; input.type = type; if (required) input.required = true;
        wrapper.appendChild(label); wrapper.appendChild(input);
        return wrapper;
    }

    formElem.appendChild(createField('Número Económico', 'numeroEconomico', true));
    formElem.appendChild(createField('Nombre', 'nombre', true));
    formElem.appendChild(createField('Correo UAM', 'correo_uam', true));
    formElem.appendChild(createField('Correo personal', 'correo_personal', false));

    // gradoEstudios select
    const wrapperGrado = document.createElement('div'); wrapperGrado.className = 'mb-2';
    const labelGrado = document.createElement('label'); labelGrado.className = 'form-label'; labelGrado.textContent = 'Grado de estudios';
    const selGrado = document.createElement('select'); selGrado.name = 'gradoEstudios'; selGrado.className = 'form-select';
    ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(optText => { const o = document.createElement('option'); o.value = optText; o.textContent = optText || '(ninguno)'; selGrado.appendChild(o); });
    wrapperGrado.appendChild(labelGrado); wrapperGrado.appendChild(selGrado);
    formElem.appendChild(wrapperGrado);

    // Tipo administrativo (select obligatorio) - se poblará desde el servidor
    const wrapperTipo = document.createElement('div'); wrapperTipo.className = 'mb-2';
    const labelTipo = document.createElement('label'); labelTipo.className = 'form-label'; labelTipo.textContent = 'Tipo';
    const selTipo = document.createElement('select'); selTipo.name = 'idAdministrativoTipo'; selTipo.className = 'form-select'; selTipo.required = true;
    const optDefault = document.createElement('option'); optDefault.value = ''; optDefault.textContent = 'Seleccione tipo'; selTipo.appendChild(optDefault);
    wrapperTipo.appendChild(labelTipo); wrapperTipo.appendChild(selTipo);
    formElem.appendChild(wrapperTipo);

    formElem.appendChild(createField('Celular', 'celular', false, 'tel'));
    formElem.appendChild(createField('Lugar', 'lugar', false));
    formElem.appendChild(createField('Extensión', 'extension', false));

    bodyDiv.appendChild(formElem);

    // Poblar tipos administrativos desde el servidor
    (function loadTiposAdministrativo() {
        fetch('controlador/recuperaFiltrosAdministrativos.php').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => {
            if (!j || !j.ok) return;
            const tipos = Array.isArray(j.administrativoTipos) ? j.administrativoTipos : (Array.isArray(j.administrativotipos) ? j.administrativotipos : []);
            tipos.forEach(t => {
                const o = document.createElement('option');
                o.value = String(t.idAdministrativoTipo || t.id || '');
                o.textContent = t.nombre || t.descripcion || String(t.idAdministrativoTipo || '');
                selTipo.appendChild(o);
            });
        }).catch(err => { console.warn('No se pudieron cargar tipos administrativos:', err); });
    })();

    // Footer
    const footerDiv = document.createElement('div'); footerDiv.className = 'modal-footer';
    const btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
    const btnSave = document.createElement('button'); btnSave.id = 'btnGuardarAdministrativo'; btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.textContent = 'Guardar';
    footerDiv.appendChild(btnCancel); footerDiv.appendChild(btnSave);

    content.appendChild(headerDiv); content.appendChild(bodyDiv); content.appendChild(footerDiv);
    dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal); bsModal.show();

    // Helper to POST form data for crear administrativo (Promise)
    function guardarAdministrativo(formData) {
        return fetch('controlador/guardarAdministrativo.php', { method: 'POST', body: formData })
            .then(async r => {
                // Try to parse JSON body (server returns JSON even on error)
                let json = null;
                try { json = await r.json(); } catch (e) { /* ignore parse errors */ }
                if (!r.ok) {
                    const msg = (json && json.error) ? json.error : ('HTTP ' + r.status);
                    throw new Error(msg);
                }
                return json;
            });
    }

    document.getElementById('btnGuardarAdministrativo').addEventListener('click', function () {
        const form = document.getElementById('formNuevoAdministrativo');
        const correoUAM = (form.querySelector('input[name="correo_uam"]').value || '').trim().toLowerCase();
        const correoPersonal = (form.querySelector('input[name="correo_personal"]').value || '').trim();
        const numeroEco = (form.querySelector('input[name="numeroEconomico"]').value || '').trim();
        const celularVal = (form.querySelector('input[name="celular"]').value || '').trim();
        const tipoVal = (form.querySelector('select[name="idAdministrativoTipo"]') || {}).value || '';

        if (!correoUAM.endsWith('@azc.uam.mx')) { if (window.swal) new swal('Error', 'El correo UAM debe tener dominio @azc.uam.mx', 'error'); else alert('El correo UAM debe tener dominio @azc.uam.mx'); return; }
        if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) { if (window.swal) new swal('Error', 'Correo personal inválido', 'error'); else alert('Correo personal inválido'); return; }
        if (!/^\d+$/.test(numeroEco)) { if (window.swal) new swal('Error', 'Número económico debe ser numérico', 'error'); else alert('Número económico debe ser numérico'); return; }
        if (celularVal !== '' && !/^\d{10}$/.test(celularVal)) { if (window.swal) new swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error'); else alert('Celular debe tener exactamente 10 dígitos'); return; }
        if (!tipoVal) { if (window.swal) new swal('Error', 'Selecciona el tipo', 'error'); else alert('Selecciona el tipo'); return; }

        const data = new FormData(form);
        // Ensure celular is sent as a trimmed string (DB stores it as varchar)
        data.set('celular', celularVal);
        btnSave.disabled = true;
        guardarAdministrativo(data).then(json => {
            if (!json.ok) { throw new Error(json.error || 'Error al guardar administrativo'); }
            bsModal.hide();
            setTimeout(() => { crearMenuDirectorio(); }, 200);
        }).catch(err => {
            console.error('Error guardando administrativo:', err);
            if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error'); else alert('Error al guardar administrativo: ' + (err.message || ''));
        }).finally(() => { btnSave.disabled = false; });
    });
}

window.crearMenuDirectorio = crearMenuDirectorio;
