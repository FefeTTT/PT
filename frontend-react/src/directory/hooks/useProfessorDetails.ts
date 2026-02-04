import { useState, useEffect } from 'react';
import { Professor, AreaAssignment, GroupAssignment, Contract, EmergencyContact, Location } from '../types';

export interface ProfessorFullDetails {
    profesor: Professor;
    areas: AreaAssignment[];
    grupos: GroupAssignment[];
    contrato: Contract | null;
    contactos: EmergencyContact[];
    lugares: Location[];
}

export function useProfessorDetails(id: string | number | null) {
    const [details, setDetails] = useState<ProfessorFullDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (!id) {
            setDetails(null);
            return;
        }

        let cancelled = false;

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`controlador/recuperarProfesorPorId.php?id=${id}`);
                const json = await response.json();

                if (cancelled) return;

                if (!json.ok) {
                    throw new Error(json.error || 'Error al cargar detalles');
                }

                setDetails({
                    profesor: json.profesor,
                    areas: json.areas || [],
                    grupos: json.grupos || [],
                    contrato: json.contrato || null,
                    contactos: json.contactos || [],
                    lugares: json.lugares || []
                });
            } catch (err: any) {
                if (cancelled) return;
                console.error('Error fetching professor details:', err);
                setError(err.message || 'Error de conexión');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchDetails();

        return () => {
            cancelled = true;
        };
    }, [id, refreshTrigger]);

    return { details, loading, error, refresh: () => setRefreshTrigger(n => n + 1) };
}
