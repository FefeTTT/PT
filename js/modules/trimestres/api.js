/**
 * API module for Trimestres feature.
 * Encapsulates all backend interaction.
 */

// Global dependency wrapper for postForm
export function post(url, payload) {
    if (typeof window.postForm === 'function') {
        return window.postForm(url, payload);
    }
    // Fallback implementation if postForm is not available
    const formData = new FormData();
    for (const key in payload) {
        if (payload.hasOwnProperty(key)) {
            formData.append(key, payload[key]);
        }
    }
    return fetch(url, { method: 'POST', body: formData }).then(r => r.json());
}

/**
 * Fetch trimestres list filtered by year.
 * @param {string} anio - Year filter or 'todos'.
 * @returns {Promise<any>} Response JSON.
 */
export function fetchTrimestres(anio) {
    if (String(anio) === 'todos') {
        return post('controlador/recuperaTrimestresTodos.php', {});
    } else {
        return post('controlador/recuperaTrimestresPorAnio.php', { anio: anio });
    }
}

/**
 * Fetch trimestres for Programacion/Preferencias (list view).
 * @returns {Promise<any>}
 */
export function fetchTrimestresForList() {
    return fetch('controlador/recuperarTrimestresProgramacion.php', { method: 'POST' }).then(r => r.json());
}

/**
 * Fetch all available UEAs.
 * @returns {Promise<any>}
 */
export function fetchUEAs() {
    return fetch('controlador/recuperarUEAsTodos.php', { method: 'POST' }).then(r => r.json());
}

/**
 * Fetch all professors.
 * @returns {Promise<any>}
 */
export function fetchProfesores() {
    return fetch('controlador/recuperarProfesoresTodos.php', { method: 'POST' }).then(r => r.json());
}

/**
 * Create a new trimestre.
 * @param {Object} payload - { anio, idPeriodo, fechaLimite, estadoId? }
 * @returns {Promise<any>}
 */
export function createTrimestre(payload) {
    return post('controlador/insertarTrimestre.php', payload);
}

/**
 * Delete a trimestre.
 * @param {number|string} idTrimestre
 * @returns {Promise<any>}
 */
export function deleteTrimestre(idTrimestre) {
    return post('controlador/eliminarTrimestre.php', { idTrimestre });
}

/**
 * Change trimestre state.
 * @param {Object} payload - { idTrimestre, estadoId?, accion? }
 * @returns {Promise<any>}
 */
export function changeEstadoTrimestre(payload) {
    return post('controlador/cambiarEstadoTrimestre.php', payload);
}

/**
 * Update professor availability in a trimestre.
 * @param {Object} payload - { idTrimestre, idProfesor, incluir }
 * @returns {Promise<any>}
 */
export function updateProfesorDisposicion(payload) {
    return post('controlador/actualizarProfesorDisposicion.php', payload);
}

/**
 * Update professor preferences.
 * @param {FormData} formData
 * @returns {Promise<any>}
 */
export function updatePreferenciasProfesor(formData) {
    return fetch('controlador/actualizarPreferenciasProfesor.php', { method: 'POST', body: formData })
        .then(r => r.json());
}

/**
 * Get professors for a specific trimestre.
 * @param {number|string} idTrimestre
 * @returns {Promise<any>}
 */
export function fetchProfesoresTrimestre(idTrimestre) {
    return post('controlador/recuperarProfesoresTrimestre.php', { idTrimestre: idTrimestre });
}

/**
 * Get groups and schedules for a trimestre (Editor de Grupos).
 * @param {number|string} idTrimestre
 * @returns {Promise<any>}
 */
export function fetchGruposHorarios(idTrimestre) {
    return post('controlador/recuperaGruposHorarios.php', { idTrimestre: idTrimestre });
}

/**
 * Load trimestre states list.
 * @returns {Promise<any>}
 */
export function fetchTrimestreEstados() {
    return post('controlador/recuperaTrimestreEstados.php', {});
}

/**
 * Delete programming for a trimestre.
 * @param {number|string} idTrimestre
 * @returns {Promise<any>}
 */
export function deleteProgramacion(idTrimestre) {
    return post('controlador/eliminarProgramacionTrimestre.php', { idTrimestre: idTrimestre });
}

/**
 * Check counts for programming/groups (helpers for button visibility).
 * @param {string} url
 * @param {Object} payload
 * @returns {Promise<any>}
 */
export function checkCount(url, payload) {
    return post(url, payload);
}

/**
 * Search preferences (multi-filter).
 * @param {Object} payload
 * @returns {Promise<any>}
 */
export function searchPreferenciasMulti(payload) {
    return fetch('controlador/buscarPreferenciasMulti.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json());
}

/**
 * Search programming (multi-filter).
 * @param {Object} payload
 * @returns {Promise<any>}
 */
export function searchProgramacionMulti(payload) {
    return fetch('controlador/buscarProgramacionMulti.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(r => r.json());
}
