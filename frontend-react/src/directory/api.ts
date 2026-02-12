import axios from 'axios';

interface ImportResult {
    isItOk: boolean;
    processed: number;
    successes: number;
    errors: number;
    details: string[];
}

export async function importarGradoAreaBatch(data: any[]): Promise<ImportResult> {
    try {
        const response = await axios.post<ImportResult>('controlador/importar_grado_area.php', data);
        return response.data;
    } catch (e: any) {
        console.error("Error al importar grado y area", e);
        return {
            isItOk: false,
            processed: 0,
            successes: 0,
            errors: 1,
            details: [e.message || 'Error de red']
        };
    }
}
