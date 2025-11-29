"use strict";

// js/menuTrimestres.js
// Construye la vista de gestión de trimestres con opciones principales
(function () {
  function crearMenuTrimestres(adminMenu) {
    if (!adminMenu) adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) return; // Limpiar contenido actual

    adminMenu.innerHTML = ''; // Header: botón volver + título

    var headerBar = document.createElement('div');
    headerBar.className = 'd-flex align-items-center mb-3';
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-sm btn-back';
    backBtn.title = 'Volver';
    backBtn.innerHTML = '&#8592; Volver';
    backBtn.addEventListener('click', function () {
      try {
        // Preferir la función de volver del mismo fichero si existe
        if (typeof crearMenuAdministrador === 'function') {
          crearMenuAdministrador();
          return;
        }
      } catch (e) {} // Fallback: intentar reconstruir el menú principal con el módulo si existe


      if (window && typeof window.crearMenuPrincipalAdmin === 'function') {
        try {
          window.crearMenuPrincipalAdmin(adminMenu);
          return;
        } catch (e) {}
      } // Si todo falla, recargar la página


      window.location.reload();
    });
    var title = document.createElement('h5');
    title.className = 'm-0 ms-2';
    title.textContent = 'Trimestres';
    headerBar.appendChild(backBtn);
    headerBar.appendChild(title);
    adminMenu.appendChild(headerBar); // Menu de acciones (header) + selector de año para filtrar la tabla

    var menuBar = document.createElement('div');
    menuBar.className = 'd-flex align-items-center justify-content-between mb-3';
    var actionsLeft = document.createElement('div');
    actionsLeft.className = 'd-flex flex-wrap';
    var actions = [{
      id: 'nuevo-trimestre',
      label: 'Nuevo trimestre',
      handler: 'nuevoTrimestre'
    }, {
      id: 'form-preferencias',
      label: 'Formulario de preferencias actual',
      handler: 'abrirFormularioPreferencias'
    }, {
      id: 'cargar-planeacion',
      label: 'Cargar planeación de grupos',
      handler: 'cargarPlaneacionGrupos'
    }, {
      id: 'programar-trimestre',
      label: 'Programar trimestre',
      handler: 'programarTrimestre'
    }, {
      id: 'hist-programacion',
      label: 'Histórico de programación',
      handler: 'historialProgramacion'
    }, {
      id: 'hist-preferencias',
      label: 'Histórico de preferencias',
      handler: 'historialPreferencias'
    }];
    actions.forEach(function (a) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = a.id;
      btn.className = 'btn btn-primary btn-sm me-2 mb-2';
      btn.textContent = a.label;
      btn.addEventListener('click', function () {
        if (window && typeof window[a.handler] === 'function') {
          try {
            window[a.handler]();
          } catch (err) {
            console.error('Error ejecutando handler', a.handler, err);
            swalAlertOpt('Error', 'Error al ejecutar: ' + a.label, 'error');
          }
        } else {
          var msg = 'Funcionalidad "' + a.label + '" no implementada en este entorno.';
          swalAlertOpt(a.label, msg, 'info');
        }
      });
      actionsLeft.appendChild(btn);
    }); // Selector de año

    var rightTools = document.createElement('div');
    rightTools.className = 'd-flex align-items-center';
    var anioLabel = document.createElement('label');
    anioLabel.className = 'me-2 mb-0';
    anioLabel.textContent = 'Año:';
    var selectAnioFilter = document.createElement('select');
    selectAnioFilter.className = 'form-select form-select-sm';
    selectAnioFilter.style.width = '120px'; // Poblar años

    (function () {
      var t = new Date();
      var cy = t.getFullYear();

      for (var y = cy - 2; y <= cy + 2; y++) {
        var o = document.createElement('option');
        o.value = String(y);
        o.textContent = String(y);
        if (y === cy) o.selected = true;
        selectAnioFilter.appendChild(o);
      }
    })();

    rightTools.appendChild(anioLabel);
    rightTools.appendChild(selectAnioFilter);
    menuBar.appendChild(actionsLeft);
    menuBar.appendChild(rightTools);
    adminMenu.appendChild(menuBar); // Contenedor para la tabla de trimestres

    var tableCard = document.createElement('div');
    tableCard.className = 'card';
    var tableBody = document.createElement('div');
    tableBody.className = 'card-body';
    var tableContainer = document.createElement('div');
    tableContainer.id = 'trimestres-table-container';
    tableBody.appendChild(tableContainer);
    tableCard.appendChild(tableBody);
    adminMenu.appendChild(tableCard); // Estado local para filas, orden y cache de estados de trimestre (id <-> nombre)

    var currentRows = [];
    var estadosMapByName = {}; // nombre normalizado -> id

    var estadosMapById = {}; // id -> nombre
    // Cargar lista de estados desde servidor y poblar mapas (no bloqueante)

    function cargarEstadosServer() {
      if (typeof postForm !== 'function') return;

      try {
        postForm('controlador/recuperaTrimestreEstados.php', {}).then(function (json) {
          if (!json || !json.ok || !Array.isArray(json.estados)) return;
          json.estados.forEach(function (e) {
            var id = e.idTrimestreEstado || e.id || e.idTrimestreestado || e.id_trimestreestado;
            var nombre = e.estado || e.nombre || String(e);
            if (!id) return;
            var key = String(nombre).trim().toLowerCase();
            estadosMapByName[key] = Number(id);
            estadosMapById[Number(id)] = nombre;
          });
        })["catch"](function (err) {
          console.warn('No se pudieron obtener estados:', err);
        });
      } catch (e) {
        console.warn('Error al solicitar estados:', e);
      }
    } // Ejecutar carga inicial de estados


    cargarEstadosServer();
    var sortState = {
      col: null,
      asc: true
    };

    function formatDateDisplay(d) {
      if (!d) return '-';
      return d;
    }

    function renderTable(rows) {
      currentRows = Array.isArray(rows) ? rows.slice() : []; // Aplicar orden

      if (sortState.col) {
        currentRows.sort(function (a, b) {
          var va = a[sortState.col];
          var vb = b[sortState.col];
          if (va == vb) return 0;

          if (sortState.col === 'fechaLimite') {
            // comparar fechas
            return sortState.asc ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
          } // numérico si es id o año


          if (/id|año|anio|idTrimestre/i.test(sortState.col)) {
            return sortState.asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
          } // string compare


          return sortState.asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
      } // Construir tabla


      var tbl = document.createElement('table');
      tbl.className = 'table table-striped table-sm';
      var thead = document.createElement('thead');
      var trh = document.createElement('tr'); // Columnas: Periodo | Año | Fecha límite | Estado

      var cols = [{
        key: 'periodoNombre',
        label: 'Periodo'
      }, {
        key: 'año',
        label: 'Año'
      }, {
        key: 'fechaLimite',
        label: 'Fecha límite'
      }, {
        key: 'trimestreEstado',
        label: 'Estado'
      }];
      cols.forEach(function (c) {
        var th = document.createElement('th');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-link p-0';
        btn.style.textDecoration = 'none';
        btn.textContent = c.label + (sortState.col === c.key ? sortState.asc ? ' ▲' : ' ▼' : '');
        btn.addEventListener('click', function () {
          if (sortState.col === c.key) sortState.asc = !sortState.asc;else {
            sortState.col = c.key;
            sortState.asc = true;
          }
          renderTable(currentRows);
        });
        th.appendChild(btn);
        trh.appendChild(th);
      });
      var thAct = document.createElement('th');
      thAct.textContent = 'Acciones';
      trh.appendChild(thAct);
      thead.appendChild(trh);
      tbl.appendChild(thead);
      var tbody = document.createElement('tbody');

      if (!currentRows || currentRows.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = cols.length + 1;
        td.textContent = 'No hay trimestres para el año seleccionado.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        currentRows.forEach(function (r) {
          var tr = document.createElement('tr'); // Periodo

          var tdP = document.createElement('td');
          tdP.textContent = r.periodoNombre || r.nombre || r.sigla || '';
          tr.appendChild(tdP); // Año

          var tdA = document.createElement('td');
          tdA.textContent = r.año || r.anio || r.year || '';
          tr.appendChild(tdA); // Fecha límite

          var tdF = document.createElement('td');
          tdF.textContent = formatDateDisplay(r.fechaLimite || r.fechaLim || '');
          tr.appendChild(tdF); // Estado (columna separada)

          var tdE = document.createElement('td');
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
          var tdAcc = document.createElement('td'); // Acciones: eliminar siempre, y acciones dependientes del estado

          tdAcc.innerHTML = ''; // Helper para crear botones

          function crearBtn(label, cls) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-sm ' + (cls || 'btn-secondary') + ' me-1';
            b.textContent = label;
            return b;
          } // Eliminar (siempre disponible)
          // Ver profesores disponibles (primero)


          var btnVerProf = crearBtn('Profesores', 'btn-primary');
          btnVerProf.title = 'Ver profesores disponibles para este trimestre';
          btnVerProf.addEventListener('click', function () {
            try {
              showProfesoresPanel(r);
            } catch (e) {
              console.error('Error mostrando panel de profesores', e);
              swalAlertOpt('Error', 'No se puede mostrar la lista de profesores', 'error');
            }
          });
          tdAcc.appendChild(btnVerProf);
          var btnDel = crearBtn('Eliminar', 'btn-danger');
          btnDel.addEventListener('click', function () {
            swalConfirmOpt('Eliminar', '¿Seguro que deseas eliminar este trimestre? Esta acción no se puede deshacer.', function () {
              // llamar al controlador
              postForm('controlador/eliminarTrimestre.php', {
                idTrimestre: r.idTrimestre
              }).then(function (json) {
                if (json && json.ok) {
                  // Construir mensaje detallado con los counts proporcionados por el servidor
                  var details = [];
                  if (json.disposiciones_eliminadas !== undefined) details.push(json.disposiciones_eliminadas + ' disposiciones');
                  if (json.grupos_eliminados !== undefined) details.push(json.grupos_eliminados + ' grupos');
                  if (json.programacion_eliminada !== undefined) details.push(json.programacion_eliminada + ' programaciones');
                  if (json.preferencias_eliminadas !== undefined) details.push(json.preferencias_eliminadas + ' preferencias');
                  var detailText = details.length > 0 ? '\n\nDetalles: ' + details.join(', ') : '';
                  var msg = (json.msg || 'Trimestre eliminado') + detailText; // Mostrar en SweetAlert (usa el helper global)

                  swalAlertOpt('Eliminado', msg, 'success').then(function () {
                    try {
                      if (window && typeof window.refrescarTrimestres === 'function') {
                        window.refrescarTrimestres();
                      }
                    } catch (e) {
                      console.error('Error refrescando trimestres después de eliminar', e);
                    }
                  });
                } else {
                  var errMsg = json && (json.msg || json.error) ? json.msg || json.error : JSON.stringify(json);
                  swalAlertOpt('Error', 'No se pudo eliminar el trimestre: ' + errMsg, 'error');
                }
              })["catch"](function (err) {
                console.error('Error eliminarTrimestre:', err);
                swalAlertOpt('Error', 'Error al eliminar trimestre', 'error');
              });
            });
          });
          tdAcc.appendChild(btnDel); // Panel de profesores: implementación dentro del scope para acceso a funciones locales

          function showProfesoresPanel(trimestreRow) {
            // Crear contenedor si no existe
            var panelId = 'profesores-panel';
            var existing = document.getElementById(panelId); // Prepare layout: ensure tableContainer and panel are side-by-side

            var parentCard = tableCard || adminMenu;
            if (!parentCard) parentCard = document.body; // If panel exists for another trimestre, remove it to recreate for new one

            if (existing) existing.parentNode.removeChild(existing);
            var panel = document.createElement('div');
            panel.id = panelId;
            panel.className = 'card ms-3';
            panel.style.width = '48%';
            panel.style.display = 'inline-block';
            panel.style.verticalAlign = 'top'; // Use a flex wrapper so the trimestres table and the panel sit side-by-side
            // We'll move the card that contains the table (`tableCard`) into a wrapper and
            // append the panel to that wrapper. On close we restore the original DOM.

            var wrapperId = 'trimestres-flex-wrapper';
            var wrapper = document.getElementById(wrapperId);
            var originalParent = tableCard && tableCard.parentNode ? tableCard.parentNode : null;

            if (!wrapper) {
              wrapper = document.createElement('div');
              wrapper.id = wrapperId; // Simple flex styling (Bootstrap utilities may be present, but set inline to be safe)

              wrapper.style.display = 'flex';
              wrapper.style.gap = '1rem';
              wrapper.style.alignItems = 'flex-start'; // If we have the table card, replace it in the DOM with the wrapper and
              // place the table card inside the wrapper so the panel can be appended next to it.

              if (tableCard && originalParent) {
                try {
                  originalParent.replaceChild(wrapper, tableCard);
                  wrapper.appendChild(tableCard); // keep a reference to restore later

                  wrapper._originalParent = originalParent;
                } catch (e) {
                  // fallback: append wrapper at body
                  document.body.appendChild(wrapper);
                  if (tableCard) wrapper.appendChild(tableCard);
                }
              } else {
                // No tableCard found — append wrapper to parentCard
                try {
                  parentCard.appendChild(wrapper);
                } catch (e) {
                  document.body.appendChild(wrapper);
                }
              }
            }

            var cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            var header = document.createElement('div');
            header.className = 'd-flex justify-content-between align-items-center mb-2';
            var h5 = document.createElement('h6');
            h5.textContent = 'Profesores — ' + (trimestreRow.año || trimestreRow.anio || '') + ' ' + (trimestreRow.periodoNombre || trimestreRow.sigla || '');
            var btnClose = document.createElement('button');
            btnClose.type = 'button';
            btnClose.className = 'btn btn-sm btn-outline-secondary';
            btnClose.textContent = 'Cerrar';
            btnClose.addEventListener('click', function () {
              try {
                // remove panel
                if (panel && panel.parentNode) panel.parentNode.removeChild(panel); // restore tableCard into its original parent and remove wrapper

                var wrapperEl = document.getElementById('trimestres-flex-wrapper');

                if (wrapperEl) {
                  var orig = wrapperEl._originalParent || null;

                  if (tableCard && orig) {
                    try {
                      orig.appendChild(tableCard);
                    } catch (e) {
                      document.body.appendChild(tableCard);
                    }
                  }

                  try {
                    if (wrapperEl.parentNode) wrapperEl.parentNode.removeChild(wrapperEl);
                  } catch (e) {}
                }
              } catch (e) {
                console.error(e);
              }
            });
            header.appendChild(h5);
            header.appendChild(btnClose); // Controls: search + toggle disponibles/todos

            var controls = document.createElement('div');
            controls.className = 'd-flex gap-2 mb-2';
            var inputSearch = document.createElement('input');
            inputSearch.type = 'search';
            inputSearch.className = 'form-control form-control-sm';
            inputSearch.placeholder = 'Buscar por nombre o número económico';
            var btnToggleList = document.createElement('button');
            btnToggleList.type = 'button';
            btnToggleList.className = 'btn btn-sm btn-outline-primary';
            btnToggleList.textContent = 'Mostrar: Todos';
            controls.appendChild(inputSearch);
            controls.appendChild(btnToggleList); // Table container

            var tblWrap = document.createElement('div');
            tblWrap.style.maxHeight = '60vh';
            tblWrap.style.overflow = 'auto';
            cardBody.appendChild(header);
            cardBody.appendChild(controls);
            cardBody.appendChild(tblWrap);
            panel.appendChild(cardBody); // Append panel into the wrapper so it appears to the right of the table card

            try {
              wrapper.appendChild(panel);
            } catch (e) {
              try {
                document.body.appendChild(panel);
              } catch (e2) {
                console.error('No se pudo agregar panel de profesores', e2);
              }
            } // State


            var profesoresList = [];
            var filterDisponiblesOnly = true;

            function renderProfesoresTable() {
              var q = (inputSearch.value || '').trim().toLowerCase();
              var filtered = profesoresList.filter(function (p) {
                if (filterDisponiblesOnly && !p.disponible) return false;
                if (!q) return true;
                var nombre = (p.nombre || p.nombreCompleto || '').toString().toLowerCase();
                var econ = (p.economico || p.numeroEconomico || p.economicoId || '').toString().toLowerCase();
                return nombre.indexOf(q) !== -1 || econ.indexOf(q) !== -1;
              }); // Build table

              tblWrap.innerHTML = '';
              var table = document.createElement('table');
              table.className = 'table table-sm table-striped';
              var thead = document.createElement('thead');
              var trh = document.createElement('tr');
              ['Trimestre', 'Económico', 'Nombre', 'Tipo profesor', 'Estado'].forEach(function (h) {
                var th = document.createElement('th');
                th.textContent = h;
                trh.appendChild(th);
              });
              thead.appendChild(trh);
              table.appendChild(thead);
              var tbody = document.createElement('tbody');
              filtered.forEach(function (p) {
                var tr = document.createElement('tr');
                var tdT = document.createElement('td');
                tdT.textContent = (trimestreRow.año || trimestreRow.anio || '') + ' ' + (trimestreRow.periodoNombre || trimestreRow.sigla || '');
                tr.appendChild(tdT);
                var tdE = document.createElement('td');
                tdE.textContent = p.economico || p.numeroEconomico || p.economicoId || '';
                tr.appendChild(tdE);
                var tdN = document.createElement('td');
                tdN.textContent = p.nombre || p.nombreCompleto || (p.apellido ? p.apellido + ', ' + p.nombre : '');
                tr.appendChild(tdN);
                var tdTipo = document.createElement('td');
                tdTipo.textContent = p.tipoProfesor || p.tipo || '';
                tr.appendChild(tdTipo);
                var tdEstado = document.createElement('td');
                var btnEstado = document.createElement('button');
                btnEstado.type = 'button';
                btnEstado.className = 'btn btn-sm';
                var disponible = !!p.disponible; // boolean

                btnEstado.classList.add(disponible ? 'btn-success' : 'btn-danger');
                btnEstado.textContent = disponible ? 'Disponible' : 'No disponible';
                btnEstado.addEventListener('click', function () {
                  // Toggle availability via server (assumed endpoint)
                  var newVal = !disponible;
                  postForm('controlador/actualizarDisponibilidadProfesor.php', {
                    idProfesor: p.idProfesor || p.id || p.profesorId,
                    idTrimestre: trimestreRow.idTrimestre,
                    disponible: newVal ? 1 : 0
                  }).then(function (resp) {
                    if (resp && resp.ok) {
                      p.disponible = newVal;
                      renderProfesoresTable();
                    } else {
                      swalAlertOpt('Error', 'No se pudo cambiar disponibilidad: ' + (resp && resp.msg ? resp.msg : JSON.stringify(resp)), 'error');
                    }
                  })["catch"](function (err) {
                    console.error('Error toggleDisponibilidadProfesor:', err);
                    swalAlertOpt('Error', 'Error al cambiar disponibilidad', 'error');
                  });
                });
                tdEstado.appendChild(btnEstado);
                tr.appendChild(tdEstado);
                tbody.appendChild(tr);
              });
              table.appendChild(tbody);
              tblWrap.appendChild(table);
            } // Fetch profesores for this trimestre (assumes controller exists)


            function cargarProfesores() {
              tblWrap.innerHTML = 'Cargando...';
              postForm('controlador/recuperaProfesoresPorTrimestre.php', {
                idTrimestre: trimestreRow.idTrimestre
              }).then(function (json) {
                if (!json || !json.ok) {
                  tblWrap.innerHTML = '<div class="text-danger">Error cargando profesores</div>';
                  return;
                }

                profesoresList = json.profesores || json.professores || json.data || []; // normalize disponible flag

                profesoresList.forEach(function (p) {
                  p.disponible = p.disponible === 1 || p.disponible === true || String(p.disponible) === '1';
                });
                renderProfesoresTable();
              })["catch"](function (err) {
                console.error('Error recuperar profesores por trimestre:', err);
                tblWrap.innerHTML = '<div class="text-danger">Error cargando profesores</div>';
              });
            } // Hook search and toggle


            inputSearch.addEventListener('input', function () {
              renderProfesoresTable();
            });
            btnToggleList.addEventListener('click', function () {
              filterDisponiblesOnly = !filterDisponiblesOnly; // Button text indicates the action that will happen when clicked (not the current state)

              btnToggleList.textContent = filterDisponiblesOnly ? 'Mostrar: Todos' : 'Mostrar: Disponibles';
              renderProfesoresTable();
            }); // Initial load

            cargarProfesores();
          } // Normalizar nombre de estado


          var estadoNorm = String(estadoText || '').trim().toLowerCase(); // Si está en proceso -> permitir terminar

          if (estadoNorm === 'en proceso' || estadoNorm === 'enproceso') {
            var btnTerm = crearBtn('Terminar', 'btn-success');
            btnTerm.addEventListener('click', function () {
              swalConfirmOpt('Terminar', 'Marcar trimestre como "Terminado"?', function () {
                var targetId = estadosMapByName['terminado'] || estadosMapByName['term'] || null; // Si no encontramos id en cache, enviar acción para que el servidor la resuelva por nombre

                var payload = {
                  idTrimestre: r.idTrimestre
                };
                if (targetId) payload.estadoId = targetId;else payload.accion = 'terminar';
                postForm('controlador/cambiarEstadoTrimestre.php', payload).then(function (json) {
                  if (json && json.ok) {
                    swalAlertOpt('Hecho', 'Estado cambiado', 'success');

                    try {
                      if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
                    } catch (e) {}
                  } else {
                    swalAlertOpt('Error', 'No se pudo cambiar estado: ' + (json && json.error ? json.error : JSON.stringify(json)), 'error');
                  }
                })["catch"](function (err) {
                  console.error('Error cambiarEstadoTrimestre:', err);
                  swalAlertOpt('Error', 'Error al cambiar estado', 'error');
                });
              });
            });
            tdAcc.appendChild(btnTerm);
          } // Si está 'A programar' -> mostrar Formulario de preferencias y botón para pasar a 'En Proceso'


          if (estadoNorm === 'a programar' || estadoNorm === 'aprogramar' || estadoNorm === 'a_programar') {
            var btnFormPref = crearBtn('Formulario de preferencias', 'btn-info');
            btnFormPref.addEventListener('click', function () {
              // intentamos invocar función existente pasando el objeto fila si está disponible
              if (window && typeof window.abrirFormularioPreferencias === 'function') {
                try {
                  window.abrirFormularioPreferencias(r);
                  return;
                } catch (e) {
                  console.error('Error abriendo formulario', e);
                }
              }

              swalAlertOpt('Info', 'Funcionalidad no disponible en este entorno para abrir formulario de preferencias.', 'info');
            });
            tdAcc.appendChild(btnFormPref);
            var btnCamb = crearBtn('Cambiar estado', 'btn-warning');
            btnCamb.addEventListener('click', function () {
              swalConfirmOpt('Cambiar estado', 'Cambiar estado a "En Proceso"?', function () {
                var targetId = estadosMapByName['en proceso'] || estadosMapByName['enproceso'] || estadosMapByName['en_proceso'] || null;
                var payload = {
                  idTrimestre: r.idTrimestre
                };
                if (targetId) payload.estadoId = targetId;else payload.accion = 'programar';
                postForm('controlador/cambiarEstadoTrimestre.php', payload).then(function (json) {
                  if (json && json.ok) {
                    swalAlertOpt('Hecho', 'Estado cambiado', 'success');

                    try {
                      if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
                    } catch (e) {}
                  } else {
                    swalAlertOpt('Error', 'No se pudo cambiar estado: ' + (json && json.error ? json.error : JSON.stringify(json)), 'error');
                  }
                })["catch"](function (err) {
                  console.error('Error cambiarEstadoTrimestre:', err);
                  swalAlertOpt('Error', 'Error al cambiar estado', 'error');
                });
              });
            });
            tdAcc.appendChild(btnCamb);
          }

          tr.appendChild(tdAcc);
          tbody.appendChild(tr);
        });
      }

      tbl.appendChild(tbody); // Reemplazar contenido del contenedor

      tableContainer.innerHTML = '';
      tableContainer.appendChild(tbl);
    }

    function cargarTrimestresParaAnio(anio) {
      tableContainer.innerHTML = 'Cargando...';
      postForm('controlador/recuperaTrimestresPorAnio.php', {
        anio: anio
      }).then(function (json) {
        if (!json || !json.ok) {
          tableContainer.innerHTML = '<div class="text-danger">Error cargando trimestres</div>';
          return;
        }

        renderTable(json.trimestres || []);
      })["catch"](function (err) {
        console.error('Error recuperaTrimestresPorAnio:', err);
        tableContainer.innerHTML = '<div class="text-danger">Error cargando trimestres</div>';
      });
    } // Inicializar carga


    cargarTrimestresParaAnio(selectAnioFilter.value);
    selectAnioFilter.addEventListener('change', function () {
      sortState = {
        col: null,
        asc: true
      };
      cargarTrimestresParaAnio(this.value);
    }); // Exponer helper para refrescar la lista de trimestres desde otras funciones (por ejemplo el modal)

    try {
      if (typeof window !== 'undefined') {
        window.refrescarTrimestres = function () {
          try {
            cargarTrimestresParaAnio(selectAnioFilter.value);
          } catch (e) {
            console.error('Error refrescando trimestres', e);
          }
        };
      }
    } catch (e) {}
  }

  try {
    if (typeof window !== 'undefined') window.crearMenuTrimestres = crearMenuTrimestres;
  } catch (e) {}
})(); // Mostrar modal para crear un nuevo trimestre
// NOTE: alert/confirm helpers are provided by `js/uiHelpers.js` as
// `swalAlertOpt` and `swalConfirmOpt` (global) — the module uses those.


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
  form.id = 'formNuevoTrimestre'; // Año select

  var divAnio = document.createElement('div');
  divAnio.className = 'mb-3';
  var labelAnio = document.createElement('label');
  labelAnio.className = 'form-label';
  labelAnio.textContent = 'Año';
  var selectAnio = document.createElement('select');
  selectAnio.className = 'form-select';
  selectAnio.id = 'nuevo_trimestre_anio';
  divAnio.appendChild(labelAnio);
  divAnio.appendChild(selectAnio); // Periodo select

  var divPeriodo = document.createElement('div');
  divPeriodo.className = 'mb-3';
  var labelPeriodo = document.createElement('label');
  labelPeriodo.className = 'form-label';
  labelPeriodo.textContent = 'Periodo (trimestre)';
  var selectPeriodo = document.createElement('select');
  selectPeriodo.className = 'form-select';
  selectPeriodo.id = 'nuevo_trimestre_periodo';
  selectPeriodo.disabled = true;
  divPeriodo.appendChild(labelPeriodo);
  divPeriodo.appendChild(selectPeriodo); // Fecha límite

  var divFecha = document.createElement('div');
  divFecha.className = 'mb-3';
  var labelFecha = document.createElement('label');
  labelFecha.className = 'form-label';
  labelFecha.textContent = 'Fecha límite';
  var inputFecha = document.createElement('input');
  inputFecha.type = 'date';
  inputFecha.className = 'form-control';
  inputFecha.id = 'nuevo_trimestre_fecha';
  divFecha.appendChild(labelFecha);
  divFecha.appendChild(inputFecha); // Estado select (se poblará desde servidor o con fallback)

  var divEstado = document.createElement('div');
  divEstado.className = 'mb-3';
  var labelEstado = document.createElement('label');
  labelEstado.className = 'form-label';
  labelEstado.textContent = 'Estado';
  var selectEstado = document.createElement('select');
  selectEstado.className = 'form-select';
  selectEstado.id = 'nuevo_trimestre_estado'; // colocar una opción temporal mientras carga

  var optLoading = document.createElement('option');
  optLoading.value = '';
  optLoading.textContent = 'Cargando estados...';
  selectEstado.appendChild(optLoading);
  divEstado.appendChild(labelEstado);
  divEstado.appendChild(selectEstado);
  form.appendChild(divAnio);
  form.appendChild(divPeriodo);
  form.appendChild(divEstado);
  form.appendChild(divFecha);
  body.appendChild(form);
  var footer = document.createElement('div');
  footer.className = 'modal-footer';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-secondary';
  btnCancel.setAttribute('data-bs-dismiss', 'modal');
  btnCancel.textContent = 'Cancelar';
  var btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.id = 'guardarNuevoTrimestre';
  btnSave.textContent = 'Crear';
  footer.appendChild(btnCancel);
  footer.appendChild(btnSave);
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  dialog.appendChild(content);
  modal.appendChild(dialog);
  document.body.appendChild(modal); // Poblar select de años: rango currentYear-2 .. currentYear+2

  var today = new Date();
  var cy = today.getFullYear();

  for (var y = cy - 2; y <= cy + 2; y++) {
    var opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === cy) opt.selected = true;
    selectAnio.appendChild(opt);
  } // Establecer min para fecha = mañana


  function formatDateYMD(d) {
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  var manana = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  inputFecha.min = formatDateYMD(manana); // Función para cargar periodos y excluir ya usados

  function cargarPeriodos(anio) {
    selectPeriodo.innerHTML = '';
    selectPeriodo.disabled = true;
    selectPeriodo.innerHTML = '<option value="">Cargando...</option>';
    postForm('controlador/recuperaPeriodosTrimestre.php', {
      anio: anio
    }).then(function (json) {
      selectPeriodo.innerHTML = '';

      if (!json || !json.ok) {
        selectPeriodo.innerHTML = '<option value="">Error al cargar periodos</option>';
        return;
      }

      var periodos = Array.isArray(json.periodos) ? json.periodos : [];
      var used = Array.isArray(json.used) ? json.used.map(Number) : []; // Filtrar

      var disponibles = periodos.filter(function (p) {
        return !used.includes(Number(p.idTrimestrePeriodo || p.id || p.idPeriodo || p.idTrimestreperiodo));
      });

      if (disponibles.length === 0) {
        selectPeriodo.innerHTML = '<option value="">No hay periodos disponibles para este año</option>';
        selectPeriodo.disabled = true;
        return;
      }

      disponibles.forEach(function (p) {
        // Normalizar id y nombre
        var id = p.idTrimestrePeriodo || p.id || p.idPeriodo || p.idTrimestreperiodo || p.id_trimestreperiodo;
        var nombre = p.nombre || p.NOMBRE || p.sigla || p.nombrePeriodo || 'Periodo';
        var opt = document.createElement('option');
        opt.value = String(id);
        opt.textContent = nombre + (p.sigla ? ' (' + p.sigla + ')' : '');
        selectPeriodo.appendChild(opt);
      });
      selectPeriodo.disabled = false;
    })["catch"](function (err) {
      console.error('Error recuperaPeriodosTrimestre:', err);
      selectPeriodo.innerHTML = '<option value="">Error al cargar periodos</option>';
      selectPeriodo.disabled = true;
    });
  } // Cargar por defecto para el año seleccionado


  cargarPeriodos(selectAnio.value); // Cargar lista de estados para el select (intentar desde servidor, si falla usar fallback)

  function cargarEstados() {
    if (!selectEstado) return; // petición al controlador esperado

    if (typeof postForm === 'function') {
      postForm('controlador/recuperaTrimestreEstados.php', {}).then(function (json) {
        selectEstado.innerHTML = '';

        if (json && json.ok && Array.isArray(json.estados) && json.estados.length > 0) {
          var foundActivo = null;
          json.estados.forEach(function (e) {
            var id = e.idTrimestreEstado || e.id || e.idTrimestreestado || e.id_trimestreestado;
            var nombre = e.estado || e.nombre || String(e);
            var opt = document.createElement('option');
            opt.value = String(id);
            opt.textContent = nombre;
            selectEstado.appendChild(opt);
            if (String(nombre).toLowerCase() === 'activo') foundActivo = opt;
          });
          if (foundActivo) foundActivo.selected = true;
          return;
        } // si no hay datos, fallback


        throw new Error('No se recibieron estados');
      })["catch"](function (err) {
        console.warn('No se pudieron recuperar estados desde servidor, usando fallback. Error:', err); // Fallback

        selectEstado.innerHTML = '';
        var defaults = [{
          id: '1',
          estado: 'Activo'
        }, {
          id: '2',
          estado: 'Inactivo'
        }];
        defaults.forEach(function (d) {
          var o = document.createElement('option');
          o.value = String(d.id);
          o.textContent = d.estado;
          selectEstado.appendChild(o);
        }); // seleccionar Activo por defecto

        selectEstado.value = '1';
      });
    } else {
      // Sin helper postForm -> usar fallback
      selectEstado.innerHTML = '';
      var defaults = [{
        id: '1',
        estado: 'Activo'
      }, {
        id: '2',
        estado: 'Inactivo'
      }];
      defaults.forEach(function (d) {
        var o = document.createElement('option');
        o.value = String(d.id);
        o.textContent = d.estado;
        selectEstado.appendChild(o);
      });
      selectEstado.value = '1';
    }
  } // Ejecutar carga de estados


  cargarEstados();
  selectAnio.addEventListener('change', function () {
    cargarPeriodos(this.value);
  }); // Inicializar bootstrap modal si está disponible

  var bsModal = null;

  try {
    bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  } catch (e) {
    modal.style.display = 'block';
  } // Guardar


  modal.querySelector('#guardarNuevoTrimestre').addEventListener('click', function () {
    var anio = selectAnio.value;
    var idPeriodo = selectPeriodo.value;
    var fecha = inputFecha.value;
    var estadoId = typeof selectEstado !== 'undefined' && selectEstado ? selectEstado.value : '';

    if (!anio) {
      swalAlertOpt('Error', 'Selecciona un año', 'error');
      return;
    }

    if (!idPeriodo) {
      swalAlertOpt('Error', 'Selecciona un periodo disponible', 'error');
      return;
    }

    if (!fecha) {
      swalAlertOpt('Error', 'Selecciona una fecha límite válida', 'error');
      return;
    } // Validación cliente: fecha > hoy


    var fSel = new Date(fecha + 'T00:00:00');
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (!(fSel.getTime() > hoy.getTime())) {
      swalAlertOpt('Error', 'La fecha límite debe ser posterior a la fecha actual', 'error');
      return;
    }

    this.disabled = true; // Enviar estado si se seleccionó uno

    var payload = {
      anio: anio,
      idPeriodo: idPeriodo,
      fechaLimite: fecha
    };
    if (estadoId) payload.estadoId = estadoId;
    postForm('controlador/insertarTrimestre.php', payload).then(function (json) {
      if (json && json.ok) {
        swalAlertOpt('Correcto', json.msg || 'Trimestre creado', 'success');

        try {
          bsModal.hide();
        } catch (e) {
          modal.parentNode.removeChild(modal);
        } // Actualizar la tabla de trimestres si el módulo la expone


        try {
          if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
        } catch (e) {
          console.warn('No se pudo refrescar la lista de trimestres:', e);
        } // Opcional: si hay un contenedor de trimestres, actualizarlo

      } else {
        var msg = json && json.msg ? json.msg : JSON.stringify(json);
        swalAlertOpt('Error', 'No se pudo crear el trimestre: ' + msg, 'error');
        modal.querySelector('#guardarNuevoTrimestre').disabled = false;
      }
    })["catch"](function (err) {
      console.error('Error insertarTrimestre:', err);
      swalAlertOpt('Error', 'Error al crear trimestre', 'error');
      modal.querySelector('#guardarNuevoTrimestre').disabled = false;
    });
  });
} // Exponer la función para que el menú la use


try {
  if (typeof window !== 'undefined') window.nuevoTrimestre = nuevoTrimestre;
} catch (e) {} // Modal + upload for cargar planeación de grupos


function cargarPlaneacionGrupos() {
  // remove existing
  var existing = document.getElementById('modalCargarPlaneacion');
  if (existing) existing.parentNode.removeChild(existing);
  var modal = document.createElement('div');
  modal.id = 'modalCargarPlaneacion';
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
  h5.textContent = 'Cargar planeación de grupos (Excel)';
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
  form.id = 'formCargarPlaneacion'; // Select trimestre

  var divTrim = document.createElement('div');
  divTrim.className = 'mb-3';
  var lblTrim = document.createElement('label');
  lblTrim.className = 'form-label';
  lblTrim.textContent = 'Selecciona trimestre';
  var selTrim = document.createElement('select');
  selTrim.className = 'form-select';
  selTrim.id = 'select_planeacion_trimestre';
  divTrim.appendChild(lblTrim);
  divTrim.appendChild(selTrim); // File input

  var divFile = document.createElement('div');
  divFile.className = 'mb-3';
  var lblFile = document.createElement('label');
  lblFile.className = 'form-label';
  lblFile.textContent = 'Archivo Excel (.xls/.xlsx) - hoja debe llamarse CB';
  var inpFile = document.createElement('input');
  inpFile.type = 'file';
  inpFile.accept = '.xls,.xlsx';
  inpFile.className = 'form-control';
  inpFile.id = 'input_planeacion_file';
  divFile.appendChild(lblFile);
  divFile.appendChild(inpFile);
  form.appendChild(divTrim);
  form.appendChild(divFile);
  body.appendChild(form);
  var footer = document.createElement('div');
  footer.className = 'modal-footer';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-secondary';
  btnCancel.setAttribute('data-bs-dismiss', 'modal');
  btnCancel.textContent = 'Cancelar';
  var btnUpload = document.createElement('button');
  btnUpload.type = 'button';
  btnUpload.className = 'btn btn-primary';
  btnUpload.textContent = 'Subir y procesar';
  footer.appendChild(btnCancel);
  footer.appendChild(btnUpload);
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(footer);
  dialog.appendChild(content);
  modal.appendChild(dialog);
  document.body.appendChild(modal); // populate select with trimestres for current year (fallback if none)

  var today = new Date();
  var cy = today.getFullYear();
  selTrim.innerHTML = '<option value="">Cargando...</option>';

  if (typeof postForm === 'function') {
    postForm('controlador/recuperaTrimestresPorAnio.php', {
      anio: cy
    }).then(function (json) {
      selTrim.innerHTML = '';

      if (!json || !json.ok || !Array.isArray(json.trimestres) || json.trimestres.length === 0) {
        selTrim.innerHTML = '<option value="">No se encontraron trimestres para el año ' + cy + '</option>';
        return;
      }

      json.trimestres.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.idTrimestre || t.id || '';
        opt.textContent = (t.año || t.anio) + ' ' + (t.periodoNombre || t.sigla || t.nombre || '');
        selTrim.appendChild(opt);
      });
    })["catch"](function (err) {
      console.error('Error cargando trimestres', err);
      selTrim.innerHTML = '<option value="">Error cargando trimestres</option>';
    });
  } // Initialize bootstrap modal if available


  try {
    var bs = new bootstrap.Modal(modal);
    bs.show();
  } catch (e) {
    modal.style.display = 'block';
  }

  btnUpload.addEventListener('click', function () {
    var file = inpFile.files && inpFile.files[0];
    var idTr = selTrim.value;

    if (!file) {
      swalAlertOpt('Error', 'Selecciona un archivo Excel', 'error');
      return;
    }

    if (!idTr) {
      swalAlertOpt('Error', 'Selecciona un trimestre', 'error');
      return;
    }

    btnUpload.disabled = true; // upload via FormData to controlador/guardarPlaneacion.php

    var fd = new FormData();
    fd.append('archivo', file);
    fetch('controlador/guardarPlaneacion.php', {
      method: 'POST',
      body: fd
    }).then(function (resp) {
      return resp.json();
    }).then(function (j) {
      if (!j || !j.ok) {
        throw new Error(j && j.error ? j.error : JSON.stringify(j));
      } // process file


      return postForm('controlador/procesarPlaneacion.php', {
        filename: j.filename,
        idTrimestre: idTr
      });
    }).then(function (result) {
      btnUpload.disabled = false;

      if (result && result.ok) {
        var s = result.stats || {};
        var msg = 'Grupos insertados: ' + (s.grupos_insertados || 0) + '\nHorarios: ' + (s.horarios_insertados || 0) + '\nProgramaciones: ' + (s.programacion_insertada || 0);
        if (Array.isArray(s.errores) && s.errores.length > 0) msg += '\n\nErrores:\n' + s.errores.join('\n');
        swalAlertOpt('Resultado', msg, 'success');

        try {
          if (window && typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
        } catch (e) {}

        try {
          if (bs) bs.hide();else modal.parentNode.removeChild(modal);
        } catch (e) {}
      } else {
        swalAlertOpt('Error', 'Error procesando archivo: ' + (result && result.error ? result.error : JSON.stringify(result)), 'error');
      }
    })["catch"](function (err) {
      console.error('Error upload/process planeacion', err);
      btnUpload.disabled = false;
      swalAlertOpt('Error', 'Error subiendo o procesando archivo: ' + err, 'error');
    });
  });
}

try {
  if (typeof window !== 'undefined') window.cargarPlaneacionGrupos = cargarPlaneacionGrupos;
} catch (e) {}