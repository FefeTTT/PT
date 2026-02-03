import React from 'react';
import { useFilters } from '../hooks/useFilters';
import { DirectoryState } from '../types';

interface DirectoryFiltersProps {
    state: DirectoryState;
    setState: React.Dispatch<React.SetStateAction<DirectoryState>>;
    isOpen: boolean;
}

export const DirectoryFilters: React.FC<DirectoryFiltersProps> = ({ state, setState, isOpen }) => {
    const { filters, loading } = useFilters();

    const handleChange = (field: keyof DirectoryState, value: string) => {
        setState(prev => ({ ...prev, [field]: value }));
    };

    const toggleSort = (field: 'nombre' | 'numeroEconomico') => {
        setState(prev => {
            if (prev.sort === field) {
                return { ...prev, sortDir: prev.sortDir === 'ASC' ? 'DESC' : 'ASC' };
            }
            return { ...prev, sort: field, sortDir: 'ASC' };
        });
    };

    if (!isOpen) return null;

    if (loading) return <div className="text-muted small">Cargando filtros...</div>;

    return (
        <div className="mb-3 p-2 bg-light border rounded">
            {/* Sort Buttons */}
            <div className="mb-3 d-flex gap-2">
                <button
                    className={`btn btn-sm ${state.sort === 'nombre' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => toggleSort('nombre')}
                >
                    Ordenar por Nombre {state.sort === 'nombre' && (state.sortDir === 'ASC' ? '↑' : '↓')}
                </button>
                <button
                    className={`btn btn-sm ${state.sort === 'numeroEconomico' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => toggleSort('numeroEconomico')}
                >
                    Ordenar por No. Económico {state.sort === 'numeroEconomico' && (state.sortDir === 'ASC' ? '↑' : '↓')}
                </button>
            </div>

            {/* Filters Grid */}
            <div className="row g-2">
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.areaAcademica}
                        onChange={(e) => handleChange('areaAcademica', e.target.value)}
                    >
                        <option value="">Área académica (Todos)</option>
                        {filters.areaAcademicas.map(a => (
                            <option key={a.idAreaAcademica} value={a.nombre}>{a.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.grupoTematico}
                        onChange={(e) => handleChange('grupoTematico', e.target.value)}
                    >
                        <option value="">Grupo temático (Todos)</option>
                        {filters.gruposTematicos.map(g => (
                            <option key={g.idGrupoTematico} value={g.nombreGrupo}>{g.nombreGrupo}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.profesorAreaTipo}
                        onChange={(e) => handleChange('profesorAreaTipo', e.target.value)}
                    >
                        <option value="">Tipo área profesor (Todos)</option>
                        {filters.profesorAreaTipos.map(t => (
                            <option key={t.idProfesorAreaTipo} value={t.idProfesorAreaTipo}>{t.descripcion}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.profesorTipo}
                        onChange={(e) => handleChange('profesorTipo', e.target.value)}
                    >
                        <option value="">Tipo de profesor (Todos)</option>
                        <option value="__no_profesores">Sin profesores</option>
                        {filters.profesorTipos.map(t => (
                            <option key={t.idProfesorTipo} value={t.idProfesorTipo}>{t.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.adminTipo}
                        onChange={(e) => handleChange('adminTipo', e.target.value)}
                    >
                        <option value="">Tipo de administrativo (Todos)</option>
                        <option value="__no_administrativos">Sin administrativos</option>
                        {filters.administrativoTipos.map(t => (
                            <option key={t.idAdministrativoTipo} value={t.idAdministrativoTipo}>{t.nombre}</option>
                        ))}
                    </select>
                </div>
                <div className="col-md-4 col-sm-6">
                    <select
                        className="form-select form-select-sm"
                        value={state.trimestre}
                        onChange={(e) => handleChange('trimestre', e.target.value)}
                    >
                        <option value="">Trimestre (Todos)</option>
                        {filters.trimestres.map(t => {
                            const left = (t.año !== undefined && t.año !== null) ? String(t.año) : '';
                            const right = t.sigla || t.nombre || '';
                            const label = right ? (left + ' - ' + right) : left;
                            return <option key={t.idTrimestre} value={t.idTrimestre}>{label}</option>;
                        })}
                    </select>
                </div>
            </div>
        </div>
    );
};
