/**
 * Main Menu module for Trimestres.
 * Replaces the monolithic logic of creating the menu, table, and routing actions.
 */

import * as API from './api.js';
import * as UI from './ui.js';
import { mostrarProfesoresTrimestre } from './profesores.js';
import { mostrarEditorGrupos } from './grupos.js';

// Internal state
let currentRows = [];
let sortState = { col: null, asc: true };

/**
 * Main function to build the menu.
 * @param {HTMLElement} adminMenu 
 */
export function crearMenuTrimestres(adminMenu) {
    if (!adminMenu) adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) return;

    adminMenu.innerHTML = '';

    // --- Header ---
    const headerBar = document.createElement('div');
    headerBar.className = 'd-flex align-items-center mb-3';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-sm btn-back';
    backBtn.innerHTML = '&#8592; Volver';
    backBtn.onclick = () => {
        if (typeof window.crearMenuAdministrador === 'function') {
            window.crearMenuAdministrador();
        } else {
            window.location.reload();
        }
    };

    const title = document.createElement('h5');
    title.className = 'm-0 ms-2';
    title.textContent = 'Trimestres';

    headerBar.appendChild(backBtn);
    headerBar.appendChild(title);
    adminMenu.appendChild(headerBar);

    // --- Actions ---
    const menuBar = document.createElement('div');
    menuBar.className = 'd-flex align-items-center justify-content-between mb-3';
    const actionsLeft = document.createElement('div');
    actionsLeft.className = 'd-flex flex-wrap';

    // Define actions (simplified for this refactor, most handlers are global or unimplemented in this scope, 
    // but we will prioritize 'nuevo-trimestre' and 'menu-trimestres' which we control)
    const actions = [
        { id: 'nuevo-trimestre', label: 'Nuevo trimestre', handler: () => import('./actions.js').then(m => m.nuevoTrimestre()) }, // Dynamic import for modal logic
        { id: 'menu-trimestres', label: 'Refrescar', handler: () => cargarTrimestresParaAnio(getSelectedYear()) }
    ];
    // Add others as stub or link to globals if they exist
    // 'importar-uea', 'cargar-planeacion', 'hist-programacion' are complex legacy globals. 
    // We can proxy them if they exist on window.
    ['importar-uea', 'cargar-planeacion', 'hist-programacion', 'hist-preferencias'].forEach(id => {
        const handlerName = {
            'importar-uea': 'navImportarUEA',
            'cargar-planeacion': 'cargarPlaneacionGrupos', // This was in original file... we need to port it or assume global
            'hist-programacion': 'historialProgramacion',
            'hist-preferencias': 'historialPreferencias'
        }[id];
        actions.push({
            id, label: id, handler: () => {
                if (typeof window[handlerName] === 'function') window[handlerName]();
                else UI.alertOpt('Info', 'Funcionalidad en migración: ' + id, 'info');
            }
        });
    });

    actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm me-2 mb-2';
        btn.textContent = a.label;
        btn.onclick = a.handler;
        actionsLeft.appendChild(btn);
    });
    menuBar.appendChild(actionsLeft);

    // --- Year Filter ---
    const rightTools = document.createElement('div');
    rightTools.className = 'd-flex align-items-center text-black-50 bg-light p-2 rounded';
    const anioLabel = document.createElement('label');
    anioLabel.className = 'me-2 mb-0';
    anioLabel.textContent = 'Año:';
    const selectAnio = document.createElement('div');
    selectAnio.className = 'd-flex gap-3 align-items-center';
    selectAnio.id = 'anio-selector-container';

    // Populate years
    const createRadio = (val, label, checked = false) => {
        const div = document.createElement('div'); div.className = 'form-check form-check-inline m-0';
        const inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'anio_filter_radio'; inp.className = 'form-check-input m-1'; inp.value = val;
        if (checked) inp.checked = true;
        inp.onchange = () => cargarTrimestresParaAnio(val);
        const lbl = document.createElement('label'); lbl.className = 'form-check-label'; lbl.textContent = label;
        lbl.style.cursor = 'pointer';
        inp.style.cursor = 'pointer';
        div.style.backgroundColor = '#f8f9fa';
        div.style.border = '1px solid #dee2e6';
        div.style.borderRadius = '5px';
        div.style.padding = '5px 10px';
        div.style.cursor = 'pointer';
        div.appendChild(inp); div.appendChild(lbl);
        div.onclick = (e) => {
            if (e.target !== inp) {
                inp.checked = true;
                cargarTrimestresParaAnio(val);
            }
        };
        selectAnio.appendChild(div);
    };
    createRadio('todos', 'Todos', true);
    const cy = new Date().getFullYear();
    for (let y = cy - 2; y <= cy + 2; y++) createRadio(String(y), String(y));

    rightTools.appendChild(anioLabel);
    rightTools.appendChild(selectAnio);
    menuBar.appendChild(rightTools);
    adminMenu.appendChild(menuBar);

    // --- Table Container ---
    const tableCard = document.createElement('div'); tableCard.className = 'card';
    const tableBody = document.createElement('div'); tableBody.className = 'card-body';
    const statusContainer = document.createElement('div'); statusContainer.id = 'trimestres-status-container'; statusContainer.className = 'text-muted small my-2';
    const tableContainer = document.createElement('div'); tableContainer.id = 'trimestres-table-container';

    tableBody.appendChild(statusContainer);
    tableBody.appendChild(tableContainer);
    tableCard.appendChild(tableBody);
    adminMenu.appendChild(tableCard);

    // Initial load
    cargarTrimestresParaAnio('todos');
}

function getSelectedYear() {
    const el = document.querySelector('input[name="anio_filter_radio"]:checked');
    return el ? el.value : 'todos';
}

function cargarTrimestresParaAnio(anio) {

    API.fetchTrimestres(anio)
        .then(json => {
            UI.setStatus('');
            if (!json || !json.ok) {
                UI.alertOpt('Info', 'No se encontraron trimestres o hubo un error.', 'info');
                currentRows = [];
            } else {
                currentRows = Array.isArray(json.trimestres) ? json.trimestres : [];
            }
            renderTable(currentRows);
        })
        .catch(err => {
            console.error(err);
            UI.setStatus('Error al cargar.');
            UI.alertOpt('Error', 'Error de red al cargar trimestres.', 'error');
        });
}

function renderTable(rows) {
    const container = document.getElementById('trimestres-table-container');
    if (!container) return;
    container.innerHTML = '';

    if (!rows.length) {
        container.innerHTML = '<div class="alert alert-light">No hay trimestres para mostrar.</div>';
        return;
    }

    // Sort
    if (sortState.col) {
        rows.sort((a, b) => {
            let va = a[sortState.col], vb = b[sortState.col];
            if (sortState.col === 'fechaLimite') { va = new Date(va); vb = new Date(vb); }
            else if (typeof va !== 'number' && typeof vb !== 'number') { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }

            if (va < vb) return sortState.asc ? -1 : 1;
            if (va > vb) return sortState.asc ? 1 : -1;
            return 0;
        });
    }

    const tbl = document.createElement('table'); tbl.className = 'table table-striped table-sm';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');

    // Headers
    const cols = [
        { key: 'periodoNombre', label: 'Periodo' },
        { key: 'año', label: 'Año' },
        { key: 'fechaLimite', label: 'Fecha límite' },
        { key: 'estado', label: 'Estado' } // Simplified key, assumed backend normalizes it or we handle it
    ];

    cols.forEach(c => {
        const th = document.createElement('th');
        const b = document.createElement('button');
        b.className = 'btn btn-link p-0 text-decoration-none text-dark fw-bold';
        b.textContent = c.label;
        b.onclick = () => {
            if (sortState.col === c.key) sortState.asc = !sortState.asc;
            else { sortState.col = c.key; sortState.asc = true; }
            renderTable(rows); // re-render sorted
        };
        th.appendChild(b);
        trh.appendChild(th);
    });
    trh.innerHTML += '<th>Acciones</th>';
    thead.appendChild(trh);
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(r => {
        const tr = document.createElement('tr');

        tr.innerHTML = `<td>${r.periodoNombre || r.sigla || ''}</td>
                        <td>${r.año || r.anio || ''}</td>
                        <td>${r.fechaLimite || '-'}</td>
                        <td><span class="badge bg-secondary">${r.estado || r.trimestreEstado || ''}</span></td>`;

        const tdAcc = document.createElement('td');

        // Buttons
        const btnElim = UI.crearBtn('Eliminar', 'btn-danger');
        btnElim.onclick = () => eliminarTrimestre(r);
        tdAcc.appendChild(btnElim);

        const btnProfes = UI.crearBtn('Profesores', 'btn-info');
        btnProfes.onclick = () => mostrarProfesoresTrimestre(r.idTrimestre, r);
        tdAcc.appendChild(btnProfes);

        const btnGrupos = UI.crearBtn('Grupos', 'btn-warning');
        btnGrupos.onclick = () => mostrarEditorGrupos(r.idTrimestre, r);
        tdAcc.appendChild(btnGrupos);

        tr.appendChild(tdAcc);
        tbody.appendChild(tr);
    }); // end forEach

    tbl.appendChild(tbody);
    container.appendChild(tbl);
}

function eliminarTrimestre(row) {
    UI.confirmOpt('Eliminar', '¿Eliminar el trimestre ' + (row.periodoNombre || row.idTrimestre) + '?', (yes) => {
        if (!yes) return;
        API.deleteTrimestre(row.idTrimestre).then(res => {
            if (res && res.ok) {
                UI.alertOpt('Exito', 'Eliminado correctamente', 'success');
                cargarTrimestresParaAnio(getSelectedYear());
            } else {
                UI.alertOpt('Error', res.error || 'No se pudo eliminar', 'error');
            }
        });
    });
}
