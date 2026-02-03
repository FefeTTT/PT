import { useState, useEffect } from 'react';
import { FilterOptions } from '../types';

export function useFilters() {
    const [filters, setFilters] = useState<FilterOptions>({
        areaAcademicas: [],
        gruposTematicos: [],
        profesorTipos: [],
        profesorAreaTipos: [],
        administrativoTipos: [],
        trimestres: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [profRes, adminRes] = await Promise.all([
                    fetch('controlador/recuperaFiltrosProfesores.php').then(r => r.json()),
                    fetch('controlador/recuperaFiltrosAdministrativos.php').then(r => r.json())
                ]);

                if (profRes.ok) {
                    setFilters(prev => ({
                        ...prev,
                        areaAcademicas: profRes.areaAcademicas || [],
                        gruposTematicos: profRes.gruposTematicos || [],
                        profesorTipos: profRes.profesorTipos || [],
                        profesorAreaTipos: profRes.profesorAreaTipos || [],
                        trimestres: profRes.trimestres || []
                    }));
                }

                if (adminRes.ok) {
                    const adminGeneric = adminRes.administrativoTipos || adminRes.administrativotipos || [];
                    setFilters(prev => ({
                        ...prev,
                        administrativoTipos: adminGeneric
                    }));
                }

            } catch (error) {
                console.error("Error loading filters", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFilters();
    }, []);

    return { filters, loading };
}
