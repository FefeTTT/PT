/**
 * UI Helper module for Trimestres.
 */

// Imports removed; using globals from window.

/**
 * Helper to create buttons.
 * @param {string} text 
 * @param {string} cls 
 * @param {string} type 
 * @returns {HTMLButtonElement}
 */
export function crearBtn(text, cls, type = 'button') {
    const btn = document.createElement('button');
    btn.type = type;
    btn.className = 'btn btn-sm ' + cls;
    btn.textContent = text;
    btn.style.marginRight = '5px';
    return btn;
}

/**
 * Helper to show alerts using global swalAlertOpt or alert.
 * @param {string} title 
 * @param {string} msg 
 * @param {string} type 
 * @returns {Promise<any>}
 */
export function alertOpt(title, msg, type) {
    if (typeof window.swalAlertOpt === 'function') {
        return window.swalAlertOpt(title, msg, type);
    }
    alert(`${title}: ${msg}`);
    return Promise.resolve();
}

/**
 * Helper to show confirm dialog.
 * @param {string} title 
 * @param {string} msg 
 * @param {Function} cb 
 * @returns {Promise<any>}
 */
export function confirmOpt(title, msg, cb) {
    if (typeof window.swalConfirmOpt === 'function') {
        return window.swalConfirmOpt(title, msg, cb);
    }
    if (confirm(`${title}\n${msg}`)) {
        cb(true);
    } else {
        cb(false);
    }
}

/**
 * Status updater for list view.
 * @param {string} msg 
 */
export function setStatus(msg) {
    const el = document.getElementById('trimestres-status-container');
    if (el) el.textContent = msg;
}

/**
 * Normalize state string (export for UI usage if needed).
 */
export function normalizeState(s) {
    try {
        return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    } catch (e) {
        return String(s || '').toLowerCase().replace(/[\u0300-\u036f]/g, '').trim();
    }
}

/**
 * Clear a container.
 * @param {string|HTMLElement} container 
 */
export function clearContainer(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (el) el.innerHTML = '';
    return el;
}
