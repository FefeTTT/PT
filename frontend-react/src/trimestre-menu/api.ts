/**
 * API module for Trimestres feature.
 * Encapsulates all backend interaction.
 */

declare global {
    interface Window {
        postForm?: (url: string, payload: any) => Promise<any>;
    }
}


async function post(url: string, payload: any): Promise<any> {
    if (typeof window.postForm === 'function') {
        return window.postForm(url, payload);
    }

    // FormData for PHP compatibility
    const formData = new FormData();
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            formData.append(key, payload[key]);
        }
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

export interface Trimestre {
    idTrimestre: string | number;
    periodoNombre?: string;
    sigla?: string;
    anio?: string | number;
    year?: string | number;
    fechaLimite?: string;
    estado?: string;
    trimestreEstado?: string;
    [key: string]: any;
}

export interface Periodo {
    idPeriodo: string | number;
    nombre: string;
    sigla?: string;
}

export interface TrimestreEstado {
    idTrimestreEstado: string | number;
    estado: string;
}

export interface CreateTrimestrePayload {
    anio: string | number;
    idPeriodo: string | number;
    fechaLimite: string;
    estadoId: string | number;
}

export async function fetchTrimestres(anio: string): Promise<{ ok: boolean; trimestres: Trimestre[]; error?: string }> {
    if (anio === 'todos') {
        return post('controlador/recuperaTrimestresTodos.php', {});
    } else {
        return post('controlador/recuperaTrimestresPorAnio.php', { anio });
    }
}

export async function deleteTrimestre(idTrimestre: string | number): Promise<{ ok: boolean; error?: string }> {
    return post('controlador/eliminarTrimestre.php', { idTrimestre });
}

export async function fetchUEAs(): Promise<any> {
    return fetch('controlador/recuperarUEAsTodos.php', { method: 'POST' }).then(r => r.json());
}

export async function fetchPeriodosTrimestre(anio: string): Promise<{ ok: boolean; periodos?: Periodo[]; used?: (string | number)[]; error?: string }> {
    return post('controlador/recuperaPeriodosTrimestre.php', { anio });
}

export async function fetchTrimestreEstados(): Promise<{ ok: boolean; estados?: TrimestreEstado[]; error?: string }> {
    return post('controlador/recuperaTrimestreEstados.php', {});
}

export async function createTrimestre(payload: CreateTrimestrePayload): Promise<{ ok: boolean; error?: string }> {
    return post('controlador/insertarTrimestre.php', payload);
}

