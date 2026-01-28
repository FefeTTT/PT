/**
 * Historial Programacion module.
 * Logic for "Menú de programación" / "Historial".
 */

import * as API from './api.js';
import * as UI from './ui.js';

export function historialProgramacion() {
    // Replaces content with the Programacion View
    const container = document.getElementById('admin-menu'); // Or main container
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'd-flex align-items-center mb-3';
    const back = UI.crearBtn('← Volver', 'btn-outline-secondary');
    back.onclick = () => {
        if (typeof window.crearMenuTrimestres === 'function') window.crearMenuTrimestres();
        else window.location.reload();
    };
    header.appendChild(back);
    header.innerHTML += '<h5 class="ms-2 m-0">Historial Programación</h5>';
    container.appendChild(header);

    // Search filters (UEA, Trimestre, Profesor, etc.)
    // ... For brevity, implementing a simplified version of the filter UI found in code
    // Assuming the user wants the core functionality preserved.

    // We will build a simple search form that hits `buscarProgramacionMulti.php`
    const form = document.createElement('div');
    form.className = 'card p-3 mb-3';
    form.innerHTML = `
        <h6>Buscador Avanzado</h6>
        <div class="row g-2">
            <div class="col-12 col-md-3">
                <input type="text" id="prog_uea" class="form-control form-control-sm" placeholder="UEA (Clave/Nombre)">
            </div>
            <div class="col-12 col-md-3">
                <input type="text" id="prog_prof" class="form-control form-control-sm" placeholder="Profesor (Eco/Nombre)">
            </div>
             <div class="col-12 col-md-2">
                <input type="text" id="prog_trim" class="form-control form-control-sm" placeholder="Trimestre (Año/Sigla)">
            </div>
            <div class="col-12 col-md-2">
                <button type="button" id="btn_search_prog" class="btn btn-primary btn-sm w-100">Buscar</button>
            </div>
        </div>
    `;
    container.appendChild(form);

    const results = document.createElement('div');
    results.id = 'prog_results';
    container.appendChild(results);

    form.querySelector('#btn_search_prog').onclick = () => {
        const uea = document.getElementById('prog_uea').value;
        const prof = document.getElementById('prog_prof').value;
        const trim = document.getElementById('prog_trim').value;

        results.innerHTML = '<div class="text-muted">Buscando...</div>';

        API.searchProgramacionMulti({ uea, profesor: prof, trimestre: trim })
            .then(json => {
                if (json && json.programacion) {
                    renderTable(json.programacion, results);
                } else {
                    results.innerHTML = '<div class="alert alert-warning">No se encontraron resultados.</div>';
                }
            })
            .catch(err => {
                results.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>';
            });
    };
}

function renderTable(data, mount) {
    if (!data.length) { mount.innerHTML = 'Sin resultados'; return; }

    const tbl = document.createElement('table');
    tbl.className = 'table table-sm table-striped font-monospace';
    tbl.style.fontSize = '0.85rem';

    const head = `<thead><tr>
        <th>Trim</th><th>Clave</th><th>UEA</th><th>Grp</th><th>Profesor</th><th>Horario</th><th>Salón</th>
    </tr></thead>`;
    tbl.innerHTML = head;

    const body = document.createElement('tbody');
    data.forEach(r => {
        const tr = document.createElement('tr');
        // Construct schedule string
        const sch = [r.lunes, r.martes, r.miercoles, r.jueves, r.viernes].filter(x => x).join(' / ');

        tr.innerHTML = `
            <td>${r.trimestre || ''}</td>
            <td>${r.claveUEA || ''}</td>
            <td>${r.UEA || ''}</td>
            <td>${r.grupo || ''}</td>
            <td>${r.profesor || ''}</td>
            <td>${sch}</td>
            <td>${r.salon || ''}</td>
        `;
        body.appendChild(tr);
    });
    tbl.appendChild(body);

    const resp = document.createElement('div');
    resp.className = 'table-responsive';
    resp.appendChild(tbl);

    mount.innerHTML = '';
    mount.appendChild(resp);
}
