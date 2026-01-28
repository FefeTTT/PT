/**
 * Editor de Grupos module.
 */

import * as API from './api.js';
import { crearBtn, normalizeState } from './ui.js'; // Removed alerts

/**
 * Show Editor de Grupos.
 * @param {number|string} idTrimestre
 * @param {Object} trimestreRow
 */
export function mostrarEditorGrupos(idTrimestre, trimestreRow) {
    const container = document.getElementById('trimestres-table-container');
    if (!container) return;

    // Loader
    const spinner = document.createElement('div');
    spinner.className = 'grupos-loader-overlay';
    spinner.innerHTML = '<div class="grupos-loader-text">Cargando...</div>';
    document.body.appendChild(spinner);

    API.fetchGruposHorarios(idTrimestre)
        .then(json => {
            if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            if (!json || !json.ok) {
                swalAlertOpt('Error', 'No se pudieron recuperar grupos', 'error');
                return;
            }

            const grupos = Array.isArray(json.grupos) ? json.grupos : [];
            const horariosAll = Array.isArray(json.horarios) ? json.horarios : [];

            renderEditor(container, grupos, horariosAll, idTrimestre, trimestreRow);
        })
        .catch(err => {
            if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            console.error('Error recupera_grupos_horarios:', err);
            swalAlertOpt('Error', 'No se pudieron recuperar grupos y horarios', 'error');
        });
}

function renderEditor(container, grupos, horariosAll, idTrimestre, trimestreRow) {
    container.innerHTML = '';

    // Header with simple "Back" navigation
    // (We need a way to go back to the list. We can assume a global refresh or custom callback)
    const headerCard = document.createElement('div');
    headerCard.className = 'd-flex align-items-center mb-2';
    const backBtn = crearBtn('← Volver a trimestres', 'btn-secondary me-2');
    backBtn.onclick = () => {
        if (typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
        else window.location.reload();
    };
    headerCard.appendChild(backBtn);

    const title = document.createElement('h5');
    title.className = 'm-0';
    let tName = 'Trimestre ' + idTrimestre;
    if (trimestreRow) {
        tName = (trimestreRow.periodoNombre || trimestreRow.sigla || '') + ' ' + (trimestreRow.año || trimestreRow.anio || '');
    }
    title.textContent = 'Editar grupos - ' + tName;
    headerCard.appendChild(title);
    container.appendChild(headerCard);

    // Filters Sticky
    const filtersRow = document.createElement('div');
    filtersRow.className = 'sticky-top bg-white py-2 mb-2 border-bottom';
    filtersRow.style.zIndex = '100';

    const searchRow = document.createElement('div');
    searchRow.className = 'd-flex align-items-center';
    const searchLabel = document.createElement('label');
    searchLabel.className = 'me-2 mb-0';
    searchLabel.textContent = 'Buscar UEA:';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'form-control form-control-sm';
    searchInput.style.maxWidth = '320px';
    searchInput.placeholder = 'Clave o nombre de la UEA';
    searchRow.appendChild(searchLabel);
    searchRow.appendChild(searchInput);
    filtersRow.appendChild(searchRow);
    container.appendChild(filtersRow);

    // Scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.style.maxHeight = '65vh';
    scrollContainer.style.overflowY = 'auto';
    scrollContainer.style.border = '1px solid #dee2e6';

    const tbl = document.createElement('table');
    tbl.className = 'table table-hover table-sm mb-0';
    const thead = document.createElement('thead');
    thead.className = 'table-light';
    thead.innerHTML = '<tr><th>Clave UEA</th><th>Nombre UEA</th></tr>';
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Grouping
    const ueaMap = {};
    grupos.forEach(g => {
        const ueaName = (g.uea && g.uea.nombreUEA) ? String(g.uea.nombreUEA) : 'Desconocida';
        const ueaClave = (g.uea && g.uea.claveUEA) ? String(g.uea.claveUEA) : '---';
        const key = ueaClave + '_' + ueaName;
        if (!ueaMap[key]) {
            ueaMap[key] = {
                clave: ueaClave,
                nombre: ueaName,
                grupos: [],
                searchStr: (ueaClave + ' ' + ueaName).toLowerCase()
            };
        }
        ueaMap[key].grupos.push(g);
    });

    // Render Rows
    const keys = Object.keys(ueaMap).sort();
    keys.forEach(k => {
        const data = ueaMap[k];
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.dataset.search = data.searchStr;

        const tdC = document.createElement('td'); tdC.textContent = data.clave;
        const tdN = document.createElement('td'); tdN.innerHTML = '<strong>' + data.nombre + '</strong>';
        tr.appendChild(tdC); tr.appendChild(tdN);

        tr.onclick = () => toggleDetails(tr, data.grupos, horariosAll);
        tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    scrollContainer.appendChild(tbl);
    container.appendChild(scrollContainer);

    // Filter Logic
    let timer;
    searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = (searchInput.value || '').trim().toLowerCase();
            const rows = tbody.querySelectorAll('tr:not(.uea-details-row)');
            rows.forEach(r => {
                // Ensure details are hidden when filtering
                const next = r.nextElementSibling;
                if (next && next.classList.contains('uea-details-row')) next.style.display = 'none';

                if (r.dataset.search.includes(q)) r.style.display = '';
                else r.style.display = 'none';
            });
        }, 100);
    });
}

function toggleDetails(tr, grupos, horariosAll) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('uea-details-row')) {
        next.style.display = (next.style.display === 'none') ? 'table-row' : 'none';
        return;
    }

    const trD = document.createElement('tr');
    trD.className = 'uea-details-row table-light';
    const tdD = document.createElement('td');
    tdD.colSpan = 2;
    tdD.style.padding = '0';

    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.borderLeft = '4px solid #0d6efd';

    const subTable = document.createElement('table');
    subTable.className = 'table table-bordered table-sm mb-0 bg-white';
    subTable.innerHTML = '<thead><tr><th>Grupo</th><th>Cupo</th><th>Salón</th><th>Horario</th></tr></thead>';
    const subBody = document.createElement('tbody');

    grupos.forEach(g => {
        const r = document.createElement('tr');
        r.innerHTML = `<td>${g.claveGrupo || '-'}</td><td>${g.cupo || ''}</td><td>${g.salon || ''}</td>`;

        let hStr = '';
        if (Array.isArray(g.horarios)) {
            hStr = g.horarios.map(h => {
                const hf = horariosAll.find(x => x.idHorario == h.idHorario); // loose equality for string/num
                if (hf) return (h.dia ? h.dia.substr(0, 2) : '') + ' ' + hf.horaInicio + '-' + hf.horaFin;
                return '';
            }).join(', ');
        }
        const tdH = document.createElement('td');
        tdH.textContent = hStr;
        r.appendChild(tdH);
        subBody.appendChild(r);
    });

    subTable.appendChild(subBody);
    div.appendChild(subTable);
    tdD.appendChild(div);
    trD.appendChild(tdD);

    tr.parentNode.insertBefore(trD, tr.nextSibling);
}
