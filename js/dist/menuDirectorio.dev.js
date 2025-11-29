"use strict";

// /js/menuDirectorio.js
// Interfaz de directorio de profesores: lista filtrable a la izquierda y detalle a la derecha.
function crearMenuDirectorio() {
  var adminMenu = document.getElementById('admin-menu');
  if (!adminMenu) return;

  while (adminMenu.firstChild) {
    adminMenu.removeChild(adminMenu.firstChild);
  } // Header (back button + title)


  var header = document.createElement('div');
  header.className = 'd-flex align-items-center mb-3';
  var backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn-sm btn-back me-2';
  backBtn.title = 'Volver';
  backBtn.textContent = '← Volver';
  backBtn.addEventListener('click', function () {
    try {
      crearMenuAdministrador();
    } catch (e) {
      window.location.reload();
    }
  });
  header.appendChild(backBtn);
  var title = document.createElement('h5');
  title.className = 'm-0';
  title.textContent = 'Directorio de Profesores';
  header.appendChild(title);
  adminMenu.appendChild(header); // Container flex

  var container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '12px'; // Left panel (30%)

  var left = document.createElement('div');
  left.style.flex = '0 0 30%';
  var nav = document.createElement('div');
  nav.className = 'mb-2';
  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Buscar por nombre o número económico';
  input.className = 'form-control mb-2';
  input.id = 'dir-search-input';
  nav.appendChild(input);
  var nuevoBtn = document.createElement('button');
  nuevoBtn.className = 'btn btn-primary btn-sm mb-2';
  nuevoBtn.textContent = 'Nuevo profesor';
  nuevoBtn.addEventListener('click', mostrarModalNuevoProfesor);
  nav.appendChild(nuevoBtn); // Toggle button to show/hide filters and sort controls

  var toggleFiltersBtn = document.createElement('button');
  toggleFiltersBtn.type = 'button';
  toggleFiltersBtn.className = 'btn btn-outline-secondary btn-sm mb-2 ms-2';
  toggleFiltersBtn.id = 'btnToggleFiltros';
  toggleFiltersBtn.setAttribute('aria-expanded', 'false');
  toggleFiltersBtn.textContent = 'Mostrar filtros';
  toggleFiltersBtn.addEventListener('click', function () {
    var controlsRef = document.getElementById('dir-controls');
    if (!controlsRef) return; // Use Bootstrap utility 'd-none' to reliably hide/show regardless of inline/class styles

    var hidden = controlsRef.classList.toggle('d-none');

    if (hidden) {
      toggleFiltersBtn.textContent = 'Mostrar filtros';
      toggleFiltersBtn.setAttribute('aria-expanded', 'false');
    } else {
      toggleFiltersBtn.textContent = 'Ocultar filtros';
      toggleFiltersBtn.setAttribute('aria-expanded', 'true');
    }
  });
  nav.appendChild(toggleFiltersBtn);
  left.appendChild(nav); // Table list

  var listWrap = document.createElement('div');
  listWrap.style.maxHeight = '60vh';
  listWrap.style.overflow = 'auto';
  var table = document.createElement('table');
  table.className = 'table table-sm table-hover';
  var thead = document.createElement('thead'); // Build table header using DOM methods (avoid innerHTML)

  var trHead = document.createElement('tr');
  var thName = document.createElement('th');
  thName.textContent = 'Nombre';
  var thNum = document.createElement('th');
  thNum.textContent = 'No. Económico';
  trHead.appendChild(thName);
  trHead.appendChild(thNum);
  thead.appendChild(trHead);
  var tbody = document.createElement('tbody');
  table.appendChild(thead);
  table.appendChild(tbody);
  listWrap.appendChild(table);
  left.appendChild(listWrap); // Right panel (70%)

  var right = document.createElement('div');
  right.style.flex = '1 1 70%';
  right.id = 'dir-right-panel'; // Build placeholder card with DOM methods

  var placeholderCard = document.createElement('div');
  placeholderCard.className = 'card';
  var placeholderBody = document.createElement('div');
  placeholderBody.className = 'card-body';
  placeholderBody.textContent = 'Seleccione un profesor a la izquierda para ver sus detalles.';
  placeholderCard.appendChild(placeholderBody);
  right.appendChild(placeholderCard);
  container.appendChild(left);
  container.appendChild(right);
  adminMenu.appendChild(container); // Helper: fetch list of profesores with optional params (returns a Promise)

  function fetchProfesores() {
    var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q); // send name-based filters for areaAcademica and grupoTematico (frontend uses unique names)

    if (params.areaAcademica) qs.set('areaAcademicaName', params.areaAcademica);
    if (params.grupoTematico) qs.set('grupoTematicoName', params.grupoTematico);
    if (params.area) qs.set('area', params.area);
    if (params.profesorTipo) qs.set('profesorTipo', params.profesorTipo);
    if (params.trimestre) qs.set('trimestre', params.trimestre);
    if (params.sort) qs.set('sort', params.sort);
    if (params.sortDir) qs.set('sortDir', params.sortDir);
    var url = 'controlador/recuperarProfesores.php' + (qs.toString() ? '?' + qs.toString() : '');
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  } // Helper: fetch filter option lists


  function fetchFilters() {
    return fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  } // current filter/sort state


  var state = {
    q: '',
    areaAcademica: '',
    grupoTematico: '',
    area: '',
    profesorTipo: '',
    trimestre: '',
    sort: 'nombre',
    sortDir: 'ASC'
  };

  function loadList(q) {
    if (typeof q === 'string') state.q = q;
    fetchProfesores(state).then(function (json) {
      if (!json.ok) {
        // show error row
        while (tbody.firstChild) {
          tbody.removeChild(tbody.firstChild);
        }

        var errTr = document.createElement('tr');
        var errTd = document.createElement('td');
        errTd.colSpan = 2;
        errTd.textContent = 'Error al cargar profesores';
        errTr.appendChild(errTd);
        tbody.appendChild(errTr);
        return;
      } // clear tbody safely


      while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
      }

      json.profesores.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.dataset.id = p.idProfesor;
        var tdName = document.createElement('td');
        tdName.textContent = p.nombre || '';
        var tdNum = document.createElement('td');
        tdNum.textContent = p.numeroEconomico !== undefined && p.numeroEconomico !== null ? p.numeroEconomico : '';
        tr.appendChild(tdName);
        tr.appendChild(tdNum); // highlight jefe when filtering by areaAcademica or grupoTematico

        try {
          if (state.areaAcademica && p.isJefeArea && Number(p.isJefeArea) === 1) {
            tr.classList.add('table-warning');
          } else if (state.grupoTematico && p.isJefeGrupo && Number(p.isJefeGrupo) === 1) {
            tr.classList.add('table-warning');
          }
        } catch (e) {
          /* ignore */
        }

        tr.addEventListener('click', function () {
          return selectProfesor(p.idProfesor, tr);
        });
        tbody.appendChild(tr);
      });
    })["catch"](function (err) {
      console.error('Error fetching profesores:', err);

      while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
      }

      var errTr = document.createElement('tr');
      var errTd = document.createElement('td');
      errTd.colSpan = 2;
      errTd.textContent = 'Error al cargar profesores';
      errTr.appendChild(errTd);
      tbody.appendChild(errTr);
    });
  } // select row highlight


  var lastSelected = null;

  function selectProfesor(id, trElem) {
    if (lastSelected) lastSelected.classList.remove('table-primary');
    trElem.classList.add('table-primary');
    lastSelected = trElem;
    showDetails(id);
  }

  function fetchProfesorById(id) {
    return fetch('controlador/recuperarProfesorPorId.php?id=' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function showDetails(id) {
    fetchProfesorById(id).then(function (json) {
      if (!json.ok) {
        var panelErr = document.getElementById('dir-right-panel');

        while (panelErr.firstChild) {
          panelErr.removeChild(panelErr.firstChild);
        }

        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning';
        alertDiv.textContent = 'No se pudo cargar el profesor';
        panelErr.appendChild(alertDiv);
        return;
      }

      var p = json.profesor;
      var areas = json.areas || [];
      var grupos = json.grupos || [];
      var contrato = json.contrato || null;
      var contactos = json.contactos || []; // Build details card using DOM methods (avoid innerHTML)

      var panel = document.getElementById('dir-right-panel');

      while (panel.firstChild) {
        panel.removeChild(panel.firstChild);
      }

      var card = document.createElement('div');
      card.className = 'card';
      var body = document.createElement('div');
      body.className = 'card-body'; // Top toolbar: left side for menu placeholders, right side for actions (delete X)

      var toolbar = document.createElement('div');
      toolbar.className = 'd-flex justify-content-between align-items-center mb-2';
      var leftMenu = document.createElement('div');
      leftMenu.className = 'd-flex gap-2 align-items-center'; // placeholder for future menu items (edit, export...)
      // placeholder for future left menu items (export...)

      toolbar.appendChild(leftMenu);
      var rightMenu = document.createElement('div'); // Delete button (X) placed at the extreme right
      // Edit button (moved to the right next to delete for consistency)

      var btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-outline-primary btn-sm me-2';
      btnEdit.title = 'Editar profesor';
      btnEdit.textContent = 'Editar';
      rightMenu.appendChild(btnEdit); // Delete button (X) placed at the extreme right

      var btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.className = 'btn btn-danger btn-sm';
      btnDelete.title = 'Eliminar profesor';
      btnDelete.style.minWidth = '40px';
      btnDelete.style.lineHeight = '1';
      btnDelete.textContent = '✕';
      rightMenu.appendChild(btnDelete);
      toolbar.appendChild(rightMenu);
      body.appendChild(toolbar);
      var h5 = document.createElement('h5');
      h5.textContent = p.nombre || '';
      var small = document.createElement('small');
      small.className = 'text-muted';
      small.textContent = ' (' + (p.numeroEconomico !== undefined && p.numeroEconomico !== null ? p.numeroEconomico : '') + ')';
      h5.appendChild(small);
      body.appendChild(h5); // Mostrar tipo de profesor (desde contrato) antes del correo UAM

      var pTipoProfesor = document.createElement('p');
      var strongTipo = document.createElement('strong');
      strongTipo.textContent = 'Tipo de profesor:';
      pTipoProfesor.appendChild(strongTipo);
      var tipoText = contrato && contrato.tipoNombre ? contrato.tipoNombre : '(sin tipo)';
      pTipoProfesor.appendChild(document.createTextNode(' ' + tipoText));
      var pCorreoUAM = document.createElement('p');
      var strongUAM = document.createElement('strong');
      strongUAM.textContent = 'Correo UAM:';
      pCorreoUAM.appendChild(strongUAM);
      pCorreoUAM.appendChild(document.createTextNode(' ' + (p.correo_uam || '')));
      var pCorreoPersonal = document.createElement('p');
      var strongPersonal = document.createElement('strong');
      strongPersonal.textContent = 'Correo personal:';
      pCorreoPersonal.appendChild(strongPersonal);
      pCorreoPersonal.appendChild(document.createTextNode(' ' + (p.correo_personal || '')));
      var pGrado = document.createElement('p');
      var strongGrado = document.createElement('strong');
      strongGrado.textContent = 'Grado de estudios:';
      pGrado.appendChild(strongGrado);
      pGrado.appendChild(document.createTextNode(' ' + (p.gradoEstudios || '')));
      var pCel = document.createElement('p');
      var strongCel = document.createElement('strong');
      strongCel.textContent = 'Celular:';
      pCel.appendChild(strongCel);
      pCel.appendChild(document.createTextNode(' ' + (p.celular || ''))); // Insert tipo antes de correo UAM as requested

      body.appendChild(pTipoProfesor);
      body.appendChild(pCorreoUAM);
      body.appendChild(pCorreoPersonal);
      body.appendChild(pGrado);
      body.appendChild(pCel);
      body.appendChild(document.createElement('hr'));
      var hAreas = document.createElement('h6');
      hAreas.textContent = 'Áreas académicas';
      body.appendChild(hAreas); // Add button to add professor to an area

      var btnAddArea = document.createElement('button');
      btnAddArea.type = 'button';
      btnAddArea.className = 'btn btn-sm btn-outline-success ms-2';
      btnAddArea.textContent = '+ Agregar';
      hAreas.appendChild(btnAddArea);

      if (!areas || areas.length === 0) {
        var none = document.createElement('p');
        none.className = 'text-muted';
        none.textContent = '(ninguna)';
        body.appendChild(none);
      } else {
        var ul = document.createElement('ul');
        areas.forEach(function (a) {
          var li = document.createElement('li'); // main text

          var span = document.createElement('span');
          span.textContent = (a.nombre || '') + ' - ' + (a.puesto || '');
          li.appendChild(span); // Edit button (left of remove)

          var btnEditar = document.createElement('button');
          btnEditar.type = 'button';
          btnEditar.className = 'btn btn-sm btn-outline-primary me-2';
          btnEditar.textContent = 'Editar';
          btnEditar.title = 'Editar asignación de área';
          btnEditar.dataset.idAreaAcademica = a.idAreaAcademica || a.id || '';
          btnEditar.dataset.puesto = a.puesto || '';
          btnEditar.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var currentAreaId = btnEditar.dataset.idAreaAcademica;

            if (!currentAreaId) {
              alert('ID de área no disponible');
              return;
            } // build modal to change role


            var existing = document.getElementById('modalEditarArea');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'modalEditarArea';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.setAttribute('role', 'dialog');
            var dialog = document.createElement('div');
            dialog.className = 'modal-dialog';
            var content = document.createElement('div');
            content.className = 'modal-content';
            var header = document.createElement('div');
            header.className = 'modal-header';
            var title = document.createElement('h5');
            title.className = 'modal-title';
            title.textContent = 'Editar asignación de área';
            header.appendChild(title);
            var btnC = document.createElement('button');
            btnC.type = 'button';
            btnC.className = 'btn-close';
            btnC.setAttribute('data-bs-dismiss', 'modal');
            header.appendChild(btnC);
            var bodyM = document.createElement('div');
            bodyM.className = 'modal-body';
            var form = document.createElement('form');
            form.id = 'formEditarArea'; // show area name as read-only

            var lblArea = document.createElement('p');
            lblArea.className = 'mb-2';
            lblArea.textContent = a.nombre || '';
            bodyM.appendChild(lblArea); // role select

            var divRol = document.createElement('div');
            divRol.className = 'mb-2';
            var lblR = document.createElement('label');
            lblR.className = 'form-label';
            lblR.textContent = 'Rol';
            divRol.appendChild(lblR);
            var selR = document.createElement('select');
            selR.className = 'form-select';
            selR.name = 'nuevoRol';
            ['integrante', 'jefe'].forEach(function (r) {
              var o = document.createElement('option');
              o.value = r;
              o.textContent = r === 'jefe' ? 'Jefe' : 'Integrante';
              if ((a.puesto || '').toLowerCase().includes('jef') && r === 'jefe') o.selected = true;
              if (!(a.puesto || '').toLowerCase().includes('jef') && r === 'integrante') o.selected = true;
              selR.appendChild(o);
            });
            divRol.appendChild(selR);
            form.appendChild(divRol);
            var hiddenId = document.createElement('input');
            hiddenId.type = 'hidden';
            hiddenId.name = 'idAreaAcademica';
            hiddenId.value = currentAreaId;
            form.appendChild(hiddenId);
            var hiddenProf = document.createElement('input');
            hiddenProf.type = 'hidden';
            hiddenProf.name = 'idProfesor';
            hiddenProf.value = p.idProfesor;
            form.appendChild(hiddenProf);
            bodyM.appendChild(form);
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
            btnSave.textContent = 'Guardar cambios';
            footer.appendChild(btnCancel);
            footer.appendChild(btnSave);
            content.appendChild(header);
            content.appendChild(bodyM);
            content.appendChild(footer);
            dialog.appendChild(content);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            var bs = new bootstrap.Modal(modal);
            bs.show();
            btnSave.addEventListener('click', function () {
              // Use an async IIFE for clearer control flow and proper finally handling
              (function _callee() {
                var fd, resp, res, retry, cur, text, ans;
                return regeneratorRuntime.async(function _callee$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        fd = new FormData(form);
                        _context2.prev = 1;
                        btnSave.disabled = true;
                        _context2.next = 5;
                        return regeneratorRuntime.awrap(fetch('controlador/editarProfesorAreaAcademica.php', {
                          method: 'POST',
                          body: fd
                        }));

                      case 5:
                        resp = _context2.sent;
                        _context2.next = 8;
                        return regeneratorRuntime.awrap(resp.json());

                      case 8:
                        res = _context2.sent;

                        if (!(!res.ok && res.conflict)) {
                          _context2.next = 39;
                          break;
                        }

                        // ask for confirmation and retry with confirmReplace
                        retry = function retry() {
                          var r2resp, r2;
                          return regeneratorRuntime.async(function retry$(_context) {
                            while (1) {
                              switch (_context.prev = _context.next) {
                                case 0:
                                  fd.append('confirmReplace', '1');
                                  _context.next = 3;
                                  return regeneratorRuntime.awrap(fetch('controlador/editarProfesorAreaAcademica.php', {
                                    method: 'POST',
                                    body: fd
                                  }));

                                case 3:
                                  r2resp = _context.sent;
                                  _context.next = 6;
                                  return regeneratorRuntime.awrap(r2resp.json());

                                case 6:
                                  r2 = _context.sent;

                                  if (!r2.ok) {
                                    _context.next = 13;
                                    break;
                                  }

                                  if (window.Swal) Swal.fire('Listo', 'Cambio aplicado', 'success');else alert('Cambio aplicado');
                                  bs.hide();
                                  showDetails(p.idProfesor);
                                  _context.next = 14;
                                  break;

                                case 13:
                                  throw new Error(r2.error || 'Error');

                                case 14:
                                case "end":
                                  return _context.stop();
                              }
                            }
                          });
                        };

                        cur = res.current || {};
                        text = 'El área ya tiene un jefe: ' + (cur.nombre || '') + (cur.numeroEconomico ? ' (' + cur.numeroEconomico + ')' : '') + '. ¿Desea reemplazarlo?';

                        if (!window.Swal) {
                          _context2.next = 28;
                          break;
                        }

                        _context2.next = 16;
                        return regeneratorRuntime.awrap(Swal.fire({
                          title: 'Conflicto',
                          text: text,
                          icon: 'warning',
                          showCancelButton: true
                        }));

                      case 16:
                        ans = _context2.sent;

                        if (!ans.isConfirmed) {
                          _context2.next = 26;
                          break;
                        }

                        _context2.prev = 18;
                        _context2.next = 21;
                        return regeneratorRuntime.awrap(retry());

                      case 21:
                        _context2.next = 26;
                        break;

                      case 23:
                        _context2.prev = 23;
                        _context2.t0 = _context2["catch"](18);
                        if (window.Swal) Swal.fire('Error', _context2.t0.message || 'Error', 'error');else alert('Error: ' + (_context2.t0.message || _context2.t0));

                      case 26:
                        _context2.next = 37;
                        break;

                      case 28:
                        if (!confirm(text)) {
                          _context2.next = 37;
                          break;
                        }

                        _context2.prev = 29;
                        _context2.next = 32;
                        return regeneratorRuntime.awrap(retry());

                      case 32:
                        _context2.next = 37;
                        break;

                      case 34:
                        _context2.prev = 34;
                        _context2.t1 = _context2["catch"](29);
                        alert('Error: ' + (_context2.t1.message || _context2.t1));

                      case 37:
                        _context2.next = 46;
                        break;

                      case 39:
                        if (!res.ok) {
                          _context2.next = 45;
                          break;
                        }

                        if (window.Swal) Swal.fire('Guardado', 'Asignación actualizada', 'success');else alert('Asignación actualizada');
                        bs.hide();
                        showDetails(p.idProfesor);
                        _context2.next = 46;
                        break;

                      case 45:
                        throw new Error(res.error || 'Error al actualizar');

                      case 46:
                        _context2.next = 52;
                        break;

                      case 48:
                        _context2.prev = 48;
                        _context2.t2 = _context2["catch"](1);
                        console.error('Error editando area:', _context2.t2);
                        if (window.Swal) Swal.fire('Error', _context2.t2.message || 'Error', 'error');else alert('Error: ' + (_context2.t2.message || _context2.t2));

                      case 52:
                        _context2.prev = 52;
                        btnSave.disabled = false;
                        return _context2.finish(52);

                      case 55:
                      case "end":
                        return _context2.stop();
                    }
                  }
                }, null, null, [[1, 48, 52, 55], [18, 23], [29, 34]]);
              })();
            });
          }); // create action container to place Edit and Quitar together on the right

          var actionDiv = document.createElement('div');
          actionDiv.className = 'd-inline-flex align-items-center float-end';
          actionDiv.style.gap = '6px'; // remove button (placed in action container)

          var btnQuitar = document.createElement('button');
          btnQuitar.type = 'button';
          btnQuitar.className = 'btn btn-sm btn-outline-danger';
          btnQuitar.textContent = 'Quitar';
          btnQuitar.title = 'Quitar de esta área académica'; // attach ids (expecting a.idAreaAcademica exists)

          btnQuitar.dataset.idAreaAcademica = a.idAreaAcademica || a.id || '';
          btnQuitar.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var idArea = btnQuitar.dataset.idAreaAcademica;

            if (!idArea) {
              alert('ID de área no disponible');
              return;
            }

            function doQuitar() {
              var params = new URLSearchParams();
              params.set('idProfesor', p.idProfesor);
              params.set('idAreaAcademica', idArea);
              btnQuitar.disabled = true;
              fetch('controlador/quitarProfesorAreaAcademica.php', {
                method: 'POST',
                body: params
              }).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              }).then(function (res) {
                if (res.ok) {
                  if (window.Swal) Swal.fire('Quitado', 'Profesor removido del área', 'success');else alert('Profesor removido del área');
                  showDetails(p.idProfesor);
                } else throw new Error(res.error || 'Error');
              })["catch"](function (err) {
                console.error('Error quitando area:', err);
                if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
              })["finally"](function () {
                btnQuitar.disabled = false;
              });
            }

            if (window.Swal) {
              Swal.fire({
                title: 'Confirmar',
                text: '¿Quitar al profesor de esta área?',
                icon: 'warning',
                showCancelButton: true
              }).then(function (ans) {
                if (ans.isConfirmed) doQuitar();
              });
            } else if (confirm('¿Quitar al profesor de esta área?')) doQuitar();
          }); // append buttons into the action container so they appear adjacent on the right
          // Remove extra margin classes on the edit button to keep spacing consistent

          btnEditar.className = 'btn btn-sm btn-outline-primary';
          actionDiv.appendChild(btnEditar);
          actionDiv.appendChild(btnQuitar);
          li.appendChild(actionDiv);
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }

      var hGrupos = document.createElement('h6');
      hGrupos.textContent = 'Grupos temáticos';
      body.appendChild(hGrupos);
      var btnAddGrupo = document.createElement('button');
      btnAddGrupo.type = 'button';
      btnAddGrupo.className = 'btn btn-sm btn-outline-success ms-2';
      btnAddGrupo.textContent = '+ Agregar';
      hGrupos.appendChild(btnAddGrupo);

      if (!grupos || grupos.length === 0) {
        var _none = document.createElement('p');

        _none.className = 'text-muted';
        _none.textContent = '(ninguno)';
        body.appendChild(_none);
      } else {
        var _ul = document.createElement('ul');

        grupos.forEach(function (g) {
          var li = document.createElement('li');
          var span = document.createElement('span');
          span.textContent = (g.nombreGrupo || '') + ' - ' + (g.puesto || '');
          li.appendChild(span); // create action container for group actions (Edit + Quitar)

          var actionDivG = document.createElement('div');
          actionDivG.className = 'd-inline-flex align-items-center float-end';
          actionDivG.style.gap = '6px'; // Edit button for grupo temático

          var btnEditarG = document.createElement('button');
          btnEditarG.type = 'button';
          btnEditarG.className = 'btn btn-sm btn-outline-primary';
          btnEditarG.textContent = 'Editar';
          btnEditarG.title = 'Editar asignación de grupo temático';
          btnEditarG.dataset.idGrupoTematico = g.idGrupoTematico || g.id || '';
          btnEditarG.dataset.puesto = g.puesto || '';
          btnEditarG.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var currentGrupoId = btnEditarG.dataset.idGrupoTematico;

            if (!currentGrupoId) {
              alert('ID de grupo no disponible');
              return;
            } // build modal to change role for grupo


            var existingG = document.getElementById('modalEditarGrupo');
            if (existingG) existingG.remove();
            var modal = document.createElement('div');
            modal.id = 'modalEditarGrupo';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.setAttribute('role', 'dialog');
            var dialog = document.createElement('div');
            dialog.className = 'modal-dialog';
            var content = document.createElement('div');
            content.className = 'modal-content';
            var header = document.createElement('div');
            header.className = 'modal-header';
            var title = document.createElement('h5');
            title.className = 'modal-title';
            title.textContent = 'Editar asignación de grupo';
            header.appendChild(title);
            var btnC = document.createElement('button');
            btnC.type = 'button';
            btnC.className = 'btn-close';
            btnC.setAttribute('data-bs-dismiss', 'modal');
            header.appendChild(btnC);
            var bodyM = document.createElement('div');
            bodyM.className = 'modal-body';
            var form = document.createElement('form');
            form.id = 'formEditarGrupo'; // show grupo name

            var lblGrupo = document.createElement('p');
            lblGrupo.className = 'mb-2';
            lblGrupo.textContent = g.nombreGrupo || '';
            bodyM.appendChild(lblGrupo); // role select

            var divRol = document.createElement('div');
            divRol.className = 'mb-2';
            var lblR = document.createElement('label');
            lblR.className = 'form-label';
            lblR.textContent = 'Rol';
            divRol.appendChild(lblR);
            var selR = document.createElement('select');
            selR.className = 'form-select';
            selR.name = 'nuevoRol';
            ['integrante', 'jefe'].forEach(function (r) {
              var o = document.createElement('option');
              o.value = r;
              o.textContent = r === 'jefe' ? 'Jefe' : 'Integrante';
              if ((g.puesto || '').toLowerCase().includes('jef') && r === 'jefe') o.selected = true;
              if (!(g.puesto || '').toLowerCase().includes('jef') && r === 'integrante') o.selected = true;
              selR.appendChild(o);
            });
            divRol.appendChild(selR);
            form.appendChild(divRol);
            var hiddenId = document.createElement('input');
            hiddenId.type = 'hidden';
            hiddenId.name = 'idGrupoTematico';
            hiddenId.value = currentGrupoId;
            form.appendChild(hiddenId);
            var hiddenProf = document.createElement('input');
            hiddenProf.type = 'hidden';
            hiddenProf.name = 'idProfesor';
            hiddenProf.value = p.idProfesor;
            form.appendChild(hiddenProf);
            bodyM.appendChild(form);
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
            btnSave.textContent = 'Guardar cambios';
            footer.appendChild(btnCancel);
            footer.appendChild(btnSave);
            content.appendChild(header);
            content.appendChild(bodyM);
            content.appendChild(footer);
            dialog.appendChild(content);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            var bs = new bootstrap.Modal(modal);
            bs.show();
            btnSave.addEventListener('click', function () {
              (function _callee2() {
                var fd, resp, res, cur, text, retry, ans;
                return regeneratorRuntime.async(function _callee2$(_context4) {
                  while (1) {
                    switch (_context4.prev = _context4.next) {
                      case 0:
                        fd = new FormData(form);
                        _context4.prev = 1;
                        btnSave.disabled = true;
                        _context4.next = 5;
                        return regeneratorRuntime.awrap(fetch('controlador/editarProfesorGrupoTematico.php', {
                          method: 'POST',
                          body: fd
                        }));

                      case 5:
                        resp = _context4.sent;
                        _context4.next = 8;
                        return regeneratorRuntime.awrap(resp.json());

                      case 8:
                        res = _context4.sent;

                        if (!(!res.ok && res.conflict)) {
                          _context4.next = 39;
                          break;
                        }

                        cur = res.current || {};
                        text = 'El grupo ya tiene un jefe: ' + (cur.nombre || '') + (cur.numeroEconomico ? ' (' + cur.numeroEconomico + ')' : '') + '. ¿Desea reemplazarlo?';

                        retry = function retry() {
                          var r2resp, r2;
                          return regeneratorRuntime.async(function retry$(_context3) {
                            while (1) {
                              switch (_context3.prev = _context3.next) {
                                case 0:
                                  fd.append('confirmReplace', '1');
                                  _context3.next = 3;
                                  return regeneratorRuntime.awrap(fetch('controlador/editarProfesorGrupoTematico.php', {
                                    method: 'POST',
                                    body: fd
                                  }));

                                case 3:
                                  r2resp = _context3.sent;
                                  _context3.next = 6;
                                  return regeneratorRuntime.awrap(r2resp.json());

                                case 6:
                                  r2 = _context3.sent;

                                  if (!r2.ok) {
                                    _context3.next = 13;
                                    break;
                                  }

                                  if (window.Swal) Swal.fire('Listo', 'Cambio aplicado', 'success');else alert('Cambio aplicado');
                                  bs.hide();
                                  showDetails(p.idProfesor);
                                  _context3.next = 14;
                                  break;

                                case 13:
                                  throw new Error(r2.error || 'Error');

                                case 14:
                                case "end":
                                  return _context3.stop();
                              }
                            }
                          });
                        };

                        if (!window.Swal) {
                          _context4.next = 28;
                          break;
                        }

                        _context4.next = 16;
                        return regeneratorRuntime.awrap(Swal.fire({
                          title: 'Conflicto',
                          text: text,
                          icon: 'warning',
                          showCancelButton: true
                        }));

                      case 16:
                        ans = _context4.sent;

                        if (!ans.isConfirmed) {
                          _context4.next = 26;
                          break;
                        }

                        _context4.prev = 18;
                        _context4.next = 21;
                        return regeneratorRuntime.awrap(retry());

                      case 21:
                        _context4.next = 26;
                        break;

                      case 23:
                        _context4.prev = 23;
                        _context4.t0 = _context4["catch"](18);
                        if (window.Swal) Swal.fire('Error', _context4.t0.message || 'Error', 'error');else alert('Error: ' + (_context4.t0.message || _context4.t0));

                      case 26:
                        _context4.next = 37;
                        break;

                      case 28:
                        if (!confirm(text)) {
                          _context4.next = 37;
                          break;
                        }

                        _context4.prev = 29;
                        _context4.next = 32;
                        return regeneratorRuntime.awrap(retry());

                      case 32:
                        _context4.next = 37;
                        break;

                      case 34:
                        _context4.prev = 34;
                        _context4.t1 = _context4["catch"](29);
                        alert('Error: ' + (_context4.t1.message || _context4.t1));

                      case 37:
                        _context4.next = 46;
                        break;

                      case 39:
                        if (!res.ok) {
                          _context4.next = 45;
                          break;
                        }

                        if (window.Swal) Swal.fire('Guardado', 'Asignación actualizada', 'success');else alert('Asignación actualizada');
                        bs.hide();
                        showDetails(p.idProfesor);
                        _context4.next = 46;
                        break;

                      case 45:
                        throw new Error(res.error || 'Error al actualizar');

                      case 46:
                        _context4.next = 52;
                        break;

                      case 48:
                        _context4.prev = 48;
                        _context4.t2 = _context4["catch"](1);
                        console.error('Error editando grupo:', _context4.t2);
                        if (window.Swal) Swal.fire('Error', _context4.t2.message || 'Error', 'error');else alert('Error: ' + (_context4.t2.message || _context4.t2));

                      case 52:
                        _context4.prev = 52;
                        btnSave.disabled = false;
                        return _context4.finish(52);

                      case 55:
                      case "end":
                        return _context4.stop();
                    }
                  }
                }, null, null, [[1, 48, 52, 55], [18, 23], [29, 34]]);
              })();
            });
          }); // Quitar button

          var btnQuitarG = document.createElement('button');
          btnQuitarG.type = 'button';
          btnQuitarG.className = 'btn btn-sm btn-outline-danger';
          btnQuitarG.textContent = 'Quitar';
          btnQuitarG.title = 'Quitar de este grupo temático';
          btnQuitarG.dataset.idGrupoTematico = g.idGrupoTematico || g.id || '';
          btnQuitarG.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var idG = btnQuitarG.dataset.idGrupoTematico;

            if (!idG) {
              alert('ID de grupo no disponible');
              return;
            }

            function doQuitarG() {
              var params = new URLSearchParams();
              params.set('idProfesor', p.idProfesor);
              params.set('idGrupoTematico', idG);
              btnQuitarG.disabled = true;
              fetch('controlador/quitarProfesorGrupoTematico.php', {
                method: 'POST',
                body: params
              }).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              }).then(function (res) {
                if (res.ok) {
                  if (window.Swal) Swal.fire('Quitado', 'Profesor removido del grupo', 'success');else alert('Profesor removido del grupo');
                  showDetails(p.idProfesor);
                } else throw new Error(res.error || 'Error');
              })["catch"](function (err) {
                console.error('Error quitando grupo:', err);
                if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
              })["finally"](function () {
                btnQuitarG.disabled = false;
              });
            }

            if (window.Swal) {
              Swal.fire({
                title: 'Confirmar',
                text: '¿Quitar al profesor de este grupo?',
                icon: 'warning',
                showCancelButton: true
              }).then(function (ans) {
                if (ans.isConfirmed) doQuitarG();
              });
            } else if (confirm('¿Quitar al profesor de este grupo?')) doQuitarG();
          });
          actionDivG.appendChild(btnEditarG);
          actionDivG.appendChild(btnQuitarG);
          li.appendChild(actionDivG);

          _ul.appendChild(li);

          _ul.appendChild(li);
        });
        body.appendChild(_ul);
      } // Handler: open modal to add professor to area


      btnAddArea.addEventListener('click', function () {
        // fetch filter lists to populate area names
        fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (json) {
          if (!json.ok) throw new Error('No se pudieron cargar áreas'); // dedupe by nombre

          var areaMap = new Map();
          json.areaAcademicas.forEach(function (a) {
            if (!areaMap.has(a.nombre)) areaMap.set(a.nombre, a);
          }); // build modal

          var existing = document.getElementById('modalAgregarArea');
          if (existing) existing.remove();
          var modal = document.createElement('div');
          modal.id = 'modalAgregarArea';
          modal.className = 'modal fade';
          modal.tabIndex = -1;
          modal.setAttribute('role', 'dialog');
          var dialog = document.createElement('div');
          dialog.className = 'modal-dialog';
          var content = document.createElement('div');
          content.className = 'modal-content';
          var header = document.createElement('div');
          header.className = 'modal-header';
          var title = document.createElement('h5');
          title.className = 'modal-title';
          title.textContent = 'Agregar a área académica';
          header.appendChild(title);
          var btnC = document.createElement('button');
          btnC.type = 'button';
          btnC.className = 'btn-close';
          btnC.setAttribute('data-bs-dismiss', 'modal');
          header.appendChild(btnC);
          var bodyM = document.createElement('div');
          bodyM.className = 'modal-body';
          var form = document.createElement('form');
          form.id = 'formAgregarArea'; // select area name — exclude areas the professor already has

          var divSel = document.createElement('div');
          divSel.className = 'mb-2';
          var lbl = document.createElement('label');
          lbl.className = 'form-label';
          lbl.textContent = 'Área';
          divSel.appendChild(lbl);
          var sel = document.createElement('select');
          sel.className = 'form-select';
          sel.name = 'areaNombre';
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '(seleccione)';
          sel.appendChild(opt0); // build set of already assigned area names for this professor

          var assignedAreaNames = new Set((areas || []).map(function (a) {
            return a.nombre;
          }));
          var addedAreaOption = false;
          areaMap.forEach(function (a) {
            if (assignedAreaNames.has(a.nombre)) return; // skip already assigned

            var o = document.createElement('option');
            o.value = a.nombre;
            o.textContent = a.nombre;
            sel.appendChild(o);
            addedAreaOption = true;
          });
          divSel.appendChild(sel);
          form.appendChild(divSel); // role select

          var divRol = document.createElement('div');
          divRol.className = 'mb-2';
          var lblR = document.createElement('label');
          lblR.className = 'form-label';
          lblR.textContent = 'Rol';
          divRol.appendChild(lblR);
          var selR = document.createElement('select');
          selR.className = 'form-select';
          selR.name = 'rol';
          ['integrante', 'jefe'].forEach(function (r) {
            var o = document.createElement('option');
            o.value = r;
            o.textContent = r === 'jefe' ? 'Jefe' : 'Integrante';
            selR.appendChild(o);
          });
          divRol.appendChild(selR);
          form.appendChild(divRol);
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'idProfesor';
          hidden.value = p.idProfesor;
          form.appendChild(hidden);
          bodyM.appendChild(form);
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
          btnSave.textContent = 'Agregar';
          footer.appendChild(btnCancel);
          footer.appendChild(btnSave); // If there are no available areas to add, disable save and show info

          if (!addedAreaOption) {
            var info = document.createElement('div');
            info.className = 'alert alert-info';
            info.style.margin = '0 1rem 0 0';
            info.textContent = 'Todas las áreas disponibles ya están asignadas a este profesor.';
            bodyM.appendChild(info);
            btnSave.disabled = true;
          }

          content.appendChild(header);
          content.appendChild(bodyM);
          content.appendChild(footer);
          dialog.appendChild(content);
          modal.appendChild(dialog);
          document.body.appendChild(modal);
          var bs = new bootstrap.Modal(modal);
          bs.show();
          btnSave.addEventListener('click', function () {
            var fd = new FormData(form); // First try adding; if conflict returned, ask confirm and retry with confirmReplace

            fetch('controlador/agregarProfesorAreaAcademica.php', {
              method: 'POST',
              body: fd
            }).then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.json();
            }).then(function (res) {
              if (res.conflict) {
                var cur = res.current;
                var text = 'El área ya tiene un jefe: ' + (cur.nombre || '') + ' (' + (cur.numeroEconomico || '') + '). ¿Desea reemplazarlo?';

                if (window.Swal) {
                  Swal.fire({
                    title: 'Reemplazar jefe?',
                    text: text,
                    icon: 'warning',
                    showCancelButton: true
                  }).then(function (ans) {
                    if (ans.isConfirmed) {
                      fd.set('confirmReplace', '1');
                      fetch('controlador/agregarProfesorAreaAcademica.php', {
                        method: 'POST',
                        body: fd
                      }).then(function (r) {
                        return r.json();
                      }).then(function (r2) {
                        if (r2.ok) {
                          Swal.fire('Listo', 'Se reemplazó al jefe', 'success');
                          bs.hide();
                          showDetails(p.idProfesor);
                        } else {
                          Swal.fire('Error', r2.error || 'Error', 'error');
                        }
                      });
                    }
                  });
                } else if (confirm(text)) {
                  fd.set('confirmReplace', '1');
                  fetch('controlador/agregarProfesorAreaAcademica.php', {
                    method: 'POST',
                    body: fd
                  }).then(function (r) {
                    return r.json();
                  }).then(function (r2) {
                    if (r2.ok) {
                      alert('Se reemplazó al jefe');
                      bs.hide();
                      showDetails(p.idProfesor);
                    } else alert('Error: ' + (r2.error || 'Error'));
                  });
                }
              } else if (res.ok) {
                if (window.Swal) Swal.fire('Listo', 'Profesor agregado', 'success');else alert('Profesor agregado');
                bs.hide();
                showDetails(p.idProfesor);
              } else {
                throw new Error(res.error || 'Error');
              }
            })["catch"](function (err) {
              console.error('Error agregando area:', err);
              if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
            });
          });
        })["catch"](function (err) {
          console.error('Error cargando áreas:', err);
          if (window.Swal) Swal.fire('Error', 'No se pudieron cargar áreas', 'error');else alert('No se pudieron cargar áreas');
        });
      }); // Handler for adding to grupo temático

      btnAddGrupo.addEventListener('click', function () {
        fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (json) {
          if (!json.ok) throw new Error('No se pudieron cargar grupos');
          var grupoMap = new Map();
          json.gruposTematicos.forEach(function (g) {
            if (!grupoMap.has(g.nombreGrupo)) grupoMap.set(g.nombreGrupo, g);
          });
          var existing = document.getElementById('modalAgregarGrupo');
          if (existing) existing.remove();
          var modal = document.createElement('div');
          modal.id = 'modalAgregarGrupo';
          modal.className = 'modal fade';
          modal.tabIndex = -1;
          modal.setAttribute('role', 'dialog');
          var dialog = document.createElement('div');
          dialog.className = 'modal-dialog';
          var content = document.createElement('div');
          content.className = 'modal-content';
          var header = document.createElement('div');
          header.className = 'modal-header';
          var title = document.createElement('h5');
          title.className = 'modal-title';
          title.textContent = 'Agregar a grupo temático';
          header.appendChild(title);
          var btnC = document.createElement('button');
          btnC.type = 'button';
          btnC.className = 'btn-close';
          btnC.setAttribute('data-bs-dismiss', 'modal');
          header.appendChild(btnC);
          var bodyM = document.createElement('div');
          bodyM.className = 'modal-body';
          var form = document.createElement('form');
          form.id = 'formAgregarGrupo';
          var divSel = document.createElement('div');
          divSel.className = 'mb-2';
          var lbl = document.createElement('label');
          lbl.className = 'form-label';
          lbl.textContent = 'Grupo';
          divSel.appendChild(lbl);
          var sel = document.createElement('select');
          sel.className = 'form-select';
          sel.name = 'grupoNombre';
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '(seleccione)';
          sel.appendChild(opt0); // exclude grupos the professor already belongs to

          var assignedGrupoNames = new Set((grupos || []).map(function (g) {
            return g.nombreGrupo;
          }));
          var addedGrupoOption = false;
          grupoMap.forEach(function (g) {
            if (assignedGrupoNames.has(g.nombreGrupo)) return;
            var o = document.createElement('option');
            o.value = g.nombreGrupo;
            o.textContent = g.nombreGrupo;
            sel.appendChild(o);
            addedGrupoOption = true;
          });
          divSel.appendChild(sel);
          form.appendChild(divSel);
          var divRol = document.createElement('div');
          divRol.className = 'mb-2';
          var lblR = document.createElement('label');
          lblR.className = 'form-label';
          lblR.textContent = 'Rol';
          divRol.appendChild(lblR);
          var selR = document.createElement('select');
          selR.className = 'form-select';
          selR.name = 'rol';
          ['integrante', 'jefe'].forEach(function (r) {
            var o = document.createElement('option');
            o.value = r;
            o.textContent = r === 'jefe' ? 'Jefe' : 'Integrante';
            selR.appendChild(o);
          });
          divRol.appendChild(selR);
          form.appendChild(divRol);
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'idProfesor';
          hidden.value = p.idProfesor;
          form.appendChild(hidden);
          bodyM.appendChild(form);
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
          btnSave.textContent = 'Agregar';
          footer.appendChild(btnCancel);
          footer.appendChild(btnSave); // If no grupos available, show message and disable save

          if (!addedGrupoOption) {
            var info = document.createElement('div');
            info.className = 'alert alert-info';
            info.style.margin = '0 1rem 0 0';
            info.textContent = 'Todos los grupos disponibles ya contienen a este profesor.';
            bodyM.appendChild(info);
            btnSave.disabled = true;
          }

          content.appendChild(header);
          content.appendChild(bodyM);
          content.appendChild(footer);
          dialog.appendChild(content);
          modal.appendChild(dialog);
          document.body.appendChild(modal);
          var bs = new bootstrap.Modal(modal);
          bs.show();
          btnSave.addEventListener('click', function () {
            var fd = new FormData(form);
            fetch('controlador/agregarProfesorGrupoTematico.php', {
              method: 'POST',
              body: fd
            }).then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.json();
            }).then(function (res) {
              if (res.conflict) {
                var cur = res.current;
                var text = 'El grupo ya tiene un jefe: ' + (cur.nombre || '') + ' (' + (cur.numeroEconomico || '') + '). ¿Desea reemplazarlo?';

                if (window.Swal) {
                  Swal.fire({
                    title: 'Reemplazar jefe?',
                    text: text,
                    icon: 'warning',
                    showCancelButton: true
                  }).then(function (ans) {
                    if (ans.isConfirmed) {
                      fd.set('confirmReplace', '1');
                      fetch('controlador/agregarProfesorGrupoTematico.php', {
                        method: 'POST',
                        body: fd
                      }).then(function (r) {
                        return r.json();
                      }).then(function (r2) {
                        if (r2.ok) {
                          Swal.fire('Listo', 'Se reemplazó al jefe', 'success');
                          bs.hide();
                          showDetails(p.idProfesor);
                        } else Swal.fire('Error', r2.error || 'Error', 'error');
                      });
                    }
                  });
                } else if (confirm(text)) {
                  fd.set('confirmReplace', '1');
                  fetch('controlador/agregarProfesorGrupoTematico.php', {
                    method: 'POST',
                    body: fd
                  }).then(function (r) {
                    return r.json();
                  }).then(function (r2) {
                    if (r2.ok) {
                      alert('Se reemplazó al jefe');
                      bs.hide();
                      showDetails(p.idProfesor);
                    } else alert('Error: ' + (r2.error || 'Error'));
                  });
                }
              } else if (res.ok) {
                if (window.Swal) Swal.fire('Listo', 'Profesor agregado', 'success');else alert('Profesor agregado');
                bs.hide();
                showDetails(p.idProfesor);
              } else {
                throw new Error(res.error || 'Error');
              }
            })["catch"](function (err) {
              console.error('Error agregando grupo:', err);
              if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
            });
          });
        })["catch"](function (err) {
          console.error('Error cargando grupos:', err);
          if (window.Swal) Swal.fire('Error', 'No se pudieron cargar grupos', 'error');else alert('No se pudieron cargar grupos');
        });
      });
      var hContrato = document.createElement('h6');
      hContrato.textContent = 'Contrato';
      body.appendChild(hContrato); // Button to add a contrato (if any)

      var btnAddContrato = document.createElement('button');
      btnAddContrato.type = 'button';
      btnAddContrato.className = 'btn btn-sm btn-outline-success ms-2';
      btnAddContrato.textContent = '+ Agregar contrato';
      hContrato.appendChild(btnAddContrato);

      if (!contrato) {
        var _none2 = document.createElement('p');

        _none2.className = 'text-muted';
        _none2.textContent = '(sin contrato registrado)';
        body.appendChild(_none2);
      } else {
        // show contract with an action container (Quitar) aligned to the right
        var wrap = document.createElement('div');
        wrap.className = 'd-flex align-items-center';
        var pC = document.createElement('p');
        pC.className = 'mb-0';
        pC.textContent = (contrato.tipoNombre || '') + ' — ' + (contrato.descripcion || '');
        wrap.appendChild(pC);
        var actionDivContract = document.createElement('div');
        actionDivContract.className = 'd-inline-flex align-items-center ms-auto';
        actionDivContract.style.gap = '6px'; // Edit button for contrato

        var btnEditarContrato = document.createElement('button');
        btnEditarContrato.type = 'button';
        btnEditarContrato.className = 'btn btn-sm btn-outline-primary';
        btnEditarContrato.textContent = 'Editar';
        btnEditarContrato.title = 'Editar contrato';
        btnEditarContrato.dataset.idProfesorContrato = contrato.idProfesorContrato || contrato.id || '';
        btnEditarContrato.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var existing = document.getElementById('modalEditarContrato');
          if (existing) existing.remove(); // fetch tipos to build select and preselect current

          fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          }).then(function (json) {
            if (!json.ok) throw new Error('No se pudieron cargar tipos');
            var tipos = json.profesorTipos || [];
            var modal = document.createElement('div');
            modal.id = 'modalEditarContrato';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.setAttribute('role', 'dialog');
            var dialog = document.createElement('div');
            dialog.className = 'modal-dialog';
            var content = document.createElement('div');
            content.className = 'modal-content';
            var header = document.createElement('div');
            header.className = 'modal-header';
            var title = document.createElement('h5');
            title.className = 'modal-title';
            title.textContent = 'Editar contrato';
            header.appendChild(title);
            var btnC = document.createElement('button');
            btnC.type = 'button';
            btnC.className = 'btn-close';
            btnC.setAttribute('data-bs-dismiss', 'modal');
            header.appendChild(btnC);
            var bodyM = document.createElement('div');
            bodyM.className = 'modal-body';
            var form = document.createElement('form');
            form.id = 'formEditarContrato'; // tipo select

            var divTipo = document.createElement('div');
            divTipo.className = 'mb-2';
            var lblTipo = document.createElement('label');
            lblTipo.className = 'form-label';
            lblTipo.textContent = 'Tipo de contrato';
            divTipo.appendChild(lblTipo);
            var selTipo = document.createElement('select');
            selTipo.className = 'form-select';
            selTipo.name = 'idProfesorTipo';
            var opt0 = document.createElement('option');
            opt0.value = '';
            opt0.textContent = '(seleccione)';
            selTipo.appendChild(opt0);
            tipos.forEach(function (t) {
              var o = document.createElement('option');
              o.value = t.idProfesorTipo;
              o.textContent = t.nombre;
              selTipo.appendChild(o);
            });
            divTipo.appendChild(selTipo);
            form.appendChild(divTipo); // descripcion

            var divDesc = document.createElement('div');
            divDesc.className = 'mb-2';
            var lblDesc = document.createElement('label');
            lblDesc.className = 'form-label';
            lblDesc.textContent = 'Descripción';
            divDesc.appendChild(lblDesc);
            var ta = document.createElement('textarea');
            ta.className = 'form-control';
            ta.name = 'descripcion';
            ta.rows = 3;
            divDesc.appendChild(ta);
            form.appendChild(divDesc);
            var hiddenId = document.createElement('input');
            hiddenId.type = 'hidden';
            hiddenId.name = 'idProfesorContrato';
            hiddenId.value = contrato.idProfesorContrato || contrato.id || '';
            var hiddenProf = document.createElement('input');
            hiddenProf.type = 'hidden';
            hiddenProf.name = 'idProfesor';
            hiddenProf.value = p.idProfesor;
            form.appendChild(hiddenId);
            form.appendChild(hiddenProf);
            bodyM.appendChild(form);
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
            btnSave.textContent = 'Guardar cambios';
            footer.appendChild(btnCancel);
            footer.appendChild(btnSave);
            content.appendChild(header);
            content.appendChild(bodyM);
            content.appendChild(footer);
            dialog.appendChild(content);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            var bs = new bootstrap.Modal(modal);
            bs.show(); // prefill

            try {
              if (typeof contrato.idProfesorTipo !== 'undefined') selTipo.value = contrato.idProfesorTipo;
            } catch (e) {}

            try {
              ta.value = contrato.descripcion || '';
            } catch (e) {}

            btnSave.addEventListener('click', function () {
              if (!selTipo.value) {
                if (window.Swal) Swal.fire('Error', 'Seleccione un tipo de contrato', 'error');else alert('Seleccione un tipo de contrato');
                return;
              }

              btnSave.disabled = true;
              var fd = new FormData(form);
              fetch('controlador/editarProfesorContrato.php', {
                method: 'POST',
                body: fd
              }).then(function (resp) {
                if (!resp.ok) return resp.json();
                return resp.json();
              }).then(function (res) {
                if (!res.ok) throw new Error(res.error || 'Error actualizando contrato');
                if (window.Swal) Swal.fire('Guardado', 'Contrato actualizado', 'success');else alert('Contrato actualizado');
                bs.hide();
                setTimeout(function () {
                  showDetails(p.idProfesor);
                }, 200);
              })["catch"](function (err) {
                console.error('Error actualizando contrato:', err);
                if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
              })["finally"](function () {
                btnSave.disabled = false;
              });
            });
          })["catch"](function (err) {
            console.error('Error cargando tipos:', err);
            if (window.Swal) Swal.fire('Error', 'No se pudieron cargar tipos de contrato', 'error');else alert('No se pudieron cargar tipos de contrato');
          });
        });
        var btnQuitarContrato = document.createElement('button');
        btnQuitarContrato.type = 'button';
        btnQuitarContrato.className = 'btn btn-sm btn-outline-danger';
        btnQuitarContrato.textContent = 'Quitar';
        btnQuitarContrato.title = 'Quitar contrato';
        btnQuitarContrato.dataset.idProfesorContrato = contrato.idProfesorContrato || contrato.id || '';
        btnQuitarContrato.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var idC = btnQuitarContrato.dataset.idProfesorContrato;

          if (!idC) {
            alert('ID de contrato no disponible');
            return;
          }

          function doQuitarContrato() {
            var params = new URLSearchParams();
            params.set('idProfesor', p.idProfesor);
            params.set('idProfesorContrato', idC);
            btnQuitarContrato.disabled = true;
            fetch('controlador/quitarProfesorContrato.php', {
              method: 'POST',
              body: params
            }).then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.json();
            }).then(function (res) {
              if (res.ok) {
                if (window.Swal) Swal.fire('Quitado', 'Contrato eliminado', 'success');else alert('Contrato eliminado');
                showDetails(p.idProfesor);
              } else throw new Error(res.error || 'Error');
            })["catch"](function (err) {
              console.error('Error quitando contrato:', err);
              if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
            })["finally"](function () {
              btnQuitarContrato.disabled = false;
            });
          }

          if (window.Swal) {
            Swal.fire({
              title: 'Confirmar',
              text: '¿Quitar este contrato?',
              icon: 'warning',
              showCancelButton: true
            }).then(function (ans) {
              if (ans.isConfirmed) doQuitarContrato();
            });
          } else if (confirm('¿Quitar este contrato?')) doQuitarContrato();
        });
        actionDivContract.appendChild(btnEditarContrato);
        actionDivContract.appendChild(btnQuitarContrato);
        wrap.appendChild(actionDivContract);
        body.appendChild(wrap);
      } // If a contrato exists, disable the add button to enforce single-contract rule


      try {
        if (contrato) {
          btnAddContrato.disabled = true;
          btnAddContrato.title = 'Ya existe un contrato para este profesor';
          btnAddContrato.setAttribute('aria-disabled', 'true'); // add Bootstrap disabled visual if available

          btnAddContrato.classList.add('disabled');
        } else {
          btnAddContrato.disabled = false;
          btnAddContrato.removeAttribute('aria-disabled');
          btnAddContrato.classList.remove('disabled');
        }
      } catch (e) {
        // if for some reason btnAddContrato is not available, ignore
        console.warn('No se pudo modificar estado de btnAddContrato:', e);
      } // Handler: open modal to add contrato


      btnAddContrato.addEventListener('click', function () {
        // fetch profesor tipos for select
        fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (json) {
          if (!json.ok) throw new Error('No se pudieron cargar tipos');
          var tipos = json.profesorTipos || [];
          var existing = document.getElementById('modalAgregarContrato');
          if (existing) existing.remove();
          var modal = document.createElement('div');
          modal.id = 'modalAgregarContrato';
          modal.className = 'modal fade';
          modal.tabIndex = -1;
          modal.setAttribute('role', 'dialog');
          var dialog = document.createElement('div');
          dialog.className = 'modal-dialog';
          var content = document.createElement('div');
          content.className = 'modal-content';
          var header = document.createElement('div');
          header.className = 'modal-header';
          var title = document.createElement('h5');
          title.className = 'modal-title';
          title.textContent = 'Agregar contrato';
          header.appendChild(title);
          var btnC = document.createElement('button');
          btnC.type = 'button';
          btnC.className = 'btn-close';
          btnC.setAttribute('data-bs-dismiss', 'modal');
          header.appendChild(btnC);
          var bodyM = document.createElement('div');
          bodyM.className = 'modal-body';
          var form = document.createElement('form');
          form.id = 'formAgregarContrato'; // tipo select

          var divTipo = document.createElement('div');
          divTipo.className = 'mb-2';
          var lblTipo = document.createElement('label');
          lblTipo.className = 'form-label';
          lblTipo.textContent = 'Tipo de contrato';
          divTipo.appendChild(lblTipo);
          var selTipo = document.createElement('select');
          selTipo.className = 'form-select';
          selTipo.name = 'idProfesorTipo';
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '(seleccione)';
          selTipo.appendChild(opt0);
          tipos.forEach(function (t) {
            var o = document.createElement('option');
            o.value = t.idProfesorTipo;
            o.textContent = t.nombre;
            selTipo.appendChild(o);
          });
          divTipo.appendChild(selTipo);
          form.appendChild(divTipo); // descripcion

          var divDesc = document.createElement('div');
          divDesc.className = 'mb-2';
          var lblDesc = document.createElement('label');
          lblDesc.className = 'form-label';
          lblDesc.textContent = 'Descripción';
          divDesc.appendChild(lblDesc);
          var ta = document.createElement('textarea');
          ta.className = 'form-control';
          ta.name = 'descripcion';
          ta.rows = 3;
          divDesc.appendChild(ta);
          form.appendChild(divDesc);
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'idProfesor';
          hidden.value = p.idProfesor;
          form.appendChild(hidden);
          bodyM.appendChild(form);
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
          btnSave.textContent = 'Agregar';
          footer.appendChild(btnCancel);
          footer.appendChild(btnSave);
          content.appendChild(header);
          content.appendChild(bodyM);
          content.appendChild(footer);
          dialog.appendChild(content);
          modal.appendChild(dialog);
          document.body.appendChild(modal);
          var bs = new bootstrap.Modal(modal);
          bs.show();
          btnSave.addEventListener('click', function () {
            var idTipoVal = selTipo.value;
            var descVal = ta.value.trim();

            if (!idTipoVal) {
              if (window.Swal) Swal.fire('Error', 'Seleccione un tipo de contrato', 'error');else alert('Seleccione un tipo de contrato');
              return;
            }

            btnSave.disabled = true;
            var fd = new FormData(form);
            fetch('controlador/agregarProfesorContrato.php', {
              method: 'POST',
              body: fd
            }).then(function (resp) {
              if (!resp.ok) return resp.json();
              return resp.json();
            }).then(function (res) {
              if (!res.ok) {
                throw new Error(res.error || 'Error al guardar contrato');
              }

              if (window.Swal) Swal.fire('Guardado', 'Contrato agregado', 'success');else alert('Contrato agregado');
              bs.hide();
              setTimeout(function () {
                showDetails(p.idProfesor);
              }, 200);
            })["catch"](function (err) {
              console.error('Error agregando contrato:', err);
              if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
            })['finally'](function () {
              btnSave.disabled = false;
            });
          });
        })["catch"](function (err) {
          console.error('Error cargando tipos:', err);
          if (window.Swal) Swal.fire('Error', 'No se pudieron cargar tipos de contrato', 'error');else alert('No se pudieron cargar tipos de contrato');
        });
      });
      var hContactos = document.createElement('h6');
      hContactos.textContent = 'Contactos de emergencia';
      body.appendChild(hContactos); // Add button to add emergency contact

      var btnAddContacto = document.createElement('button');
      btnAddContacto.type = 'button';
      btnAddContacto.className = 'btn btn-sm btn-outline-success ms-2';
      btnAddContacto.textContent = '+ Agregar';
      hContactos.appendChild(btnAddContacto);

      if (!contactos || contactos.length === 0) {
        var _none3 = document.createElement('p');

        _none3.className = 'text-muted';
        _none3.textContent = '(ninguno)';
        body.appendChild(_none3);
      } else {
        var _ul2 = document.createElement('ul');

        contactos.forEach(function (c) {
          var li = document.createElement('li');
          var span = document.createElement('span');
          var raw = c.celular === null || c.celular === undefined ? '' : String(c.celular).trim();
          var fmt = raw; // format 10-digit celular as 2-4-4 (e.g., "12 3456 7890")

          if (/^\d{10}$/.test(raw)) fmt = raw.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');
          span.textContent = (c.nombre || '') + ' — ' + (c.parentesco || '') + ' — ' + (fmt || '');
          li.appendChild(span); // Edit button for each contact

          var btnEditarC = document.createElement('button');
          btnEditarC.type = 'button';
          btnEditarC.className = 'btn btn-sm btn-outline-primary me-2';
          btnEditarC.textContent = 'Editar';
          btnEditarC.title = 'Editar contacto de emergencia';
          btnEditarC.dataset.idProfesorEmergencia = c.idProfesorEmergencia || c.id || '';
          btnEditarC.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var existing = document.getElementById('modalEditarContacto');
            if (existing) existing.remove();
            var modal = document.createElement('div');
            modal.id = 'modalEditarContacto';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.setAttribute('role', 'dialog');
            var dialog = document.createElement('div');
            dialog.className = 'modal-dialog';
            var content = document.createElement('div');
            content.className = 'modal-content';
            var headerDiv = document.createElement('div');
            headerDiv.className = 'modal-header';
            var titleH5 = document.createElement('h5');
            titleH5.className = 'modal-title';
            titleH5.textContent = 'Editar contacto de emergencia';
            var btnClose = document.createElement('button');
            btnClose.type = 'button';
            btnClose.className = 'btn-close';
            btnClose.setAttribute('data-bs-dismiss', 'modal');
            btnClose.setAttribute('aria-label', 'Close');
            headerDiv.appendChild(titleH5);
            headerDiv.appendChild(btnClose);
            var bodyDiv = document.createElement('div');
            bodyDiv.className = 'modal-body';
            var form = document.createElement('form');
            form.id = 'formEditarContacto'; // Nombre

            var w1 = document.createElement('div');
            w1.className = 'mb-2';
            var l1 = document.createElement('label');
            l1.className = 'form-label';
            l1.textContent = 'Nombre del contacto';
            var i1 = document.createElement('input');
            i1.name = 'nombre';
            i1.className = 'form-control';
            i1.required = true;
            i1.value = c.nombre || '';
            w1.appendChild(l1);
            w1.appendChild(i1);
            form.appendChild(w1); // Parentesco select

            var w2 = document.createElement('div');
            w2.className = 'mb-2';
            var l2 = document.createElement('label');
            l2.className = 'form-label';
            l2.textContent = 'Parentesco';
            var sel = document.createElement('select');
            sel.name = 'parentesco';
            sel.className = 'form-select';
            sel.required = true;
            ['', 'hijos', 'nietos', 'conyugues', 'otros'].forEach(function (optText) {
              var o = document.createElement('option');
              o.value = optText;
              o.textContent = optText || '(Seleccione)';
              sel.appendChild(o);
            });
            if (['', 'hijos', 'nietos', 'conyugues', 'otros'].includes((c.parentesco || '').toString())) sel.value = c.parentesco || '';else sel.value = 'otros';
            w2.appendChild(l2);
            w2.appendChild(sel);
            form.appendChild(w2);
            var w2b = document.createElement('div');
            w2b.className = 'mb-2 d-none';
            w2b.id = 'cont_parentesco_otro_edit';
            var l2b = document.createElement('label');
            l2b.className = 'form-label';
            l2b.textContent = 'Especifique parentesco';
            var i2b = document.createElement('input');
            i2b.name = 'parentesco_otro';
            i2b.className = 'form-control';
            i2b.placeholder = 'Describa el parentesco';
            if (!['', 'hijos', 'nietos', 'conyugues', 'otros'].includes((c.parentesco || '').toString())) i2b.value = c.parentesco || '';
            w2b.appendChild(l2b);
            w2b.appendChild(i2b);
            form.appendChild(w2b); // Celular

            var w3 = document.createElement('div');
            w3.className = 'mb-2';
            var l3 = document.createElement('label');
            l3.className = 'form-label';
            l3.textContent = 'Celular (10 dígitos)';
            var i3 = document.createElement('input');
            i3.name = 'celular';
            i3.className = 'form-control';
            i3.required = true;
            i3.type = 'tel';
            i3.value = c.celular || '';
            w3.appendChild(l3);
            w3.appendChild(i3);
            form.appendChild(w3); // hidden fields

            var hiddenId = document.createElement('input');
            hiddenId.type = 'hidden';
            hiddenId.name = 'idProfesorEmergencia';
            hiddenId.value = btnEditarC.dataset.idProfesorEmergencia;
            var hiddenProfesor = document.createElement('input');
            hiddenProfesor.type = 'hidden';
            hiddenProfesor.name = 'idProfesor';
            hiddenProfesor.value = p.idProfesor;
            form.appendChild(hiddenId);
            form.appendChild(hiddenProfesor);
            bodyDiv.appendChild(form);
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
            btnSave.id = 'btnGuardarEditarContacto';
            btnSave.textContent = 'Guardar';
            footer.appendChild(btnCancel);
            footer.appendChild(btnSave);
            content.appendChild(headerDiv);
            content.appendChild(bodyDiv);
            content.appendChild(footer);
            dialog.appendChild(content);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            var bsModal = new bootstrap.Modal(modal);
            bsModal.show(); // show/hide custom parentesco

            sel.addEventListener('change', function () {
              if (sel.value === 'otros') {
                w2b.classList.remove('d-none');
                i2b.required = true;
              } else {
                w2b.classList.add('d-none');
                i2b.required = false;
              }
            });

            if (sel.value === 'otros') {
              w2b.classList.remove('d-none');
              i2b.required = true;
            } else {
              w2b.classList.add('d-none');
              i2b.required = false;
            }

            document.getElementById('btnGuardarEditarContacto').addEventListener('click', function () {
              var nombreVal = form.querySelector('input[name="nombre"]').value.trim();
              var parentVal = form.querySelector('select[name="parentesco"]').value;
              var parentOt = form.querySelector('input[name="parentesco_otro"]').value.trim();
              var celularVal = form.querySelector('input[name="celular"]').value.trim();

              if (!nombreVal) {
                if (window.swal) Swal.fire('Error', 'Nombre requerido', 'error');else alert('Nombre requerido');
                return;
              }

              if (!parentVal) {
                if (window.swal) Swal.fire('Error', 'Parentesco requerido', 'error');else alert('Parentesco requerido');
                return;
              }

              if (parentVal === 'otros') {
                if (!parentOt) {
                  if (window.swal) Swal.fire('Error', 'Especifique el parentesco', 'error');else alert('Especifique el parentesco');
                  return;
                }

                parentVal = parentOt;
              }

              if (!/^[0-9]{10}$/.test(celularVal)) {
                if (window.swal) Swal.fire('Error', 'Celular debe tener 10 dígitos', 'error');else alert('Celular debe tener 10 dígitos');
                return;
              }

              var fd = new FormData(form);
              btnSave.disabled = true;
              fetch('controlador/editarProfesorEmergencia.php', {
                method: 'POST',
                body: fd
              }).then(function (r) {
                if (!r.ok) return r.json();
                return r.json();
              }).then(function (res) {
                if (!res.ok) {
                  var msg = res.error || 'Error actualizando contacto';
                  if (window.Swal) Swal.fire('Error', msg, 'error');else alert(msg);
                  btnSave.disabled = false;
                  return;
                }

                bsModal.hide();
                setTimeout(function () {
                  return showDetails(p.idProfesor);
                }, 200);
              })["catch"](function (err) {
                console.error('Error actualizando contacto:', err);
                if (window.swal) Swal.fire('Error', 'No se pudo actualizar contacto', 'error');else alert('No se pudo actualizar contacto');
                btnSave.disabled = false;
              });
            });
          }); // Quitar button for each contact

          var btnQuitarC = document.createElement('button');
          btnQuitarC.type = 'button';
          btnQuitarC.className = 'btn btn-sm btn-outline-danger ms-2 float-end';
          btnQuitarC.textContent = 'Quitar';
          btnQuitarC.title = 'Quitar este contacto de emergencia';
          btnQuitarC.dataset.idProfesorEmergencia = c.idProfesorEmergencia || c.id || '';
          btnQuitarC.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var idCE = btnQuitarC.dataset.idProfesorEmergencia;

            if (!idCE) {
              alert('ID de contacto no disponible');
              return;
            }

            function doQuitarContact() {
              var params = new URLSearchParams();
              params.set('idProfesor', p.idProfesor);
              params.set('idProfesorEmergencia', idCE);
              btnQuitarC.disabled = true;
              fetch('controlador/quitarProfesorEmergencia.php', {
                method: 'POST',
                body: params
              }).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              }).then(function (res) {
                if (res.ok) {
                  if (window.Swal) Swal.fire('Quitado', 'Contacto eliminado', 'success');else alert('Contacto eliminado');
                  showDetails(p.idProfesor);
                } else throw new Error(res.error || 'Error');
              })["catch"](function (err) {
                console.error('Error quitando contacto:', err);
                if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
              })["finally"](function () {
                btnQuitarC.disabled = false;
              });
            }

            if (window.Swal) {
              Swal.fire({
                title: 'Confirmar',
                text: '¿Quitar este contacto de emergencia?',
                icon: 'warning',
                showCancelButton: true
              }).then(function (ans) {
                if (ans.isConfirmed) doQuitarContact();
              });
            } else if (confirm('¿Quitar este contacto de emergencia?')) doQuitarContact();
          }); // group Edit and Quitar into an action container so both appear at the extreme right

          var actionDivC = document.createElement('div');
          actionDivC.className = 'd-inline-flex align-items-center float-end';
          actionDivC.style.gap = '6px'; // normalize classes (spacing managed by container)

          btnEditarC.className = 'btn btn-sm btn-outline-primary';
          btnQuitarC.className = 'btn btn-sm btn-outline-danger';
          actionDivC.appendChild(btnEditarC);
          actionDivC.appendChild(btnQuitarC);
          li.appendChild(actionDivC);

          _ul2.appendChild(li);
        });
        body.appendChild(_ul2);
      } // Handler: open modal to add contacto de emergencia


      btnAddContacto.addEventListener('click', function () {
        // remove existing modal if any
        var existing = document.getElementById('modalAgregarContacto');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = 'modalAgregarContacto';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('role', 'dialog');
        var dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        var content = document.createElement('div');
        content.className = 'modal-content';
        var headerDiv = document.createElement('div');
        headerDiv.className = 'modal-header';
        var titleH5 = document.createElement('h5');
        titleH5.className = 'modal-title';
        titleH5.textContent = 'Agregar contacto de emergencia';
        var btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'btn-close';
        btnClose.setAttribute('data-bs-dismiss', 'modal');
        btnClose.setAttribute('aria-label', 'Close');
        headerDiv.appendChild(titleH5);
        headerDiv.appendChild(btnClose);
        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'modal-body';
        var form = document.createElement('form');
        form.id = 'formAgregarContacto'; // Nombre

        var w1 = document.createElement('div');
        w1.className = 'mb-2';
        var l1 = document.createElement('label');
        l1.className = 'form-label';
        l1.textContent = 'Nombre del contacto';
        var i1 = document.createElement('input');
        i1.name = 'nombre';
        i1.className = 'form-control';
        i1.required = true;
        w1.appendChild(l1);
        w1.appendChild(i1);
        form.appendChild(w1); // Parentesco select

        var w2 = document.createElement('div');
        w2.className = 'mb-2';
        var l2 = document.createElement('label');
        l2.className = 'form-label';
        l2.textContent = 'Parentesco';
        var sel = document.createElement('select');
        sel.name = 'parentesco';
        sel.className = 'form-select';
        sel.required = true;
        ['', 'hijos', 'nietos', 'conyugues', 'otros'].forEach(function (optText) {
          var o = document.createElement('option');
          o.value = optText;
          o.textContent = optText || '(Seleccione)';
          sel.appendChild(o);
        });
        w2.appendChild(l2);
        w2.appendChild(sel);
        form.appendChild(w2); // Custom parentesco when 'otros' selected

        var w2b = document.createElement('div');
        w2b.className = 'mb-2 d-none';
        w2b.id = 'cont_parentesco_otro';
        var l2b = document.createElement('label');
        l2b.className = 'form-label';
        l2b.textContent = 'Especifique parentesco';
        var i2b = document.createElement('input');
        i2b.name = 'parentesco_otro';
        i2b.className = 'form-control';
        i2b.placeholder = 'Describa el parentesco';
        w2b.appendChild(l2b);
        w2b.appendChild(i2b);
        form.appendChild(w2b); // Celular

        var w3 = document.createElement('div');
        w3.className = 'mb-2';
        var l3 = document.createElement('label');
        l3.className = 'form-label';
        l3.textContent = 'Celular (10 dígitos)';
        var i3 = document.createElement('input');
        i3.name = 'celular';
        i3.className = 'form-control';
        i3.required = true;
        i3.type = 'tel';
        w3.appendChild(l3);
        w3.appendChild(i3);
        form.appendChild(w3);
        bodyDiv.appendChild(form);
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
        btnSave.id = 'btnGuardarContacto';
        btnSave.textContent = 'Guardar';
        footer.appendChild(btnCancel);
        footer.appendChild(btnSave);
        content.appendChild(headerDiv);
        content.appendChild(bodyDiv);
        content.appendChild(footer);
        dialog.appendChild(content);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        var bsModal = new bootstrap.Modal(modal);
        bsModal.show(); // show/hide custom parentesco

        sel.addEventListener('change', function () {
          if (sel.value === 'otros') {
            w2b.classList.remove('d-none');
            i2b.required = true;
          } else {
            w2b.classList.add('d-none');
            i2b.required = false;
          }
        });
        document.getElementById('btnGuardarContacto').addEventListener('click', function () {
          var nombreVal = form.querySelector('input[name="nombre"]').value.trim();
          var parentVal = form.querySelector('select[name="parentesco"]').value;
          var parentOt = form.querySelector('input[name="parentesco_otro"]').value.trim();
          var celularVal = form.querySelector('input[name="celular"]').value.trim();

          if (!nombreVal) {
            if (window.Swal) Swal.fire('Error', 'Nombre requerido', 'error');else alert('Nombre requerido');
            return;
          }

          if (!parentVal) {
            if (window.Swal) Swal.fire('Error', 'Parentesco requerido', 'error');else alert('Parentesco requerido');
            return;
          }

          if (parentVal === 'otros') {
            if (!parentOt) {
              if (window.Swal) Swal.fire('Error', 'Especifique el parentesco', 'error');else alert('Especifique el parentesco');
              return;
            }

            parentVal = parentOt;
          }

          if (!/^[0-9]{10}$/.test(celularVal)) {
            if (window.Swal) Swal.fire('Error', 'Celular debe tener 10 dígitos', 'error');else alert('Celular debe tener 10 dígitos');
            return;
          } // submit


          var fd = new FormData();
          fd.append('idProfesor', p.idProfesor);
          fd.append('nombre', nombreVal);
          fd.append('parentesco', parentVal);
          fd.append('celular', celularVal);
          btnSave.disabled = true;
          fetch('controlador/agregarProfesorEmergencia.php', {
            method: 'POST',
            body: fd
          }).then(function (r) {
            if (!r.ok) return r.json();
            return r.json();
          }).then(function (res) {
            if (res.ok) {
              if (window.Swal) Swal.fire('Guardado', 'Contacto agregado', 'success');else alert('Contacto agregado');
              bsModal.hide();
              showDetails(p.idProfesor);
            } else {
              throw new Error(res.error || 'Error al guardar');
            }
          })["catch"](function (err) {
            console.error('Error guardando contacto:', err);
            if (window.Swal) Swal.fire('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
          })["finally"](function () {
            btnSave.disabled = false;
          });
        });
      });
      card.appendChild(body);
      panel.appendChild(card); // Delete logic: confirmation with SweetAlert (if available) and POST to controller using Promises

      btnDelete.addEventListener('click', function () {
        function doDelete() {
          btnDelete.disabled = true;
          var params = new URLSearchParams();
          params.set('idProfesor', p.idProfesor);
          fetch('controlador/eliminarProfesorCompleto.php', {
            method: 'POST',
            body: params
          }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          }).then(function (json) {
            if (json.ok) {
              if (window.swal) {
                swal('Eliminado', 'Profesor eliminado correctamente', 'success');
              } else {
                alert('Profesor eliminado correctamente');
              } // refresh the directory view


              crearMenuDirectorio();
            } else {
              throw new Error(json.error || 'Error al eliminar');
            }
          })["catch"](function (err) {
            console.error('Error eliminando profesor:', err);
            if (window.swal) swal('Error', err.message || 'Error', 'error');else alert('Error: ' + (err.message || err));
          })["finally"](function () {
            btnDelete.disabled = false;
          });
        } // Ask confirmation (SweetAlert if available)


        if (window.swal) {
          swal({
            title: 'Confirmar eliminación',
            text: 'Se eliminarán todas las referencias y el profesor. ¿Desea continuar?',
            icon: 'warning',
            buttons: true,
            dangerMode: true
          }).then(function (willDelete) {
            if (willDelete) doDelete();
          });
        } else {
          if (confirm('Se eliminarán todas las referencias y el profesor. ¿Desea continuar?')) doDelete();
        }
      }); // Editar: abrir modal prellenado con los campos solicitados

      btnEdit.addEventListener('click', function () {
        // Remove any existing edit modal
        var existing = document.getElementById('modalEditarProfesor');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = 'modalEditarProfesor';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.setAttribute('role', 'dialog');
        var dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        var content = document.createElement('div');
        content.className = 'modal-content'; // Header

        var headerDiv = document.createElement('div');
        headerDiv.className = 'modal-header';
        var titleH5 = document.createElement('h5');
        titleH5.className = 'modal-title';
        titleH5.textContent = 'Editar profesor';
        var btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'btn-close';
        btnClose.setAttribute('data-bs-dismiss', 'modal');
        btnClose.setAttribute('aria-label', 'Close');
        headerDiv.appendChild(titleH5);
        headerDiv.appendChild(btnClose); // Body / form

        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'modal-body';
        var formElem = document.createElement('form');
        formElem.id = 'formEditarProfesor';

        function createFieldEdit(labelText, name, required, value) {
          var wrapper = document.createElement('div');
          wrapper.className = 'mb-2';
          var label = document.createElement('label');
          label.className = 'form-label';
          label.textContent = labelText;
          var input = document.createElement('input');
          input.name = name;
          input.className = 'form-control';
          if (required) input.required = true;
          if (value !== undefined) input.value = value;
          wrapper.appendChild(label);
          wrapper.appendChild(input);
          return wrapper;
        } // numeroEconomico, nombre, correo_uam, correo_personal, celular, gradoEstudios selector


        formElem.appendChild(createFieldEdit('Número Económico', 'numeroEconomico', true, p.numeroEconomico || ''));
        formElem.appendChild(createFieldEdit('Nombre', 'nombre', true, p.nombre || ''));
        formElem.appendChild(createFieldEdit('Correo UAM', 'correo_uam', true, p.correo_uam || ''));
        formElem.appendChild(createFieldEdit('Correo personal', 'correo_personal', false, p.correo_personal || '')); // Tipo de profesor (select) - poblará opciones desde el servidor y preseleccionará el tipo actual si existe

        var wrapperTipo = document.createElement('div');
        wrapperTipo.className = 'mb-2';
        var lblTipo = document.createElement('label');
        lblTipo.className = 'form-label';
        lblTipo.textContent = 'Tipo de profesor';
        var selTipo = document.createElement('select');
        selTipo.name = 'idProfesorTipo';
        selTipo.className = 'form-select';
        var optTipo0 = document.createElement('option');
        optTipo0.value = '';
        optTipo0.textContent = '(sin seleccionar)';
        selTipo.appendChild(optTipo0);
        wrapperTipo.appendChild(lblTipo);
        wrapperTipo.appendChild(selTipo);
        formElem.appendChild(wrapperTipo); // Poblar opciones del select con los tipos disponibles

        (function populateTipoSelect() {
          fetch('controlador/recuperaFiltrosProfesores.php').then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          }).then(function (json) {
            if (!json || !json.ok) return;
            var tipos = Array.isArray(json.profesorTipos) ? json.profesorTipos : [];
            tipos.forEach(function (t) {
              var o = document.createElement('option');
              o.value = t.idProfesorTipo !== undefined ? t.idProfesorTipo : t.id || '';
              o.textContent = t.nombre || t.nombreTipo || '';
              selTipo.appendChild(o);
            }); // preselect if contrato info is present

            try {
              if (typeof contrato !== 'undefined' && contrato && contrato.idProfesorTipo) {
                selTipo.value = contrato.idProfesorTipo;
              }
            } catch (e) {
              /* ignore */
            }
          })["catch"](function (err) {
            console.warn('No se pudieron cargar tipos de profesor:', err);
          });
        })();

        formElem.appendChild(createFieldEdit('Celular (10 dígitos)', 'celular', false, p.celular || '')); // gradoEstudios select

        var wrapperGrado = document.createElement('div');
        wrapperGrado.className = 'mb-2';
        var labelGrado = document.createElement('label');
        labelGrado.className = 'form-label';
        labelGrado.textContent = 'Grado de estudios';
        var selGrado = document.createElement('select');
        selGrado.name = 'gradoEstudios';
        selGrado.className = 'form-select';
        ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(function (optText) {
          var o = document.createElement('option');
          o.value = optText;
          o.textContent = optText || '(ninguno)';
          if (p.gradoEstudios === optText) o.selected = true;
          selGrado.appendChild(o);
        });
        wrapperGrado.appendChild(labelGrado);
        wrapperGrado.appendChild(selGrado);
        formElem.appendChild(wrapperGrado); // hidden id

        var idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.name = 'idProfesor';
        idInput.value = p.idProfesor;
        formElem.appendChild(idInput);
        bodyDiv.appendChild(formElem); // Footer

        var footerDiv = document.createElement('div');
        footerDiv.className = 'modal-footer';
        var btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'btn btn-secondary';
        btnCancel.setAttribute('data-bs-dismiss', 'modal');
        btnCancel.textContent = 'Cancelar';
        var btnSave = document.createElement('button');
        btnSave.id = 'btnActualizarProfesor';
        btnSave.type = 'button';
        btnSave.className = 'btn btn-primary';
        btnSave.textContent = 'Guardar cambios';
        footerDiv.appendChild(btnCancel);
        footerDiv.appendChild(btnSave);
        content.appendChild(headerDiv);
        content.appendChild(bodyDiv);
        content.appendChild(footerDiv);
        dialog.appendChild(content);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        var bsModal = new bootstrap.Modal(modal);
        bsModal.show(); // Save handler

        function guardarCambios(fd) {
          return fetch('controlador/actualizarProfesor.php', {
            method: 'POST',
            body: fd
          }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          });
        }

        document.getElementById('btnActualizarProfesor').addEventListener('click', function () {
          var form = document.getElementById('formEditarProfesor'); // client-side validations: celular, correo UAM and correo personal

          var celVal = form.querySelector('input[name="celular"]').value.trim();
          var correoUAM = form.querySelector('input[name="correo_uam"]').value.trim().toLowerCase();
          var correoPersonal = form.querySelector('input[name="correo_personal"]').value.trim();

          if (celVal !== '' && !/^\d{10}$/.test(celVal)) {
            if (window.swal) swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error');else alert('Celular debe tener exactamente 10 dígitos');
            return;
          }

          if (!correoUAM.endsWith('@azc.uam.mx')) {
            if (window.swal) swal('Error', 'El correo UAM debe tener dominio @azc.uam.mx', 'error');else alert('El correo UAM debe tener dominio @azc.uam.mx');
            return;
          }

          if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) {
            if (window.swal) swal('Error', 'Correo personal inválido', 'error');else alert('Correo personal inválido');
            return;
          }

          var data = new FormData(form);
          guardarCambios(data).then(function (json) {
            if (!json.ok) {
              if (window.swal) swal('Error', json.error || 'Error', 'error');else alert('Error: ' + (json.error || ''));
              return;
            }

            bsModal.hide(); // refresh directory and reselect updated professor

            crearMenuDirectorio();
            setTimeout(function () {
              var rows = document.querySelectorAll('table.table tbody tr');
              rows.forEach(function (r) {
                if (r.dataset.id == json.profesor.idProfesor) {
                  r.click();
                }
              });
            }, 400);
          })["catch"](function (err) {
            console.error('Error actualizando profesor:', err);
            if (window.swal) swal('Error', err.message || 'Error', 'error');else alert('Error al actualizar el profesor');
          });
        });
      });
    })["catch"](function (err) {
      console.error('Error fetching profesor por id:', err);
      var panelErr = document.getElementById('dir-right-panel');

      while (panelErr.firstChild) {
        panelErr.removeChild(panelErr.firstChild);
      }

      var alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-danger';
      alertDiv.textContent = 'Error al cargar datos del profesor';
      panelErr.appendChild(alertDiv);
    });
  } // small helper to escape HTML


  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  } // Search handler with debounce


  var timer = null;
  input.addEventListener('input', function (e) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      return loadList(input.value.trim());
    }, 250);
  }); // Build navigator controls (sort buttons + filters)

  var controls = document.createElement('div');
  controls.className = 'mb-2 d-flex flex-wrap gap-2 align-items-center';
  controls.id = 'dir-controls'; // start hidden when entering the directorio

  controls.classList.add('d-none'); // Sort buttons

  var sortBtnName = document.createElement('button');
  sortBtnName.className = 'btn btn-outline-secondary btn-sm';
  sortBtnName.textContent = 'Ordenar por nombre ↑';
  sortBtnName.addEventListener('click', function () {
    if (state.sort === 'nombre') state.sortDir = state.sortDir === 'ASC' ? 'DESC' : 'ASC';else {
      state.sort = 'nombre';
      state.sortDir = 'ASC';
    }
    sortBtnName.textContent = 'Ordenar por nombre ' + (state.sort === 'nombre' ? state.sortDir === 'ASC' ? '↑' : '↓' : '');
    sortBtnNum.textContent = 'Ordenar por número económico';
    loadList();
  });
  controls.appendChild(sortBtnName);
  var sortBtnNum = document.createElement('button');
  sortBtnNum.className = 'btn btn-outline-secondary btn-sm';
  sortBtnNum.textContent = 'Ordenar por número económico';
  sortBtnNum.addEventListener('click', function () {
    if (state.sort === 'numeroEconomico') state.sortDir = state.sortDir === 'ASC' ? 'DESC' : 'ASC';else {
      state.sort = 'numeroEconomico';
      state.sortDir = 'ASC';
    }
    sortBtnNum.textContent = 'Ordenar por número económico ' + (state.sort === 'numeroEconomico' ? state.sortDir === 'ASC' ? '↑' : '↓' : '');
    sortBtnName.textContent = 'Ordenar por nombre';
    loadList();
  });
  controls.appendChild(sortBtnNum); // Filter selects

  function createSelect(placeholder) {
    var sel = document.createElement('select');
    sel.className = 'form-select form-select-sm';
    var opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder + ' (Todos)';
    sel.appendChild(opt);
    return sel;
  }

  var selAreaAcad = createSelect('Área académica');
  var selGrupo = createSelect('Grupo temático');
  var selArea = createSelect('Área');
  var selProfTipo = createSelect('Tipo de profesor');
  var selTrim = createSelect('Trimestre'); // apply filter change

  [selAreaAcad, selGrupo, selArea, selProfTipo, selTrim].forEach(function (s) {
    s.addEventListener('change', function () {
      state.areaAcademica = selAreaAcad.value;
      state.grupoTematico = selGrupo.value;
      state.area = selArea.value;
      state.profesorTipo = selProfTipo.value;
      state.trimestre = selTrim.value;
      loadList();
    });
  });
  controls.appendChild(selAreaAcad);
  controls.appendChild(selGrupo);
  controls.appendChild(selArea);
  controls.appendChild(selProfTipo);
  controls.appendChild(selTrim); // Insert controls above the table (append to nav so it's guaranteed to be a child)

  nav.appendChild(controls); // Populate filter options from server

  fetchFilters().then(function (json) {
    if (!json.ok) return; // areas academicas: deduplicate by nombre so each area appears once in the select

    var areaMap = new Map();
    json.areaAcademicas.forEach(function (a) {
      if (!areaMap.has(a.nombre)) areaMap.set(a.nombre, a);
    });
    areaMap.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.nombre; // use nombre as the value so selection groups jefe+miembros

      o.textContent = a.nombre;
      selAreaAcad.appendChild(o);
    }); // grupos tematicos: deduplicate by nombreGrupo

    var grupoMap = new Map();
    json.gruposTematicos.forEach(function (g) {
      if (!grupoMap.has(g.nombreGrupo)) grupoMap.set(g.nombreGrupo, g);
    });
    grupoMap.forEach(function (g) {
      var o = document.createElement('option');
      o.value = g.nombreGrupo;
      o.textContent = g.nombreGrupo;
      selGrupo.appendChild(o);
    });
    json.areas.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.idArea;
      o.textContent = a.nombre;
      selArea.appendChild(o);
    });
    json.profesorTipos.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.idProfesorTipo;
      o.textContent = t.nombre;
      selProfTipo.appendChild(o);
    });
    json.trimestres.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.idTrimestre;
      o.textContent = (t.año ? t.año : t.nombre) + (t.fechaLimite ? ' — ' + t.fechaLimite : '');
      selTrim.appendChild(o);
    });
  })["catch"](function (err) {
    console.warn('No se pudieron cargar filtros:', err);
  }); // initial

  loadList();
} // Modal for creating new profesor


function mostrarModalNuevoProfesor() {
  var existing = document.getElementById('modalNuevoProfesor');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'modalNuevoProfesor';
  modal.className = 'modal fade';
  modal.tabIndex = -1;
  modal.setAttribute('role', 'dialog');
  var dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  var content = document.createElement('div');
  content.className = 'modal-content'; // Header

  var headerDiv = document.createElement('div');
  headerDiv.className = 'modal-header';
  var titleH5 = document.createElement('h5');
  titleH5.className = 'modal-title';
  titleH5.textContent = 'Nuevo profesor';
  var btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'btn-close';
  btnClose.setAttribute('data-bs-dismiss', 'modal');
  btnClose.setAttribute('aria-label', 'Close');
  headerDiv.appendChild(titleH5);
  headerDiv.appendChild(btnClose); // Body / form

  var bodyDiv = document.createElement('div');
  bodyDiv.className = 'modal-body';
  var formElem = document.createElement('form');
  formElem.id = 'formNuevoProfesor';

  function createField(labelText, name, required) {
    var wrapper = document.createElement('div');
    wrapper.className = 'mb-2';
    var label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = labelText;
    var input = document.createElement('input');
    input.name = name;
    input.className = 'form-control';
    if (required) input.required = true;
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    return wrapper;
  }

  formElem.appendChild(createField('Número Económico', 'numeroEconomico', true));
  formElem.appendChild(createField('Nombre', 'nombre', true));
  formElem.appendChild(createField('Correo UAM', 'correo_uam', true));
  formElem.appendChild(createField('Correo personal', 'correo_personal', false)); // gradoEstudios select (same options used in editar modal)

  var wrapperGradoNew = document.createElement('div');
  wrapperGradoNew.className = 'mb-2';
  var labelGradoNew = document.createElement('label');
  labelGradoNew.className = 'form-label';
  labelGradoNew.textContent = 'Grado de estudios';
  var selGradoNew = document.createElement('select');
  selGradoNew.name = 'gradoEstudios';
  selGradoNew.className = 'form-select';
  ['', 'Ingeniería', 'Licenciatura', 'Maestría', 'Doctorado'].forEach(function (optText) {
    var o = document.createElement('option');
    o.value = optText;
    o.textContent = optText || '(ninguno)';
    selGradoNew.appendChild(o);
  });
  wrapperGradoNew.appendChild(labelGradoNew);
  wrapperGradoNew.appendChild(selGradoNew);
  formElem.appendChild(wrapperGradoNew);
  formElem.appendChild(createField('Celular', 'celular', false));
  bodyDiv.appendChild(formElem); // Footer

  var footerDiv = document.createElement('div');
  footerDiv.className = 'modal-footer';
  var btnCancel = document.createElement('button');
  btnCancel.type = 'button';
  btnCancel.className = 'btn btn-secondary';
  btnCancel.setAttribute('data-bs-dismiss', 'modal');
  btnCancel.textContent = 'Cancelar';
  var btnSave = document.createElement('button');
  btnSave.id = 'btnGuardarProfesor';
  btnSave.type = 'button';
  btnSave.className = 'btn btn-primary';
  btnSave.textContent = 'Guardar';
  footerDiv.appendChild(btnCancel);
  footerDiv.appendChild(btnSave);
  content.appendChild(headerDiv);
  content.appendChild(bodyDiv);
  content.appendChild(footerDiv);
  dialog.appendChild(content);
  modal.appendChild(dialog);
  document.body.appendChild(modal);
  var bsModal = new bootstrap.Modal(modal);
  bsModal.show(); // Helper to POST form data for crear profesor (returns a Promise)

  function guardarProfesor(formData) {
    return fetch('controlador/guardarProfesor.php', {
      method: 'POST',
      body: formData
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  document.getElementById('btnGuardarProfesor').addEventListener('click', function () {
    var form = document.getElementById('formNuevoProfesor'); // Client-side validations

    var correoUAM = form.querySelector('input[name="correo_uam"]').value.trim().toLowerCase();
    var correoPersonal = form.querySelector('input[name="correo_personal"]').value.trim();
    var numeroEco = form.querySelector('input[name="numeroEconomico"]').value.trim();
    var celularVal = form.querySelector('input[name="celular"]').value.trim();

    if (!correoUAM.endsWith('@azc.uam.mx')) {
      if (window.swal) swal('Error', 'El correo UAM debe tener dominio @azc.uam.mx', 'error');else alert('El correo UAM debe tener dominio @azc.uam.mx');
      return;
    }

    if (correoPersonal !== '' && !/@[^@]+\.[^@]+/.test(correoPersonal)) {
      if (window.swal) swal('Error', 'Correo personal inválido', 'error');else alert('Correo personal inválido');
      return;
    }

    if (!/^\d+$/.test(numeroEco)) {
      if (window.swal) swal('Error', 'Número económico debe ser numérico', 'error');else alert('Número económico debe ser numérico');
      return;
    }

    if (celularVal !== '' && !/^\d{10}$/.test(celularVal)) {
      if (window.swal) swal('Error', 'Celular debe tener exactamente 10 dígitos', 'error');else alert('Celular debe tener exactamente 10 dígitos');
      return;
    } // Before submitting, check duplicates server-side via checkProfesorExiste.php for better UX


    var checkPayload = new FormData();
    checkPayload.append('numeroEconomico', numeroEco);
    checkPayload.append('nombre', form.querySelector('input[name="nombre"]').value.trim());
    checkPayload.append('correo_uam', form.querySelector('input[name="correo_uam"]').value.trim().toLowerCase());
    fetch('controlador/ValidaProfesorExiste.php', {
      method: 'POST',
      body: checkPayload
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (check) {
      if (!check.ok) {
        throw new Error(check.error || 'Error verificando duplicados');
      }

      if (check.existsNumero) {
        var msg = 'Ya existe un profesor con ese número económico' + (check.existingNumero && check.existingNumero.nombre ? ': ' + check.existingNumero.nombre : '');
        if (window.swal) swal('Error', msg, 'error');else alert(msg);
        return;
      }

      if (check.existsNombre) {
        var _msg = 'Ya existe un profesor con ese nombre' + (check.existingNombre && check.existingNombre.numeroEconomico ? ': ' + check.existingNombre.numeroEconomico : '');

        if (window.swal) swal('Error', _msg, 'error');else alert(_msg);
        return;
      }

      if (check.existsCorreo) {
        var _msg2 = 'Ya existe un profesor con ese correo UAM' + (check.existingCorreo && check.existingCorreo.nombre ? ': ' + check.existingCorreo.nombre : '');

        if (window.swal) swal('Error', _msg2, 'error');else alert(_msg2);
        return;
      } // not duplicated — proceed to create


      var data = new FormData(form);
      return guardarProfesor(data).then(function (json) {
        if (!json.ok) {
          alert('Error: ' + (json.error || ''));
          return;
        }

        bsModal.hide();
        setTimeout(function () {
          crearMenuDirectorio();
          setTimeout(function () {
            var rows = document.querySelectorAll('table.table tbody tr');
            rows.forEach(function (r) {
              if (r.dataset.id == json.profesor.idProfesor) {
                r.click();
              }
            });
          }, 400);
        }, 200);
      })["catch"](function (err) {
        console.error('Error guardando profesor:', err);
        alert('Error al guardar el profesor');
      });
    })["catch"](function (err) {
      console.error('Error verificando duplicados:', err);
      if (window.swal) swal('Error', 'No se pudo verificar duplicados. Intente de nuevo.', 'error');else alert('No se pudo verificar duplicados. Intente de nuevo.');
    });
  });
}

window.crearMenuDirectorio = crearMenuDirectorio;