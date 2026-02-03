import { useState, useEffect } from 'react';
import { DirectoryItem, DirectoryState, Professor, Admin } from '../types';

type ServerFilters = Pick<DirectoryState, 'areaAcademica' | 'grupoTematico' | 'profesorAreaTipo' | 'profesorTipo' | 'adminTipo' | 'trimestre'>;

export function useDirectoryData(filters: ServerFilters) {
    const [data, setData] = useState<DirectoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Prepare params for Professors
                const profParams = new URLSearchParams();
                profParams.set('q', ''); // Fetch all for client-side fuzzy search
                if (filters.areaAcademica) profParams.set('areaAcademicaName', filters.areaAcademica);
                if (filters.grupoTematico) profParams.set('grupoTematicoName', filters.grupoTematico);
                if (filters.profesorAreaTipo) profParams.set('profesorAreaTipo', filters.profesorAreaTipo);
                if (filters.profesorTipo && filters.profesorTipo !== '__no_profesores') profParams.set('profesorTipo', filters.profesorTipo);
                if (filters.trimestre) profParams.set('trimestre', filters.trimestre);
                // Default sort for initial fetch, though we re-sort client side
                profParams.set('sort', 'nombre');
                profParams.set('sortDir', 'ASC');

                const profPromise = (filters.profesorTipo === '__no_profesores')
                    ? Promise.resolve({ ok: true, profesores: [] })
                    : fetch('controlador/recuperarProfesores.php?' + profParams.toString()).then(r => r.json());

                // Prepare params for Admins
                const adminParams = new URLSearchParams();
                adminParams.set('q', '');
                adminParams.set('sort', 'nombre');
                adminParams.set('sortDir', 'ASC');
                if (filters.adminTipo && filters.adminTipo !== '__no_administrativos') {
                    adminParams.set('idAdministrativoTipo', filters.adminTipo);
                }

                // If filters implies we shouldn't fetch admins?
                // The original code fetches admins unless explicitly disabled or if we assume filtering by academic things excludes admins.
                // Original code: always fetched unless adminTipo === '__no_administrativos'
                // But wait, if I filter by 'Area Academica', admins don't have areas.
                // The original code passed `filterState` to admin fetch BUT `recuperarAdministrativos.php` likely ignores them.
                // However, logically if I search for "Department X" I might not want admins?
                // The original JS: `const adminParams = { ...filterState, q: '' };` and passed it.
                // I will replicate that behavior.

                const adminPromise = (filters.adminTipo === '__no_administrativos')
                    ? Promise.resolve({ ok: true, administrativos: [] })
                    : fetch('controlador/recuperarAdministrativos.php?' + adminParams.toString()).then(r => r.json());

                const [profRes, adminRes] = await Promise.all([profPromise, adminPromise]);

                const combined: DirectoryItem[] = [];

                if (profRes.ok && Array.isArray(profRes.profesores)) {
                    profRes.profesores.forEach((p: Professor) => {
                        combined.push({
                            id: p.idProfesor,
                            tipo: 'profesor',
                            nombre: p.nombre || '',
                            numeroEconomico: p.numeroEconomico || '',
                            raw: p
                        });
                    });
                }

                if (adminRes.ok && Array.isArray(adminRes.administrativos)) {
                    adminRes.administrativos.forEach((a: Admin) => {
                        combined.push({
                            id: a.idAdministrativo,
                            tipo: 'administrativo',
                            nombre: a.nombre || '',
                            numeroEconomico: a.numeroEconomico || '',
                            raw: a
                        });
                    });
                }

                setData(combined);

            } catch (e: any) {
                console.error("Error fetching directory data", e);
                setError(e.message || "Error de red");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [
        filters.areaAcademica,
        filters.grupoTematico,
        filters.profesorAreaTipo,
        filters.profesorTipo,
        filters.adminTipo,
        filters.trimestre,
        refreshTrigger
    ]);

    return { data, loading, error, refresh: () => setRefreshTrigger(p => p + 1) };
}
