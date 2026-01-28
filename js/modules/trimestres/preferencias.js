/**
 * Historial Preferencias module.
 */

import * as API from './api.js';
import * as UI from './ui.js';

export function historialPreferencias() {
    const container = document.getElementById('admin-menu');
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
    header.innerHTML += '<h5 class="ms-2 m-0">Historial Preferencias</h5>';
    container.appendChild(header);

    const form = document.createElement('div');
    form.className = 'card p-3 mb-3';
    form.innerHTML = `
        <h6>Buscador Preferencias</h6>
        <div class="row g-2">
            <div class="col-12 col-md-4">
                <input type="text" id="pref_prof" class="form-control form-control-sm" placeholder="Profesor">
            </div>
            <div class="col-12 col-md-3">
                <input type="text" id="pref_trim" class="form-control form-control-sm" placeholder="Trimestre">
            </div>
            <div class="col-12 col-md-2">
                <button type="button" id="btn_search_pref" class="btn btn-primary btn-sm w-100">Buscar</button>
            </div>
        </div>
    `;
    container.appendChild(form);

    const results = document.createElement('div');
    results.id = 'pref_results';
    container.appendChild(results);

    form.querySelector('#btn_search_pref').onclick = () => {
        const prof = document.getElementById('pref_prof').value;
        const trim = document.getElementById('pref_trim').value;

        results.innerHTML = '<div class="text-muted">Buscando...</div>';

        API.searchPreferenciasMulti({ profesor: prof, trimestre: trim })
            .then(json => {
                if (json && json.preferencias) {
                    renderTable(json.preferencias, results);
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

    // Adapted columns
    tbl.innerHTML = `<thead><tr>
        <th>Trimestre</th><th>Profesor</th><th>Comentarios</th><th>Fecha</th>
    </tr></thead>`;

    const body = document.createElement('tbody');
    data.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.trimestre || ''}</td>
            <td>${r.profesor || ''}</td>
            <td>${r.comentarios || ''}</td>
            <td>${r.fecha || ''}</td>
        `;
        body.appendChild(tr);
    });
    tbl.appendChild(body);
    mount.innerHTML = '';
    mount.appendChild(tbl);
}
