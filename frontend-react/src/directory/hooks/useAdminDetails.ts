import { useState, useEffect } from 'react';
import { Admin } from '../types';

export interface AdminFullDetails {
    administrativo: Admin;
}

export function useAdminDetails(id: string | number | null) {
    const [details, setDetails] = useState<AdminFullDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setDetails(null);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`controlador/recuperarAdministrativoPorId.php?id=${id}`);
                const json = await response.json();

                if (!json.ok) {
                    throw new Error(json.error || 'Error al cargar detalles');
                }

                setDetails({
                    administrativo: json.administrativo || {}
                });
            } catch (err: any) {
                console.error('Error fetching admin details:', err);
                setError(err.message || 'Error de conexión');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id]);

    return { details, loading, error };
}
