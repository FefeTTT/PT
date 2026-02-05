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

export async function importarUEA(file: File): Promise<{
    ok: boolean;
    error?: string;
    processed?: number;
    inserted?: number;
    updated?: number;
    errors?: Array<{ line: number; error: string; }>
}> {
    try {
        const formData = new FormData();
        formData.append('csvfile', file);

        // Use fetch directly for file upload to avoid JSON stringification of FormData in post wrapper if implementation varies
        const req = await fetch('scripts/upload_uea_csv.php', {
            method: 'POST',
            body: formData
        });
        const text = await req.text();
        try {
            const json = JSON.parse(text);
            return json;
        } catch (e) {
            return { ok: false, error: 'Respuesta inválida del servidor: ' + text };
        }
    } catch (e) {
        return { ok: false, error: 'Error de red' };
    }
}


export async function fetchProfesoresTrimestre(idTrimestre: string | number): Promise<{ ok: boolean; profesores?: any[]; msg?: string }> {
    return post('controlador/recuperarProfesoresTrimestre.php', { idTrimestre });
}

export async function toggleProfesorTrimestre(idTrimestre: string | number, idProfesor: string | number, action: 'include' | 'exclude'): Promise<{ ok: boolean; error?: string }> {
    return post('controlador/toggleProfesorEnTrimestre.php', { idTrimestre, idProfesor, action });
}
