/**
 * Actions module.
 * Contains logic for creating new trimestres, importing, etc.
 */

import * as API from './api.js';

export function nuevoTrimestre() {
    // Remove existing modal if any
    const existing = document.getElementById('modalNuevoTrimestre');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modalNuevoTrimestre';
    modal.className = 'modal fade';
    modal.innerHTML = `
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Crear nuevo trimestre</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="formNuevoTrimestre">
                    <div class="mb-3">
                        <label class="form-label">Año</label>
                        <select class="form-select" id="nuevo_trimestre_anio"></select>
                        <input type="number" id="nuevo_trimestre_anio_custom" class="form-control mt-2" placeholder="Introduce año (>= 2000)" min="2000" style="display:none">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Periodo (trimestre)</label>
                        <select class="form-select" id="nuevo_trimestre_periodo" disabled><option>Cargando...</option></select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Estado</label>
                        <select class="form-select" id="nuevo_trimestre_estado">
                            <option value="1">Activo</option>
                            <option value="2">Inactivo</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Fecha límite</label>
                        <input type="date" class="form-control" id="nuevo_trimestre_fecha">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" id="guardarNuevoTrimestre">Crear</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    const selectAnio = modal.querySelector('#nuevo_trimestre_anio');
    const inputCustom = modal.querySelector('#nuevo_trimestre_anio_custom');
    const selectPeriodo = modal.querySelector('#nuevo_trimestre_periodo');
    const selectEstado = modal.querySelector('#nuevo_trimestre_estado');
    const inputFecha = modal.querySelector('#nuevo_trimestre_fecha');
    const btnSave = modal.querySelector('#guardarNuevoTrimestre');

    // Populate years
    const cy = new Date().getFullYear();
    for (let y = cy - 2; y <= cy + 2; y++) {
        const o = document.createElement('option');
        o.value = String(y); o.textContent = String(y);
        if (y === cy) o.selected = true;
        selectAnio.appendChild(o);
    }
    const oIns = document.createElement('option'); oIns.value = 'insertar'; oIns.textContent = 'Insertar año...';
    selectAnio.appendChild(oIns);

    // Initial load
    cargarPeriodos(selectAnio.value, selectPeriodo);

    // Set min date
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    inputFecha.min = tom.toISOString().split('T')[0];

    // Events
    selectAnio.addEventListener('change', () => {
        if (selectAnio.value === 'insertar') {
            inputCustom.style.display = ''; inputCustom.focus();
            selectPeriodo.disabled = true;
        } else {
            inputCustom.style.display = 'none';
            cargarPeriodos(selectAnio.value, selectPeriodo);
        }
    });

    inputCustom.addEventListener('change', () => {
        const v = parseInt(inputCustom.value, 10);
        if (!isNaN(v) && v >= 2000) {
            cargarPeriodos(String(v), selectPeriodo);
        }
    });

    btnSave.addEventListener('click', () => {
        const anio = (selectAnio.value === 'insertar') ? inputCustom.value : selectAnio.value;
        const idPeriodo = selectPeriodo.value;
        const idEstado = selectEstado.value;
        const fecha = inputFecha.value;

        if (!anio || !idPeriodo) { swalAlertOpt('Error', 'Completa los campos', 'error'); return; }

        btnSave.disabled = true;
        API.createTrimestre({ anio, idPeriodo, fechaLimite: fecha, estadoId: idEstado })
            .then(res => {
                if (res && res.ok) {
                    swalAlertOpt('Creado', 'Trimestre creado', 'success');
                    try { const bs = bootstrap.Modal.getInstance(modal); if (bs) bs.hide(); else modal.remove(); } catch (e) { modal.remove(); }
                    if (typeof window.refrescarTrimestres === 'function') window.refrescarTrimestres();
                } else {
                    swalAlertOpt('Error', res.error || 'Error al crear', 'error');
                    btnSave.disabled = false;
                }
            })
            .catch(err => {
                console.error(err);
                swalAlertOpt('Error', 'Error de red', 'error');
                btnSave.disabled = false;
            });
    });

    // Load states
    API.fetchTrimestreEstados().then(json => {
        if (json && json.estados) {
            selectEstado.innerHTML = '';
            json.estados.forEach(e => {
                const o = document.createElement('option');
                o.value = e.id || e.idTrimestreEstado;
                o.textContent = e.nombre || e.estado;
                // auto select "Recepción de preferencias" if matches logic
                if (normalize(o.textContent) === 'recepcion de preferencias') o.selected = true;
                selectEstado.appendChild(o);
            });
        }
    });

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function cargarPeriodos(anio, select) {
    select.innerHTML = '<option>Cargando...</option>';
    select.disabled = true;
    API.post('controlador/recuperaPeriodosTrimestre.php', { anio })
        .then(json => {
            select.innerHTML = '';
            if (!json || !json.ok || !json.periodos) {
                select.innerHTML = '<option value="">Sin periodos disponibles</option>';
                return;
            }
            const used = (json.used || []).map(Number);
            const avail = json.periodos.filter(p => !used.includes(Number(p.idPeriodo || p.id)));
            if (!avail.length) {
                select.innerHTML = '<option value="">Todos los periodos ocupados</option>';
                return;
            }
            avail.forEach(p => {
                const o = document.createElement('option');
                o.value = p.idPeriodo || p.id;
                o.textContent = (p.nombre || p.sigla);
                select.appendChild(o);
            });
            select.disabled = false;
        })
        .catch(() => {
            select.innerHTML = '<option>Error</option>';
        });
}

function normalize(s) {
    return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
