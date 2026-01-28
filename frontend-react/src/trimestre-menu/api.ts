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

