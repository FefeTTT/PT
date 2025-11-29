// js/menuTrimestres.js
// Construye la vista de gestión de trimestres con opciones principales
(function(){
    function crearMenuTrimestres(adminMenu){
        if (!adminMenu) adminMenu = document.getElementById('admin-menu');
        if (!adminMenu) return;

        // Limpiar contenido actual
        adminMenu.innerHTML = '';

        // Header: botón volver + título
        const headerBar = document.createElement('div');
        headerBar.className = 'd-flex align-items-center mb-3';

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn btn-sm btn-back';
        backBtn.title = 'Volver';
        backBtn.innerHTML = '&#8592; Volver';
        backBtn.addEventListener('click', function(){
            try {
                // Preferir la función de volver del mismo fichero si existe
                if (typeof crearMenuAdministrador === 'function') {
                    crearMenuAdministrador();
                    return;
                }
            } catch(e){}
            // Respaldo: intentar reconstruir el menú principal con el módulo si existe
            if (window && typeof window.crearMenuPrincipalAdmin === 'function') {
                try { window.crearMenuPrincipalAdmin(adminMenu); return; } catch(e){}
            }
            // Si todo falla, recargar la página
            window.location.reload();
        });

        const title = document.createElement('h5');
        title.className = 'm-0 ms-2';
        title.textContent = 'Trimestres';

        headerBar.appendChild(backBtn);
        headerBar.appendChild(title);
        adminMenu.appendChild(headerBar);

        // Menu de acciones (header) + selector de año para filtrar la tabla
        const menuBar = document.createElement('div');
        menuBar.className = 'd-flex align-items-center justify-content-between mb-3';

        const actionsLeft = document.createElement('div');
        actionsLeft.className = 'd-flex flex-wrap';
        const actions = [
            { id: 'nuevo-trimestre', label: 'Nuevo trimestre', handler: 'nuevoTrimestre' },
            { id: 'cargar-planeacion', label: 'Cargar planeación de grupos', handler: 'cargarPlaneacionGrupos' },
            { id: 'hist-programacion', label: 'Menú de programación', handler: 'historialProgramacion' },
            { id: 'hist-preferencias', label: 'Menú de preferencias', handler: 'historialPreferencias' },
            { id: 'menu-trimestres', label: 'Menú de trimestres', handler: 'refrescarTrimestres' }
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = a.id;
            btn.className = 'btn btn-primary btn-sm me-2 mb-2';
            btn.textContent = a.label;
            btn.addEventListener('click', function(){
                if (window && typeof window[a.handler] === 'function') {
                    try { window[a.handler](); } catch (err) { console.error('Error ejecutando el manejador', a.handler, err); swalAlertOpt('Error', 'Error al ejecutar: ' + a.label, 'error'); }
                } else {
                    var msg = 'Funcionalidad "' + a.label + '" no implementada en este entorno.';
                    swalAlertOpt(a.label, msg, 'info');
                }
            });
            actionsLeft.appendChild(btn);
        });

        // Selector de año
        const rightTools = document.createElement('div');
        rightTools.className = 'd-flex align-items-center';
        const anioLabel = document.createElement('label'); anioLabel.className = 'me-2 mb-0'; anioLabel.textContent = 'Año:';
        const selectAnioFilter = document.createElement('select'); selectAnioFilter.className = 'form-select form-select-sm trimestres-filter-select'; selectAnioFilter.style.width = '120px';
        // Poblar años
        (function(){
            // Opción inicial para ver todos los trimestres (seleccionada por defecto)
            const oAll = document.createElement('option'); oAll.value = 'todos'; oAll.textContent = 'Todos'; oAll.selected = true;
            selectAnioFilter.appendChild(oAll);
            const t = new Date(); const cy = t.getFullYear();
            for (let y = cy - 2; y <= cy + 2; y++){
                const o = document.createElement('option'); o.value = String(y); o.textContent = String(y);
                // No seleccionar el año actual por defecto: dejar que 'Todos' permanezca seleccionado
                selectAnioFilter.appendChild(o);
            }
        })();
    // year label moved into the yearMenu below

    menuBar.appendChild(actionsLeft);
    menuBar.appendChild(rightTools);
    adminMenu.appendChild(menuBar);

    // Añadir menú de filtro de año encima de la tabla de trimestres
    var yearMenu = document.createElement('div');
    yearMenu.className = 'd-flex align-items-center justify-content-start mb-2';
    var yearLabelClone = document.createElement('label'); yearLabelClone.className = 'me-2 mb-0'; yearLabelClone.textContent = 'Año:';
    // Mover el select existente al nuevo menú (evita duplicados)
    yearMenu.appendChild(yearLabelClone);
    yearMenu.appendChild(selectAnioFilter);

        // Contenedor para la tabla de trimestres
        const tableCard = document.createElement('div'); tableCard.className = 'card';
        const tableBody = document.createElement('div'); tableBody.className = 'card-body';
    const tableContainer = document.createElement('div'); tableContainer.id = 'trimestres-table-container';
    tableBody.appendChild(tableContainer);
    // Insertar aquí el menú de filtro de año dentro del contenedor de la tabla
    try { if (typeof yearMenu !== 'undefined' && yearMenu) { tableContainer.appendChild(yearMenu); } } catch(e) { console.warn('No se pudo mover yearMenu dentro de tableContainer:', e); }
        tableCard.appendChild(tableBody);
        adminMenu.appendChild(tableCard);

        // Estado local para filas, orden y cache de estados de trimestre (id <-> nombre)
        let currentRows = [];
        let estadosMapByName = {}; // nombre normalizado -> id
        let estadosMapById = {}; // id -> nombre

        // Normalizar texto de estado: quitar acentos, múltiples espacios y pasar a minúsculas
        function _normState(s){
            try {
                if (!s && s !== 0) return '';
                // Normalizar unicode y quitar diacríticos
                var str = String(s);
                // Use NFD + regex to strip accents (compatible en browsers modernos)
                try { str = str.normalize('NFD').replace(/\p{Diacritic}/gu, ''); } catch(e){
                    // Fallback si no soporta \p{Diacritic}
                    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                }
                str = str.toLowerCase().replace(/\s+/g, ' ').trim();
                return str;
            } catch (e) { return String(s || '').toLowerCase(); }
        }

        // Cargar lista de estados desde servidor y poblar mapas (no bloqueante)
        function cargarEstadosServer(){
            if (typeof postForm !== 'function') return;
            try {
                postForm('controlador/recuperaTrimestreEstados.php', {})
                    .then(json => {
                        if (!json || !json.ok || !Array.isArray(json.estados)) return;
                        json.estados.forEach(e => {
                            var id = e.idTrimestreEstado || e.id || e.idTrimestreestado || e.id_trimestreestado;
                            var nombre = e.estado || e.nombre || String(e);
                            if (!id) return;
                            var key = String(nombre).trim().toLowerCase();
                            estadosMapByName[key] = Number(id);
                            estadosMapById[Number(id)] = nombre;
                        });
                }).catch(err => { console.warn('No se pudieron obtener estados:', err); });
            } catch(e) { console.warn('Error al solicitar estados:', e); }
        }

        // Ejecutar carga inicial de estados
        cargarEstadosServer();
        let sortState = { col: null, asc: true };

        function formatDateDisplay(d){ if(!d) return '-'; return d; }

        // Mostrar lista de profesores para un trimestre con filtro y buscador
        function mostrarProfesoresTrimestre(idTrimestre, trimestreRow){
            var container = tableContainer;
            container.innerHTML = '';

            // Encabezado con volver y título
            var header = document.createElement('div'); header.className = 'd-flex align-items-center mb-2';
            var backBtn = document.createElement('button'); backBtn.type='button'; backBtn.className='btn btn-sm btn-secondary me-2'; backBtn.textContent='← Volver a trimestres';
            backBtn.addEventListener('click', function(){ try { cargarTrimestresParaAnio(selectAnioFilter.value); } catch(e){} });
            header.appendChild(backBtn);
            var title = document.createElement('h5'); title.className='m-0';
            title.textContent = 'Profesores - ' + ( (trimestreRow && (trimestreRow.periodoNombre || trimestreRow.sigla)) ? (trimestreRow.periodoNombre || trimestreRow.sigla) + ' ' + (trimestreRow.año || trimestreRow.anio || '') : ('Trimestre ' + idTrimestre) );
            header.appendChild(title);
            container.appendChild(header);

            // Barra de herramientas superior: Importar (sin acción), Filtro, Buscador
            var tools = document.createElement('div'); tools.className = 'd-flex flex-wrap align-items-center gap-2 mb-2';
            var btnImport = document.createElement('button'); btnImport.type='button'; btnImport.className='btn btn-outline-primary btn-sm'; btnImport.textContent='Importar'; btnImport.title = 'Importar profesores (ECO.)';
            // Abrir modal para importar Excel con columna ECO.
            btnImport.addEventListener('click', function(){
                // eliminar modal previo si existe
                var existing = document.getElementById('modalImportarEcos'); if (existing) existing.parentNode.removeChild(existing);
                var modal = document.createElement('div'); modal.id='modalImportarEcos'; modal.className='modal fade'; modal.tabIndex=-1; modal.setAttribute('role','dialog');
                var dialog = document.createElement('div'); dialog.className='modal-dialog'; var content = document.createElement('div'); content.className='modal-content';
                var header = document.createElement('div'); header.className='modal-header'; var h5=document.createElement('h5'); h5.className='modal-title'; h5.textContent='Importar profesores (ECO.)'; var btnC=document.createElement('button'); btnC.type='button'; btnC.className='btn-close'; btnC.setAttribute('data-bs-dismiss','modal'); header.appendChild(h5); header.appendChild(btnC);
                var body = document.createElement('div'); body.className='modal-body';
                var form = document.createElement('form'); form.id='formImportarEcos';
                var g1 = document.createElement('div'); g1.className='mb-3'; var l1=document.createElement('label'); l1.className='form-label'; l1.textContent='Archivo Excel (.xls/.xlsx)'; var inp = document.createElement('input'); inp.type='file'; inp.accept='.xls,.xlsx'; inp.className='form-control'; inp.name='excelFile'; g1.appendChild(l1); g1.appendChild(inp);
                var info = document.createElement('div'); info.className='form-text small text-muted'; info.innerHTML='El archivo debe contener una columna <code>ECO.</code> con los números económicos a activar en este trimestre. Los no listados quedarán <strong>fuera del trimestre</strong>.';
                form.appendChild(g1); form.appendChild(info); body.appendChild(form);
                var footer = document.createElement('div'); footer.className='modal-footer'; var btnCancel = document.createElement('button'); btnCancel.type='button'; btnCancel.className='btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss','modal'); btnCancel.textContent='Cancelar'; var btnUpload=document.createElement('button'); btnUpload.type='button'; btnUpload.className='btn btn-primary'; btnUpload.textContent='Subir y procesar'; btnUpload.disabled=true; footer.appendChild(btnCancel); footer.appendChild(btnUpload);
                content.appendChild(header); content.appendChild(body); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                var bs; try { bs = new bootstrap.Modal(modal); bs.show(); } catch(e){ modal.style.display='block'; }

                inp.addEventListener('change', function(){ btnUpload.disabled = !(inp.files && inp.files[0]); });

                // helper: abrir modal de registro (reusa el formulario global si existe)
                function abrirRegistroPrefill(eco, correo){
                    try {
                        if (typeof window.mostrarModalNuevoProfesor === 'function') {
                            window.mostrarModalNuevoProfesor();
                            setTimeout(function(){
                                try{
                                    var fm = document.getElementById('formNuevoProfesor');
                                    var iEco = fm.querySelector('input[name="numeroEconomico"]'); if (iEco) { iEco.value = String(eco||''); }
                                    var iCorreo = fm.querySelector('input[name="correo_uam"]'); if (iCorreo) { iCorreo.value = (correo && String(correo).includes('@')) ? correo : (String(eco||'') + '@azc.uam.mx'); }
                                } catch(err) { console.warn('No se pudo prellenar el formulario', err); }
                            }, 300);
                        }
                    } catch (e) { console.warn('Formulario global no disponible', e); }
                }

                // helper: mostrar lista de faltantes con acción Registrar
                function showMissingModal(missing){
                    var mid = 'modalMissingEcos'; var ex = document.getElementById(mid); if (ex) ex.parentNode.removeChild(ex);
                    var m = document.createElement('div'); m.id=mid; m.className='modal fade'; m.tabIndex=-1; m.setAttribute('role','dialog');
                    var d = document.createElement('div'); d.className='modal-dialog modal-lg'; var c = document.createElement('div'); c.className='modal-content';
                    var hh = document.createElement('div'); hh.className='modal-header'; var tt=document.createElement('h5'); tt.className='modal-title'; tt.textContent='Profesores faltantes'; var x=document.createElement('button'); x.type='button'; x.className='btn-close'; x.setAttribute('data-bs-dismiss','modal'); hh.appendChild(tt); hh.appendChild(x);
                    var bb = document.createElement('div'); bb.className='modal-body';
                    var p = document.createElement('p'); p.className='text-muted'; p.textContent = 'Los siguientes números económicos no existen en la tabla profesor. Regístrelos para poder activarlos en el trimestre:'; bb.appendChild(p);
                    var tbl = document.createElement('table'); tbl.className='table table-sm'; var thead=document.createElement('thead'); var trh=document.createElement('tr'); ['ECO.','Correo sugerido','Acción'].forEach(function(h){ var th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }); thead.appendChild(trh); tbl.appendChild(thead); var tbody=document.createElement('tbody');
                    (missing||[]).forEach(function(it){ var tr=document.createElement('tr'); var td1=document.createElement('td'); td1.textContent = it.eco || ''; var td2=document.createElement('td'); td2.textContent = it.correo_sugerido || (String(it.eco||'') + '@azc.uam.mx'); var td3=document.createElement('td'); var b=document.createElement('button'); b.type='button'; b.className='btn btn-outline-primary btn-sm'; b.textContent='Registrar'; b.addEventListener('click', function(){ abrirRegistroPrefill(it.eco, it.correo_sugerido); }); td3.appendChild(b); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tbody.appendChild(tr); });
                    tbl.appendChild(tbody); bb.appendChild(tbl);
                    var ff = document.createElement('div'); ff.className='modal-footer'; var bc=document.createElement('button'); bc.type='button'; bc.className='btn btn-secondary'; bc.setAttribute('data-bs-dismiss','modal'); bc.textContent='Cerrar'; var br=document.createElement('button'); br.type='button'; br.className='btn btn-primary'; br.textContent='Refrescar vista';
                    br.addEventListener('click', function(){
                        try {
                            if (typeof fetchProfes === 'function'){
                                fetchProfes().then(function(j){
                                    if (j && j.ok && Array.isArray(j.profesores)){
                                        profesores = j.profesores;
                                        try { applyFilterAndRender(); } catch(e){}
                                    }
                                }).catch(function(_e){});
                            }
                        } catch(e){}
                        try { var inst = bootstrap.Modal.getInstance(m); if(inst) inst.hide(); else m.style.display='none'; } catch(e){}
                    }); ff.appendChild(bc); ff.appendChild(br);
                    c.appendChild(hh); c.appendChild(bb); c.appendChild(ff); d.appendChild(c); m.appendChild(d); document.body.appendChild(m);
                    try { var bsm = new bootstrap.Modal(m); bsm.show(); } catch(e){ m.style.display='block'; }
                }

                btnUpload.addEventListener('click', function(){
                    var file = inp.files && inp.files[0]; if (!file) { if (window.Swal) Swal.fire('Error','Seleccione un archivo','error'); else alert('Seleccione un archivo'); return; }
                    btnUpload.disabled = true;
                    var fd = new FormData(); fd.append('idTrimestre', String(idTrimestre)); fd.append('excelFile', file);
                    // Promesa de subida y procesamiento
                    fetch('controlador/procesarImportarProfesores.php', { method: 'POST', body: fd })
                    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
                    .then(function(json){
                        if (!json || !json.ok){ throw new Error(json && json.error ? json.error : 'Error al procesar importación'); }
                        try { var inst = bootstrap.Modal.getInstance(modal); if (inst) inst.hide(); else modal.style.display='none'; } catch(e){}
                        var stats = json.stats || {};
                        var txt = 'Activados: ' + (stats.updated_estado_1||0) + ', Insertados: ' + (stats.inserted_disposicion||0) + ', Desactivados: ' + (stats.updated_estado_0||0);
                        if (window.Swal) Swal.fire('Importación completa', txt, 'success'); else alert('Importación completa\n' + txt);
                        // refrescar tabla: re-fetch y repintar usando el helper local
                        try {
                            if (typeof fetchProfes === 'function'){
                                fetchProfes().then(function(j){
                                    if (j && j.ok && Array.isArray(j.profesores)){
                                        profesores = j.profesores;
                                        try { applyFilterAndRender(); } catch(e){}
                                    }
                                }).catch(function(_e){});
                            }
                        } catch(e){}
                        // manejar faltantes
                        if (Array.isArray(json.missing_profesores) && json.missing_profesores.length > 0){ showMissingModal(json.missing_profesores); }
                    })
                    .catch(function(err){ console.error('Error importar ECO:', err); if (window.Swal) Swal.fire('Error', err.message||'Error','error'); else alert('Error: '+(err.message||err)); })
                    .finally(function(){ btnUpload.disabled = false; });
                });
            });
            tools.appendChild(btnImport);

            var filterLabel = document.createElement('label'); filterLabel.className='ms-2 me-1 mb-0'; filterLabel.textContent='Mostrar: ';
            var selectFiltro = document.createElement('select'); selectFiltro.className='form-select form-select-sm'; selectFiltro.style.width='180px';
            [['todos','Todos'],['en','En el trimestre'],['no','No en el trimestre']].forEach(function(p){ var o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; selectFiltro.appendChild(o); });
            tools.appendChild(filterLabel); tools.appendChild(selectFiltro);

            var searchLabel = document.createElement('label'); searchLabel.className='ms-3 me-1 mb-0'; searchLabel.textContent='Buscar:';
            var searchInp = document.createElement('input'); searchInp.type='search'; searchInp.className='form-control form-control-sm'; searchInp.placeholder='Número o nombre'; searchInp.style.maxWidth='260px';
            tools.appendChild(searchLabel); tools.appendChild(searchInp);
            container.appendChild(tools);

            // Contenedor de tabla
            var tbl = document.createElement('table'); tbl.className='table table-sm table-striped';
            var thead = document.createElement('thead'); var trh = document.createElement('tr');
            ['No. Económico','Profesor','Estado'].forEach(function(h){ var th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
            thead.appendChild(trh); tbl.appendChild(thead);
            var tbody = document.createElement('tbody'); tbl.appendChild(tbody);
            container.appendChild(tbl);

            // Loader sencillo
            var loading = document.createElement('div'); loading.textContent = 'Cargando profesores...'; loading.className='text-muted'; container.appendChild(loading);

            // Estado local de profesores (se comparte entre helpers para permitir recargas)
            var profesores = [];

            // render helper con filtro + búsqueda (declarado en el scope de mostrarProfesoresTrimestre
            // para que pueda ser invocado desde los modales/fuentes externas como el modal de faltantes)
            function applyFilterAndRender(){
                try {
                    var q = String(searchInp.value || '').trim().toLowerCase();
                    var mode = selectFiltro.value; // 'todos'|'en'|'no'
                    tbody.innerHTML = '';
                    var frag = document.createDocumentFragment();
                    profesores.forEach(function(p){
                        try {
                            var match = true;
                            if (q) {
                                var ne = String(p.numeroEconomico || '').toLowerCase();
                                var nom = String(p.nombre || '').toLowerCase();
                                match = (ne.indexOf(q) !== -1) || (nom.indexOf(q) !== -1);
                            }
                            if (!match) return;
                            var en = (p.enTrimestre ? 1 : 0);
                            if (mode === 'en' && en !== 1) return;
                            if (mode === 'no' && en !== 0) return;

                            var tr = document.createElement('tr'); tr.dataset.idProfesor = String(p.idProfesor);
                            var tdNE = document.createElement('td'); tdNE.textContent = p.numeroEconomico || ''; tr.appendChild(tdNE);
                            var tdNom = document.createElement('td'); tdNom.textContent = p.nombre || ''; tr.appendChild(tdNom);
                            var tdToggle = document.createElement('td');
                            // switch estilo bootstrap
                            var wrapper = document.createElement('div'); wrapper.className='form-check form-switch switch-state';
                            var checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.className='form-check-input'; checkbox.role='switch'; checkbox.checked = !!en;
                            // color verde/rojo con clases utilitarias
                            function paintSwitch(){
                                wrapper.classList.toggle('switch-green', checkbox.checked);
                                wrapper.classList.toggle('switch-red', !checkbox.checked);
                            }
                            paintSwitch();
                            checkbox.addEventListener('change', function(){
                                var desired = checkbox.checked ? 1 : 0;
                                checkbox.disabled = true;
                                var payload = { idTrimestre: idTrimestre, idProfesor: p.idProfesor, incluir: desired };
                                var saveP = (typeof postForm === 'function') ? postForm('controlador/actualizarProfesorDisposicion.php', payload)
                                    : (function(){ var fd = new FormData(); fd.append('idTrimestre', idTrimestre); fd.append('idProfesor', p.idProfesor); fd.append('incluir', desired); return fetch('controlador/actualizarProfesorDisposicion.php', { method:'POST', body: fd }).then(function(r){ return r.json(); }); })();
                                saveP.then(function(res){
                                    if (res && res.ok) {
                                        p.enTrimestre = desired ? 1 : 0; paintSwitch();
                                    } else {
                                        var msg = (res && res.msg) ? res.msg : 'No se pudo actualizar';
                                        swalAlertOpt('Error', msg, 'error');
                                        // revertir UI
                                        checkbox.checked = !desired; paintSwitch();
                                    }
                                }).catch(function(err){ console.error('toggle dispo:', err); swalAlertOpt('Error','Error actualizando disposición','error'); checkbox.checked = !desired; paintSwitch(); })
                                .finally(function(){ checkbox.disabled = false; });
                            });
                            wrapper.appendChild(checkbox);
                            tdToggle.appendChild(wrapper);
                            tr.appendChild(tdToggle);
                            frag.appendChild(tr);
                        } catch(e){ /* skip row */ }
                    });
                    tbody.appendChild(frag);
                } catch(e) { console.error('applyFilterAndRender error:', e); }
            }

            function fetchProfes(){
                var payload = { idTrimestre: idTrimestre };
                var p = (typeof postForm === 'function') ? postForm('controlador/recuperarProfesoresTrimestre.php', payload)
                    : fetch('controlador/recuperarProfesoresTrimestre.php', { method:'POST', body:(function(){ var f=new FormData(); f.append('idTrimestre', idTrimestre); return f; })() }).then(function(r){ return r.json(); });
                return p;
            }

            fetchProfes().then(function(json){
                try { loading.remove(); } catch(_){ container.removeChild(loading); }
                if (!json || !json.ok) { swalAlertOpt('Error','No se pudieron recuperar profesores','error'); return; }
                profesores = Array.isArray(json.profesores) ? json.profesores : [];

                // listeners
                function debounce(fn, wait){ var t; return function(){ var a=arguments, c=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(c,a); }, wait); }; }
                searchInp.addEventListener('input', debounce(applyFilterAndRender, 180));
                selectFiltro.addEventListener('change', applyFilterAndRender);

                // primer render
                try { applyFilterAndRender(); } catch(e){ console.error('Error al renderizar profesores inicialmente:', e); }
            }).catch(function(err){ try { loading.remove(); } catch(_){ } console.error('Error recuperando profesores:', err); swalAlertOpt('Error','Error recuperando profesores','error'); });
        }

        // Mostrar editor de grupos para un trimestre: reemplaza la tabla de trimestres por la vista de edición
        function mostrarEditorGrupos(idTrimestre, trimestreRow) {
            // cargar datos desde el servidor
                // Usar únicamente la superposición local blanca (texto animado "Cargando").
                // Evitamos mostrar el spinner global de swal en este flujo.

                // Mostrar además una superposición local de spinner dentro del contenedor de trimestres
                // Esto muestra un indicador visible mientras se construye el contenido del editor.
                var spinnerOverlay = (function(){
                    try {
                        var cont = document.getElementById('trimestres-table-container');
                        // Adjuntaremos la superposición a document.body para cubrir toda la ventana.
                        // cont puede usarse para posicionamiento en otros flujos, pero la superposición será fija.
                        var ov = document.createElement('div');
                        // La clase define el diseño y la apariencia (en /css/styles.css)
                        ov.className = 'grupos-loader-overlay';
                        // Construir texto animado "Cargando" donde cada letra parpadea en secuencia
                        try {
                            // Estilos en /css/styles.css (ver .grupos-loader-overlay y .grupos-loader-text)
                            var txt = 'Cargando';
                            // construir nodos DOM en lugar de usar innerHTML
                            var textDiv = document.createElement('div');
                            textDiv.className = 'grupos-loader-text';
                            textDiv.setAttribute('aria-hidden', 'true');
                            for (var i = 0; i < txt.length; i++) {
                                var ch = txt.charAt(i);
                                if (ch === ' ') {
                                    var spacer = document.createElement('span');
                                    spacer.style.display = 'inline-block';
                                    spacer.style.width = '8px';
                                    textDiv.appendChild(spacer);
                                } else {
                                    var span = document.createElement('span');
                                    span.className = 'gr-ch';
                                    span.textContent = ch;
                                    // escalonar la animación usando delay en estilo en línea
                                    span.style.animation = 'grFlash 1.2s linear infinite';
                                    span.style.animationDelay = (i * 0.12) + 's';
                                    textDiv.appendChild(span);
                                }
                            }
                            ov.appendChild(textDiv);
                        } catch (e) {
                            ov.innerHTML = '<div class="grupos-loader-text">Cargando...</div>';
                        }
                        // Adjuntar al body para cubrir toda la pantalla
                        (document.body || document.documentElement).appendChild(ov);
                        return ov;
                    } catch (e) { console.warn('No se pudo mostrar spinner local:', e); return null; }
                })();

                var payload = { idTrimestre: idTrimestre };
                    // medir tiempos: total y fetch (comentados para evitar ruido en consola)
                    try {
                        // (instrumentación) if (console && console.time) { console.time('mostrarEditorGrupos_total'); console.time('fetch_recuperaGruposHorarios'); }
                    } catch(e){}
                    // usar la función auxiliar postForm si existe
                    var fetchPromise = (typeof postForm === 'function') ? postForm('controlador/recuperaGruposHorarios.php', payload) : fetch('controlador/recuperaGruposHorarios.php', { method: 'POST', body: (function(){ var f=new FormData(); f.append('idTrimestre', idTrimestre); return f; })() }).then(r => r.json());
            fetchPromise.then(function(json){
                // eliminar superposición local si está presente
                try { if (spinnerOverlay && spinnerOverlay.parentNode) spinnerOverlay.parentNode.removeChild(spinnerOverlay); } catch(e){}
                if (!json || !json.ok) { swalAlertOpt('Error','No se pudieron recuperar grupos','error'); return; }
                var grupos = Array.isArray(json.grupos) ? json.grupos : [];
                var horariosAll = Array.isArray(json.horarios) ? json.horarios : [];
                var hasProgramacion = !!json.hasProgramacion;
                // fetch completed, stop fetch timer and start render timer (comentado)
                try { 
                    // (instrumentación) if (console && console.timeEnd) { console.timeEnd('fetch_recuperaGruposHorarios'); console.time('render_mostrarEditorGrupos'); }
                } catch(e){}

                // Construir vista de edición
                var container = tableContainer;
                container.innerHTML = '';

                var headerCard = document.createElement('div'); headerCard.className = 'd-flex align-items-center mb-2';
                var backBtn = document.createElement('button'); backBtn.type='button'; backBtn.className='btn btn-sm btn-secondary me-2'; backBtn.textContent='← Volver a trimestres';
                backBtn.addEventListener('click', function(){ cargarTrimestresParaAnio(selectAnioFilter.value); });
                headerCard.appendChild(backBtn);
                var title = document.createElement('h5'); title.className='m-0'; title.textContent = 'Editar grupos - ' + ( (trimestreRow && (trimestreRow.periodoNombre || trimestreRow.sigla)) ? (trimestreRow.periodoNombre || trimestreRow.sigla) + ' ' + (trimestreRow.año || trimestreRow.anio || '') : ('Trimestre ' + idTrimestre) );
                headerCard.appendChild(title);
                container.appendChild(headerCard);

                // Control de búsqueda para UEA (por nombre o clave)
                var searchRow = document.createElement('div');
                searchRow.className = 'd-flex align-items-center mb-2';
                var searchLabel = document.createElement('label'); searchLabel.className = 'me-2 mb-0'; searchLabel.textContent = 'Buscar UEA:';
                var searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.className = 'form-control form-control-sm'; searchInput.style.maxWidth = '320px'; searchInput.placeholder = 'Clave o nombre de la UEA';
                searchRow.appendChild(searchLabel); searchRow.appendChild(searchInput);
                container.appendChild(searchRow);

                // Construir la tabla
                var tbl = document.createElement('table'); tbl.className='table table-sm table-striped';
                var thead = document.createElement('thead'); var trh = document.createElement('tr');
                // Encabezados: usar nombres completos de días y añadir un icono de edición sólo en los th correspondientes
                var headerCols = hasProgramacion
                    ? ['UEA','GRUPO','CM','SALÓN','Económico','Profesor','Lunes','Martes','Miércoles','Jueves','Viernes']
                    : ['UEA','GRUPO','CM','SALÓN','Lunes','Martes','Miércoles','Jueves','Viernes'];
                headerCols.forEach(function(h){ 
                    var th = document.createElement('th'); 
                    th.textContent = h; 
                    // si es columna de día o la columna GRUPO, agregar un icono pequeño en el th para indicar que es editable
                    if (['GRUPO','Lunes','Martes','Miércoles','Jueves','Viernes'].indexOf(h) !== -1) {
                        var ic = document.createElement('span');
                        ic.className = 'grupo-horario-edit-icon header';
                        ic.setAttribute('aria-hidden','true');
                        ic.title = 'Editar';
                        ic.textContent = '✎';
                        // dejar un pequeño espacio antes del icono
                        th.appendChild(document.createTextNode(' '));
                        th.appendChild(ic);
                        // marcar la columna como 'grupo-col' para controlar estilos desde CSS
                        try { if (h === 'GRUPO') th.classList.add('grupo-col'); } catch(e){}
                    }
                    trh.appendChild(th); 
                });
                thead.appendChild(trh); tbl.appendChild(thead);
                var tbody = document.createElement('tbody');

                // Función auxiliar: obtener el id de horario actual para un grupo y día
                function horarioActualIdParaDia(grHorarioArr, dayPrefix) {
                    if (!Array.isArray(grHorarioArr)) return '';
                    for (var i=0;i<grHorarioArr.length;i++){
                        var hh = grHorarioArr[i]; if (!hh || !hh.dia) continue;
                        var d = String(hh.dia).toLowerCase(); if (d.indexOf(dayPrefix) === 0) return hh.idHorario || '';
                    }
                    return '';
                }

                // Pre-index horarios por día para poblar selects
                var horariosPorDia = { 'lu': [], 'ma': [], 'mi': [], 'ju': [], 'vi': [] };
                horariosAll.forEach(function(h){ try { var d = String(h.dia||'').toLowerCase(); if (d.indexOf('lu')===0 || d.indexOf('lunes')===0) horariosPorDia['lu'].push(h);
                    else if (d.indexOf('ma')===0 || d.indexOf('martes')===0) horariosPorDia['ma'].push(h);
                    else if (d.indexOf('mi')===0 || d.indexOf('mier')===0 || d.indexOf('miercoles')===0) horariosPorDia['mi'].push(h);
                    else if (d.indexOf('ju')===0 || d.indexOf('jueves')===0) horariosPorDia['ju'].push(h);
                    else if (d.indexOf('vi')===0 || d.indexOf('viernes')===0) horariosPorDia['vi'].push(h);
                } catch(e){} });

                // Construir plantillas de select por día y reusarlas clonándolas (evita crear opciones por fila)
                // prefijo usado para buscar horarios (lu, ma, mi, ju, vi) y etiqueta visible (nombre completo)
                var diasArr = [ ['lu','Lunes'], ['ma','Martes'], ['mi','Miércoles'], ['ju','Jueves'], ['vi','Viernes'] ];
                var selectTemplates = {};
                diasArr.forEach(function(dpair){
                    var prefix = dpair[0];
                    var tpl = document.createElement('select'); tpl.className = 'form-select form-select-sm';
                    var optEmpty = document.createElement('option'); optEmpty.value = ''; optEmpty.textContent = '(ninguno)'; tpl.appendChild(optEmpty);
                    var list = horariosPorDia[prefix] || [];
                    for (var i=0;i<list.length;i++){
                        var h = list[i];
                        var o = document.createElement('option'); o.value = String(h.idHorario); o.textContent = (h.horaInicio||'') + ' - ' + (h.horaFin||''); tpl.appendChild(o);
                    }
                    selectTemplates[prefix] = tpl;
                });
                // Construir filas en un DocumentFragment para minimizar reflows
                // También preparar un mapa groupsById para búsquedas O(1) usado por el editor en línea
                var groupsById = {};
                try { if (Array.isArray(grupos)) { grupos.forEach(function(g){ if (g && g.idGrupo !== undefined) groupsById[String(g.idGrupo)] = g; }); } } catch(e) {}

                var fragment = document.createDocumentFragment();
                grupos.forEach(function(g){
                    var tr = document.createElement('tr');
                    // almacenar idGrupo en la fila para eventos delegados
                    try { if (g && g.idGrupo !== undefined) tr.dataset.idGrupo = String(g.idGrupo); } catch(e) {}
                    // atributos data para búsqueda rápida en el cliente
                    try {
                        var ueaName = (g.uea && g.uea.nombreUEA) ? String(g.uea.nombreUEA).toLowerCase() : '';
                        var ueaClave = (g.uea && g.uea.claveUEA) ? String(g.uea.claveUEA).toLowerCase() : '';
                        tr.dataset.ueaName = ueaName;
                        tr.dataset.ueaClave = ueaClave;
                    } catch(e) { /* ignore */ }
                    var tdU = document.createElement('td'); tdU.textContent = (g.uea && g.uea.claveUEA ? g.uea.claveUEA + ' - ' + g.uea.nombreUEA : '-'); tr.appendChild(tdU);
                    var tdG = document.createElement('td');
                    // marcar la celda del grupo para estilos (ancho y nowrap) desde CSS
                    try { tdG.classList.add('grupo-col'); } catch(e){}
                    // Hacer editable el nombre del grupo: clic -> input en línea, Enter/blur guarda, Escape cancela
                    (function(tdG, g){
                        var spanGrp = document.createElement('span'); spanGrp.className = 'grupo-nombre-display'; spanGrp.textContent = g.claveGrupo || '';
                        tdG.appendChild(spanGrp);

                        tdG.addEventListener('click', function onTdClick(e){
                            try {
                                // evitar crear múltiples inputs si ya existe uno
                                if (tdG.querySelector('input')) return;
                                var orig = spanGrp.textContent || '';
                                var inp = document.createElement('input');
                                inp.type = 'text'; inp.className = 'form-control form-control-sm'; inp.value = orig;
                                // reemplazar contenido por el input
                                tdG.innerHTML = ''; tdG.appendChild(inp);
                                inp.focus(); inp.select();

                                function restore(){ tdG.innerHTML = ''; tdG.appendChild(spanGrp); }

                                function save(){
                                    var newVal = String(inp.value || '').trim();
                                    if (newVal === orig) { restore(); return; }
                                    if (!newVal) { try { swalAlertOpt('Error','El nombre del grupo no puede quedar vacío','error'); } catch(e){}; inp.focus(); return; }
                                    // construir payload y enviar al servidor
                                    var payloadObj = { idGrupo: g.idGrupo, claveGrupo: newVal };
                                    var savePromise;
                                    if (typeof postForm === 'function') {
                                        // postForm espera un objeto plano y devuelve promesa que resuelve JSON
                                        savePromise = postForm('controlador/actualizarGrupo.php', payloadObj);
                                    } else {
                                        var fd = new FormData(); fd.append('idGrupo', g.idGrupo); fd.append('claveGrupo', newVal);
                                        savePromise = fetch('controlador/actualizarGrupo.php', { method: 'POST', body: fd }).then(function(r){ return r.json().catch(function(){ return { ok:false, msg:'Respuesta inválida' }; }); });
                                    }
                                    // deshabilitar input durante guardado
                                    inp.disabled = true;
                                    savePromise.then(function(res){
                                        if (res && res.ok) {
                                            try { g.claveGrupo = newVal; groupsById[String(g.idGrupo)] = g; } catch(e){}
                                            spanGrp.textContent = newVal;
                                            restore();
                                        } else {
                                            var msg = (res && res.msg) ? res.msg : JSON.stringify(res);
                                            try { swalAlertOpt('Error','No se pudo actualizar grupo: ' + msg,'error'); } catch(e) { console.error('Error actualizar grupo:', msg); }
                                            restore();
                                        }
                                    }).catch(function(err){ console.error('Error actualizar grupo:', err); try { swalAlertOpt('Error','Error al actualizar grupo','error'); } catch(e){}; restore(); })
                                    .finally(function(){ try { inp.disabled = false; } catch(e){} });
                                }

                                inp.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' || ev.key === 'Esc') { ev.preventDefault(); restore(); } else if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
                                inp.addEventListener('blur', function(){ setTimeout(save, 120); });
                            } catch(e){ console.error('Error al editar nombre de grupo:', e); }
                        });
                    })(tdG, g);
                    tr.appendChild(tdG);
                    var tdC = document.createElement('td'); tdC.textContent = g.cupo || ''; tr.appendChild(tdC);
                    var tdS = document.createElement('td'); tdS.textContent = g.salon || ''; tr.appendChild(tdS);

                    // Si hay programación, agregar columnas Económico y Profesor
                    if (hasProgramacion) {
                        var tdEco = document.createElement('td');
                        var tdProf = document.createElement('td');
                        var prof = g && g.profesor ? g.profesor : null;
                        tdEco.textContent = prof && prof.numeroEconomico != null ? String(prof.numeroEconomico) : '';
                        tdProf.textContent = prof && prof.nombre ? String(prof.nombre) : '';
                        tr.appendChild(tdEco);
                        tr.appendChild(tdProf);
                    }

                    // Para cada día crear una celda de visualización que se convierta en un selector en línea bajo demanda
                    diasArr.forEach(function(dpair){
                        var prefix = dpair[0]; var label = dpair[1];
                        var td = document.createElement('td');
                        // determinar id de horario actual y texto de visualización
                        var cur = horarioActualIdParaDia(g.horarios, prefix);
                        var displayText = '';
                        if (cur) {
                            try {
                                var hinfo = (horariosAll || []).find(function(hh){ return String(hh.idHorario) === String(cur); });
                                if (hinfo) displayText = (hinfo.horaInicio || '') + ' - ' + (hinfo.horaFin || '');
                                else displayText = String(cur);
                            } catch(e) { displayText = String(cur); }
                        }
                            // celda: visualización + icono de edición. Clic en cualquier parte abre el selector en línea
                            var cell = document.createElement('span'); cell.className = 'grupo-horario-cell';
                            var spanDisplay = document.createElement('span'); spanDisplay.className = 'grupo-horario-display'; spanDisplay.textContent = displayText || '(ninguno)';
                            // mostrar sólo la visualización aquí; el icono de edición ahora está en el encabezado
                            cell.appendChild(spanDisplay);
                            // clic -> reemplazar la celda por un selector clonado desde la plantilla
                            (function(td, cell, spanDisplay, prefix, label, g){
                                function attachClick(){
                                    cell.addEventListener('click', function onSpanClick(e){
                                    try {
                                        // crear select desde la plantilla
                                        var tpl = selectTemplates[prefix];
                                            var sel = tpl ? tpl.cloneNode(true) : document.createElement('select');
                                        sel.className = sel.className || 'form-select form-select-sm';
                                        sel.dataset.dia = label;
                                        // establecer el valor actual
                                            var curv = horarioActualIdParaDia(g.horarios, prefix);
                                            try { sel.value = curv ? String(curv) : ''; } catch(e){}
                                            // reemplazar la celda por el selector
                                            td.innerHTML = '';
                                            td.appendChild(sel);
                                            sel.focus();

                                        // manejar Escape para cancelar (restaurar span)
                                        sel.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' || ev.key === 'Esc') { ev.preventDefault(); td.innerHTML = ''; td.appendChild(cell); attachClick(); } });

                                        // cuando el selector pierde foco, restaurar el span con la visualización actualizada
                                        sel.addEventListener('blur', function(){
                                            // pequeño timeout para permitir que el evento 'change' se dispare y el manejador delegado actualice el modelo
                                            setTimeout(function(){
                                                var gref = groupsById[String(g.idGrupo)];
                                                var newCur = gref ? horarioActualIdParaDia(gref.horarios, prefix) : null;
                                                var newDisplay = '';
                                                if (newCur) {
                                                    try { var hh = (horariosAll || []).find(function(hh){ return String(hh.idHorario) === String(newCur); }); if (hh) newDisplay = (hh.horaInicio||'') + ' - ' + (hh.horaFin||''); else newDisplay = String(newCur); } catch(e) { newDisplay = String(newCur); }
                                                }
                                                spanDisplay.textContent = newDisplay || '(ninguno)';
                                                td.innerHTML = ''; td.appendChild(cell); attachClick();
                                            }, 150);
                                        }, { once: true });
                                    } catch(e){ console.error('Error creando select en línea:', e); }
                                }, { once: true });
                            }
                            attachClick();
                        })(td, cell, spanDisplay, prefix, label, g);

                        td.appendChild(cell);
                        tr.appendChild(td);
                    });

                    fragment.appendChild(tr);
                });

                tbody.appendChild(fragment);

                // Construir un mapa idGrupo -> grupo para búsquedas O(1) (evita usar groups.find en los manejadores)
                var groupsById = {};
                try { if (Array.isArray(grupos)) { grupos.forEach(function(g){ if (g && g.idGrupo !== undefined) groupsById[String(g.idGrupo)] = g; }); } } catch(e) {}

                // Manejador delegado para cambios en selectores (un solo manejador en vez de uno por selector)
                try {
                    tbody.addEventListener('change', function(e){
                        var target = e.target;
                        if (!target || String(target.tagName).toLowerCase() !== 'select') return;
                        var tr = target.closest('tr'); if (!tr) return;
                        var idGrupo = tr.dataset.idGrupo || '';
                        var dia = target.dataset.dia || '';
                        var newVal = target.value || '';
                        var prevDisabled = target.disabled;
                        target.disabled = true;
                        var fd = new FormData(); fd.append('idGrupo', idGrupo); fd.append('dia', dia); fd.append('idHorario', newVal);
                        fetch('controlador/actualizarHorarioGrupo.php', { method: 'POST', body: fd })
                        .then(function(resp){ return resp.json().catch(function(){ return { ok:false, msg:'Respuesta inválida' }; }); })
                        .then(function(r){
                            if (r && r.ok) {
                                // actualizar el modelo local si está disponible usando búsqueda O(1)
                                try {
                                    var gref = groupsById[String(idGrupo)];
                                    if (gref) {
                                        // eliminar cualquier horario del mismo día
                                        gref.horarios = (gref.horarios || []).filter(function(x){ return !(x.dia && String(x.dia).toLowerCase().indexOf(dia.toLowerCase()) === 0); });
                                        if (newVal) {
                                            var hinfo = (horariosAll || []).find(function(hh){ return String(hh.idHorario) === String(newVal); });
                                            if (hinfo) gref.horarios.push({ idHorario: Number(hinfo.idHorario), dia: hinfo.dia, horaInicio: hinfo.horaInicio, horaFin: hinfo.horaFin });
                                        }
                                    }
                                } catch(e){}
                            } else {
                                try { swalAlertOpt('Error','No se pudo actualizar horario: ' + (r && r.msg ? r.msg : JSON.stringify(r)),'error'); } catch(e){}
                                // revertir selección usando el modelo local
                                try { var gref2 = groupsById[String(idGrupo)]; var prev = gref2 ? horarioActualIdParaDia(gref2.horarios, dia.toLowerCase().slice(0,2)) : ''; target.value = prev ? String(prev) : ''; } catch(e){}
                            }
                        }).catch(function(err){ console.error('Error actualizar horario:', err); try { swalAlertOpt('Error','Error al actualizar horario','error'); } catch(e){}; try { var gref2 = groupsById[String(idGrupo)]; var prev = gref2 ? horarioActualIdParaDia(gref2.horarios, dia.toLowerCase().slice(0,2)) : ''; target.value = prev ? String(prev) : ''; } catch(e){}; })
                        .finally(function(){ try { target.disabled = prevDisabled; } catch(e){} });
                    });
                } catch(e) { console.warn('No se pudo delegar el manejador en tbody:', e); }

                tbl.appendChild(tbody);
                container.appendChild(tbl);

                // render completo: parar timers (comentado)
                try { 
                    // (instrumentación) if (console && console.timeEnd) { console.timeEnd('render_mostrarEditorGrupos'); console.timeEnd('mostrarEditorGrupos_total'); }
                } catch(e){}

                // Conectar el input de búsqueda para filtrar filas por clave o nombre de UEA (con debounce)
                try {
                    function debounce(fn, wait){ var t; return function(){ var args = arguments; var ctx = this; clearTimeout(t); t = setTimeout(function(){ fn.apply(ctx, args); }, wait); }; }

                    var doFilter = function(){
                        var q = String(searchInput.value || '').trim().toLowerCase();
                        // iterate table rows
                        var rows = tbody.querySelectorAll('tr');
                        rows.forEach(function(row){
                            try {
                                var name = (row.dataset.ueaName || '').toLowerCase();
                                var clave = (row.dataset.ueaClave || '').toLowerCase();
                                var keep = false;
                                if (!q || q === '') keep = true;
                                else if (name.indexOf(q) !== -1) keep = true;
                                else if (clave.indexOf(q) !== -1) keep = true;
                                // escribir sólo cuando cambia el estado
                                var isHidden = row.style.display === 'none';
                                if (keep && isHidden) row.style.display = '';
                                else if (!keep && !isHidden) row.style.display = 'none';
                            } catch (e) { /* ignore row */ }
                        });
                    };

                    searchInput.addEventListener('input', debounce(doFilter, 180));
                } catch(e) { /* ignore */ }

            }).catch(function(err){
                try { if (spinnerOverlay && spinnerOverlay.parentNode) spinnerOverlay.parentNode.removeChild(spinnerOverlay); } catch(e){}
                console.error('Error recupera_grupos_horarios:', err);
                try {
                    // Instrumentación comentada intencionalmente para evitar ruido en la consola.
                    // (instrumentación) if (console && console.timeEnd) {
                    //     console.timeEnd('fetch_recuperaGruposHorarios');
                    //     console.timeEnd('render_mostrarEditorGrupos');
                    //     console.timeEnd('mostrarEditorGrupos_total');
                    // }
                } catch(e){}
                swalAlertOpt('Error','No se pudieron recuperar grupos y horarios','error');
            });
        }

        function renderTable(rows){
            currentRows = Array.isArray(rows) ? rows.slice() : [];
            // Aplicar orden
            if (sortState.col){
                currentRows.sort((a,b) => {
                    const va = a[sortState.col];
                    const vb = b[sortState.col];
                    if (va == vb) return 0;
                    if (sortState.col === 'fechaLimite') {
                        // comparar fechas
                        return sortState.asc ? (new Date(va) - new Date(vb)) : (new Date(vb) - new Date(va));
                    }
                    // numérico si es id o año
                    if (/id|año|anio|idTrimestre/i.test(sortState.col)) {
                        return sortState.asc ? (Number(va) - Number(vb)) : (Number(vb) - Number(va));
                    }
                    // string compare
                    return sortState.asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                });
            }

            // Construir tabla
            const tbl = document.createElement('table'); tbl.className = 'table table-striped table-sm';
            const thead = document.createElement('thead');
            const trh = document.createElement('tr');
            // Columnas: Periodo | Año | Fecha límite | Estado
            const cols = [
                { key: 'periodoNombre', label: 'Periodo' },
                { key: 'año', label: 'Año' },
                { key: 'fechaLimite', label: 'Fecha límite' },
                { key: 'trimestreEstado', label: 'Estado' }
            ];
            cols.forEach(c => {
                const th = document.createElement('th');
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'btn btn-link p-0'; btn.style.textDecoration = 'none';
                btn.textContent = c.label + (sortState.col === c.key ? (sortState.asc ? ' ▲' : ' ▼') : '');
                btn.addEventListener('click', function(){
                    if (sortState.col === c.key) sortState.asc = !sortState.asc; else { sortState.col = c.key; sortState.asc = true; }
                    renderTable(currentRows);
                });
                th.appendChild(btn);
                trh.appendChild(th);
            });
            var thAct = document.createElement('th'); thAct.textContent = 'Acciones'; trh.appendChild(thAct);
            thead.appendChild(trh);
            tbl.appendChild(thead);

            const tbody = document.createElement('tbody');
            if (!currentRows || currentRows.length === 0){
                const tr = document.createElement('tr');
                const td = document.createElement('td'); td.colSpan = cols.length + 1; td.textContent = 'No hay trimestres para el año seleccionado.'; tr.appendChild(td); tbody.appendChild(tr);
            } else {
                currentRows.forEach(r => {
                    const tr = document.createElement('tr');
                    // Periodo
                    const tdP = document.createElement('td'); tdP.textContent = r.periodoNombre || r.nombre || r.sigla || '';
                    tr.appendChild(tdP);
                    // Año
                    const tdA = document.createElement('td'); tdA.textContent = r.año || r.anio || r.year || '';
                    tr.appendChild(tdA);
                    // Fecha límite
                    const tdF = document.createElement('td');
                    tdF.textContent = formatDateDisplay(r.fechaLimite || r.fechaLim || '');
                    tr.appendChild(tdF);
                    // Estado (columna separada)
                    const tdE = document.createElement('td');
                    var estadoText = r.trimestreEstado || r.estado || r.trimestreestado || r.trimestre_estado || '';
                    if (estadoText) {
                        var badge = document.createElement('span');
                        badge.className = 'badge bg-secondary';
                        badge.textContent = estadoText;
                        tdE.appendChild(badge);
                    } else {
                        tdE.textContent = '';
                    }
                    tr.appendChild(tdE);
                    const tdAcc = document.createElement('td');
                    // Acciones: eliminar siempre, y acciones dependientes del estado
                    tdAcc.innerHTML = '';

                    // Función auxiliar para crear botones
                    function crearBtn(label, cls){
                        var b = document.createElement('button');
                        b.type = 'button';
                        b.className = 'btn btn-sm ' + (cls || 'btn-secondary') + ' me-1';
                        b.textContent = label;
                        return b;
                    }

                    // Eliminar (siempre disponible) - colocamos a la izquierda según petición
                    var btnDel = crearBtn('Eliminar', 'btn-danger');
                    btnDel.addEventListener('click', function(){
                        swalConfirmOpt('Eliminar', '¿Seguro que deseas eliminar este trimestre? Esta acción no se puede deshacer.', function(){
                            // llamar al controlador
                                postForm('controlador/eliminarTrimestre.php', { idTrimestre: r.idTrimestre })
                                .then(json => {
                                    if (json && json.ok) {
                                        // Construir mensaje detallado con los counts proporcionados por el servidor
                                        var details = [];
                                        if (json.disposiciones_eliminadas !== undefined) details.push(json.disposiciones_eliminadas + ' disposiciones');
                                        if (json.grupos_eliminados !== undefined) details.push(json.grupos_eliminados + ' grupos');
                                        if (json.programacion_eliminada !== undefined) details.push(json.programacion_eliminada + ' programaciones');
                                        if (json.preferencias_eliminadas !== undefined) details.push(json.preferencias_eliminadas + ' preferencias');
                                        var detailText = details.length > 0 ? ('\n\nDetalles: ' + details.join(', ')) : '';
                                        var msg = (json.msg || 'Trimestre eliminado') + detailText;
                                        // Mostrar en SweetAlert (usa el helper global)
                                        swalAlertOpt('Eliminado', msg, 'success')
                                        .then(function(){
                                            try{
                                                if (window && typeof window.refrescarTrimestres === 'function') {
                                                    window.refrescarTrimestres();
                                                }
                                            } catch(e){
                                                console.error('Error refrescando trimestres después de eliminar', e);
                                            }
                                        });
                                    } else {
                                        var errMsg = (json && (json.msg || json.error)) ? (json.msg || json.error) : JSON.stringify(json);
                                        swalAlertOpt('Error', 'No se pudo eliminar el trimestre: ' + errMsg, 'error');
                                    }
                                }).catch(err => { console.error('Error eliminarTrimestre:', err); swalAlertOpt('Error', 'Error al eliminar trimestre', 'error'); });
                        });
                    });
                    tdAcc.appendChild(btnDel);

                    // Botón para eliminar programación del trimestre (creado aquí para mostrarse junto a 'Eliminar')
                    var btnDeleteProg = crearBtn('Eliminar programación', 'btn-outline-danger');
                    btnDeleteProg.title = 'Eliminar toda la programación de este trimestre';
                    // oculto/inhabilitado por defecto hasta verificar si hay programación
                    btnDeleteProg.style.display = 'none';
                    btnDeleteProg.disabled = true;
                    tdAcc.appendChild(btnDeleteProg);

                    // Botón de Descargar programación (se habilita si hay grupos programados)
                    var btnExport = crearBtn('Descargar programación', 'btn-outline-success');
                    btnExport.title = 'Descargar programación de este trimestre en formato Excel/CSV';
                    // oculto por defecto: se mostrará sólo si la BD indica que existe programación
                    btnExport.style.display = 'none';
                    btnExport.disabled = true;
                    btnExport.addEventListener('click', function(){
                        // POST y descargar blob
                        var fd = new FormData(); fd.append('idTrimestre', r.idTrimestre);
                        fetch('controlador/exportar_programacion.php', { method: 'POST', body: fd })
                        .then(function(resp){
                            if (resp.status === 204) { swalAlertOpt('Info', 'No hay programación para exportar en este trimestre', 'info'); throw 'no-content'; }
                            if (!resp.ok) throw new Error('Error al generar archivo');
                            return resp.blob();
                        }).then(function(blob){
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            // Construir nombre de archivo: Programacion_<año>-<sigla>.xlsx
                            try {
                                var yearPart = String(r.año || r.anio || r.year || '').trim();
                                var siglaPart = String(r.sigla || r.periodoNombre || r.nombre || '').trim();
                                // si periodoNombre contiene la sigla entre paréntesis, intentar extraerla
                                if ((!siglaPart || siglaPart === '') && r.periodoNombre) {
                                    var m = String(r.periodoNombre).match(/\(([^)]+)\)/);
                                    if (m && m[1]) siglaPart = m[1].trim();
                                }
                                // respaldo a id si falta información
                                if (!yearPart) yearPart = String(r.idTrimestre || '');
                                if (!siglaPart) siglaPart = 'NA';
                                // sanitizar partes para filename (quitar caracteres no alfanuméricos salvo guión/underscore)
                                var safe = function(s){ return String(s).replace(/[^A-Za-z0-9\-_]/g, '_'); };
                                var filename = 'Programacion_' + safe(yearPart) + '-' + safe(siglaPart) + '.xlsx';
                                a.download = filename;
                            } catch (e) {
                                // respaldo simple
                                a.download = 'programacion_trimestre_' + (r.idTrimestre || '') + '.xlsx';
                            }
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
                        }).catch(function(err){ if (err === 'no-content') return; console.error('Error exportar programacion:', err); swalAlertOpt('Error','No se pudo descargar la programación','error'); });
                    });
                    tdAcc.appendChild(btnExport);

                    // Botón de Descargar preferencias (visible cuando el estado es 'Programacion de horarios')
                    var btnExportPrefs = crearBtn('Descargar preferencias', 'btn-outline-success');
                    btnExportPrefs.title = 'Descargar preferencias (profesores que las llenaron)';
                    btnExportPrefs.style.display = 'none';
                    btnExportPrefs.disabled = true;
                    btnExportPrefs.addEventListener('click', function(){
                        try {
                            // Usar SweetAlert para mostrar carga y promesas para gestionar flujo
                            if (typeof swalShowLoading === 'function') swalShowLoading('Generando archivo de preferencias...');
                            var fd = new FormData(); fd.append('idTrimestre', r.idTrimestre);
                            fetch('controlador/exportarPreferenciasTrimestre.php', { method: 'POST', body: fd })
                            .then(function(resp){
                                if (typeof swalClose === 'function') swalClose();
                                if (resp.status === 204) { return Promise.reject({ code: 'no-content' }); }
                                if (!resp.ok) return resp.text().then(function(t){ throw new Error(t || 'Error generando archivo'); });
                                return resp.blob();
                            })
                            .then(function(blob){
                                var url = URL.createObjectURL(blob);
                                var a = document.createElement('a'); a.href = url;
                                try {
                                    var yearPart = String(r.año || r.anio || r.year || '').trim();
                                    var siglaPart = String(r.sigla || r.periodoNombre || r.nombre || '').trim();
                                    if ((!siglaPart || siglaPart === '') && r.periodoNombre) {
                                        var m = String(r.periodoNombre).match(/\(([^)]+)\)/);
                                        if (m && m[1]) siglaPart = m[1].trim();
                                    }
                                    if (!yearPart) yearPart = String(r.idTrimestre || '');
                                    if (!siglaPart) siglaPart = 'NA';
                                    var safe = function(s){ return String(s).replace(/[^A-Za-z0-9\-_]/g, '_'); };
                                    var filename = 'Preferencias_' + safe(yearPart) + '-' + safe(siglaPart) + '.xlsx';
                                    a.download = filename;
                                } catch(e) { a.download = 'preferencias_trimestre_' + (r.idTrimestre || '') + '.xlsx'; }
                                document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
                            })
                            .catch(function(err){
                                if (err && err.code === 'no-content') {
                                    if (typeof swalAlertOpt === 'function') swalAlertOpt('Info','No hay preferencias para exportar en este trimestre','info');
                                    return;
                                }
                                console.error('Error exportar preferencias:', err);
                                if (typeof swalAlertOpt === 'function') {
                                    var msg = (err && err.message) ? err.message : String(err || 'Error desconocido');
                                    swalAlertOpt('Error','No se pudo descargar las preferencias: ' + msg,'error');
                                }
                            });
                        } catch(e) { console.error('Error manejando descarga de preferencias:', e); if (typeof swalAlertOpt === 'function') swalAlertOpt('Error','Error al iniciar descarga','error'); }
                    });
                    tdAcc.appendChild(btnExportPrefs);

                                    // Botón de Descargar horarios (cuando hay grupos pero no programación)
                                    var btnDownloadHorarios = crearBtn('Descargar horarios', 'btn-outline-primary');
                                    btnDownloadHorarios.title = 'Descargar horarios (grupos sin programación) de este trimestre';
                                    btnDownloadHorarios.style.display = 'none';
                                    btnDownloadHorarios.disabled = true;
                                    btnDownloadHorarios.addEventListener('click', function(){
                                        var fd = new FormData(); fd.append('idTrimestre', r.idTrimestre);
                                        fetch('controlador/exportarHorarios.php', { method: 'POST', body: fd })
                                        .then(function(resp){
                                            if (resp.status === 204) { swalAlertOpt('Info', 'No hay horarios para exportar en este trimestre', 'info'); throw 'no-content'; }
                                            if (!resp.ok) throw new Error('Error al generar archivo');
                                            return resp.blob();
                                        }).then(function(blob){
                                            var url = URL.createObjectURL(blob);
                                            var a = document.createElement('a'); a.href = url;
                                            try {
                                                var yearPart = String(r.año || r.anio || r.year || '').trim();
                                                var siglaPart = String(r.sigla || r.periodoNombre || r.nombre || '').trim();
                                                if ((!siglaPart || siglaPart === '') && r.periodoNombre) {
                                                    var m = String(r.periodoNombre).match(/\(([^)]+)\)/);
                                                    if (m && m[1]) siglaPart = m[1].trim();
                                                }
                                                if (!yearPart) yearPart = String(r.idTrimestre || '');
                                                if (!siglaPart) siglaPart = 'NA';
                                                var safe = function(s){ return String(s).replace(/[^A-Za-z0-9\-_]/g, '_'); };
                                                var filename = 'Horarios_' + safe(yearPart) + '-' + safe(siglaPart) + '.xlsx';
                                                a.download = filename;
                                            } catch(e) { a.download = 'horarios_trimestre_' + (r.idTrimestre || '') + '.xlsx'; }
                                            document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
                                        }).catch(function(err){ if (err === 'no-content') return; console.error('Error exportar horarios:', err); swalAlertOpt('Error','No se pudo descargar los horarios','error'); });
                                    });
                                    tdAcc.appendChild(btnDownloadHorarios);

                                    // Botón Editar grupos (mostrar si hay grupos cargados)
                                    var btnEditGroups = crearBtn('Editar grupos', 'btn-outline-primary');
                                    btnEditGroups.title = 'Editar grupos del trimestre';
                                    btnEditGroups.style.display = 'none';
                                    btnEditGroups.disabled = true;
                                    btnEditGroups.addEventListener('click', function(){
                                        try { mostrarEditorGrupos(r.idTrimestre, r); } catch(e){ console.error('Error abriendo editor de grupos', e); }
                                    });
                                    tdAcc.appendChild(btnEditGroups);

                                    // Si el estado numérico del trimestre es 1 -> mostrar botón "Reiniciar" que ponga estado = 3
                                    try {
                                        var estadoId = r.trimestreestado_idTrimestreEstado || r.trimestreEstadoId || r.estadoId || r.trimestreestado_id || null;
                                        if (estadoId !== null && Number(estadoId) === 1) {
                                            var btnRein = crearBtn('Reiniciar', 'btn-warning');
                                            btnRein.title = 'Reiniciar ciclo: poner estado a 3';
                                            btnRein.addEventListener('click', function(){
                                                swalConfirmOpt('Reiniciar', '¿Deseas reiniciar este trimestre y cambiar su estado a "3"? Esto puede afectar datos asociados.', function(){
                                                    var payload = { idTrimestre: r.idTrimestre, estadoId: 3 };
                                                    postForm('controlador/cambiarEstadoTrimestre.php', payload)
                                                    .then(function(json){
                                                        if (json && json.ok) {
                                                            swalAlertOpt('Hecho', 'Trimestre reiniciado', 'success')
                                                            .then(function(){ try{ if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){} });
                                                        } else {
                                                            var em = (json && (json.error || json.msg)) ? (json.error || json.msg) : JSON.stringify(json);
                                                            swalAlertOpt('Error', 'No se pudo reiniciar el trimestre: ' + em, 'error');
                                                        }
                                                    }).catch(function(err){ console.error('Error reiniciar trimestre:', err); swalAlertOpt('Error','Error al reiniciar trimestre','error'); });
                                                });
                                            });
                                            tdAcc.appendChild(btnRein);
                                        }
                                    } catch(e) { console.warn('No se pudo evaluar/Reiniciar botón para trimestre:', e); }

                    // Ver profesores disponibles (después)
                    var btnVerProf = crearBtn('Profesores', 'btn-primary');
                    btnVerProf.title = 'Ver profesores para este trimestre';
                    btnVerProf.addEventListener('click', function(){
                        try { mostrarProfesoresTrimestre(r.idTrimestre, r); } catch(e){ console.error('Error abriendo vista de profesores:', e); swalAlertOpt('Error','No se pudo abrir la vista de profesores','error'); }
                    });
                    tdAcc.appendChild(btnVerProf);

                        // Si el estado es 'Programacion de horarios' (normalizado) mostrar botón 'Programar'
                        try {
                            var estadoNormForProg = (String(estadoText||'')).normalize ? _normalizeState(estadoText||'') : String(estadoText||'').toLowerCase();
                            if (estadoNormForProg.indexOf('programacion') !== -1 && estadoNormForProg.indexOf('horario') !== -1) {
                                var btnProgramar = crearBtn('Programar', 'btn-success');
                                btnProgramar.title = 'Abrir pantalla de programación para este trimestre';
                                btnProgramar.addEventListener('click', function(){
                                    // Crear form y enviarlo por POST a programacion.php con idTrimestre
                                    // Además intentamos pasar el parámetro 'user' para evitar redirección al login.
                                    try {
                                        var form = document.createElement('form');
                                        form.method = 'POST';
                                        // Intentar obtener 'user' desde la query string o variables globales
                                        var user = null;
                                        try {
                                            var params = new URLSearchParams(window.location.search || '');
                                            user = params.get('user') || null;
                                        } catch(e) { user = null; }
                                        if (!user) {
                                            if (typeof window.currentUser !== 'undefined' && window.currentUser) user = window.currentUser;
                                            else if (typeof window.USER !== 'undefined' && window.USER) user = window.USER;
                                        }
                                        // Si encontramos user, añadimos como GET para compatibilidad y también lo mandamos por POST
                                        var actionUrl = 'programacion.php';
                                        if (user) actionUrl += '?user=' + encodeURIComponent(String(user));
                                        form.action = actionUrl;
                                        form.style.display = 'none';
                                        var inp = document.createElement('input'); inp.type = 'hidden'; inp.name = 'idTrimestre'; inp.value = r.idTrimestre || r.id || '';
                                        form.appendChild(inp);
                                        if (user) {
                                            var inpU = document.createElement('input'); inpU.type = 'hidden'; inpU.name = 'user'; inpU.value = String(user);
                                            form.appendChild(inpU);
                                        }
                                        document.body.appendChild(form);
                                        form.submit();
                                    } catch (e) { console.error('Error al redirigir a programacion.php', e); try { swalAlertOpt('Error','No se pudo abrir la programación','error'); } catch(_e) { alert('No se pudo abrir la programación'); } }
                                });
                                tdAcc.appendChild(btnProgramar);
                            }
                        } catch(e){ /* no crítico */ }

                        

                    // Normalizar nombre de estado: minusculas y sin diacríticos para comparaciones robustas
                    function _normalizeState(s){
                        try {
                            // NFD + remove diacritics (compatibilidad moderna)
                            return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
                        } catch(e){
                            // Fallback si normalize no está disponible
                            return String(s || '').toLowerCase().replace(/[\u0300-\u036f]/g, '').trim();
                        }
                    }
                    var estadoNorm = _normalizeState(estadoText || '');
                    // forma sin caracteres extra (solo a-z0-9 y espacios) y versión sin espacios para comparaciones compactas
                    var estadoKey = String(estadoNorm).replace(/[^a-z0-9 \-]/g, '').replace(/\s+/g, ' ').trim();
                    var estadoNoSpace = estadoKey.replace(/\s+/g, '');

                    // Consultar si hay programaciones para habilitar el botón de export y activar el botón de eliminar programación (no bloqueante)
                    try {
                        if (typeof postForm === 'function' && typeof btnExport !== 'undefined') {
                            postForm('controlador/contarProgramacionTrimestre.php', { idTrimestre: r.idTrimestre })
                            .then(function(j){ 
                    if (j && j.ok && j.count && Number(j.count) > 0) { 
                        // mostrar y habilitar el botón de export sólo cuando hay programación
                        try { btnExport.style.display = ''; } catch(e){}
                        btnExport.disabled = false;
                                    // Mostrar y habilitar el botón creado junto a 'Eliminar'
                                    try {
                                        btnDeleteProg.style.display = '';
                                        btnDeleteProg.disabled = false;
                                        // adjuntar el manejador sólo una vez
                                        if (!btnDeleteProg._listenerAttached) {
                                            btnDeleteProg.addEventListener('click', function(){
                                                swalConfirmOpt('Eliminar programación', '¿Deseas eliminar toda la programación de este trimestre? Esta acción no se puede deshacer.', function(){
                                                    postForm('controlador/eliminarProgramacionTrimestre.php', { idTrimestre: r.idTrimestre })
                                                    .then(function(resp){
                                                        if (resp && resp.ok) {
                                                            var msgParts = [];
                                                            if (resp.deleted_breakdown) {
                                                                var d = resp.deleted_breakdown;
                                                                msgParts.push('Programación rows: ' + (d.programacion || 0));
                                                                msgParts.push('Vínculos grupo_has_horario: ' + (d.grupo_has_horario || 0));
                                                                msgParts.push('Grupos: ' + (d.grupos || 0));
                                                            } else {
                                                                msgParts.push('Registros borrados: ' + (resp.deleted || 0));
                                                            }
                                                            swalAlertOpt('Eliminado', msgParts.join('\n'), 'success')
                                                            .then(function(){ try{ if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){} });
                                                            // deshabilitar botones de export/eliminar en esta fila
                                                            try { btnExport.disabled = true; btnDeleteProg.disabled = true; } catch(e){}
                                                        } else {
                                                            var err = resp && (resp.error || resp.msg) ? (resp.error || resp.msg) : JSON.stringify(resp);
                                                            swalAlertOpt('Error', 'No se pudo eliminar la programación: ' + err, 'error');
                                                        }
                                                    }).catch(function(err){ console.error('Error eliminar programacion:', err); swalAlertOpt('Error','Error al eliminar programación','error'); });
                                                });
                                            });
                                            btnDeleteProg._listenerAttached = true;
                                        }
                                    } catch(e) { console.warn('No se pudo habilitar el botón de eliminar programación:', e); }
                                } else {
                                    // ocultar el botón de export si no hay programación
                                    try { btnExport.style.display = 'none'; btnExport.disabled = true; } catch(e){}
                                    // si no hay programación, consultar si hay grupos para ofrecer descargar horarios
                                    try {
                                        postForm('controlador/contarGruposTrimestre.php', { idTrimestre: r.idTrimestre })
                                        .then(function(gj){
                                            if (gj && gj.ok && gj.count && Number(gj.count) > 0) {
                                                try { btnDownloadHorarios.style.display = ''; } catch(e){}
                                                btnDownloadHorarios.disabled = false;
                                            } else {
                                                try { btnDownloadHorarios.style.display = 'none'; btnDownloadHorarios.disabled = true; } catch(e){}
                                            }
                                        }).catch(function(err){ console.warn('No se pudo consultar grupos para mostrar Descargar horarios:', err); });
                                    } catch(e) { console.warn('Error consultando grupos para Descargar horarios:', e); }
                                }
                            })
                            .catch(function(e){ /* no crítico */ console.warn('No se pudo consultar programacion para export:', e); });
                        }
                    } catch(e) { console.warn('Error al consultar programacion para export:', e); }

                    // Consultar si hay grupos para mostrar el botón de editar grupos (no bloqueante)
                    try {
                        if (typeof postForm === 'function') {
                            postForm('controlador/contarGruposTrimestre.php', { idTrimestre: r.idTrimestre })
                            .then(function(gj){
                                if (gj && gj.ok && gj.count && Number(gj.count) > 0) {
                                    try { btnEditGroups.style.display = ''; } catch(e){}
                                    btnEditGroups.disabled = false;
                                } else {
                                    try { btnEditGroups.style.display = 'none'; btnEditGroups.disabled = true; } catch(e){}
                                }
                            }).catch(function(err){ console.warn('No se pudo consultar grupos para Editar grupos:', err); });
                        }
                    } catch(e) { console.warn('Error consultando grupos para Editar grupos:', e); }

                    // Si está en proceso (o el nuevo nombre 'Programacion de horarios') -> permitir terminar
                    var isInProcess = (estadoKey === 'en proceso' || estadoNoSpace === 'enproceso') || (estadoKey.indexOf('programacion') !== -1 && estadoKey.indexOf('horario') !== -1)  || (estadoNoSpace === 'programaciondehorarios');
                    if (isInProcess){
                        var btnTerm = crearBtn('Terminar', 'btn-success');
                        btnTerm.addEventListener('click', function(){
                            swalConfirmOpt('Terminar', 'Marcar trimestre como "Terminado"?', function(){
                                var targetId = estadosMapByName['terminado'] || estadosMapByName['term'] || null;
                                // Si no encontramos id en cache, enviar acción para que el servidor la resuelva por nombre
                                var payload = { idTrimestre: r.idTrimestre };
                                if (targetId) payload.estadoId = targetId; else payload.accion = 'terminar';
                                postForm('controlador/cambiarEstadoTrimestre.php', payload)
                                .then(json => {
                                    if (json && json.ok) { swalAlertOpt('Hecho', 'Estado cambiado', 'success'); try{ if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){} }
                                    else { swalAlertOpt('Error', 'No se pudo cambiar estado: ' + (json && json.error ? json.error : JSON.stringify(json)), 'error'); }
                                }).catch(err => { console.error('Error cambiarEstadoTrimestre:', err); swalAlertOpt('Error', 'Error al cambiar estado', 'error'); });
                            });
                        });
                        tdAcc.appendChild(btnTerm);
                        // Mostrar botón de exportar preferencias si existe
                        try {
                            if (typeof btnExportPrefs !== 'undefined') {
                                btnExportPrefs.style.display = '';
                                btnExportPrefs.disabled = false;
                            }
                        } catch(e) { /* noop */ }
                    }

                    // Si está 'A programar' o 'Recepcion de preferencias' -> mostrar Formulario de preferencias y botón para pasar a 'En Proceso'
                    var isReceivingPrefs = (estadoKey.indexOf('recepcion') !== -1 && estadoKey.indexOf('preferenc') !== -1) || estadoKey === 'a programar' || estadoNoSpace === 'aprogramar' || estadoKey === 'a_programar';
                    if (isReceivingPrefs){
                        var btnFormPref = crearBtn('Formulario de preferencias', 'btn-info');
                        btnFormPref.addEventListener('click', function(){
                            // intentamos invocar función existente pasando el objeto fila si está disponible
                            if (window && typeof window.abrirFormularioPreferencias === 'function') {
                                    try { window.abrirFormularioPreferencias(r); return; } catch(e){ console.error('Error abriendo formulario', e); }
                                }
                                swalAlertOpt('Info', 'Funcionalidad no disponible en este entorno para abrir formulario de preferencias.', 'info');
                        });
                        tdAcc.appendChild(btnFormPref);

                        var btnCamb = crearBtn('Cambiar estado', 'btn-warning');
                        btnCamb.addEventListener('click', function(){
                            swalConfirmOpt('Cambiar estado', 'Cambiar estado a "Programacion de horarios"?', function(){
                                var targetId = estadosMapByName['en proceso'] || estadosMapByName['enproceso'] || estadosMapByName['en_proceso'] || null;
                                var payload = { idTrimestre: r.idTrimestre };
                                if (targetId) payload.estadoId = targetId; else payload.accion = 'programar';
                                postForm('controlador/cambiarEstadoTrimestre.php', payload)
                                .then(json => {
                                    if (json && json.ok) { swalAlertOpt('Hecho', 'Estado cambiado', 'success'); try{ if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){} }
                                    else { swalAlertOpt('Error', 'No se pudo cambiar estado: ' + (json && json.error ? json.error : JSON.stringify(json)), 'error'); }
                                }).catch(err => { console.error('Error cambiarEstadoTrimestre:', err); swalAlertOpt('Error', 'Error al cambiar estado', 'error'); });
                            });
                        });
                        tdAcc.appendChild(btnCamb);
                    }

                    tr.appendChild(tdAcc);
                    tbody.appendChild(tr);
                });
            }
            tbl.appendChild(tbody);

            // Reemplazar contenido del contenedor
            tableContainer.innerHTML = '';
            // Asegurar que el menú de filtro de año esté presente encima de la tabla
            try { if (typeof yearMenu !== 'undefined' && yearMenu) tableContainer.appendChild(yearMenu); } catch(e) { console.warn('No se pudo reinsertar yearMenu:', e); }
            tableContainer.appendChild(tbl);
        }

        function cargarTrimestresParaAnio(anio){
            tableContainer.innerHTML = 'Cargando...';
            // Soporta la vista "Todos" usando un controlador dedicado
            var fetchPromise;
            try {
                if (String(anio) === 'todos') {
                    fetchPromise = postForm('controlador/recuperaTrimestresTodos.php', {});
                } else {
                    fetchPromise = postForm('controlador/recuperaTrimestresPorAnio.php', { anio: anio });
                }
            } catch(e){
                console.error('postForm no disponible o error preparando petición:', e);
                tableContainer.innerHTML = '<div class="text-danger">Error cargando trimestres</div>';
                return;
            }

            fetchPromise
            .then(json => {
                if (!json || !json.ok) {
                    tableContainer.innerHTML = '<div class="text-danger">Error cargando trimestres</div>';
                    return;
                }
                var list = Array.isArray(json.trimestres) ? json.trimestres : [];
                // Si pedimos todos, ordenar por año descendente (seguro)
                try {
                    if (String(anio) === 'todos') {
                        list.sort(function(a,b){
                            var ya = Number(a.año || a.anio || 0);
                            var yb = Number(b.año || b.anio || 0);
                            return (yb - ya);
                        });
                    }
                } catch(e) { /* ignore sort errors */ }
                renderTable(list);
            }).catch(err => {
                console.error('Error recuperaTrimestres:', err);
                tableContainer.innerHTML = '<div class="text-danger">Error cargando trimestres</div>';
            });
        }

        // Inicializar carga
        cargarTrimestresParaAnio(selectAnioFilter.value);
        selectAnioFilter.addEventListener('change', function(){ sortState = {col:null, asc:true}; cargarTrimestresParaAnio(this.value); });

            // Exponer helper para refrescar la lista de trimestres desde otras funciones (por ejemplo el modal)
            try {
                if (typeof window !== 'undefined') {
                    window.refrescarTrimestres = function(){ try{ cargarTrimestresParaAnio(selectAnioFilter.value); } catch(e){ console.error('Error refrescando trimestres', e); } };
                }
            } catch(e){}
    }

    try { if (typeof window !== 'undefined') window.crearMenuTrimestres = crearMenuTrimestres; } catch(e){}
})();

// Función global para abrir el formulario de preferencias para un trimestre dado.
// Devuelve una Promise y redirige a formularioPreferenciasDocentes.php?trim=<id>
try {
    if (typeof window !== 'undefined') {
        window.abrirFormularioPreferencias = function(trimestreRow){
            return new Promise(function(resolve){
                try {
                    var idTr = null;
                    if (trimestreRow && typeof trimestreRow === 'object'){
                        idTr = trimestreRow.idTrimestre || trimestreRow.id || trimestreRow.id_trimestre || null;
                    }
                    // permitir también pasar directamente un id
                    if (!idTr && (typeof trimestreRow === 'number' || (typeof trimestreRow === 'string' && String(trimestreRow).trim() !== ''))) {
                        idTr = trimestreRow;
                    }
                    if (!idTr) {
                        if (typeof swalAlertOpt === 'function') swalAlertOpt('Error', 'No se pudo determinar el trimestre.', 'error');
                        resolve({ ok:false, error:'missing trimestre' });
                        return;
                    }

                    var container = document.getElementById('trimestres-table-container');
                    if (!container){ resolve({ ok:false, error:'missing container' }); return; }

                    // UI superior: volver + enlace formulario
                    container.innerHTML = '';
                    var wrap = document.createElement('div');

                    var topBar = document.createElement('div'); topBar.className = 'd-flex align-items-center justify-content-between mb-3';
                    var left = document.createElement('div');
                    var backBtn = document.createElement('button'); backBtn.type='button'; backBtn.className='btn btn-sm btn-outline-secondary'; backBtn.innerHTML='&#8592; Volver'; backBtn.title='Volver';
                    backBtn.addEventListener('click', function(){ try { if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); else window.location.reload(); } catch(e){ window.location.reload(); } });
                    var title = document.createElement('span');
                    title.className='ms-2 fw-semibold';
                    // Construir etiqueta: "Trimestre Año - Sigla (idTrimestre)"
                    var anioLbl = '';
                    var siglaLbl = '';
                    try {
                        if (trimestreRow && typeof trimestreRow === 'object'){
                            anioLbl = String(trimestreRow.año || trimestreRow.anio || trimestreRow.year || '') || '';
                            siglaLbl = String(trimestreRow.sigla || trimestreRow.periodoNombre || trimestreRow.nombre || '') || '';
                        }
                    } catch(e){}
                    var parts = ['Preferencias de profesores — Trimestre'];
                    if (anioLbl) parts.push(anioLbl);
                    if (siglaLbl) parts.push('- ' + siglaLbl);
                    // Nota: se omite el id del trimestre por petición del usuario
                    title.textContent = parts.join(' ');
                    left.appendChild(backBtn); left.appendChild(title);

                    var right = document.createElement('div');
                    var enlaceBtn = document.createElement('button'); enlaceBtn.type='button'; enlaceBtn.className='btn btn-primary btn-sm'; enlaceBtn.textContent='Enlace de formulario';
                    enlaceBtn.addEventListener('click', function(){
                        var modal = document.createElement('div'); modal.className='modal fade'; modal.tabIndex=-1; modal.setAttribute('role','dialog');
                        var dialog = document.createElement('div'); dialog.className='modal-dialog'; dialog.setAttribute('role','dialog');
                        var content = document.createElement('div'); content.className='modal-content';
                        var header = document.createElement('div'); header.className='modal-header'; var h5=document.createElement('h5'); h5.className='modal-title'; h5.textContent='Compartir enlace'; var x=document.createElement('button'); x.type='button'; x.className='btn-close'; x.setAttribute('data-bs-dismiss','modal'); x.setAttribute('aria-label','Close'); header.appendChild(h5); header.appendChild(x);
                        var body = document.createElement('div'); body.className='modal-body'; var p=document.createElement('p'); p.textContent='Comparte este enlace con los profesores para llenar sus preferencias:'; body.appendChild(p);
                        var input = document.createElement('input'); input.type='text'; input.className='form-control';
                        var link = '';
                        try { var loc=window.location; var base=loc.origin+loc.pathname; var dir=base.replace(/[^/]*$/, ''); link = dir + 'formularioPreferenciasDocentes.php?trim=' + idTr; } catch(e){ link = 'formularioPreferenciasDocentes.php?trim=' + idTr; }
                        input.value = link; input.readOnly = true; body.appendChild(input);
                        var footer = document.createElement('div'); footer.className='modal-footer';
                        var copyBtn = document.createElement('button'); copyBtn.type='button'; copyBtn.className='btn btn-outline-primary'; copyBtn.textContent='Copiar';
                        copyBtn.addEventListener('click', function(){
                            var txt = input.value;
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(txt).then(function(){ if (typeof swalAlertOpt === 'function') swalAlertOpt('Copiado','Enlace copiado.','success'); });
                            } else { input.select(); document.execCommand('copy'); }
                        });
                        var closeBtn = document.createElement('button'); closeBtn.type='button'; closeBtn.className='btn btn-secondary'; closeBtn.setAttribute('data-bs-dismiss','modal'); closeBtn.textContent='Cerrar';
                        footer.appendChild(copyBtn); footer.appendChild(closeBtn);
                        content.appendChild(header); content.appendChild(body); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                        try { var bs = new bootstrap.Modal(modal); bs.show(); } catch(e){ modal.style.display='block'; }
                    });
                    right.appendChild(enlaceBtn);
                    topBar.appendChild(left); topBar.appendChild(right); wrap.appendChild(topBar);

                    // Contenedor de dos columnas: izquierda lista, derecha detalle
                    var row = document.createElement('div'); row.className = 'row';
                    var colLeft = document.createElement('div'); colLeft.className = 'col-12';
                    var colRight = document.createElement('div'); colRight.className = 'col-12 col-lg-5';

                    // Filtros (columna izquierda)
                    var filterBar = document.createElement('div'); filterBar.className='d-flex align-items-center mb-2 gap-2';
                    var inputSearch = document.createElement('input'); inputSearch.type='text'; inputSearch.className='form-control form-control-sm'; inputSearch.placeholder='Buscar por número o nombre'; inputSearch.style.maxWidth='280px';
                    var selectFilter = document.createElement('select'); selectFilter.className='form-select form-select-sm'; selectFilter.style.maxWidth='220px';
                    var o0=document.createElement('option'); o0.value='all'; o0.textContent='Todos'; var o1=document.createElement('option'); o1.value='con'; o1.textContent='Solo con formulario'; var o2=document.createElement('option'); o2.value='sin'; o2.textContent='Solo sin formulario';
                    selectFilter.appendChild(o0); selectFilter.appendChild(o1); selectFilter.appendChild(o2);
                    filterBar.appendChild(inputSearch); filterBar.appendChild(selectFilter);

                    // Tabla (columna izquierda)
                    var table = document.createElement('table'); table.className='table table-sm table-striped align-middle';
                    var thead = document.createElement('thead'); thead.innerHTML='<tr>\n  <th style="width:120px">No. Económico</th>\n  <th>Nombre</th>\n  <th style="width:160px">Estado en el trimestre</th>\n  <th style="width:180px">Estado de preferencias</th>\n  <th style="width:160px">Acciones</th>\n</tr>';
                    var tbody = document.createElement('tbody'); table.appendChild(thead); table.appendChild(tbody);

                    colLeft.appendChild(filterBar);
                    colLeft.appendChild(table);

                    // Panel de detalle (columna derecha)
                    var detailWrap = document.createElement('div'); detailWrap.id = 'panel-detalle-preferencias';
                    // El panel inicia oculto; se muestra al hacer clic en "ver"
                    colRight.appendChild(detailWrap);
                    colRight.style.display = 'none';

                    row.appendChild(colLeft); row.appendChild(colRight);
                    wrap.appendChild(row);
                    container.appendChild(wrap);

                    var allRows = [];
                    // Helper: confirmar acción usando swalConfirmOpt pero exponiéndola como Promise
                    function askConfirm(title, text){
                        return new Promise(function(resolve){
                            try {
                                var p = null;
                                if (typeof swalConfirmOpt === 'function') p = swalConfirmOpt(title, text, function(){ resolve(true); });
                                // si swalConfirmOpt devolvió una promesa, usar su resolución
                                if (p && typeof p.then === 'function') {
                                    p.then(function(v){ if (v === true) resolve(true); else resolve(false); }).catch(function(){ resolve(false); });
                                }
                                // en caso de que swalConfirmOpt no acepte callback o no llame, timeout de respaldo
                                setTimeout(function(){ /* no-op backup */ }, 300);
                            } catch(e){ resolve(false); }
                        });
                    }
                    // Helper: construir panel de detalle con el mismo formato de preferenciaProfesor
                    function renderDetalle(data, profesorRow){
                        var mount = detailWrap;
                        mount.innerHTML = '';

                        // Marcar qué profesor/trimestre se está mostrando en el panel (para poder cerrarlo en eventos externos)
                        try {
                            detailWrap.dataset.profesorId = String(profesorRow && profesorRow.idProfesor != null ? profesorRow.idProfesor : '');
                            detailWrap.dataset.trimestreId = String(idTr);
                        } catch(e){}

                        // Toolbar del panel: título, botón Generar enlace y botón Cerrar (X)
                        var tools = document.createElement('div'); tools.className='d-flex align-items-center justify-content-between mb-2';
                        var title = document.createElement('h6'); title.className='m-0'; title.textContent='Preferencia Docente';
                        var right = document.createElement('div');
                        var linkBtn = document.createElement('button'); linkBtn.type='button'; linkBtn.className='btn btn-outline-primary btn-sm'; linkBtn.textContent='Generar enlace';
                        linkBtn.addEventListener('click', function(){
                            var modal = document.createElement('div'); modal.className='modal fade'; modal.tabIndex=-1; modal.setAttribute('role','dialog');
                            var dialog = document.createElement('div'); dialog.className='modal-dialog';
                            var content = document.createElement('div'); content.className='modal-content';
                            var header = document.createElement('div'); header.className='modal-header'; var h5=document.createElement('h5'); h5.className='modal-title'; h5.textContent='Enlace para ver preferencias'; var x=document.createElement('button'); x.type='button'; x.className='btn-close'; x.setAttribute('data-bs-dismiss','modal'); header.appendChild(h5); header.appendChild(x);
                            var body = document.createElement('div'); body.className='modal-body';
                            var p = document.createElement('p'); p.textContent='Usa este enlace (GET) para abrir la vista preferenciaProfesor.php:'; body.appendChild(p);
                            var input = document.createElement('input'); input.type='text'; input.className='form-control';
                            var link = '';
                            try {
                                var loc = window.location; var base = loc.origin + loc.pathname; var dir = base.replace(/[^/]*$/, '');
                                link = dir + 'preferenciaProfesor.php?idTrimestre=' + encodeURIComponent(idTr) + '&idProfesor=' + encodeURIComponent(profesorRow.idProfesor);
                            } catch(e){ link = 'preferenciaProfesor.php?idTrimestre=' + idTr + '&idProfesor=' + profesorRow.idProfesor; }
                            input.value = link; input.readOnly = true; body.appendChild(input);
                            var footer = document.createElement('div'); footer.className='modal-footer';
                            var copyBtn = document.createElement('button'); copyBtn.type='button'; copyBtn.className='btn btn-outline-primary'; copyBtn.textContent='Copiar';
                            copyBtn.addEventListener('click', function(){ var txt=input.value; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ try{ swalAlertOpt('Copiado','Enlace copiado.','success'); }catch(e){} }); } else { input.select(); document.execCommand('copy'); }});
                            var closeBtn = document.createElement('button'); closeBtn.type='button'; closeBtn.className='btn btn-secondary'; closeBtn.setAttribute('data-bs-dismiss','modal'); closeBtn.textContent='Cerrar';
                            footer.appendChild(copyBtn); footer.appendChild(closeBtn);
                            content.appendChild(header); content.appendChild(body); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);
                            try { var bs = new bootstrap.Modal(modal); bs.show(); } catch(e){ modal.style.display='block'; }
                        });
                        // Botón cerrar (X) para ocultar el panel
                        var closeBtn = document.createElement('button'); closeBtn.type='button'; closeBtn.className='btn-close ms-2'; closeBtn.setAttribute('aria-label','Cerrar');
                        closeBtn.title = 'Cerrar';
                        closeBtn.addEventListener('click', function(){
                            // Ocultar panel y limpiar contenido; expandir la lista a ancho completo
                            try { detailWrap.innerHTML = ''; } catch(e){}
                            try { colRight.style.display = 'none'; } catch(e){}
                            try { colLeft.className = 'col-12'; } catch(e){}
                            try { delete detailWrap.dataset.profesorId; delete detailWrap.dataset.trimestreId; } catch(e){}
                        });
                        right.appendChild(linkBtn);
                        right.appendChild(closeBtn);
                        tools.appendChild(title); tools.appendChild(right);
                        mount.appendChild(tools);

                        if (!data){
                            var warn = document.createElement('div'); warn.className='alert alert-warning'; warn.textContent='El profesor no ha enviado sus preferencias para este trimestre.'; mount.appendChild(warn); return;
                        }

                        var profesor = data.profesor || {}; var pref = data.preferencia || {}; var ueas = Array.isArray(data.ueas)? data.ueas : []; var horarios = Array.isArray(data.horarios)? data.horarios : [];

                        // Tarjeta encabezado
                        var card = document.createElement('div'); card.className='card mb-3';
                        var cb = document.createElement('div'); cb.className='card-body';
                        var h5 = document.createElement('h5'); h5.className='card-title mb-2'; h5.textContent = (profesor.nombre || 'Profesor');
                        var sub = document.createElement('div'); sub.className='text-muted'; sub.textContent = 'Número económico: ' + (profesor.numeroEconomico != null ? String(profesor.numeroEconomico) : '');
                        var grupos = document.createElement('div'); grupos.innerHTML = '<strong>Número de grupos:</strong> ' + (pref.noGrupos != null ? String(pref.noGrupos) : '');
                        cb.appendChild(h5); cb.appendChild(sub); cb.appendChild(grupos); card.appendChild(cb); mount.appendChild(card);

                        // UEAs
                        var cardU = document.createElement('div'); cardU.className='card mb-3';
                        var cbu = document.createElement('div'); cbu.className='card-body';
                        var h6u = document.createElement('h6'); h6u.className='card-title'; h6u.textContent='UEA seleccionadas'; cbu.appendChild(h6u);
                        if (ueas.length === 0){
                            var noU = document.createElement('div'); noU.className='text-muted'; noU.textContent='Sin UEA seleccionadas'; cbu.appendChild(noU);
                        } else {
                            var tbl = document.createElement('table'); tbl.className='table table-sm table-striped';
                            var thead2 = document.createElement('thead'); var trh = document.createElement('tr');
                            ['Prioridad','Clave','Nombre'].forEach(function(h){ var th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
                            thead2.appendChild(trh); tbl.appendChild(thead2);
                            var tbody2 = document.createElement('tbody');
                            // ordenar por prioridad
                            ueas.slice().sort(function(a,b){ return (a.prioridad||0) - (b.prioridad||0); }).forEach(function(u){
                                var tr=document.createElement('tr');
                                var td1=document.createElement('td'); td1.textContent= String(u.prioridad||''); tr.appendChild(td1);
                                var td2=document.createElement('td'); td2.textContent= String(u.claveUEA||''); tr.appendChild(td2);
                                var td3=document.createElement('td'); td3.textContent= String(u.nombre||''); tr.appendChild(td3);
                                tbody2.appendChild(tr);
                            });
                            tbl.appendChild(tbody2); cbu.appendChild(tbl);
                        }
                        cardU.appendChild(cbu); mount.appendChild(cardU);

                        // Horarios por día
                        var cardH = document.createElement('div'); cardH.className='card mb-3';
                        var cbh = document.createElement('div'); cbh.className='card-body';
                        var h6h = document.createElement('h6'); h6h.className='card-title'; h6h.textContent='Horarios seleccionados'; cbh.appendChild(h6h);
                        // agrupar por día
                        var map = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
                        horarios.forEach(function(h){ if(!h||!h.dia) return; var d=String(h.dia).toLowerCase(); if(d.indexOf('lu')===0) d='lunes'; else if(d.indexOf('ma')===0) d='martes'; else if(d.indexOf('mi')===0 || d.indexOf('miér')===0) d='miercoles'; else if(d.indexOf('ju')===0) d='jueves'; else if(d.indexOf('vi')===0) d='viernes'; if(!map[d]) map[d]=[]; map[d].push(h); });
                        Object.keys(map).forEach(function(k){ map[k].sort(function(a,b){ return String(a.horaInicio||'').localeCompare(String(b.horaInicio||'')); }); });
                        var tblh = document.createElement('table'); tblh.className='table table-bordered table-sm';
                        var theadh = document.createElement('thead'); var trd = document.createElement('tr');
                        [['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes']].forEach(function(p){ var th=document.createElement('th'); th.textContent=p[1]; trd.appendChild(th); });
                        theadh.appendChild(trd); tblh.appendChild(theadh);
                        var trb = document.createElement('tr');
                        ['lunes','martes','miercoles','jueves','viernes'].forEach(function(k){ var td=document.createElement('td'); var arr = map[k]||[]; if(arr.length===0){ td.textContent='-'; } else { var cont = document.createElement('div'); arr.forEach(function(h){ var b=document.createElement('span'); b.className='badge text-bg-light me-1 mb-1'; b.textContent = String(h.horaInicio||'') + ' - ' + String(h.horaFin||''); cont.appendChild(b); }); td.appendChild(cont); } trb.appendChild(td); });
                        var tbdy = document.createElement('tbody'); tbdy.appendChild(trb); tblh.appendChild(tbdy);
                        // Envolver en contenedor responsive para evitar desbordes horizontales
                        var respWrap = document.createElement('div'); respWrap.className = 'table-responsive';
                        respWrap.appendChild(tblh);
                        cbh.appendChild(respWrap); cardH.appendChild(cbh); mount.appendChild(cardH);

                        // Observaciones
                        var obsCard = document.createElement('div'); obsCard.className='card';
                        var obb = document.createElement('div'); obb.className='card-body';
                        var h6o = document.createElement('h6'); h6o.className='card-title'; h6o.textContent='Observaciones'; obb.appendChild(h6o);
                        var pobs = document.createElement('p'); pobs.textContent = pref && pref.observaciones ? String(pref.observaciones) : 'Sin observaciones'; obb.appendChild(pobs);
                        obsCard.appendChild(obb); mount.appendChild(obsCard);
                    }

                    // Helper: construir el editor basado en el formulario de docentes
                    function renderEditor(data, profesorRow, ueasList, horariosAll){
                        var mount = detailWrap; mount.innerHTML = '';
                        // Marcar dataset para cierre externo
                        try { detailWrap.dataset.profesorId = String(profesorRow && profesorRow.idProfesor != null ? profesorRow.idProfesor : ''); detailWrap.dataset.trimestreId = String(idTr); } catch(e){}

                        // Toolbar
                        var tools = document.createElement('div'); tools.className='d-flex align-items-center justify-content-between mb-2';
                        var title = document.createElement('h6'); title.className='m-0'; title.textContent='Editar preferencias';
                        var right = document.createElement('div');
                        var closeBtn = document.createElement('button'); closeBtn.type='button'; closeBtn.className='btn-close ms-2'; closeBtn.title='Cerrar';
                        closeBtn.addEventListener('click', function(){ try { detailWrap.innerHTML=''; colRight.style.display='none'; colLeft.className='col-12'; delete detailWrap.dataset.profesorId; delete detailWrap.dataset.trimestreId; } catch(e){} });
                        right.appendChild(closeBtn); tools.appendChild(title); tools.appendChild(right); mount.appendChild(tools);

                        // Normalizar estructuras iniciales
                        var profesor = data && data.profesor ? data.profesor : { numeroEconomico: profesorRow.numeroEconomico };
                        var pref = data && data.preferencia ? data.preferencia : { noGrupos: 2, observaciones: '' };
                        var ueas = Array.isArray(data && data.ueas) ? data.ueas.slice().sort(function(a,b){return (a.prioridad||0)-(b.prioridad||0)}) : [];
                        var horariosSel = Array.isArray(data && data.horarios) ? data.horarios : [];

                        // snapshot original para comparar cambios
                        var original = {
                            noGrupos: Number(pref.noGrupos || 0),
                            obser: String(pref.observaciones || ''),
                            ueas: ueas.map(function(u){ return String(u.claveUEA || u.clave || ''); }), // por prioridad
                            horarios: new Set(horariosSel.map(function(h){ return Number(h.idHorario); }))
                        };

                        // Construir formulario (DOM)
                        var form = document.createElement('form'); form.id='editor-pref-form'; form.autocomplete='off';

                        // Row: noEco (readonly), noGrup
                        var row1 = document.createElement('div'); row1.className='row g-3';
                        var col1 = document.createElement('div'); col1.className='col-md-6';
                        var l1 = document.createElement('label'); l1.className='form-label'; l1.textContent='Número económico';
                        var inEco = document.createElement('input'); inEco.type='number'; inEco.className='form-control'; inEco.value = String(profesor.numeroEconomico || ''); inEco.readOnly = true; inEco.disabled = true; inEco.setAttribute('aria-readonly', 'true'); inEco.tabIndex = -1; inEco.id='ed_noEco'; inEco.name='noEco';
                        col1.appendChild(l1); col1.appendChild(inEco);
                        var col3 = document.createElement('div'); col3.className='col-md-6';
                        var l3 = document.createElement('label'); l3.className='form-label'; l3.textContent='Número de grupos (mínimo 2)';
                        var inGr = document.createElement('input'); inGr.type='number'; inGr.className='form-control'; inGr.min='2'; inGr.required=true; inGr.id='ed_noGrup'; inGr.name='noGrupos'; inGr.value = String(pref.noGrupos || '');
                        col3.appendChild(l3); col3.appendChild(inGr);
                        row1.appendChild(col1); row1.appendChild(col3); form.appendChild(row1);

                        var hr1 = document.createElement('hr'); hr1.className='my-3'; form.appendChild(hr1);

                        // UEA selects (5) — basados en buildFormDocentes
                        var p1 = document.createElement('p'); p1.className='mb-2'; p1.innerHTML = 'Indique 5 UEA (todas diferentes).'; form.appendChild(p1);
                        var rowU = document.createElement('div'); rowU.className='row g-3';
                        // construir master options
                        function makeOptions(ueasArr){
                            var opts=[]; if(!Array.isArray(ueasArr)||ueasArr.length===0){ var o=document.createElement('option'); o.value='0'; o.textContent='(No hay UEA disponibles)'; opts.push(o); return opts; }
                            ueasArr.forEach(function(u){
                                // Prefer the shape returned by UEAVO->toJSON(): cUEA / nUEA
                                var clave = (u.cUEA || u.claveUEA || u.clave || '');
                                var nombre = (u.nUEA || u.nombre || u.nombreUEA || u.label || '');
                                var o=document.createElement('option');
                                o.value=String(clave);
                                // Mostrar como "CLAVE - Nombre"
                                o.textContent = (clave ? (clave + ' - ') : '') + nombre;
                                opts.push(o);
                            });
                            return opts;
                        }
                        var masterOptions = makeOptions(ueasList);
                        var selects = [];
                        for (var i=1;i<=5;i++){
                            var col = document.createElement('div'); col.className='col-md-6';
                            var lab = document.createElement('label'); lab.className='form-label'; lab.htmlFor='ed_uea'+i; lab.textContent = i + 'ª UEA';
                            var sel = document.createElement('select'); sel.id='ed_uea'+i; sel.name='uea'+i; sel.className='form-select';
                            var opt0=document.createElement('option'); opt0.value='0'; opt0.textContent='-- Seleccionar UEA --'; sel.appendChild(opt0);
                            masterOptions.forEach(function(o){ sel.appendChild(o.cloneNode(true)); });
                            // Preseleccionar por prioridad
                            var pick = ueas[i-1] ? String(ueas[i-1].cUEA || ueas[i-1].claveUEA || ueas[i-1].clave || '') : '0';
                            sel.value = pick && [...sel.options].some(function(o){return o.value===pick;}) ? pick : '0';
                            col.appendChild(lab); col.appendChild(sel); rowU.appendChild(col); selects.push(sel);
                        }
                        // evitar duplicados entre selects
                        var baseOpts = masterOptions.map(function(o){return o.cloneNode(true)});
                        function refreshUEAOptions(){
                            var selected = new Set(selects.map(function(s){return s.value}).filter(function(v){return v && v!=='0';}));
                            selects.forEach(function(s){ var cur=s.value; while(s.options.length>1) s.remove(1); baseOpts.forEach(function(o){ var val=o.value; if(val===cur || !selected.has(val)){ s.appendChild(o.cloneNode(true)); } }); if ([...s.options].some(function(o){return o.value===cur;})) s.value=cur; else s.value='0'; });
                        }
                        selects.forEach(function(s){ s.addEventListener('change', refreshUEAOptions); }); refreshUEAOptions();
                        form.appendChild(rowU);

                        var hr2 = document.createElement('hr'); hr2.className='my-3'; form.appendChild(hr2);

                        // Horarios grid — idéntico esquema de filas que buildFormDocentes
                        var p2 = document.createElement('p'); p2.innerHTML='Seleccione al menos <strong>tres</strong> horarios por día.'; form.appendChild(p2);
                        var wrapTable = document.createElement('div'); wrapTable.className='table-responsive';
                        var table = document.createElement('table'); table.className='table table-bordered';
                        var thead=document.createElement('thead'); var trh=document.createElement('tr'); ['', 'Lunes','Martes','Miércoles','Jueves','Viernes'].forEach(function(t){ var th=document.createElement('th'); th.textContent=t; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead);
                        var tbody=document.createElement('tbody');
                        var rows=[['7:00 - 8:30','7:00','8:30'],['8:30 - 10:00','8:30','10:00'],['10:00 - 11:30','10:00','11:30'],['11:30 - 13:00','11:30','13:00'],['13:00 - 14:30','13:00','14:30'],['14:30 - 16:00','14:30','16:00'],['16:00 - 17:30','16:00','17:30'],['17:30 - 19:00','17:30','19:00'],['19:00 - 20:30','19:00','20:30']];
                        function horaToLabel(h){ if(!h) return ''; var s=String(h).trim(); var p=s.split(':'); if(p.length>=2){ var hh=parseInt(p[0],10); var mm=p[1]; return String(hh)+':'+mm; } return s; }
                        var byDay={lu:[],ma:[],mi:[],ju:[],vi:[]}; (horariosAll||[]).forEach(function(h){ try{ var d=String(h.dia||'').toLowerCase(); if(d.indexOf('lu')===0||d.indexOf('lunes')===0) byDay.lu.push(h); else if(d.indexOf('ma')===0||d.indexOf('martes')===0) byDay.ma.push(h); else if(d.indexOf('mi')===0||d.indexOf('mier')===0||d.indexOf('miercoles')===0) byDay.mi.push(h); else if(d.indexOf('ju')===0||d.indexOf('jueves')===0) byDay.ju.push(h); else if(d.indexOf('vi')===0||d.indexOf('viernes')===0) byDay.vi.push(h); }catch(e){} });
                        var selectedSet = new Set(original.horarios);
                        rows.forEach(function(rw){ var tr=document.createElement('tr'); var th=document.createElement('th'); th.textContent=rw[0]; tr.appendChild(th); ['lu','ma','mi','ju','vi'].forEach(function(prefix){ var td=document.createElement('td'); var inp=document.createElement('input'); inp.type='checkbox'; inp.className='form-check-input'; inp.setAttribute('data-day', prefix); var found=null; (byDay[prefix]||[]).some(function(c){ var sL=horaToLabel(c.horaInicio); var eL=horaToLabel(c.horaFin); if(String(sL)===String(rw[1]) && String(eL)===String(rw[2])){ found=c; return true; } return false; }); inp.value = (found && found.idHorario) ? String(found.idHorario) : ''; if (found && selectedSet.has(Number(found.idHorario))) inp.checked = true; td.appendChild(inp); tr.appendChild(td); }); tbody.appendChild(tr); });
                        table.appendChild(tbody); wrapTable.appendChild(table); form.appendChild(wrapTable);

                        var mb = document.createElement('div'); mb.className='mb-3';
                        var labO=document.createElement('label'); labO.className='form-label'; labO.textContent='Observaciones';
                        var txt=document.createElement('textarea'); txt.className='form-control'; txt.id='ed_obser'; txt.name='obser'; txt.rows=3; txt.value=String(pref.observaciones||'');
                        mb.appendChild(labO); mb.appendChild(txt); form.appendChild(mb);

                        var actions = document.createElement('div'); actions.className='d-flex gap-2';
                        var btnSave=document.createElement('button'); btnSave.type='button'; btnSave.className='btn btn-primary'; btnSave.textContent='Guardar cambios';
                        var btnCancel=document.createElement('button'); btnCancel.type='button'; btnCancel.className='btn btn-secondary'; btnCancel.textContent='Cancelar';
                        btnCancel.addEventListener('click', function(){ try { renderDetalle(data, profesorRow); } catch(e){} });
                        actions.appendChild(btnSave); actions.appendChild(btnCancel); form.appendChild(actions);

                        mount.appendChild(form);

                        function gatherSnapshot(){
                            var cur = {
                                noGrupos: Number(inGr.value||0),
                                obser: String(txt.value||''),
                                ueas: selects.map(function(s){ return String(s.value||'0'); }),
                                horarios: new Set()
                            };
                            var cbs = form.querySelectorAll('input[type="checkbox"][data-day]');
                            cbs.forEach(function(cb){ if (cb && cb.checked && cb.value) cur.horarios.add(Number(cb.value)); });
                            return cur;
                        }

                        function diffs(a,b){
                            var changes = [];
                            if (a.noGrupos !== b.noGrupos) changes.push('noGrupos');
                            if (String(a.obser||'').trim() !== String(b.obser||'').trim()) changes.push('observaciones');
                            var uEq = a.ueas.length===b.ueas.length && a.ueas.every(function(v,i){ return String(v)===String(b.ueas[i]); });
                            if (!uEq) changes.push('ueas');
                            if (a.horarios.size !== b.horarios.size) changes.push('horarios');
                            else {
                                for (var v of a.horarios){ if (!b.horarios.has(v)) { changes.push('horarios'); break; } }
                            }
                            return changes;
                        }

                        btnSave.addEventListener('click', function(){
                            var cur = gatherSnapshot();
                            var ch = diffs(original, cur);
                            if (ch.length === 0) { try { swalAlertOpt && swalAlertOpt('Sin cambios','No hay modificaciones que guardar.','info'); } catch(e){ alert('No hay cambios'); } return; }
                            // Validación rápida cliente: mínimo 3 por día
                            var perDay = {lu:0,ma:0,mi:0,ju:0,vi:0};
                            form.querySelectorAll('input[type="checkbox"][data-day]').forEach(function(cb){ if(cb.checked){ var d=cb.getAttribute('data-day'); if(perDay[d]!==undefined) perDay[d]++; }});
                            var bad = Object.keys(perDay).filter(function(k){ return perDay[k] < 3; });
                            if (bad.length>0){ try { swalAlertOpt('Faltan horarios','Debes elegir al menos 3 horarios por día.','warning'); } catch(e){ alert('Debes elegir al menos 3 horarios por día.'); } return; }

                            // Confirmar
                            var proceed = function(){
                                btnSave.disabled = true; btnCancel.disabled = true;
                                var fd = new FormData();
                                fd.append('idTrimestre', String(idTr));
                                fd.append('idProfesor', String(profesorRow.idProfesor));
                                fd.append('noEco', String(inEco.value||''));
                                fd.append('noGrupos', String(inGr.value||''));
                                fd.append('obser', String(txt.value||''));
                                for (var i=0;i<5;i++){ fd.append('uea'+(i+1), String(cur.ueas[i]||'0')); }
                                cur.horarios.forEach(function(h){ fd.append('horario[]', String(h)); });
                                fetch('controlador/actualizarPreferenciasProfesor.php', { method: 'POST', body: fd })
                                  .then(function(resp){ return resp.json().catch(function(){ return {ok:false, error:'Respuesta no JSON'}; }); })
                                  .then(function(j){
                                      if (j && j.ok){
                                          try { swalAlertOpt('Actualizado','Preferencias actualizadas correctamente.','success'); } catch(e){}
                                          // refrescar vista (volver a mostrar detalle)
                                          var fd2 = new FormData(); fd2.append('idTrimestre', String(idTr)); fd2.append('idProfesor', String(profesorRow.idProfesor));
                                          fetch('controlador/recuperarPreferenciasProfesor.php', { method:'POST', body: fd2 })
                                            .then(function(r){ return r.json(); })
                                            .then(function(j2){ if(j2 && j2.ok){ renderDetalle(j2.data, profesorRow); } else { renderDetalle(data, profesorRow); } })
                                            .catch(function(){ renderDetalle(data, profesorRow); });
                                          // refrescar listado de la izquierda (estado no cambia, pero por consistencia)
                                          try { fetchLista().then(function(js){ if (js && js.ok && Array.isArray(js.data)) { allRows = js.data; render(); } }); } catch(e){}
                                      } else {
                                          var em = (j && (j.error||j.msg)) ? (j.error||j.msg) : 'Error al guardar';
                                          try { swalAlertOpt('Error', em, 'error'); } catch(e){ alert(em); }
                                          btnSave.disabled = false; btnCancel.disabled = false;
                                      }
                                  })
                                  .catch(function(err){ console.error('actualizarPreferenciasProfesor:', err); try { swalAlertOpt('Error','Error al actualizar','error'); } catch(e){} btnSave.disabled=false; btnCancel.disabled=false; });
                            };
                            try {
                                if (typeof swalConfirmOpt === 'function') { swalConfirmOpt('Confirmar', 'Esto reemplazará las preferencias actuales. ¿Continuar?', proceed); }
                                else { proceed(); }
                            } catch(e){ proceed(); }
                        });
                    }

                    function render(){
                        var q = (inputSearch.value||'').trim().toLowerCase(); var mode = selectFilter.value||'all';
                        var rows = allRows.filter(function(r){
                            var ok=true; if (q){ var txt=(String(r.numeroEconomico||'')+' '+String(r.nombre||'')).toLowerCase(); ok = txt.indexOf(q) !== -1; }
                            if (!ok) return false;
                            if (mode==='con') return Number(r.estado)===1 && Number(r.filledPrefs)===1;
                            if (mode==='sin') return Number(r.estado)===1 && (!r.filledPrefs || Number(r.filledPrefs)===0);
                            // 'all': mostrar todos
                            return true;
                        });
                        tbody.innerHTML=''; if (rows.length===0){ var tr=document.createElement('tr'); var td=document.createElement('td'); td.colSpan=5; td.className='text-center text-muted'; td.textContent='Sin resultados'; tr.appendChild(td); tbody.appendChild(tr); return; }
                        var frag=document.createDocumentFragment();
                        rows.forEach(function(r){
                            var tr=document.createElement('tr');
                            var td1=document.createElement('td'); td1.textContent=r.numeroEconomico; tr.appendChild(td1);
                            var td2=document.createElement('td'); td2.textContent=r.nombre; tr.appendChild(td2);
                            // Estado en el trimestre (disponible/no disponible)
                            var td3=document.createElement('td'); var sDisp=document.createElement('span');
                            if (Number(r.estado)===1){ sDisp.className='text-success'; sDisp.innerHTML='&#10003; Disponible'; }
                            else { sDisp.className='text-danger'; sDisp.innerHTML='&#10007; No disponible'; }
                            td3.appendChild(sDisp); tr.appendChild(td3);
                            // Estado de preferencias
                            var td4=document.createElement('td'); var span=document.createElement('span'); if (Number(r.filledPrefs)===1){ span.className='text-success'; span.innerHTML='&#10003; Ha enviado'; } else { span.className='text-danger'; span.innerHTML='&#10007; Sin envío'; } td4.appendChild(span); tr.appendChild(td4);
                            var td5=document.createElement('td');
                            // Mostrar únicamente el botón "ver" cuando el profesor ya haya enviado sus preferencias (r.filledPrefs == 1)
                            if (r.filledPrefs == 1) {
                                var btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'btn btn-outline-secondary btn-sm';
                                // Etiqueta corta para mantener la fila compacta
                                btn.textContent = 'ver';
                                btn.title = 'Ver preferencias del profesor';
                                btn.addEventListener('click', function(){
                                    // Cargar datos y renderizar en el panel derecho
                                    var fd = new FormData(); fd.append('idTrimestre', String(idTr)); fd.append('idProfesor', String(r.idProfesor));
                                    // Mostrar loader ligero en panel
                                    try {
                                        // Mostrar panel y ajustar columnas
                                        colRight.style.display = '';
                                        colLeft.className = 'col-12 col-lg-7';
                                        detailWrap.innerHTML = '<div class="text-muted">Cargando preferencias...</div>';
                                    } catch(e){}
                                    fetch('controlador/recuperarPreferenciasProfesor.php', { method:'POST', body: fd })
                                      .then(function(resp){ return resp.json(); })
                                      .then(function(j){ if (!j || j.ok!==true) throw new Error(j && (j.error||j.msg) ? (j.error||j.msg) : 'Error de servidor'); renderDetalle(j.data, r); })
                                      .catch(function(err){ console.error('recuperarPreferenciasProfesor:', err); try { detailWrap.innerHTML = '<div class="alert alert-danger">No se pudieron cargar las preferencias.</div>'; } catch(e){} });
                                });
                                td5.appendChild(btn);

                                // Botón Editar: abre el panel lateral con un formulario editable basado en el de docentes
                                var btnEdit = document.createElement('button');
                                btnEdit.type = 'button';
                                btnEdit.className = 'btn btn-outline-primary btn-sm ms-2';
                                btnEdit.textContent = 'Editar';
                                btnEdit.title = 'Editar preferencias del profesor';
                                btnEdit.addEventListener('click', function(){
                                    // Mostrar panel y ajustar columnas
                                    try { colRight.style.display = ''; colLeft.className = 'col-12 col-lg-7'; } catch(e){}
                                    // loader
                                    try { detailWrap.innerHTML = '<div class="text-muted">Cargando editor...</div>'; } catch(e){}
                                    // Cargar en paralelo: preferencias actuales, UEA y horarios
                                    var fd = new FormData(); fd.append('idTrimestre', String(idTr)); fd.append('idProfesor', String(r.idProfesor));
                                    var pPref = fetch('controlador/recuperarPreferenciasProfesor.php', { method:'POST', body: fd }).then(function(resp){ return resp.json(); }).then(function(j){ if(!j||j.ok!==true) throw new Error(j && (j.error||j.msg)?(j.error||j.msg):'Error servidor'); return j.data; });
                                    var pUEAS = fetch('controlador/recuperaUEAS.php', { credentials: 'same-origin' }).then(function(resp){ return resp.json(); });
                                    var pHor = fetch('controlador/recuperarHorarios.php', { credentials: 'same-origin' }).then(function(resp){ return resp.json(); }).then(function(j){ return (j && j.ok && Array.isArray(j.horarios)) ? j.horarios : []; });
                                    Promise.all([pPref, pUEAS, pHor]).then(function(arr){
                                        var data = arr[0]; var ueasList = Array.isArray(arr[1])?arr[1]:[]; var horariosAll = arr[2]||[];
                                        renderEditor(data, r, ueasList, horariosAll);
                                    }).catch(function(err){ console.error('Editor carga:', err); try { detailWrap.innerHTML = '<div class="alert alert-danger">No se pudo abrir el editor.</div>'; } catch(e){} });
                                });
                                td5.appendChild(btnEdit);
                            }

                            // Botón: Borrar preferencias (visible solo si el profesor ya envió sus preferencias)
                            if (r.filledPrefs == 1) {
                                var btnDelPref = document.createElement('button');
                                btnDelPref.type = 'button';
                                btnDelPref.className = 'btn btn-danger btn-sm ms-2';
                                // usar etiqueta corta para mantener el botón compacto
                                btnDelPref.textContent = 'Borrar';
                                btnDelPref.title = 'Eliminar todas las preferencias de este profesor para el trimestre';
                                btnDelPref.addEventListener('click', function(){
                                    // confirmar usando promesas
                                    askConfirm('Borrar preferencias', '¿Deseas eliminar TODAS las preferencias enviadas por este profesor en este trimestre? Esta acción no se puede deshacer.')
                                    .then(function(accepted){
                                        if (!accepted) return;
                                        btnDelPref.disabled = true;
                                        var fd = new FormData(); fd.append('idTrimestre', String(idTr)); fd.append('idProfesor', String(r.idProfesor));
                                        fetch('controlador/borrarPreferenciasProfesorTrimestre.php', { method: 'POST', body: fd })
                                        .then(function(resp){ return resp.json().catch(function(){ return { ok:false, error:'Respuesta inválida' }; }); })
                                        .then(function(j){
                                            if (j && j.ok) {
                                                var details = [];
                                                if (j.deleted_preferencias !== undefined) details.push((j.deleted_preferencias||0) + ' preferencia(s)');
                                                if (j.deleted_uea !== undefined) details.push((j.deleted_uea||0) + ' UEA(s)');
                                                if (j.deleted_horario !== undefined) details.push((j.deleted_horario||0) + ' horario(s)');
                                                var txt = 'Preferencias borradas correctamente.' + (details.length ? '\n\nDetalles: ' + details.join(', ') : '');
                                                try { swalAlertOpt('Eliminado', txt, 'success'); } catch(e){ alert(txt); }
                                                // refrescar la lista de la vista (volver a recuperar datos)
                                                try { fetchLista().then(function(js){ if (js && js.ok && Array.isArray(js.data)) { allRows = js.data; render(); } }); } catch(e){}

                                                // Si el panel lateral está mostrando a este mismo profesor/trimestre, cerrarlo
                                                try {
                                                    var pId = detailWrap && detailWrap.dataset ? detailWrap.dataset.profesorId : null;
                                                    var tId = detailWrap && detailWrap.dataset ? detailWrap.dataset.trimestreId : null;
                                                    if (pId && tId && String(pId) === String(r.idProfesor) && String(tId) === String(idTr)) {
                                                        detailWrap.innerHTML = '';
                                                        colRight.style.display = 'none';
                                                        colLeft.className = 'col-12';
                                                        delete detailWrap.dataset.profesorId; delete detailWrap.dataset.trimestreId;
                                                    }
                                                } catch(e){}
                                            } else {
                                                var em = j && (j.error || j.msg) ? (j.error || j.msg) : JSON.stringify(j);
                                                try { swalAlertOpt('Error', 'No se pudieron borrar las preferencias: ' + em, 'error'); } catch(e){ alert('Error: ' + em); }
                                                btnDelPref.disabled = false;
                                            }
                                        }).catch(function(err){ console.error('Error borrar preferencias:', err); try { swalAlertOpt('Error','Error al eliminar preferencias','error'); } catch(e){}; btnDelPref.disabled = false; });
                                    });
                                });
                                td5.appendChild(btnDelPref);
                            }

                            tr.appendChild(td5); frag.appendChild(tr);
                        });
                        tbody.appendChild(frag);
                    }
                    inputSearch.addEventListener('input', render); selectFilter.addEventListener('change', render);

                    // Cargar datos
                    function fetchLista(){
                        if (typeof postForm === 'function') return postForm('controlador/recuperarProfesoresPreferenciasTrimestre.php', { idTrimestre: idTr });
                        var fd=new FormData(); fd.append('idTrimestre', String(idTr));
                        return fetch('controlador/recuperarProfesoresPreferenciasTrimestre.php', { method:'POST', body: fd }).then(function(r){ return r.json(); });
                    }
                    fetchLista().then(function(json){ if (!json || json.ok!==true) throw new Error(json && json.error ? json.error : 'Error de servidor'); allRows = Array.isArray(json.data) ? json.data : []; render(); resolve({ ok:true }); })
                    .catch(function(err){ if (typeof swalAlertOpt==='function') swalAlertOpt('Error', String(err && err.message ? err.message : err), 'error'); resolve({ ok:false, error:String(err && err.message ? err.message : err) }); });
                } catch (e){ resolve({ ok:false, error: e && e.message ? e.message : 'error' }); }
            });
        };
    }
} catch(e) { /* noop */ }

// Mostrar modal para crear un nuevo trimestre
// NOTA: los ayudantes de alert/confirm están provistos por `js/uiHelpers.js` como
// `swalAlertOpt` y `swalConfirmOpt` (globales) — el módulo los utiliza.
function nuevoTrimestre() {
    // Eliminar modal previo si existe
    var existing = document.getElementById('modalNuevoTrimestre');
    if (existing) existing.parentNode.removeChild(existing);

    var modal = document.createElement('div');
    modal.id = 'modalNuevoTrimestre';
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');

    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'document');

    var content = document.createElement('div');
    content.className = 'modal-content';

    var header = document.createElement('div');
    header.className = 'modal-header';
    var h5 = document.createElement('h5');
    h5.className = 'modal-title';
    h5.textContent = 'Crear nuevo trimestre';
    var btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'btn-close';
    btnClose.setAttribute('data-bs-dismiss', 'modal');
    btnClose.setAttribute('aria-label', 'Close');
    header.appendChild(h5);
    header.appendChild(btnClose);

    var body = document.createElement('div');
    body.className = 'modal-body';
    var form = document.createElement('form');
    form.id = 'formNuevoTrimestre';

    // Año select
    var divAnio = document.createElement('div'); divAnio.className = 'mb-3';
    var labelAnio = document.createElement('label'); labelAnio.className = 'form-label'; labelAnio.textContent = 'Año';
    var selectAnio = document.createElement('select'); selectAnio.className = 'form-select'; selectAnio.id = 'nuevo_trimestre_anio';
    divAnio.appendChild(labelAnio); divAnio.appendChild(selectAnio);

    // Periodo select
    var divPeriodo = document.createElement('div'); divPeriodo.className = 'mb-3';
    var labelPeriodo = document.createElement('label'); labelPeriodo.className = 'form-label'; labelPeriodo.textContent = 'Periodo (trimestre)';
    var selectPeriodo = document.createElement('select'); selectPeriodo.className = 'form-select'; selectPeriodo.id = 'nuevo_trimestre_periodo';
    selectPeriodo.disabled = true;
    divPeriodo.appendChild(labelPeriodo); divPeriodo.appendChild(selectPeriodo);

    // Fecha límite
    var divFecha = document.createElement('div'); divFecha.className = 'mb-3';
    var labelFecha = document.createElement('label'); labelFecha.className = 'form-label'; labelFecha.textContent = 'Fecha límite';
    var inputFecha = document.createElement('input'); inputFecha.type = 'date'; inputFecha.className = 'form-control'; inputFecha.id = 'nuevo_trimestre_fecha';
    divFecha.appendChild(labelFecha); divFecha.appendChild(inputFecha);

    // Estado select (se poblará desde servidor o con respaldo)
    var divEstado = document.createElement('div'); divEstado.className = 'mb-3';
    var labelEstado = document.createElement('label'); labelEstado.className = 'form-label'; labelEstado.textContent = 'Estado';
    var selectEstado = document.createElement('select'); selectEstado.className = 'form-select'; selectEstado.id = 'nuevo_trimestre_estado';
    // colocar una opción temporal mientras carga
    var optLoading = document.createElement('option'); optLoading.value = ''; optLoading.textContent = 'Cargando estados...'; selectEstado.appendChild(optLoading);
    divEstado.appendChild(labelEstado); divEstado.appendChild(selectEstado);

    form.appendChild(divAnio);
    form.appendChild(divPeriodo);
    form.appendChild(divEstado);
    form.appendChild(divFecha);
    body.appendChild(form);

    var footer = document.createElement('div'); footer.className = 'modal-footer';
    var btnCancel = document.createElement('button'); btnCancel.type = 'button'; btnCancel.className = 'btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss', 'modal'); btnCancel.textContent = 'Cancelar';
    var btnSave = document.createElement('button'); btnSave.type = 'button'; btnSave.className = 'btn btn-primary'; btnSave.id = 'guardarNuevoTrimestre'; btnSave.textContent = 'Crear';
    footer.appendChild(btnCancel); footer.appendChild(btnSave);

    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    dialog.appendChild(content);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Poblar select de años: rango currentYear-2 .. currentYear+2
    var today = new Date();
    var cy = today.getFullYear();
    for (var y = cy - 2; y <= cy + 2; y++) {
        var opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        if (y === cy) opt.selected = true;
        selectAnio.appendChild(opt);
    }
    // Opción para permitir insertar manualmente un año
    var optInsert = document.createElement('option');
    optInsert.value = 'insertar';
    optInsert.textContent = 'Insertar año de trimestre...';
    selectAnio.appendChild(optInsert);
    // Input oculto para año personalizado (aparece si se selecciona "Insertar año...")
    var inputAnioCustom = document.createElement('input');
    inputAnioCustom.type = 'number';
    inputAnioCustom.id = 'nuevo_trimestre_anio_custom';
    inputAnioCustom.className = 'form-control mt-2';
    inputAnioCustom.placeholder = 'Introduce año (>= 2000)';
    inputAnioCustom.min = '2000';
    inputAnioCustom.style.maxWidth = '160px';
    inputAnioCustom.style.display = 'none';
    divAnio.appendChild(inputAnioCustom);
    // Mostrar/ocultar input custom según selección
    selectAnio.addEventListener('change', function () {
        try {
            if (String(this.value) === 'insertar') {
                inputAnioCustom.style.display = '';
                inputAnioCustom.focus();
                // deshabilitar selectPeriodo mientras se inserta año manualmente
                try { selectPeriodo.innerHTML = '<option value="">(selecciona periodo después de ingresar año)</option>'; selectPeriodo.disabled = true; } catch(e) { /* noop */ }
            } else {
                inputAnioCustom.style.display = 'none';
                // si selecciona un año normal, recargar periodos disponibles para ese año
                try { if (typeof cargarPeriodos === 'function') cargarPeriodos(this.value); } catch(e) { /* noop */ }
            }
        } catch (e) { /* noop */ }
    });
    // Cuando el usuario ingresa un año personalizado, intentar cargar periodos para ese año
    inputAnioCustom.addEventListener('change', function (){
        try{
            var v = String(this.value || '').trim();
            var num = parseInt(v, 10);
            if (!isNaN(num) && num >= 2000) {
                try { if (typeof cargarPeriodos === 'function') cargarPeriodos(String(num)); } catch(e){}
                selectPeriodo.disabled = false;
            } else {
                selectPeriodo.innerHTML = '<option value="">Año inválido</option>';
                selectPeriodo.disabled = true;
            }
        }catch(e){}
    });
    inputAnioCustom.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); this.dispatchEvent(new Event('change')); } });

    // Establecer min para fecha = mañana
    function formatDateYMD(d) {
        var mm = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mm + '-' + dd;
    }
    var manana = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    inputFecha.min = formatDateYMD(manana);

    // Función para cargar periodos y excluir ya usados
    function cargarPeriodos(anio) {
        selectPeriodo.innerHTML = '';
        selectPeriodo.disabled = true;
        selectPeriodo.innerHTML = '<option value="">Cargando...</option>';
        postForm('controlador/recuperaPeriodosTrimestre.php', { anio: anio })
        .then(json => {
            selectPeriodo.innerHTML = '';
            if (!json || !json.ok) {
                selectPeriodo.innerHTML = '<option value="">Error al cargar periodos</option>';
                return;
            }
            var periodos = Array.isArray(json.periodos) ? json.periodos : [];
            var used = Array.isArray(json.used) ? json.used.map(Number) : [];
            // Filtrar
            var disponibles = periodos.filter(p => !used.includes(Number(p.idTrimestrePeriodo || p.id || p.idPeriodo || p.idTrimestreperiodo)));
            if (disponibles.length === 0) {
                selectPeriodo.innerHTML = '<option value="">No hay periodos disponibles para este año</option>';
                selectPeriodo.disabled = true;
                return;
            }
            disponibles.forEach(p => {
                // Normalizar id y nombre
                var id = p.idTrimestrePeriodo || p.id || p.idPeriodo || p.idTrimestreperiodo || p.id_trimestreperiodo;
                var nombre = p.nombre || p.NOMBRE || p.sigla || (p.nombrePeriodo || 'Periodo');
                var opt = document.createElement('option');
                opt.value = String(id);
                opt.textContent = nombre + (p.sigla ? ' (' + p.sigla + ')' : '');
                selectPeriodo.appendChild(opt);
            });
            selectPeriodo.disabled = false;
        }).catch(err => {
            console.error('Error recuperaPeriodosTrimestre:', err);
            selectPeriodo.innerHTML = '<option value="">Error al cargar periodos</option>';
            selectPeriodo.disabled = true;
        });
    }

    // Cargar por defecto para el año seleccionado
    cargarPeriodos(selectAnio.value);

    // Cargar lista de estados para el select (intentar desde servidor, si falla usar respaldo)
    function cargarEstados() {
        if (!selectEstado) return;
        // petición al controlador esperado
        if (typeof postForm === 'function') {
            postForm('controlador/recuperaTrimestreEstados.php', {})
            .then(json => {
                selectEstado.innerHTML = '';
                if (json && json.ok && Array.isArray(json.estados) && json.estados.length>0) {
                    var foundActivo = null;
                    // helper para normalizar texto (sin acentos, lowercase)
                    function _norm(s){ try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim(); } catch(e) { try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); } catch(e2){ return String(s).toLowerCase(); } } }
                    var desired = 'recepcion de preferencias';
                    var desiredValue = null;
                    json.estados.forEach(e => {
                        var id = e.idTrimestreEstado || e.id || e.idTrimestreestado || e.id_trimestreestado;
                        var nombre = e.estado || e.nombre || String(e);
                        var opt = document.createElement('option'); opt.value = String(id); opt.textContent = nombre;
                        selectEstado.appendChild(opt);
                        if (String(nombre).toLowerCase() === 'activo') foundActivo = opt;
                        try { if (_norm(nombre) === desired) desiredValue = String(id); } catch(e){}
                    });
                    // Preferir 'Recepción de preferencias' si existe (normalizado)
                    if (desiredValue !== null) {
                        selectEstado.value = desiredValue;
                    } else if (foundActivo) {
                        foundActivo.selected = true;
                    }
                    return;
                }
                // si no hay datos, usar respaldo
                throw new Error('No se recibieron estados');
            }).catch(err => {
                console.warn('No se pudieron recuperar estados desde servidor, usando fallback. Error:', err);
                // Respaldo
                selectEstado.innerHTML = '';
                var defaults = [ {id: '1', estado: 'Activo'}, {id: '2', estado: 'Inactivo'} ];
                defaults.forEach(d => {
                    var o = document.createElement('option'); o.value = String(d.id); o.textContent = d.estado; selectEstado.appendChild(o);
                });
                // seleccionar Activo por defecto
                selectEstado.value = '1';
            });
        } else {
            // Sin helper postForm -> usar respaldo
            selectEstado.innerHTML = '';
            var defaults = [ {id: '1', estado: 'Activo'}, {id: '2', estado: 'Inactivo'} ];
            defaults.forEach(d => { var o = document.createElement('option'); o.value = String(d.id); o.textContent = d.estado; selectEstado.appendChild(o); });
            selectEstado.value = '1';
        }
    }

    // Ejecutar carga de estados
    cargarEstados();

    selectAnio.addEventListener('change', function() {
        cargarPeriodos(this.value);
    });

    // Inicializar bootstrap modal si está disponible
    var bsModal = null;
    try {
        bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    } catch (e) {
        modal.style.display = 'block';
    }

    // Guardar
    modal.querySelector('#guardarNuevoTrimestre').addEventListener('click', function() {
        // Si el usuario escogió insertar año, tomar el valor del input y validarlo
        var anio = selectAnio.value;
        if (String(anio) === 'insertar') {
            var custom = document.getElementById('nuevo_trimestre_anio_custom');
            if (custom) anio = String(custom.value || '').trim();
        }
        var idPeriodo = selectPeriodo.value;
        var fecha = inputFecha.value;
        var estadoId = (typeof selectEstado !== 'undefined' && selectEstado) ? selectEstado.value : '';
        if (!anio) { swalAlertOpt('Error', 'Selecciona un año', 'error'); return; }
        // validar que el año sea numérico y >= 2000
        var anioNum = parseInt(String(anio), 10);
        if (isNaN(anioNum) || anioNum < 2000) { swalAlertOpt('Error', 'Introduce un año válido (2000 o posterior)', 'error'); return; }
        if (!idPeriodo) { swalAlertOpt('Error', 'Selecciona un periodo disponible', 'error'); return; }
        if (!fecha) { swalAlertOpt('Error', 'Selecciona una fecha límite válida', 'error'); return; }
        // Validación cliente: fecha > hoy
        var fSel = new Date(fecha + 'T00:00:00');
        var hoy = new Date(); hoy.setHours(0,0,0,0);
        if (!(fSel.getTime() > hoy.getTime())) {
            swalAlertOpt('Error', 'La fecha límite debe ser posterior a la fecha actual', 'error');
            return;
        }
        this.disabled = true;
    // Enviar estado si se seleccionó uno
    var payload = { anio: String(anioNum), idPeriodo: idPeriodo, fechaLimite: fecha };
    if (estadoId) payload.estadoId = estadoId;
    postForm('controlador/insertarTrimestre.php', payload)
        .then(json => {
                if (json && json.ok) {
                swalAlertOpt('Correcto', json.msg || 'Trimestre creado', 'success');
                try { bsModal.hide(); } catch (e) { modal.parentNode.removeChild(modal); }
                // Actualizar la tabla de trimestres si el módulo la expone
                try { if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){ console.warn('No se pudo refrescar la lista de trimestres:', e); }
                // Opcional: si hay un contenedor de trimestres, actualizarlo
                } else {
                var msg = (json && json.msg) ? json.msg : JSON.stringify(json);
                swalAlertOpt('Error', 'No se pudo crear el trimestre: ' + msg, 'error');
                modal.querySelector('#guardarNuevoTrimestre').disabled = false;
            }
        }).catch(err => {
            console.error('Error insertarTrimestre:', err);
            swalAlertOpt('Error', 'Error al crear trimestre', 'error');
            modal.querySelector('#guardarNuevoTrimestre').disabled = false;
        });
    });

}

// =============================
// Menú de programación (historialProgramacion)
// Reemplaza el contenedor principal por un menú inicial de filtros:
// 1) Selección múltiple de trimestres (modal con opción "Todos")
// 2) Segundo menú para filtrar por UEA y Profesor (multi-select modal)
// 3) Render de tabla con columnas solicitadas
// Usa SweetAlert si disponible; fallback con alert/prompts simples.
// =============================
try {
    if (typeof window !== 'undefined') window.historialProgramacion = historialProgramacion;
} catch(e){}

// =============================
// Menú de preferencias (historialPreferencias)
// Misma UX y filtros que programación, pero consulta preferencias
// =============================
try { if (typeof window !== 'undefined') window.historialPreferencias = historialPreferencias; } catch(e){}

function historialPreferencias(){
    const container = document.getElementById('trimestres-table-container');
    if (!container){ console.warn('Contenedor de tabla no encontrado'); return; }
    container.innerHTML = '';

    // Barra superior con volver
    const topBar = document.createElement('div'); topBar.className='d-flex align-items-center mb-3';
    const backBtn = document.createElement('button'); backBtn.type='button'; backBtn.className='btn btn-sm btn-outline-secondary me-2'; backBtn.innerHTML='← Volver';
    backBtn.addEventListener('click', function(){ try { if (typeof window.refrescarTrimestres==='function') window.refrescarTrimestres(); else location.reload(); } catch(e){ location.reload(); } });
    const title = document.createElement('h5'); title.className='m-0'; title.textContent='Menú de preferencias';
    topBar.appendChild(backBtn); topBar.appendChild(title); container.appendChild(topBar);

    const primaryMenu = document.createElement('div'); primaryMenu.className='card mb-3';
    const pmBody = document.createElement('div'); pmBody.className='card-body';
    pmBody.innerHTML = '<p class="mb-2">Seleccione el criterio inicial para explorar las preferencias:</p>';
    const btnRow = document.createElement('div'); btnRow.className='d-flex flex-wrap gap-2';
    const opts = [
        { id:'pref-por-anio', label:'Mostrar por año', action: seleccionarTrimestresPref },
        { id:'pref-por-uea', label:'Mostrar por UEA', action: seleccionarUEAsPref },
        { id:'pref-por-prof', label:'Mostrar por profesor', action: seleccionarProfesoresPref }
    ];
    opts.forEach(op => { const b=document.createElement('button'); b.type='button'; b.id=op.id; b.className='btn btn-primary btn-sm'; b.textContent=op.label; b.addEventListener('click', ()=> op.action(op.id)); btnRow.appendChild(b); });
    pmBody.appendChild(btnRow); primaryMenu.appendChild(pmBody); container.appendChild(primaryMenu);

    const breadcrumbWrap = document.createElement('div'); breadcrumbWrap.id='pref-breadcrumbs'; breadcrumbWrap.className='d-flex align-items-center gap-2 mb-2';
    container.insertBefore(breadcrumbWrap, primaryMenu);
    const resultsWrap = document.createElement('div'); container.appendChild(resultsWrap);

    // Estado local
    let seleccionTrimestres = [];
    let seleccionAnios = [];
    let seleccionUEAs = [];
    let seleccionProfes = [];
    let modoInicial = null;
    let path = [];
    let cachedTrimestres = [];

    function renderBreadcrumbs(){
        breadcrumbWrap.innerHTML = '';
        if (!path || path.length === 0) return;
        path.forEach((p, idx) => {
            const chip = document.createElement('div');
            chip.className = 'badge rounded-pill bg-light border d-flex align-items-center';
            chip.style.padding = '0.35rem 0.6rem';
            const txt = document.createElement('span'); txt.textContent = p.label; txt.className = 'me-2 text-dark';
            const btn = document.createElement('button'); btn.type='button'; btn.className='btn btn-sm btn-link p-0 ms-1'; btn.style.lineHeight='1'; btn.innerHTML='&times;';
            btn.title = 'Quitar y volver';
            btn.addEventListener('click', function(){
                // reset al primer menú
                seleccionTrimestres = []; seleccionAnios = []; seleccionUEAs = []; seleccionProfes = []; modoInicial = null; path = [];
                resultsWrap.innerHTML = ''; primaryMenu.style.display=''; renderBreadcrumbs();
            });
            chip.appendChild(txt); chip.appendChild(btn); breadcrumbWrap.appendChild(chip);
        });
    }

    // Fuentes de datos compartidas con programación
    function cargarTrimestres(){
        return new Promise((resolve,reject)=>{
            fetch('controlador/recuperarTrimestresProgramacion.php',{method:'POST'})
            .then(r=>r.json())
            .then(j=>{ if(!j||!j.ok) reject(j&&j.error||'Error'); const list = Array.isArray(j.trimestres)? j.trimestres.map(t=>({ idTrimestre: Number(t.idTrimestre||t.id||t.idtrimestre), año: Number(t.año||t.anio||t.year), label: (t.año||t.anio)+' - '+(t.sigla||t.periodo||'') })) : []; cachedTrimestres = list; resolve(list); }).catch(e=>reject(e.message||e));
        });
    }
    function cargarUEAs(){
        return fetch('controlador/recuperarUEAsTodos.php',{method:'POST'})
            .then(r=>r.json())
            .then(j=>{
                if(!j||!j.ok) throw new Error(j&&j.error||'Error');
                return Array.isArray(j.ueas) ? j.ueas.map(u=>{
                    // soportar distintos nombres desde el servidor: cUEA/nUEA o claveUEA/nombre
                    const rawId = (u.idUEA !== undefined && u.idUEA !== null) ? u.idUEA : (u.id || null);
                    const clave = (u.cUEA !== undefined && u.cUEA !== null) ? String(u.cUEA) : (u.claveUEA || u.clave || '');
                    const nombre = u.nUEA || u.nombreUEA || u.nombre || '';
                    const label = (clave ? (clave + ' - ') : '') + nombre;
                    const idForFilter = clave ? String(clave) : String(rawId);
                    return { id: idForFilter, label: String(label) };
                }) : [];
            });
    }
    function cargarProfes(){
        return fetch('controlador/recuperarProfesoresTodos.php',{method:'POST'})
            .then(r=>r.json())
            .then(j=>{
                if(!j||!j.ok) throw new Error(j&&j.error||'Error');
                return Array.isArray(j.profesores)? j.profesores.map(p=>({ id: String(p.numeroEconomico), label: (p.numeroEconomico||'')+' - '+(p.nombre||'') })) : [];
            });
    }

    // Helper para abrir modal multi-select de forma segura reutilizando la global si existe
    function showMulti(opts){
        // Normalizar items a {id,label} para protegernos contra distintos formatos
        try {
            if (!opts) opts = {};
            let items = Array.isArray(opts.items) ? opts.items.slice() : [];
            items = items.map(function(it, idx){
                if (it === null || it === undefined) return { id: String(idx), label: String(idx) };
                if (typeof it === 'string' || typeof it === 'number') return { id: String(it), label: String(it) };
                // objeto: intentar extraer id/label de campos comunes
                const id = (it.id !== undefined && it.id !== null) ? String(it.id) : (it.claveUEA !== undefined ? String(it.claveUEA) : (it.idUEA !== undefined ? String(it.idUEA) : String(idx)));
                let label = '';
                if (it.label) label = String(it.label);
                else if (it.nombre) label = (it.claveUEA ? (String(it.claveUEA) + ' - ') : '') + String(it.nombre);
                else if (it.claveUEA) label = String(it.claveUEA);
                else label = id;
                return { id: id, label: label };
            });
            opts.items = items;
            if (typeof window !== 'undefined' && typeof window.mostrarModalMultiSelect === 'function') {
                return window.mostrarModalMultiSelect(opts);
            }
        } catch(_){ }
        // Fallback muy simple si no existe el helper global: pedir IDs separados por coma
        const ids = prompt((opts && opts.titulo) ? opts.titulo : 'Selecciona', '');
        const arr = (ids||'').split(',').map(s=>s.trim()).filter(Boolean);
        if (opts && typeof opts.onAccept === 'function') opts.onAccept(arr);
    }

    function seleccionarTrimestresPref(modo){
        const isSecondary = (modo === 'select-trimestres');
        if (!isSecondary) modoInicial = modo;
        cargarTrimestres().then(list => {
            if (modo === 'pref-por-anio'){
                // Mostrar años únicos
                const anios = Array.from(new Set(list.map(t=>t.año))).sort((a,b)=>b-a);
                showMulti({ titulo:'Selecciona años', items: anios.map(a=>({ id:String(a), label:String(a) })), incluirTodos:true, selected: seleccionAnios, onAccept: (ids)=>{ seleccionAnios = ids.map(x=>Number(x)); path = [{type:'anio', label: 'Años: '+seleccionAnios.join(', ')}]; renderBreadcrumbs(); construirSegundoMenu(); } });
                return;
            }
            // Mostrar trimestres (filtrados por años si ya se seleccionaron)
            let items = list.map(t => ({ id: t.idTrimestre, label: t.label, año: t.año }));
            if (Array.isArray(seleccionAnios) && seleccionAnios.length>0) items = items.filter(it => seleccionAnios.includes(Number(it.año)));
            showMulti({ titulo:'Selecciona trimestres', items, incluirTodos:true, selected: seleccionTrimestres.map(String), onAccept:(ids)=>{ seleccionTrimestres = ids.map(Number); if (!isSecondary){ path = [{type:'trimestres', label: 'Trimestres ('+seleccionTrimestres.length+')'}]; renderBreadcrumbs(); } construirSegundoMenu(); } });
        }).catch(err => swalAlertOpt('Error','No se pudieron cargar trimestres: '+err,'error'));
    }
    function seleccionarUEAsPref(){ modoInicial='pref-por-uea'; cargarUEAs().then(items=>{ showMulti({ titulo:'Selecciona UEA', items, incluirTodos:true, selected: seleccionUEAs, onAccept:(ids)=>{ seleccionUEAs = ids.slice(); path=[{type:'ueas', label:'UEA ('+seleccionUEAs.length+')'}]; renderBreadcrumbs(); construirSegundoMenu(); } }); }).catch(err=>swalAlertOpt('Error','No se pudieron cargar UEA: '+err,'error')); }
    function seleccionarProfesoresPref(){ modoInicial='pref-por-prof'; cargarProfes().then(items=>{ showMulti({ titulo:'Selecciona profesores', items, incluirTodos:true, selected: seleccionProfes, onAccept:(ids)=>{ seleccionProfes = ids.slice(); path=[{type:'profes', label:'Profesores ('+seleccionProfes.length+')'}]; renderBreadcrumbs(); construirSegundoMenu(); } }); }).catch(err=>swalAlertOpt('Error','No se pudieron cargar profesores: '+err,'error')); }

    function construirSegundoMenu(){
        resultsWrap.innerHTML='';
        // Ocultar el menú primario (primer paso) cuando mostramos el segundo menú
        try { if (typeof primaryMenu !== 'undefined' && primaryMenu && primaryMenu.style) { primaryMenu.style.display = 'none'; } } catch(e) { /* noop */ }
        const card = document.createElement('div'); card.className='card mb-3'; card.id='pref-second-menu-card';
        const body = document.createElement('div'); body.className='card-body';
        const info = document.createElement('p'); info.className='mb-2'; info.textContent='Seleccione filtros opcionales y luego presione "Buscar".'; body.appendChild(info);
        const btns = document.createElement('div'); btns.className='d-flex flex-wrap gap-2 mb-3';
        const btnTrim = document.createElement('button'); btnTrim.type='button'; btnTrim.className='btn btn-outline-secondary btn-sm'; btnTrim.textContent='Trimestres'; btnTrim.addEventListener('click', ()=> seleccionarTrimestresPref('select-trimestres'));
    const btnUEA = document.createElement('button'); btnUEA.type='button'; btnUEA.className='btn btn-outline-primary btn-sm'; btnUEA.textContent='UEA'; btnUEA.addEventListener('click', ()=>{ cargarUEAs().then(items=>{ showMulti({ titulo:'Selecciona UEA', items, incluirTodos:true, selected: seleccionUEAs, onAccept:(ids)=>{ seleccionUEAs = ids.slice(); pintarResumen(); } }); }); });
    const btnProf = document.createElement('button'); btnProf.type='button'; btnProf.className='btn btn-outline-primary btn-sm'; btnProf.textContent='Profesores'; btnProf.addEventListener('click', ()=>{ cargarProfes().then(items=>{ showMulti({ titulo:'Selecciona profesores', items, incluirTodos:true, selected: seleccionProfes, onAccept:(ids)=>{ seleccionProfes = ids.slice(); pintarResumen(); } }); }); });
        const btnBuscar = document.createElement('button'); btnBuscar.type='button'; btnBuscar.className='btn btn-success btn-sm'; btnBuscar.textContent='Buscar'; btnBuscar.addEventListener('click', ejecutarBusqueda);
        if (modoInicial === 'pref-por-uea') btnUEA.style.display='none';
        if (modoInicial === 'pref-por-prof') btnProf.style.display='none';
        btns.appendChild(btnTrim); btns.appendChild(btnUEA); btns.appendChild(btnProf); btns.appendChild(btnBuscar);
        body.appendChild(btns);
        const resumen = document.createElement('div'); resumen.id='pref-filtros-resumen'; resumen.className='small text-muted'; body.appendChild(resumen);
        card.appendChild(body); resultsWrap.appendChild(card);
        pintarResumen();
    }

    function pintarResumen(){
        const r = document.getElementById('pref-filtros-resumen'); if(!r) return;
        function fmt(list, label){ if(!list||list.length===0) return label+': '+list.length+' seleccionado(s)'; return label+': '+list.length+' seleccionado(s)'; }
        const trimestresLabel = (seleccionAnios && seleccionAnios.length>0) ? ('Años: '+seleccionAnios.join(', ')) : fmt(seleccionTrimestres,'Trimestres');
        r.textContent = [trimestresLabel, fmt(seleccionUEAs,'UEA'), fmt(seleccionProfes,'Profesores')].join(' | ');
    }

    function ejecutarBusqueda(){
        try { const sm = document.getElementById('pref-second-menu-card'); if (sm) sm.style.display='none'; } catch(e){}
        try { const prev = document.getElementById('pref-results-wrap'); if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch(e){}
        const results = document.createElement('div'); results.id='pref-results-wrap'; results.className='mb-3';
        const tableZone = document.createElement('div'); tableZone.className='mb-2 text-muted'; tableZone.textContent='Buscando preferencias...'; results.appendChild(tableZone); resultsWrap.appendChild(results);

        // Construir payload
        const payload = {
            anios: (seleccionAnios && seleccionAnios.length) ? seleccionAnios.map(Number) : [],
            trimestres: (seleccionTrimestres && seleccionTrimestres.length) ? seleccionTrimestres.map(Number) : [],
            ueas: (seleccionUEAs && seleccionUEAs.length) ? seleccionUEAs.slice() : [],
            profesores: (seleccionProfes && seleccionProfes.length) ? seleccionProfes.slice() : [],
            trimestresIds: (seleccionTrimestres && seleccionTrimestres.length) ? seleccionTrimestres.map(Number) : []
        };
        const payloadToSend = Object.assign({}, payload, { trimestres: payload.trimestresIds });
        fetch('controlador/buscarPreferenciasMulti.php', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payloadToSend)})
        .then(r=>r.json())
        .then(j=>{
            if(!j||!j.ok){ tableZone.textContent='Error en servidor'; try{ if (document.getElementById('pref-second-menu-card')) document.getElementById('pref-second-menu-card').style.display=''; }catch(_){} return; }
            pintarTablaPreferencias(j.preferencias||[]);
        }).catch(err=>{
            tableZone.textContent='Error: '+(err.message||err);
            try{ if (document.getElementById('pref-second-menu-card')) document.getElementById('pref-second-menu-card').style.display=''; }catch(_){ }
        });
    }

    function pintarTablaPreferencias(rows){
        let mount = document.getElementById('pref-results-wrap'); if (!mount){ mount = document.createElement('div'); mount.id='pref-results-wrap'; resultsWrap.appendChild(mount); }
        mount.innerHTML = '';
        const wrap = document.createElement('div');
        const tbl = document.createElement('table'); tbl.className='table table-sm table-striped';
        const thead = document.createElement('thead'); const trh = document.createElement('tr');
        const cols = ['TRIMESTRE','NUMERO ECONOMICO','NOMBRE','TIPO DE PROFESOR','DISCIPLINA','NO. DE GRUPOS','0 UEA','1 UEA','2 UEA','3 UEA','4 UEA','5 UEA','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','OBSERVACIONES'];
        cols.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; trh.appendChild(th); });
        thead.appendChild(trh); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        if (!rows.length){ const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=cols.length; td.textContent='Sin resultados'; tr.appendChild(td); tbody.appendChild(tr); }
        rows.forEach(r=>{
            const tr=document.createElement('tr');
            addCell(tr,r.trimestre); addCell(tr,r.numeroEconomico); addCell(tr,r.nombre); addCell(tr,r.tipoProfesor); addCell(tr,r.disciplina); addCell(tr, r.noGrupos==null?'':String(r.noGrupos));
            addCell(tr,r.uea0); addCell(tr,r.uea1); addCell(tr,r.uea2); addCell(tr,r.uea3); addCell(tr,r.uea4); addCell(tr,r.uea5);
            addCell(tr,r.lunes); addCell(tr,r.martes); addCell(tr,r.miercoles); addCell(tr,r.jueves); addCell(tr,r.viernes);
            addCell(tr,r.observaciones);
            tbody.appendChild(tr);
        });
    tbl.appendChild(tbody);
    // Encapsular la tabla en un contenedor responsive (clases aplicadas desde css/styles.css)
    const resp = document.createElement('div');
    // mantener la clase bootstrap "table-responsive" por compatibilidad y añadir clase propia
    resp.className = 'table-responsive pref-table-responsive';
    // aplicar clase que fuerza un min-width en la tabla (definida en css/styles.css)
    tbl.classList.add('pref-table-minwidth');
    resp.appendChild(tbl);
    wrap.appendChild(resp);
    mount.appendChild(wrap);
        function addCell(tr, txt){ const td=document.createElement('td'); td.textContent= txt==null?'':String(txt); tr.appendChild(td); }

        // Mostrar chip de resultado y flecha en breadcrumbs para permitir volver al primer menú
        try { renderResultChipPref(); } catch(e){ /* noop */ }

        // Dibuja la flecha y el chip de resultado en el breadcrumb (permite volver al primer menú)
        function renderResultChipPref(){
            try{
                const bc = document.getElementById('pref-breadcrumbs');
                if(!bc) return;
                // evitar duplicados
                if (bc.querySelector('.pref-result-chip')) return;

                // Flecha (no clicable) y chip de resultado — los agregamos al final del breadcrumb
                // para que aparezcan después de los pasos anteriores (como en programación)
                const arrow = document.createElement('span');
                arrow.id = 'pref-next-arrow';
                // reutilizar clase prog-arrow (tiene estilos en styles_patch_prog.css) y añadir pref-arrow por si acaso
                arrow.className = 'prog-arrow pref-arrow';
                arrow.textContent = '→';

                // Chip de resultado con botón para limpiar
                const chip = document.createElement('div');
                chip.id = 'pref-result-chip';
                chip.className = 'badge rounded-pill bg-light border d-flex align-items-center pref-result-chip';
                chip.style.padding = '0.35rem 0.6rem';
                const txt = document.createElement('span'); txt.textContent = 'Resultados'; txt.className = 'me-2 text-dark';
                const btn = document.createElement('button'); btn.type='button'; btn.className='btn btn-sm btn-link p-0 ms-1'; btn.style.lineHeight='1'; btn.innerHTML='&times;'; btn.title='Cerrar resultados y volver';
                btn.addEventListener('click', function(){
                    // quitar resultados y restaurar primer menú
                    const wrapEl = document.getElementById('pref-results-wrap'); if (wrapEl && wrapEl.parentNode) wrapEl.parentNode.removeChild(wrapEl);
                    // mostrar segundo menú de filtros otra vez
                    try { const sm = document.getElementById('pref-second-menu-card'); if (sm) sm.style.display = ''; } catch(e){}
                    // quitar chip y flecha
                    const arr = document.getElementById('pref-next-arrow'); if (arr && arr.parentNode) arr.parentNode.removeChild(arr);
                    const ch = document.getElementById('pref-result-chip'); if (ch && ch.parentNode) ch.parentNode.removeChild(ch);
                });
                chip.appendChild(txt); chip.appendChild(btn);

                // Añadir al final del breadcrumb (misma lógica que renderResultChip de programación)
                bc.appendChild(arrow);
                bc.appendChild(chip);
            }catch(e){ console.warn('renderResultChipPref error', e); }
        }

        function showPrimaryMenuPref(){
            try {
                if (typeof primaryMenu !== 'undefined' && primaryMenu && primaryMenu.style) {
                    primaryMenu.style.display = '';
                }
                // eliminar segundo menú si existe
                const second = document.getElementById('pref-second-menu-card'); if (second && second.parentNode) second.parentNode.removeChild(second);
                // limpiar breadcrumbs
                const bc = document.getElementById('pref-breadcrumbs'); if (bc) { bc.innerHTML = ''; }
                // asegurar que resultados previos se eliminen
                const wrapEl = document.getElementById('pref-results-wrap'); if (wrapEl && wrapEl.parentNode) wrapEl.parentNode.removeChild(wrapEl);
            } catch(e){ /* noop */ }
        }
    }
}

// Helper global: definir mostrarModalMultiSelect a nivel window si no existe para uso compartido (programación y preferencias)
try {
    if (typeof window !== 'undefined' && typeof window.mostrarModalMultiSelect === 'undefined') {
        window.mostrarModalMultiSelect = function(opts){
            const { titulo, items, incluirTodos, onAccept, selected } = opts || {};
            if (window.Swal){
                const html = document.createElement('div');
                const search = document.createElement('input'); search.type='text'; search.placeholder='Buscar'; search.className='form-control form-control-sm mb-2';
                html.appendChild(search);
                const box = document.createElement('div'); box.style.maxHeight='320px'; box.style.overflow='auto'; box.className='border rounded p-2';
                let current = Array.isArray(selected) ? selected.map(String) : [];
                const render = (q)=>{
                    box.innerHTML='';
                    const filtered = Array.isArray(items)? items.filter(it=> !q || (it.label && String(it.label).toLowerCase().includes(String(q).toLowerCase()))) : [];
                    if(incluirTodos){
                        const chkAll = document.createElement('div'); chkAll.className='form-check';
                        const c=document.createElement('input'); c.type='checkbox'; c.className='form-check-input'; c.id='chk_all_modal_glob'; c.value='ALL';
                        c.checked = current.includes('ALL');
                        c.addEventListener('change', ()=>{
                            if(c.checked){ current = ['ALL']; [...box.querySelectorAll('input[type="checkbox"]:not(#chk_all_modal_glob)')].forEach(x=> x.checked=false); }
                            else { current = []; }
                        });
                        const l=document.createElement('label'); l.className='form-check-label'; l.htmlFor='chk_all_modal_glob'; l.textContent='Todos';
                        chkAll.appendChild(c); chkAll.appendChild(l); box.appendChild(chkAll);
                    }
                    filtered.forEach(it=>{
                        const div=document.createElement('div'); div.className='form-check';
                        const c=document.createElement('input'); c.type='checkbox'; c.className='form-check-input'; c.id='chk_'+it.id; c.value=String(it.id);
                        try { c.checked = current.indexOf(String(it.id)) !== -1 || current.indexOf(Number(it.id)) !== -1; } catch(e) { c.checked = false; }
                        c.addEventListener('change', ()=>{
                            if (current.includes('ALL')){ current = current.filter(x=> x!=='ALL'); const allEl=box.querySelector('#chk_all_modal_glob'); if(allEl) allEl.checked=false; }
                            if (c.checked) { if (!current.includes(c.value)) current.push(c.value); } else { current = current.filter(x=> x!==c.value); }
                        });
                        const l=document.createElement('label'); l.className='form-check-label'; l.htmlFor='chk_'+it.id; l.textContent=it.label;
                        div.appendChild(c); div.appendChild(l); box.appendChild(div);
                    });
                };
                render('');
                html.appendChild(box);
                search.addEventListener('input', ()=> render(search.value));
                Swal.fire({ title: titulo||'Seleccionar', html: html, width: 600, showCancelButton: true, confirmButtonText: 'Aceptar', cancelButtonText: 'Cancelar', preConfirm: ()=> Array.from(new Set(current.slice())) })
                .then(res=>{ if(res.isConfirmed && typeof onAccept==='function'){ onAccept(res.value||[]); } });
            } else {
                const ids = prompt((titulo||'Seleccionar')+' (IDs separados por coma, ALL para todos)') || '';
                const arr = ids.split(',').map(s=>s.trim()).filter(s=>s);
                if (typeof onAccept==='function') onAccept(arr.length? arr: []);
            }
        };
    }
} catch(_){ }

function historialProgramacion(){
    const container = document.getElementById('trimestres-table-container');
    if (!container){ console.warn('Contenedor de tabla no encontrado'); return; }
    container.innerHTML = '';

    // Barra superior con volver
    const topBar = document.createElement('div'); topBar.className='d-flex align-items-center mb-3';
    const backBtn = document.createElement('button'); backBtn.type='button'; backBtn.className='btn btn-sm btn-outline-secondary me-2'; backBtn.innerHTML='← Volver';
    backBtn.addEventListener('click', function(){ try { if (typeof window.refrescarTrimestres==='function') window.refrescarTrimestres(); } catch(e){ location.reload(); } });
    const title = document.createElement('h5'); title.className='m-0'; title.textContent='Menú de programación';
    topBar.appendChild(backBtn); topBar.appendChild(title); container.appendChild(topBar);

    const primaryMenu = document.createElement('div'); primaryMenu.className='card mb-3';
    const pmBody = document.createElement('div'); pmBody.className='card-body';
    pmBody.innerHTML = '<p class="mb-2">Seleccione el criterio inicial para explorar la programación:</p>';
    const btnRow = document.createElement('div'); btnRow.className='d-flex flex-wrap gap-2';
    const opts = [
        { id:'prog-por-anio', label:'Mostrar por año', action: seleccionarTrimestres },
        { id:'prog-por-uea', label:'Mostrar por UEA', action: seleccionarUEAs },
        { id:'prog-por-prof', label:'Mostrar por profesor', action: seleccionarProfesores }
    ];
    opts.forEach(op => { const b=document.createElement('button'); b.type='button'; b.id=op.id; b.className='btn btn-primary btn-sm'; b.textContent=op.label; b.addEventListener('click', ()=> op.action(op.id)); btnRow.appendChild(b); });
    pmBody.appendChild(btnRow); primaryMenu.appendChild(pmBody); container.appendChild(primaryMenu);

    // Breadcrumbs / camino de selección (mostrará la acción seleccionada con una 'x' para retroceder)
    const breadcrumbWrap = document.createElement('div');
    breadcrumbWrap.id = 'prog-breadcrumbs';
    breadcrumbWrap.className = 'd-flex align-items-center gap-2 mb-2';
    // insert breadcrumbs above primary menu (after topBar)
    container.insertBefore(breadcrumbWrap, primaryMenu);

    // Área donde se mostrará el segundo menú y la tabla final
    const resultsWrap = document.createElement('div'); container.appendChild(resultsWrap);

    // Estado local
    let seleccionTrimestres = [];
    let seleccionAnios = [];
    let seleccionUEAs = [];
    let seleccionProfes = [];
    let modoInicial = null; // 'prog-por-anio' | 'prog-por-uea' | 'prog-por-prof'
    // Camino de selecciones (array de { type, label })
    let path = [];
    // Cache de trimestres para construir filtros detallados { anio, periodo }
    let cachedTrimestres = [];

    function renderBreadcrumbs(){
        breadcrumbWrap.innerHTML = '';
        if (!path || path.length === 0) return;
        path.forEach((p, idx) => {
            const chip = document.createElement('div');
            chip.className = 'badge rounded-pill bg-light border d-flex align-items-center';
            chip.style.padding = '0.35rem 0.6rem';
            const txt = document.createElement('span'); txt.textContent = p.label; txt.className = 'me-2 text-dark';
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-sm btn-link p-0 ms-1'; btn.style.lineHeight = '1'; btn.innerHTML = '&times;';
            btn.title = 'Quitar y volver';
            btn.addEventListener('click', function(){
                // retroceder: quitar desde idx hasta el final
                path = path.slice(0, idx);
                renderBreadcrumbs();
                // si no quedan pasos, mostrar menú principal y ocultar segundo menú
                if (path.length === 0){
                    try { primaryMenu.style.display = ''; } catch(e){}
                    resultsWrap.innerHTML = '';
                }
            });
            chip.appendChild(txt); chip.appendChild(btn); breadcrumbWrap.appendChild(chip);
        });
    }

    // Paso 1: seleccionar trimestres o años
    function seleccionarTrimestres(modo){
        // Cuando se invoca desde el segundo menú usamos modo = 'select-trimestres'.
        // En ese caso NO debemos alterar modoInicial ni agregar un chip extra en el breadcrumb.
        const isSecondary = (modo === 'select-trimestres');
        if (!isSecondary) {
            modoInicial = modo; // sólo la primera vez (modo inicial: prog-por-anio | prog-por-uea | prog-por-prof)
        }
        cargarTrimestres().then(list => {
            // Si el modo inicial es 'Mostrar por año' mostramos sólo años únicos
            if (modo === 'prog-por-anio'){
                const yearsSet = new Set();
                list.forEach(t => { if (t.año !== undefined && t.año !== null) yearsSet.add(Number(t.año)); });
                const years = Array.from(yearsSet).sort((a,b)=> b - a).map(y => ({ id: String(y), label: String(y) }));
                new Promise(function(resolve){
                    mostrarModalMultiSelect({
                        titulo: 'Seleccionar año(s)',
                        items: years,
                        incluirTodos: true,
                        selected: Array.isArray(seleccionAnios) ? seleccionAnios.map(String) : [],
                        onAccept: ids => resolve(ids)
                    });
                }).then(function(ids){
                    if (ids && ids.includes('ALL')) {
                        seleccionAnios = [];
                    } else {
                        seleccionAnios = (ids || []).map(x => Number(x)).filter(n => !isNaN(n));
                    }
                    // reset trimestres seleccionados
                    seleccionTrimestres = [];
                    // update path and UI: push action and show second menu
                    path.push({ type: 'anio', label: 'Año' });
                    renderBreadcrumbs();
                    try { primaryMenu.style.display = 'none'; } catch(e){}
                    construirSegundoMenu();
                }).catch(function(err){ swalAlertOpt && swalAlertOpt('Error','No se completó la selección','error'); });
                return;
            }

            // Mostrar trimestres (filtrados por años si ya se seleccionaron)
            let items = list.map(t => ({ id: t.idTrimestre, label: t.label, año: t.año }));
            if (Array.isArray(seleccionAnios) && seleccionAnios.length > 0){
                items = items.filter(it => seleccionAnios.includes(Number(it.año)));
            }
            new Promise(function(resolve){
                // 'items' ya tiene la propiedad `id` inicializada con el id del trimestre.
                // Evitar volver a acceder a `t.idTrimestre` aquí (no existe en los objetos de `items`),
                // porque eso provocaba que los checkbox recibieran value='undefined'.
                mostrarModalMultiSelect({
                    titulo: 'Seleccionar trimestres',
                    items: items.map(t => ({ id: t.id, label: t.label })),
                    incluirTodos: true,
                    selected: Array.isArray(seleccionTrimestres) ? seleccionTrimestres.map(String) : [],
                    onAccept: ids => resolve(ids)
                });
            }).then(function(ids){
                if (ids && ids.includes('ALL')) seleccionTrimestres = [];
                else seleccionTrimestres = (ids || []).map(x => Number(x)).filter(n => !isNaN(n));
                // debug log removed
                if (!isSecondary) {
                    // Flujo inicial: se seleccionaron trimestres como punto de entrada → agregar chip
                    path.push({ type: 'trimestre', label: 'Trimestre' });
                    renderBreadcrumbs();
                    try { primaryMenu.style.display = 'none'; } catch(e){}
                    construirSegundoMenu();
                } else {
                    // Flujo secundario: sólo refrescar resumen sin tocar breadcrumbs / menú
                    pintarResumen();
                }
            }).catch(function(err){ swalAlertOpt && swalAlertOpt('Error','No se completó la selección','error'); });
        }).catch(err => swalAlertOpt('Error','No se pudieron cargar trimestres: '+err,'error'));
    }

    // Seleccionar UEA primero (para 'Mostrar por UEA')
    function seleccionarUEAs(){
        modoInicial = 'prog-por-uea';
        cargarUEAs().then(items=>{
                new Promise(function(resolve){
                    mostrarModalMultiSelect({
                            titulo: 'Seleccionar UEA',
                            items: items,
                            incluirTodos: true,
                            selected: Array.isArray(seleccionUEAs) ? seleccionUEAs.map(String) : [],
                            onAccept: ids => resolve(ids)
                        });
                }).then(function(ids){
                    if (ids && ids.includes('ALL')) seleccionUEAs = [];
                    else seleccionUEAs = (ids || []).slice(); // conservar claves (pueden ser alfanuméricas)
                    // debug log removed
                    // reset trimestres/years selection
                    seleccionTrimestres = [];
                    seleccionAnios = [];
                    path.push({ type: 'uea', label: 'UEA' });
                    renderBreadcrumbs();
                    try { primaryMenu.style.display = 'none'; } catch(e){}
                    construirSegundoMenu();
                }).catch(function(err){ swalAlertOpt && swalAlertOpt('Error','No se completó la selección','error'); });
        }).catch(err => swalAlertOpt('Error','No se pudieron cargar UEA: '+err,'error'));
    }

    // Seleccionar profesores primero (para 'Mostrar por profesor')
    function seleccionarProfesores(){
        modoInicial = 'prog-por-prof';
        cargarProfes().then(items=>{
                new Promise(function(resolve){
                    mostrarModalMultiSelect({
                            titulo: 'Seleccionar profesores',
                            items: items,
                            incluirTodos: true,
                            selected: Array.isArray(seleccionProfes) ? seleccionProfes.map(String) : [],
                            onAccept: ids => resolve(ids)
                        });
                }).then(function(ids){
                    if (ids && ids.includes('ALL')) seleccionProfes = [];
                    else seleccionProfes = (ids || []).slice(); // conservar número económico como string
                    // debug log removed
                    // reset trimestres/years selection
                    seleccionTrimestres = [];
                    seleccionAnios = [];
                    path.push({ type: 'profesor', label: 'Profesor' });
                    renderBreadcrumbs();
                    try { primaryMenu.style.display = 'none'; } catch(e){}
                    construirSegundoMenu();
                }).catch(function(err){ swalAlertOpt && swalAlertOpt('Error','No se completó la selección','error'); });
        }).catch(err => swalAlertOpt('Error','No se pudieron cargar profesores: '+err,'error'));
    }

    // Carga de trimestres desde controlador recuperarTrimestresProgramacion.php
    function cargarTrimestres(){
        return new Promise((resolve,reject)=>{
            fetch('controlador/recuperarTrimestresProgramacion.php',{method:'POST'})
            .then(r=>r.json())
            .then(j=>{
                if(!j||!j.ok) return reject(j&&j.error?j.error:'Error');
                const arr = Array.isArray(j.trimestres)? j.trimestres:[];
                // Normalizar: garantizar idTrimestre, label y año (aceptar 'año' o 'anio' del servidor)
                const mapped = arr.map(t=>{
                    var rawYear = (t['año'] !== undefined && t['año'] !== null) ? t['año'] : ((t['anio'] !== undefined && t['anio'] !== null) ? t['anio'] : null);
                    var yearNum = rawYear !== null ? Number(rawYear) : null;
                    // conservar también posibles campos de periodo para construir payload
                    var periodoNombre = t.periodoNombre || t.nombre || '';
                    var sigla = t.sigla || '';
                    return { idTrimestre: t.idTrimestre, label: t.label || ((rawYear !== null ? rawYear : '') + ' - ' + (sigla||'')), año: yearNum, periodoNombre: periodoNombre, sigla: sigla };
                });
                try { cachedTrimestres = mapped.slice(); } catch(e){}
                resolve(mapped);
            }).catch(e=>reject(e.message||e));
        });
    }

    function cargarUEAs(){
        return fetch('controlador/recuperarUEAsTodos.php',{method:'POST'}).then(r=>r.json()).then(j=>{
            if(!j||!j.ok) return [];
            return Array.isArray(j.ueas)? j.ueas.map(u=>{
                // soportar distintas formas de nombrar campos desde el servidor
                const rawId = (u.idUEA !== undefined && u.idUEA !== null) ? u.idUEA : (u.id || null);
                const clave = (u.cUEA !== undefined && u.cUEA !== null) ? String(u.cUEA) : (u.claveUEA || u.clave || '');
                const nombre = u.nUEA || u.nombreUEA || u.nombre || '';
                const label = (clave ? (clave + ' - ') : '') + nombre;
                // Para filtros: enviar CLAVE de la UEA; si no hay clave, hacer fallback al id
                const idForFilter = clave ? String(clave) : String(rawId);
                return { id: idForFilter, label: String(label) };
            }) : [];
        });
    }
    function cargarProfes(){
        return fetch('controlador/recuperarProfesoresTodos.php',{method:'POST'}).then(r=>r.json()).then(j=>{
            if(!j||!j.ok) return [];
            // Para filtros: enviar NÚMERO ECONÓMICO del profesor
            return Array.isArray(j.profesores)? j.profesores.map(p=>({ id: String(p.numeroEconomico), label: (p.numeroEconomico||'')+' - '+(p.nombre||'') })) : [];
        });
    }

    // Construye el segundo menú: botones para seleccionar UEA y Profesor y botón Buscar
    function construirSegundoMenu(){
        resultsWrap.innerHTML='';
        const card = document.createElement('div'); card.className='card mb-3'; card.id = 'prog-second-menu-card';
        const body = document.createElement('div'); body.className='card-body';
        const info = document.createElement('p'); info.className='mb-2';
        info.textContent='Seleccione filtros opcionales y luego presione "Buscar".';
        body.appendChild(info);
    const btns = document.createElement('div'); btns.className='d-flex flex-wrap gap-2 mb-3';
    const btnTrim = document.createElement('button'); btnTrim.type='button'; btnTrim.className='btn btn-outline-secondary btn-sm'; btnTrim.textContent='Trimestres';
    // Abrir selector de trimestres; si se eligieron años previamente, el selector los filtrará
    btnTrim.addEventListener('click', ()=> seleccionarTrimestres('select-trimestres'));
        const btnUEA = document.createElement('button'); btnUEA.type='button'; btnUEA.className='btn btn-outline-primary btn-sm'; btnUEA.textContent='UEA'; btnUEA.addEventListener('click', ()=>{
            cargarUEAs().then(items=>{
                mostrarModalMultiSelect({ titulo:'Seleccionar UEA', items, incluirTodos:true, selected: Array.isArray(seleccionUEAs) ? seleccionUEAs.map(String) : [], onAccept: ids=>{ seleccionUEAs = ids.includes('ALL')? []: ids.slice(); pintarResumen(); } });
            });
        });
        const btnProf = document.createElement('button'); btnProf.type='button'; btnProf.className='btn btn-outline-primary btn-sm'; btnProf.textContent='Profesores'; btnProf.addEventListener('click', ()=>{
            cargarProfes().then(items=>{
                mostrarModalMultiSelect({ titulo:'Seleccionar profesores', items, incluirTodos:true, selected: Array.isArray(seleccionProfes) ? seleccionProfes.map(String) : [], onAccept: ids=>{ seleccionProfes = ids.includes('ALL')? []: ids.slice(); pintarResumen(); } });
            });
        });
        const btnBuscar = document.createElement('button'); btnBuscar.type='button'; btnBuscar.className='btn btn-success btn-sm'; btnBuscar.textContent='Buscar'; btnBuscar.addEventListener('click', ejecutarBusqueda);

        // Ocultar el botón correspondiente si el modo inicial ya seleccionó ese filtro
        try {
            if (modoInicial === 'prog-por-uea') {
                // Ya se seleccionó UEA en el primer paso, no mostrar el botón UEA en el segundo menú
                btnUEA.style.display = 'none';
            }
            if (modoInicial === 'prog-por-prof') {
                // Ya se seleccionó profesor en el primer paso, no mostrar el botón Profesores en el segundo menú
                btnProf.style.display = 'none';
            }
        } catch (e) { /* noop */ }

        btns.appendChild(btnTrim); btns.appendChild(btnUEA); btns.appendChild(btnProf); btns.appendChild(btnBuscar);
        body.appendChild(btns);
        const resumen = document.createElement('div'); resumen.id='prog-filtros-resumen'; resumen.className='small text-muted'; body.appendChild(resumen);
        card.appendChild(body); resultsWrap.appendChild(card);
        pintarResumen();

        // Nota: El chip de resultado y la flecha se dibujarán SOLO después de una búsqueda exitosa
    }

    // Renderiza la flecha y el chip de resultados en los breadcrumbs (solo tras Buscar)
    function renderResultChip(){
        try {
            // Eliminar cualquier chip/flecha previo
            const oldArrow = document.getElementById('prog-next-arrow'); if (oldArrow && oldArrow.parentNode) oldArrow.parentNode.removeChild(oldArrow);
            const oldChip = document.getElementById('prog-result-chip'); if (oldChip && oldChip.parentNode) oldChip.parentNode.removeChild(oldChip);
            // Etiqueta del chip según el modo inicial
            let chipText = 'Trimestre/UEA/Profesor';
            if (modoInicial === 'prog-por-uea') chipText = 'Trimestre/UEA';
            if (modoInicial === 'prog-por-prof') chipText = 'Trimestre/Profesor';
            // Flecha
            const arrow = document.createElement('span'); arrow.id='prog-next-arrow'; arrow.className='prog-arrow'; arrow.textContent='→';
            breadcrumbWrap.appendChild(arrow);
            // Chip con mismo formato que los breadcrumbs del primer menú
            const chip = document.createElement('div'); chip.id='prog-result-chip'; chip.className='badge rounded-pill bg-light border d-flex align-items-center';
            chip.style.padding = '0.35rem 0.6rem';
            const txt = document.createElement('span'); txt.className='me-2 text-dark'; txt.textContent = chipText;
            const close = document.createElement('button'); close.type='button'; close.className='btn btn-sm btn-link p-0 ms-1'; close.style.lineHeight='1'; close.title='Quitar resultado'; close.innerHTML='&times;';
            close.addEventListener('click', function(){
                // Al cerrar: eliminar tabla si existe y volver a mostrar el segundo menú
                try {
                    const tableWrap = document.getElementById('prog-results-wrap');
                    if (tableWrap && tableWrap.parentNode) tableWrap.parentNode.removeChild(tableWrap);
                    const sm = document.getElementById('prog-second-menu-card'); if (sm) sm.style.display='';
                    // quitar chip y flecha
                    const arr = document.getElementById('prog-next-arrow'); if (arr && arr.parentNode) arr.parentNode.removeChild(arr);
                    const ch = document.getElementById('prog-result-chip'); if (ch && ch.parentNode) ch.parentNode.removeChild(ch);
                } catch(e) { /* noop */ }
            });
            chip.appendChild(txt); chip.appendChild(close); breadcrumbWrap.appendChild(chip);
        } catch(e) { /* noop */ }
    }

    function pintarResumen(){
        const r = document.getElementById('prog-filtros-resumen'); if(!r) return;
        function fmt(list, label){ if(!list||list.length===0) return label+': Todos'; return label+': '+list.length+' seleccionado(s)'; }
        // Si hay años seleccionados mostrarlos; si no, mostrar resumen de trimestres
        const trimestresLabel = (seleccionAnios && seleccionAnios.length>0) ? ('Años: '+seleccionAnios.join(', ')) : fmt(seleccionTrimestres,'Trimestres');
        r.textContent = [trimestresLabel, fmt(seleccionUEAs,'UEA'), fmt(seleccionProfes,'Profesores')].join(' | ');
    }

    function ejecutarBusqueda(){
        // Ocultar segundo menú durante resultados
        try { const sm = document.getElementById('prog-second-menu-card'); if (sm) sm.style.display='none'; } catch(e){}
        // Eliminar tabla previa si existe
        try { const prev = document.getElementById('prog-results-wrap'); if (prev && prev.parentNode) prev.parentNode.removeChild(prev); } catch(e){}
        // Contenedor de resultados
        const results = document.createElement('div'); results.id='prog-results-wrap'; results.className='mb-3';
        const tableZone = document.createElement('div'); tableZone.className='mb-2 text-muted'; tableZone.textContent='Buscando programación...'; results.appendChild(tableZone); resultsWrap.appendChild(results);

        // Construir payload según especificación
        // anios: lista de años; trimestres: objetos { anio, periodo }
        let trimestresDet = [];
        try {
            if (Array.isArray(seleccionTrimestres) && seleccionTrimestres.length > 0 && Array.isArray(cachedTrimestres) && cachedTrimestres.length > 0){
                trimestresDet = seleccionTrimestres.map(function(id){
                    const t = cachedTrimestres.find(tt => String(tt.idTrimestre) === String(id));
                    if (!t) return null;
                    // usar sigla si existe; si no, intentar extraer de periodoNombre (texto entre paréntesis)
                    let periodo = t.sigla || '';
                    if (!periodo && t.periodoNombre){ const m = String(t.periodoNombre).match(/\(([^)]+)\)/); if (m && m[1]) periodo = m[1]; }
                    return { anio: Number(t.año), periodo: String(periodo||'') };
                }).filter(Boolean);
            }
        } catch(e){}

    // DEBUG: inspeccionar seleccionTrimestres y cachedTrimestres justo antes de construir el payload
    // debug logs removed

    const payload = {
            anios: (seleccionAnios && seleccionAnios.length) ? seleccionAnios.map(Number) : [],
            trimestres: trimestresDet, // objetos { anio, periodo }
            ueas: (seleccionUEAs && seleccionUEAs.length) ? seleccionUEAs.slice() : [], // claves UEA (string)
            profesores: (seleccionProfes && seleccionProfes.length) ? seleccionProfes.slice() : [], // números económicos (string)
            trimestresIds: (seleccionTrimestres && seleccionTrimestres.length) ? seleccionTrimestres.map(Number) : [] // respaldo ids
        };
    // Compatibilidad: el backend actual espera 'trimestres' como IDs. Enviar ambos: 'trimestresIds' y mapear 'trimestres' a IDs.
    const payloadToSend = Object.assign({}, payload, { trimestres: payload.trimestresIds });
        // DEBUG: mostrar en consola el payload que se enviará al servidor
        // debug logs removed
        fetch('controlador/buscarProgramacionMulti.php',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payloadToSend)})
        .then(r=>r.json())
        .then(j=>{
            // DEBUG: mostrar respuesta del servidor
            // debug logs removed
            if(!j||!j.ok){ throw new Error(j&&j.error?j.error:'Error'); }
            pintarTablaProgramacion(j.programacion||[]);
            try { tableZone.remove(); } catch(_){}
            // Dibujar chip/flecha de resultado ahora que hay una búsqueda exitosa
            renderResultChip();
        })
        .catch(err=>{
            tableZone.textContent='Error: '+(err.message||err);
            // En caso de error, re-mostrar el segundo menú
            try { const sm = document.getElementById('prog-second-menu-card'); if (sm) sm.style.display=''; } catch(e){}
        });
    }

    function pintarTablaProgramacion(rows){
        // pintar dentro de prog-results-wrap si existe
        let mount = document.getElementById('prog-results-wrap');
        if (!mount){ mount = document.createElement('div'); mount.id='prog-results-wrap'; resultsWrap.appendChild(mount); }
        // limpiar previo (excepto breadcrumbs)
        mount.innerHTML = '';
        const wrap = document.createElement('div');
        const tbl = document.createElement('table'); tbl.className='table table-sm table-striped';
        const thead = document.createElement('thead'); const trh = document.createElement('tr');
        const cols = ['TRIMESTRE','CLAVE UEA','UEA','GRUPO','CM','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SALON','ECONOMICO','PROFESOR'];
        cols.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; trh.appendChild(th); });
        thead.appendChild(trh); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        if (!rows.length){ const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=cols.length; td.textContent='Sin resultados'; tr.appendChild(td); tbody.appendChild(tr); }
        rows.forEach(r=>{
            const tr=document.createElement('tr');
            addCell(tr,r.trimestre); addCell(tr,r.claveUEA); addCell(tr,r.UEA); addCell(tr,r.grupo); addCell(tr,r.CM);
            addCell(tr,r.lunes); addCell(tr,r.martes); addCell(tr,r.miercoles); addCell(tr,r.jueves); addCell(tr,r.viernes);
            addCell(tr,r.salon); addCell(tr,r.numeroEconomico); addCell(tr,r.profesor);
            tbody.appendChild(tr);
        });
    tbl.appendChild(tbody);
    // Encapsular la tabla en un contenedor responsive para evitar overflow horizontal
    const resp = document.createElement('div'); resp.className = 'table-responsive';
    resp.appendChild(tbl);
    wrap.appendChild(resp);
    mount.appendChild(wrap);

        function addCell(tr, txt){ const td=document.createElement('td'); td.textContent= txt||''; tr.appendChild(td); }
    }

    // Modal multi-select reutilizable
    function mostrarModalMultiSelect(opts){
        const { titulo, items, incluirTodos, onAccept, selected } = opts;
        // Construir HTML simple para SweetAlert o fallback
        if (window.Swal){
            const html = document.createElement('div');
            const search = document.createElement('input'); search.type='text'; search.placeholder='Buscar'; search.className='form-control form-control-sm mb-2';
            html.appendChild(search);
            const box = document.createElement('div'); box.style.maxHeight='320px'; box.style.overflow='auto'; box.className='border rounded p-2';
            // Inicializar el conjunto de seleccionados con los valores pasados (si los hay)
            let current = Array.isArray(selected) ? selected.map(String) : [];
            const render = (q)=>{
                box.innerHTML='';
                const filtered = items.filter(it=> !q || (it.label && it.label.toLowerCase().includes(q.toLowerCase())));
                if(incluirTodos){
                    const chkAll = document.createElement('div'); chkAll.className='form-check';
                    const c=document.createElement('input'); c.type='checkbox'; c.className='form-check-input'; c.id='chk_all_modal'; c.value='ALL';
                    // mantener estado si ya estaba seleccionado
                    c.checked = current.includes('ALL');
                    c.addEventListener('change', ()=>{
                        if(c.checked){ current = ['ALL']; // seleccionar sólo ALL
                            // desmarcar visualmente las demás casillas en el DOM
                            [...box.querySelectorAll('input[type="checkbox"]:not(#chk_all_modal)')].forEach(x=> x.checked=false);
                        }
                        else { current = []; }
                    });
                    const l=document.createElement('label'); l.className='form-check-label'; l.htmlFor='chk_all_modal'; l.textContent='Todos';
                    chkAll.appendChild(c); chkAll.appendChild(l); box.appendChild(chkAll);
                }
                filtered.forEach(it=>{
                    const div=document.createElement('div'); div.className='form-check';
                    const c=document.createElement('input'); c.type='checkbox'; c.className='form-check-input'; c.id='chk_'+it.id; c.value=String(it.id);
                    // marcar según el estado en 'current' para persistir selecciones entre renders
                    try { c.checked = current.indexOf(String(it.id)) !== -1 || current.indexOf(Number(it.id)) !== -1; } catch(e) { c.checked = false; }
                    c.addEventListener('change', ()=>{
                        // si ALL estaba seleccionado, quitarlo al seleccionar una específica
                        if (current.includes('ALL')){
                            current = current.filter(x=> x!=='ALL'); const allEl=box.querySelector('#chk_all_modal'); if(allEl) allEl.checked=false;
                        }
                        if (c.checked) {
                            if (!current.includes(c.value)) current.push(c.value);
                        } else {
                            current = current.filter(x=> x!==c.value);
                        }
                        // debug logs removed
                    });
                    const l=document.createElement('label'); l.className='form-check-label'; l.htmlFor='chk_'+it.id; l.textContent=it.label;
                    div.appendChild(c); div.appendChild(l); box.appendChild(div);
                });
            };
            render('');
            html.appendChild(box);
            search.addEventListener('input', ()=> render(search.value));
                // debug logs removed
                Swal.fire({
                title: titulo,
                html: html,
                width: 600,
                showCancelButton: true,
                confirmButtonText: 'Aceptar',
                cancelButtonText: 'Cancelar',
                preConfirm: ()=> {
                    // debug logs removed
                    return Array.from(new Set(current.slice()));
                }
            }).then(res=>{ if(res.isConfirmed){ onAccept(res.value||[]); } });
        } else {
            // Fallback sencillo: prompt para id separados por coma, usar ALL para todos
            const ids = prompt(titulo+' (IDs separados por coma, ALL para todos)') || '';
            const arr = ids.split(',').map(s=>s.trim()).filter(s=>s);
            onAccept(arr.length? arr: []);
        }
    }
}

// Exponer la función para que el menú la use
try { if (typeof window !== 'undefined') window.nuevoTrimestre = nuevoTrimestre; } catch(e) {}

// Modal + subida para cargar planeación de grupos
function cargarPlaneacionGrupos(){
    // eliminar modal existente
    var existing = document.getElementById('modalCargarPlaneacion'); if (existing) existing.parentNode.removeChild(existing);
    var modal = document.createElement('div'); modal.id='modalCargarPlaneacion'; modal.className='modal fade'; modal.tabIndex=-1; modal.setAttribute('role','dialog');
    var dialog = document.createElement('div'); dialog.className='modal-dialog'; dialog.setAttribute('role','document');
    var content = document.createElement('div'); content.className='modal-content';
    var header = document.createElement('div'); header.className='modal-header';
    var h5 = document.createElement('h5'); h5.className='modal-title'; h5.textContent='Cargar planeación de grupos (Excel)';
    var btnClose = document.createElement('button'); btnClose.type='button'; btnClose.className='btn-close'; btnClose.setAttribute('data-bs-dismiss','modal'); btnClose.setAttribute('aria-label','Close');
    header.appendChild(h5); header.appendChild(btnClose);
    var body = document.createElement('div'); body.className='modal-body';
    var form = document.createElement('form'); form.id='formCargarPlaneacion';
    // Select trimestre
    var divTrim = document.createElement('div'); divTrim.className='mb-3';
    var lblTrim = document.createElement('label'); lblTrim.className='form-label'; lblTrim.textContent='Selecciona trimestre';
    var selTrim = document.createElement('select'); selTrim.className='form-select'; selTrim.id='select_planeacion_trimestre';
    divTrim.appendChild(lblTrim); divTrim.appendChild(selTrim);
    // File input
    var divFile = document.createElement('div'); divFile.className='mb-3';
    var lblFile = document.createElement('label'); lblFile.className='form-label'; lblFile.textContent='Archivo Excel (.xls/.xlsx) - hoja debe llamarse CB';
    var inpFile = document.createElement('input'); inpFile.type='file'; inpFile.accept='.xls,.xlsx'; inpFile.className='form-control'; inpFile.id='input_planeacion_file';
    divFile.appendChild(lblFile); divFile.appendChild(inpFile);
    // Instrucciones para el usuario sobre el formato esperado del Excel
    var instrucciones = document.createElement('div');
    instrucciones.className = 'form-text small text-muted mt-2';

    // Línea 1: nombre de la hoja
    var p1 = document.createElement('p'); p1.className = 'mb-1';
    p1.appendChild(document.createTextNode('La hoja obligatoria debe llamarse '));
    var strongCb = document.createElement('strong'); strongCb.textContent = 'CB';
    p1.appendChild(strongCb);
    p1.appendChild(document.createTextNode('.'));
    instrucciones.appendChild(p1);

    // Línea 2: columnas obligatorias
    var p2 = document.createElement('p'); p2.className = 'mb-1';
    var boldReq = document.createElement('strong'); boldReq.textContent = 'Columnas obligatorias:';
    p2.appendChild(boldReq);
    p2.appendChild(document.createTextNode(' '));
    var codeReq = document.createElement('code');
    codeReq.textContent = 'CLAVE, UEA, GRUPO, CM, L_I, L_F, M_I, M_F, MI_I, MI_F, J_I, J_F, V_I, V_F';
    p2.appendChild(codeReq);
    p2.appendChild(document.createTextNode('.'));
    instrucciones.appendChild(p2);

    // Línea 3: columnas opcionales
    var p3 = document.createElement('p'); p3.className = 'mb-1';
    var boldOpt = document.createElement('strong'); boldOpt.textContent = 'Columnas opcionales:';
    p3.appendChild(boldOpt);
    p3.appendChild(document.createTextNode(' '));
    var codeOpt = document.createElement('code'); codeOpt.textContent = 'SALON, INS, ECO., PROFESOR';
    p3.appendChild(codeOpt);
    p3.appendChild(document.createTextNode('.'));
    instrucciones.appendChild(p3);

    // Línea 4: nota sobre formatos horarios
    var p4 = document.createElement('p'); p4.className = 'mb-1';
    p4.appendChild(document.createTextNode('Los horarios pueden indicarse como hora (ej. '));
    var em1 = document.createElement('em'); em1.textContent = '08:30'; p4.appendChild(em1);
    p4.appendChild(document.createTextNode(' o '));
    var em2 = document.createElement('em'); em2.textContent = '08:30:00'; p4.appendChild(em2);
    p4.appendChild(document.createTextNode('), como seriales/decimales de Excel o como texto reconocible por '));
    var codeStr = document.createElement('code'); codeStr.textContent = 'strtotime'; p4.appendChild(codeStr);
    p4.appendChild(document.createTextNode('.'));
    instrucciones.appendChild(p4);

    // Línea 5: recomendaciones adicionales
    var p5 = document.createElement('p'); p5.className = 'mb-0';
    p5.appendChild(document.createTextNode('No deje filas vacías al final del archivo. Encabezados con tilde (ej. '));
    var em3 = document.createElement('em'); em3.textContent = 'SALÓN'; p5.appendChild(em3);
    p5.appendChild(document.createTextNode(') serán reconocidos.'));
    instrucciones.appendChild(p5);

    divFile.appendChild(instrucciones);
    form.appendChild(divTrim); form.appendChild(divFile);
    body.appendChild(form);
    var footer = document.createElement('div'); footer.className='modal-footer';
    var btnCancel = document.createElement('button'); btnCancel.type='button'; btnCancel.className='btn btn-secondary'; btnCancel.setAttribute('data-bs-dismiss','modal'); btnCancel.textContent='Cancelar';
    var btnUpload = document.createElement('button'); btnUpload.type='button'; btnUpload.className='btn btn-primary'; btnUpload.textContent='Subir y procesar';
    footer.appendChild(btnCancel); footer.appendChild(btnUpload);
    content.appendChild(header); content.appendChild(body); content.appendChild(footer); dialog.appendChild(content); modal.appendChild(dialog); document.body.appendChild(modal);

    // poblar select con los trimestres del año actual (respaldo si no hay)
    var today = new Date(); var cy = today.getFullYear();
    // crear una opción por defecto (DOM, sin innerHTML)
    selTrim.innerHTML = '';
    var optLoading = document.createElement('option'); optLoading.value = ''; optLoading.textContent = 'Cargando...'; selTrim.appendChild(optLoading);

    // función auxiliar: diálogo de confirmación que resuelve booleano usando swalConfirmOpt
    function confirmPromise(title, text) {
        return new Promise(function(resolve){
            var resolved = false;
            var p = swalConfirmOpt(title, text, function(){ resolved = true; resolve(true); });
            if (p && typeof p.then === 'function') {
                p.then(function(){ if (!resolved) resolve(false); }).catch(function(){ if (!resolved) resolve(false); });
            } else {
                // respaldo: si swalConfirmOpt no devolvió una promesa, resolver false tras un breve timeout
                setTimeout(function(){ if (!resolved) resolve(false); }, 500);
            }
        });
    }

    // Inicialmente deshabilitar input de archivo y botón de subida hasta validar trimestre
    inpFile.disabled = true;

    if (typeof postForm === 'function'){
        // Pedir TODOS los trimestres para poblar el selector del modal de carga
        // (evita limitar la lista al año actual)
        postForm('controlador/recuperaTrimestresTodos.php', {})
        .then(json => {
            selTrim.innerHTML = '';
            if (!json || !json.ok || !Array.isArray(json.trimestres) || json.trimestres.length===0){
                var optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = 'No se encontraron trimestres para el año ' + cy; selTrim.appendChild(optNone);
                // mostrar modal para que el usuario vea el mensaje
                try { var bsShow = new bootstrap.Modal(modal); bsShow.show(); } catch(e) { modal.style.display = 'block'; }
                return;
            }
            json.trimestres.forEach(t => {
                var opt = document.createElement('option'); opt.value = t.idTrimestre || t.id || ''; opt.textContent = (t.año||t.anio) + ' ' + (t.periodoNombre||t.sigla||t.nombre || ''); selTrim.appendChild(opt);
            });

            // Después de poblar, mostrar el modal. La comprobación de existencia de programación/grupos
            // se ejecutará cuando el usuario pulse "Subir y procesar".
            try { var bsShow = new bootstrap.Modal(modal); bsShow.show(); } catch(e) { modal.style.display = 'block'; }
            // Permitir seleccionar un archivo; mantener el botón de subida deshabilitado hasta que se elija un archivo
            inpFile.disabled = false; btnUpload.disabled = true;
        }).catch(err => { console.error('Error cargando trimestres', err); selTrim.innerHTML=''; var optErr = document.createElement('option'); optErr.value=''; optErr.textContent='Error cargando trimestres'; selTrim.appendChild(optErr); try { var bsShow2 = new bootstrap.Modal(modal); bsShow2.show(); } catch(e){ modal.style.display = 'block'; } });
    }

    // Cuando el usuario seleccione un trimestre, habilitar input de archivo y reiniciar estado de subida.
    // La comprobación de existencia de programación/grupos se hará cuando el usuario pulse "Subir y procesar".
    selTrim.addEventListener('change', function(){
    var selected = String(this.value || '').trim();
    inpFile.value = ''; // limpiar cualquier archivo seleccionado al cambiar trimestre
        btnUpload.disabled = true;
        if (!selected) {
            inpFile.disabled = true;
            return;
        }
    // habilitar selección de archivo; no realizar comprobaciones de eliminación todavía
    inpFile.disabled = false;
    });

    // Habilitar botón de subir cuando se elija un archivo; deshabilitar cuando se limpie
    inpFile.addEventListener('change', function(){
        try {
            var has = this.files && this.files.length > 0;
            btnUpload.disabled = !has;
        } catch(e) {
            console.warn('Error manejando cambio de archivo:', e);
            btnUpload.disabled = true;
        }
    });

    btnUpload.addEventListener('click', function(){
        var file = inpFile.files && inpFile.files[0];
        var idTr = selTrim.value;
        if (!file) { swalAlertOpt('Error','Selecciona un archivo Excel','error'); return; }
        if (!idTr) { swalAlertOpt('Error','Selecciona un trimestre','error'); return; }
        btnUpload.disabled = true;

    // Primero: comprobar si el trimestre seleccionado ya tiene programaciones/grupos
        swalShowLoading('Comprobando si el trimestre ya tiene programación o grupos...');
        Promise.all([
            postForm('controlador/contarProgramacionTrimestre.php', { idTrimestre: idTr }).catch(e => ({ ok:false, msg: e })),
            postForm('controlador/contarGruposTrimestre.php', { idTrimestre: idTr }).catch(e => ({ ok:false, msg: e }))
        ]).then(function(results){
            try { swalClose(); } catch(e){}
            var progResp = results[0] || {};
            var gruposResp = results[1] || {};
            var progCount = (progResp && progResp.ok) ? Number(progResp.count || 0) : 0;
            var gruposCount = (gruposResp && gruposResp.ok) ? Number(gruposResp.count || 0) : 0;

                function startUpload(){
                // Mostrar overlay de carga para la operación de subida/procesamiento
                var uploadOverlay = (function(){
                    try {
                        var ov = document.createElement('div');
                        ov.className = 'grupos-loader-overlay';
                        var box = document.createElement('div');
                        box.style.display = 'flex';
                        box.style.flexDirection = 'column';
                        box.style.alignItems = 'center';
                        box.style.justifyContent = 'center';
                        var spinner = document.createElement('div'); spinner.className = 'grupos-spinner';
                        var text = document.createElement('div'); text.className = 'grupos-loader-text'; text.textContent = 'Procesando...';
                        box.appendChild(spinner); box.appendChild(text); ov.appendChild(box);
                        (document.body || document.documentElement).appendChild(ov);
                        return ov;
                    } catch (e) { console.warn('No se pudo mostrar overlay de subida:', e); return null; }
                })();

                // subir mediante FormData a controlador/guardarPlaneacion.php
                var fd = new FormData(); fd.append('archivo', file);
                var procFilename = null;
                fetch('controlador/guardarPlaneacion.php', { method: 'POST', body: fd })
                .then(resp => resp.json())
                .then(j => {
                    if (!j || !j.ok) { throw new Error((j && j.error) ? j.error : JSON.stringify(j)); }
                    // guardar nombre de archivo para poder reprocesar después de registrar profesores
                    procFilename = j.filename;
                    // procesar archivo
                    return postForm('controlador/procesarPlaneacion.php', { filename: j.filename, idTrimestre: idTr });
                }).then(result => {
                    btnUpload.disabled = false;
                    if (result && result.ok) {
                        var s = result.stats || {};
                        var msg = 'Grupos insertados: ' + (s.grupos_insertados||0) + '\nHorarios: ' + (s.horarios_insertados||0) + '\nProgramaciones: ' + (s.programacion_insertada||0);
                        if (Array.isArray(s.errores) && s.errores.length>0) msg += '\n\nErrores:\n' + s.errores.join('\n');

                        // Registrar errores y estadísticas completas en la consola para que el usuario pueda copiarlas
                        if (Array.isArray(s.errores) && s.errores.length > 0) {
                            console.error('procesar_planeacion: errores detectados al procesar el archivo:');
                            s.errores.forEach(function(e){ console.error(e); });
                        }
                        console.log('procesar_planeacion: stats:', s);

                        swalAlertOpt('Resultado', msg, 'success');
                        try{ if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres(); } catch(e){}
                        try{ if (bs) bs.hide(); else modal.parentNode.removeChild(modal); } catch(e){ }

                        // Después de procesar la planeación, sincronizar disposiciones: disponible (1)
                        // si el profesor tiene programacion o tiene preferencias; caso contrario 0.
                        // Llamada al endpoint que ejecuta la actualización masiva en el servidor.
                        try {
                            postForm('controlador/actualizarDisposicionMasiva.php', { idTrimestre: idTr })
                            .then(function(res){
                                if (res && res.ok) {
                                    console.log('actualizarDisposicionMasiva:', res);
                                    // opcional: notificar en UI (no intrusivo)
                                    try { console.info('Disposiciones sincronizadas: ' + (res.set1||0) + ' disponibles, ' + (res.set0||0) + ' no disponibles.'); } catch(e){}
                                } else {
                                    console.error('Error al sincronizar disposiciones:', res);
                                }
                            }).catch(function(err){ console.error('Error fetch actualizarDisposicionMasiva:', err); });
                        } catch (e) { console.error('Error iniciando sincronización de disposiciones:', e); }
                    } else {
                        // Registrar resultado no OK en la consola para depuración/copia
                        console.error('procesar_planeacion: resultado no OK:', result);

                        // Caso específico: falta de la hoja 'CB' en el Excel
                        try {
                            var errMsg = (result && result.error) ? String(result.error) : '';
                            if (errMsg && errMsg.toLowerCase().indexOf('cb') !== -1 && errMsg.toLowerCase().indexOf('hoja') !== -1) {
                                // Mostrar alerta clara y devolver control al usuario
                                swalAlertOpt('Error', 'El archivo Excel debe contener una hoja llamada "CB" para poder procesar la planeación. Por favor verifica el libro y vuelve a intentarlo.', 'error');
                                return;
                            }
                        } catch(e) { /* ignore */ }

                        // Si se devolvieron errores de validación, mostrarlos y ofrecer registrar profesores faltantes
                        if (result && Array.isArray(result.validation_errors) && result.validation_errors.length > 0) {
                            // mostrar una alerta simple con el conteo y registrar los errores completos en la consola
                            swalAlertOpt('Validación', 'Se detectaron ' + result.validation_errors.length + ' errores durante la validación. Revisa la consola para más detalles.', 'warning');
                            console.error('procesar_planeacion: validation_errors:', result.validation_errors);
                        }

                        // Si el controlador devolvió missing_profesores, construir un modal para registrarlos
                        if (result && Array.isArray(result.missing_profesores) && result.missing_profesores.length > 0) {
                            // Agregar profesores faltantes únicos por clave (eco o nombre)
                            var missing = [];
                            var seen = {};
                            result.missing_profesores.forEach(mp => {
                                var key = (mp.eco && mp.eco !== '') ? ('eco:' + mp.eco) : ('name:' + (mp.nombre || '').trim().toUpperCase());
                                if (!seen[key]) { seen[key] = true; missing.push(mp); }
                            });

                            // Crear modal listando profesores faltantes con botones Registrar
                            var modId = 'modalMissingProfesores';
                            var existing = document.getElementById(modId); if (existing) existing.parentNode.removeChild(existing);
                            var m = document.createElement('div'); m.id = modId; m.className = 'modal fade'; m.tabIndex = -1; m.setAttribute('role','dialog');
                            var d = document.createElement('div'); d.className = 'modal-dialog modal-lg'; d.setAttribute('role','document');
                            var c = document.createElement('div'); c.className = 'modal-content';
                            var h = document.createElement('div'); h.className = 'modal-header'; var h5 = document.createElement('h5'); h5.className='modal-title'; h5.textContent='Profesores faltantes'; h.appendChild(h5);
                            var btnClose = document.createElement('button'); btnClose.type='button'; btnClose.className='btn-close'; btnClose.setAttribute('data-bs-dismiss','modal'); h.appendChild(btnClose);
                            c.appendChild(h);
                            var body = document.createElement('div'); body.className = 'modal-body';
                            var p = document.createElement('p'); p.textContent = 'Se detectaron profesores no encontrados en la base. Puedes registrarlos aquí y luego reprocesar el archivo.'; body.appendChild(p);
                            var list = document.createElement('div');
                            missing.forEach(function(mp, idx){
                                var card = document.createElement('div'); card.className='card mb-2 p-2';
                                var row = document.createElement('div'); row.className='d-flex align-items-center justify-content-between';
                                var filasText = Array.isArray(mp.rows) ? mp.rows.join(',') : (mp.row || '-');
                                var info = document.createElement('div'); info.innerHTML = '<strong>Fila:</strong> ' + filasText + ' &nbsp; <strong>ECO:</strong> ' + (mp.eco || '-') + ' &nbsp; <strong>Nombre:</strong> ' + (mp.nombre || '-') ;
                                var btnReg = document.createElement('button'); btnReg.type='button'; btnReg.className='btn btn-sm btn-success'; btnReg.textContent='Registrar';
                                // guardar referencia del botón para poder actualizar su estado desde "Registrar todos"
                                btnReg.dataset.missingIdx = String(idx);
                                missing[idx]._btn = btnReg;
                                btnReg.addEventListener('click', function(){ openRegisterProfesorModal(mp, btnReg); });
                                row.appendChild(info); row.appendChild(btnReg); card.appendChild(row); list.appendChild(card);
                            });
                            body.appendChild(list);
                            var footer = document.createElement('div'); footer.className='modal-footer';
                            var btnCloseF = document.createElement('button'); btnCloseF.type='button'; btnCloseF.className='btn btn-secondary'; btnCloseF.setAttribute('data-bs-dismiss','modal'); btnCloseF.textContent='Cerrar';
                            // botón para registrar todos los profesores faltantes
                            var btnRegisterAll = document.createElement('button'); btnRegisterAll.type='button'; btnRegisterAll.className='btn btn-success'; btnRegisterAll.textContent='Registrar todos';
                            var btnReproc = document.createElement('button'); btnReproc.type='button'; btnReproc.className='btn btn-primary'; btnReproc.textContent='Reprocesar ahora';
                            btnReproc.addEventListener('click', function(){
                                if (!procFilename) { swalAlertOpt('Error','No hay archivo para reprocesar almacenado','error'); return; }
                                // llamar a procesarPlaneacion de nuevo
                                postForm('controlador/procesarPlaneacion.php', { filename: procFilename, idTrimestre: idTr })
                                .then(res => {
                                    console.log('reprocesar result:', res);
                                    if (res && res.ok) {
                                        swalAlertOpt('Correcto','Reproceso completado. Revisa la consola para detalles.','success');
                                        try{ if (bs) bs.hide(); } catch(e){}
                                        try{ if (document.getElementById(modId)) document.getElementById(modId).remove(); } catch(e){}
                                    } else {
                                        console.error('reprocesar error full:', res);
                                        try {
                                            if (res && Array.isArray(res.validation_errors) && res.validation_errors.length>0) {
                                                console.error('validation_errors:', res.validation_errors);
                                            }
                                            if (res && Array.isArray(res.missing_profesores) && res.missing_profesores.length>0) {
                                                console.warn('missing_profesores:', res.missing_profesores);
                                            }
                                        } catch(e) { console.error('Error al inspeccionar respuesta de reproceso:', e); }
                                        var userMsg = 'Reproceso falló. Abre la consola para ver la respuesta completa.';
                                        try {
                                            if (res && res.msg) userMsg = 'Reproceso: ' + String(res.msg);
                                            else if (res && res.error) userMsg = 'Reproceso error: ' + String(res.error);
                                            else if (res && (res.validation_errors || res.missing_profesores)) userMsg = 'Reproceso retornó errores; revisa consola para más detalles.';
                                            else userMsg = userMsg + '\n' + JSON.stringify(res);
                                        } catch(e) { userMsg = userMsg + '\n(Respuesta no serializable)'; }
                                        swalAlertOpt('Error', userMsg, 'error');
                                    }
                                }).catch(err => { console.error('Error re-procesando:', err); swalAlertOpt('Error','Error re-procesando archivo: '+String(err),'error'); });
                            });
                            footer.appendChild(btnCloseF); footer.appendChild(btnRegisterAll); footer.appendChild(btnReproc);
                            c.appendChild(body); c.appendChild(footer); d.appendChild(c); m.appendChild(d); document.body.appendChild(m);
                            try { var mb = new bootstrap.Modal(m); mb.show(); } catch(e) { m.style.display='block'; }

                            // función para registrar un profesor directamente (sin abrir modal), usando los datos detectados
                            function autoRegisterProfesor(mp, btn){
                                return new Promise(function(resolve){
                                    if (!mp) return resolve({ ok: false, error: 'MP vacío' });
                                    var fd = new FormData();
                                    fd.append('numeroEconomico', mp.eco || '');
                                    fd.append('nombre', mp.nombre || '');
                                    var correo = (mp.eco && String(mp.eco).trim() !== '') ? (String(mp.eco).trim() + '@azc.uam.mx') : 'user@azc.uam.mx';
                                    fd.append('correo_uam', correo);
                                    fd.append('correo_personal', '');
                                    fd.append('gradoEstudios', mp.gradoEstudios || '');
                                    fd.append('celular', mp.celular || '');
                                    fd.append('idProfesorTipo', '2');
                                    if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; btn.className = 'btn btn-sm btn-warning'; }
                                    fetch('controlador/guardarProfesor.php', { method: 'POST', body: fd })
                                    .then(function(r){ return r.json ? r.json() : r.text(); })
                                    .then(function(j){
                                        if (j && j.ok) {
                                            if (btn) { btn.textContent = 'Registrado'; btn.className = 'btn btn-sm btn-secondary'; btn.disabled = true; }
                                            resolve({ ok: true, result: j });
                                        } else {
                                            if (btn) { btn.textContent = 'Error'; btn.className = 'btn btn-sm btn-danger'; btn.disabled = false; }
                                            resolve({ ok: false, error: j || 'Respuesta inválida' });
                                        }
                                    }).catch(function(err){
                                        if (btn) { btn.textContent = 'Error'; btn.className = 'btn btn-sm btn-danger'; btn.disabled = false; }
                                        resolve({ ok: false, error: String(err) });
                                    });
                                });
                            }

                            // Manejador para registrar todos en serie
                            btnRegisterAll.addEventListener('click', async function(){
                                if (!Array.isArray(missing) || missing.length === 0) { swalAlertOpt('Info','No hay profesores para registrar','info'); return; }
                                btnRegisterAll.disabled = true; btnRegisterAll.textContent = 'Registrando...';
                                var total = missing.length; var okCount = 0; var failList = [];
                                for (var i=0;i<missing.length;i++){
                                    var mp = missing[i];
                                    var btn = (mp && mp._btn) ? mp._btn : null;
                                    if (btn && (btn.textContent === 'Registrado' || (btn.disabled && btn.textContent !== 'Registrar'))) { okCount++; continue; }
                                    // eslint-disable-next-line no-await-in-loop
                                    var res = await autoRegisterProfesor(mp, btn);
                                    if (res && res.ok) okCount++; else failList.push({ mp: mp, error: res && res.error ? res.error : 'unknown' });
                                }
                                btnRegisterAll.disabled = false; btnRegisterAll.textContent = 'Registrar todos';
                                var msg = 'Registro finalizado. Registrados: ' + okCount + ' / ' + total;
                                if (failList.length > 0) {
                                    msg += '\nErrores: ' + failList.length + '\nRevisa la consola para más detalles.';
                                    console.error('Errores registrar todos:', failList);
                                    swalAlertOpt('Resultado', msg, 'warning');
                                } else {
                                    swalAlertOpt('Resultado', msg, 'success');
                                }
                            });

                            // función auxiliar para abrir el modal de registro de un profesor faltante
                            function openRegisterProfesorModal(mp, callerBtn){
                                // Deshabilitar el botón llamador mientras el modal esté abierto
                                callerBtn.disabled = true;
                                var regId = 'modalRegistrarProfesor'; var ex = document.getElementById(regId); if (ex) ex.parentNode.removeChild(ex);
                                var mm = document.createElement('div'); mm.id = regId; mm.className='modal fade'; mm.tabIndex=-1; mm.setAttribute('role','dialog');
                                var dd = document.createElement('div'); dd.className='modal-dialog'; dd.setAttribute('role','document');
                                var cc = document.createElement('div'); cc.className='modal-content';
                                var hh = document.createElement('div'); hh.className='modal-header'; var hhh = document.createElement('h5'); hhh.className='modal-title'; hhh.textContent='Registrar profesor'; hh.appendChild(hhh);
                                var btnc = document.createElement('button'); btnc.type='button'; btnc.className='btn-close'; btnc.setAttribute('data-bs-dismiss','modal'); hh.appendChild(btnc); cc.appendChild(hh);
                                var bdy = document.createElement('div'); bdy.className='modal-body';
                                var f = document.createElement('form'); f.id='formRegistrarProfesor';
                                // numeroEconomico
                                var g1 = document.createElement('div'); g1.className='mb-2'; var l1 = document.createElement('label'); l1.className='form-label'; l1.textContent='Número económico'; var i1 = document.createElement('input'); i1.type='text'; i1.className='form-control'; i1.name='numeroEconomico'; i1.value = mp.eco || ''; g1.appendChild(l1); g1.appendChild(i1); f.appendChild(g1);
                                // nombre
                                var g2 = document.createElement('div'); g2.className='mb-2'; var l2 = document.createElement('label'); l2.className='form-label'; l2.textContent='Nombre'; var i2 = document.createElement('input'); i2.type='text'; i2.className='form-control'; i2.name='nombre'; i2.value = mp.nombre || ''; g2.appendChild(l2); g2.appendChild(i2); f.appendChild(g2);
                                // correo_uam (required)
                                var g3 = document.createElement('div'); g3.className='mb-2'; var l3 = document.createElement('label'); l3.className='form-label'; l3.textContent='Correo UAM (ej: user@azc.uam.mx)'; var i3 = document.createElement('input'); i3.type='email'; i3.className='form-control'; i3.name='correo_uam'; i3.placeholder='user@azc.uam.mx';
                                // Si tenemos número económico, proponer correo por defecto: <eco>@azc.uam.mx
                                try { if (mp && mp.eco && String(mp.eco).trim() !== '') { i3.value = String(mp.eco).trim() + '@azc.uam.mx'; } else { i3.value = 'user@azc.uam.mx'; } } catch(e) { i3.value = 'user@azc.uam.mx'; }
                                g3.appendChild(l3); g3.appendChild(i3); f.appendChild(g3);
                                // correo_personal
                                var g4 = document.createElement('div'); g4.className='mb-2'; var l4 = document.createElement('label'); l4.className='form-label'; l4.textContent='Correo personal (opcional)'; var i4 = document.createElement('input'); i4.type='email'; i4.className='form-control'; i4.name='correo_personal'; g4.appendChild(l4); g4.appendChild(i4); f.appendChild(g4);
                                // gradoEstudios (usar select como en el directorio)
                                var g5 = document.createElement('div'); g5.className='mb-2';
                                var l5 = document.createElement('label'); l5.className='form-label'; l5.textContent='Grado de estudios (opcional)';
                                var sel5 = document.createElement('select'); sel5.className='form-select'; sel5.name='gradoEstudios';
                                // Opciones compatibles con el formulario del directorio
                                var grados = ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'];
                                grados.forEach(function(g){
                                    var o = document.createElement('option'); o.value = g; o.textContent = g || '(ninguno)';
                                    // si la fila trae un grado, seleccionarlo
                                    if (mp && mp.gradoEstudios && String(mp.gradoEstudios).trim() === g) o.selected = true;
                                    sel5.appendChild(o);
                                });
                                g5.appendChild(l5); g5.appendChild(sel5); f.appendChild(g5);

                                // tipo de profesor / contrato (obligatorio para guardarProfesor.php)
                                var g5b = document.createElement('div'); g5b.className = 'mb-2';
                                var l5b = document.createElement('label'); l5b.className = 'form-label'; l5b.textContent = 'Tipo de contrato';
                                var sel5b = document.createElement('select'); sel5b.className = 'form-select'; sel5b.name = 'idProfesorTipo';
                                // opción por defecto mientras carga
                                var optLoadingTipo = document.createElement('option');
                                optLoadingTipo.value = '';
                                optLoadingTipo.textContent = 'Cargando tipos de contrato...';
                                sel5b.appendChild(optLoadingTipo);
                                g5b.appendChild(l5b); g5b.appendChild(sel5b); f.appendChild(g5b);

                                // cargar tipos de contrato desde el servidor usando Promises
                                (function(selectEl){
                                    fetch('controlador/recuperarProfesorTipos.php', { method: 'POST' })
                                        .then(function(r){ return r.json(); })
                                        .then(function(j){
                                            // limpiar opciones anteriores
                                            while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
                                            var rows = (j && j.ok && Array.isArray(j.data)) ? j.data : [];
                                            if (!rows.length) {
                                                var oEmpty = document.createElement('option');
                                                oEmpty.value = '';
                                                oEmpty.textContent = 'Sin tipos de contrato disponibles';
                                                selectEl.appendChild(oEmpty);
                                                return;
                                            }
                                            var oDefault = document.createElement('option');
                                            oDefault.value = '';
                                            oDefault.textContent = 'Selecciona tipo de contrato...';
                                            selectEl.appendChild(oDefault);
                                            rows.forEach(function(t){
                                                if (!t) return;
                                                var o = document.createElement('option');
                                                o.value = String(t.idProfesorTipo);
                                                o.textContent = t.nombre;
                                                selectEl.appendChild(o);
                                            });
                                        })
                                        .catch(function(err){
                                            // en error, mostrar una opción informativa
                                            while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
                                            var oErr = document.createElement('option');
                                            oErr.value = '';
                                            oErr.textContent = 'Error cargando tipos de contrato';
                                            selectEl.appendChild(oErr);
                                            console.error('Error recuperarProfesorTipos:', err);
                                        });
                                })(sel5b);
                                // celular
                                var g6 = document.createElement('div'); g6.className='mb-2'; var l6 = document.createElement('label'); l6.className='form-label'; l6.textContent='Celular (10 dígitos, opcional)'; var i6 = document.createElement('input'); i6.type='text'; i6.className='form-control'; i6.name='celular'; i6.value = ''; g6.appendChild(l6); g6.appendChild(i6); f.appendChild(g6);
                                bdy.appendChild(f); cc.appendChild(bdy);
                                var ftr = document.createElement('div'); ftr.className='modal-footer'; var btnCancelR = document.createElement('button'); btnCancelR.type='button'; btnCancelR.className='btn btn-secondary'; btnCancelR.setAttribute('data-bs-dismiss','modal'); btnCancelR.textContent='Cancelar';
                                var btnSaveR = document.createElement('button'); btnSaveR.type='button'; btnSaveR.className='btn btn-primary'; btnSaveR.textContent='Registrar';
                                ftr.appendChild(btnCancelR); ftr.appendChild(btnSaveR); cc.appendChild(ftr); dd.appendChild(cc); mm.appendChild(dd); document.body.appendChild(mm);
                                try { var mb2 = new bootstrap.Modal(mm); mb2.show(); } catch(e) { mm.style.display='block'; }

                                btnSaveR.addEventListener('click', function(){
                                    btnSaveR.disabled = true;
                                    // Asegurar que correo_uam tenga un valor antes de enviar (respaldo: eco@azc.uam.mx o genérico)
                                    try {
                                        var correoField = f.querySelector('input[name="correo_uam"]');
                                        if (correoField) {
                                            var cv = String(correoField.value || '').trim();
                                            if (cv === '') {
                                                if (mp && mp.eco && String(mp.eco).trim() !== '') correoField.value = String(mp.eco).trim() + '@azc.uam.mx'; else correoField.value = 'user@azc.uam.mx';
                                            }
                                        }
                                    } catch(e) { /* ignore */ }
                                    var formData = new FormData(f);
                                    fetch('controlador/guardarProfesor.php', { method: 'POST', body: formData })
                                    .then(resp => resp.json())
                                    .then(j => {
                                        if (j && j.ok) {
                                            swalAlertOpt('Correcto','Profesor registrado correctamente','success');
                                            console.log('Profesor registrado:', j.profesor);
                                            // marcar al llamador como completado
                                            callerBtn.textContent = 'Registrado'; callerBtn.className='btn btn-sm btn-secondary'; callerBtn.disabled = true;
                                            try { mb2.hide(); } catch(e) {}
                                        } else {
                                            swalAlertOpt('Error','No se pudo registrar: ' + (j && j.error ? j.error : JSON.stringify(j)),'error');
                                            btnSaveR.disabled = false;
                                        }
                                    }).catch(err => { console.error('Error guardarProfesor', err); swalAlertOpt('Error','Error registrando profesor: '+err,'error'); btnSaveR.disabled = false; });
                                });
                                // cuando el modal se oculte, reactivar el llamador si todavía no está registrado
                                try { mm.addEventListener('hidden.bs.modal', function(){ if (callerBtn && callerBtn.textContent === 'Registrar') callerBtn.disabled = false; document.getElementById(regId)?.remove(); }); } catch(e) {}
                            }
                        }

                        // Si no hay datos especiales, mostrar error genérico
                        if (!(result && Array.isArray(result.missing_profesores) && result.missing_profesores.length > 0)) {
                            swalAlertOpt('Error','Error procesando archivo: ' + (result && result.error ? result.error : JSON.stringify(result)),'error');
                        }
                    }
                }).catch(err => { console.error('Error upload/process planeacion', err); btnUpload.disabled = false; swalAlertOpt('Error','Error subiendo o procesando archivo: '+err,'error'); })
                .finally(function(){
                    try { if (uploadOverlay && uploadOverlay.parentNode) uploadOverlay.parentNode.removeChild(uploadOverlay); } catch(e){}
                    btnUpload.disabled = false;

                    // Intentar borrar el archivo temporal en el servidor si existe
                    try {
                        if (procFilename) {
                            var payload = { filename: procFilename };
                            if (typeof postForm === 'function') {
                                postForm('controlador/borrarTemporalPlaneacion.php', payload).then(function(res){
                                    try { if (res && res.ok) console.info('Temporal borrado:', res.filename, 'deleted=', res.deleted); else console.warn('No se pudo borrar temporal:', res); } catch(e){}
                                }).catch(function(err){ console.warn('Error borrando temporal (postForm):', err); });
                            } else {
                                var fdDelTemp = new FormData(); fdDelTemp.append('filename', procFilename);
                                fetch('controlador/borrarTemporalPlaneacion.php', { method: 'POST', body: fdDelTemp })
                                .then(function(r){ return r.json().catch(function(){ return null; }); })
                                .then(function(j){ try { if (j && j.ok) console.info('Temporal borrado:', j.filename, 'deleted=', j.deleted); else console.warn('No se pudo borrar temporal (fetch):', j); } catch(e){} })
                                .catch(function(err){ console.warn('Error borrando temporal (fetch):', err); });
                            }
                        }
                    } catch(e) { console.warn('Error iniciando borrado temporal:', e); }
                });
            }

            // Si hay datos existentes, preguntar al usuario si desea eliminarlos primero
            if (progCount > 0 || gruposCount > 0) {
                var msg = 'El trimestre seleccionado ya contiene ' + (progCount>0? progCount+' programación(es)':'' ) + (progCount>0 && gruposCount>0? ' y ' : '') + (gruposCount>0? gruposCount+' grupo(s)':'' ) + '.\n¿Deseas eliminar los datos existentes (programación, grupos y sus horarios) antes de subir el nuevo archivo?';
                confirmPromise('Trimestre con datos existentes', msg).then(function(accepted){
                    if (!accepted) {
                        swalAlertOpt('Cancelado', 'No se realizará ninguna acción. Selecciona otro trimestre o cancela.', 'info');
                        btnUpload.disabled = false;
                        return;
                    }
                    // user accepted -> delete existing programming first
                    swalShowLoading('Borrando programación existente...');
                    // Usar fetch con promesas en lugar de postForm/ajax
                    try {
                        var fdDel = new FormData(); fdDel.append('idTrimestre', idTr);
                        fetch('controlador/eliminarProgramacionTrimestre.php', { method: 'POST', body: fdDel })
                        .then(function(response){
                            // intentar parsear JSON; si falla, devolver objeto de error
                            return response.json().catch(function(){ return { ok: false, msg: 'Respuesta no válida del servidor' }; });
                        })
                        .then(function(resp){
                            try { swalClose(); } catch(e){}
                            if (resp && resp.ok) {
                                // Intentar extraer conteos de la respuesta para mostrarlos al usuario
                                try {
                                    var parts = [];
                                    var lookup = [
                                        { label: 'programación(s)', keys: ['deleted_programacion','deleted_programaciones','programacion_deleted','programacion_count','deleted_programacion_count'] },
                                        { label: 'grupo(s)', keys: ['deleted_grupos','deleted_groups','grupos_deleted','grupos_count','deleted_grupos_count'] },
                                        { label: 'horario(s)', keys: ['deleted_grupos_has_horario','deleted_horarios','horarios_deleted','horarios_count','deleted_horarios_count'] }
                                    ];
                                    lookup.forEach(function(item){
                                        for (var i=0;i<item.keys.length;i++){
                                            var k = item.keys[i];
                                            if (resp.hasOwnProperty(k)){
                                                var v = Number(resp[k]) || 0;
                                                if (v > 0) parts.push(v + ' ' + item.label);
                                                break;
                                            }
                                        }
                                    });

                                    if (parts.length === 0) {
                                        var totalKeys = ['total_deleted','deleted_total','deleted'];
                                        for (var j=0;j<totalKeys.length;j++){
                                            var tk = totalKeys[j];
                                            if (resp.hasOwnProperty(tk)){
                                                var tv = Number(resp[tk]) || 0;
                                                if (tv > 0) parts.push(tv + ' registro(s) eliminados');
                                                break;
                                            }
                                        }
                                    }

                                    var msg = '';
                                    if (parts.length > 0) {
                                        msg = 'Eliminación completada: ' + parts.join(', ') + '. Procediendo con la carga.';
                                    } else if (resp && resp.msg) {
                                        msg = resp.msg + ' Procediendo con la carga.';
                                    } else {
                                        msg = 'Datos anteriores eliminados. Procediendo con la carga.';
                                    }
                                    swalAlertOpt('Eliminado', msg, 'success');
                                } catch(e) {
                                    swalAlertOpt('Eliminado','Datos anteriores eliminados. Procediendo con la carga.','success');
                                }
                                startUpload();
                            } else {
                                swalAlertOpt('Error','No se pudo eliminar la programación existente: '+(resp && resp.msg ? resp.msg : JSON.stringify(resp)),'error');
                                btnUpload.disabled = false;
                            }
                        }).catch(function(err){ try { swalClose(); } catch(e){} console.error('Error eliminando programación:', err); swalAlertOpt('Error','Error eliminando programación: '+err,'error'); btnUpload.disabled = false; });
                    } catch(e) {
                        try { swalClose(); } catch(_){}
                        console.error('Error preparando petición de eliminación:', e);
                        swalAlertOpt('Error','Error interno al preparar la eliminación: '+e,'error');
                        btnUpload.disabled = false;
                    }
                });
            } else {
                // no existen datos previos, proceder con la subida
                startUpload();
            }

        }).catch(function(err){ try { swalClose(); } catch(e){} console.error('Error comprobando programación/grupos:', err); swalAlertOpt('Error','Error comprobando programación/grupos: '+err,'error'); btnUpload.disabled = false; });
    });
}

try { if (typeof window !== 'undefined') window.cargarPlaneacionGrupos = cargarPlaneacionGrupos; } catch(e) {}

