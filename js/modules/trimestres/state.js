/**
 * Shared state for Trimestres module.
 */

export const state = {
    estadosMapByName: {}, // normalized name -> id
    estadosMapById: {}    // id -> name
};

/**
 * Normalize state string for comparisons.
 * @param {string} s 
 * @returns {string}
 */
export function normState(s) {
    try {
        if (!s && s !== 0) return '';
        let str = String(s);
        try { str = str.normalize('NFD').replace(/\p{Diacritic}/gu, ''); } catch (e) {
            str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        str = str.toLowerCase().replace(/\s+/g, ' ').trim();
        return str;
    } catch (e) { return String(s || '').toLowerCase(); }
}

export function setEstados(list) {
    if (!Array.isArray(list)) return;
    list.forEach(e => {
        const id = e.idTrimestreEstado || e.id || e.idTrimestreestado || e.id_trimestreestado;
        const nombre = e.estado || e.nombre || String(e);
        if (!id) return;
        const key = String(nombre).trim().toLowerCase();
        state.estadosMapByName[key] = Number(id);
        state.estadosMapById[Number(id)] = nombre;
    });
}
