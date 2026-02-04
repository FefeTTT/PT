import React, { useMemo } from 'react';
import Fuse from 'fuse.js';
import { DirectoryItem, DirectoryState, Professor } from '../types';

interface DirectoryListProps {
    data: DirectoryItem[];
    state: DirectoryState;
    selectedItem: DirectoryItem | null;
    onSelect: (item: DirectoryItem) => void;
}

export const DirectoryList: React.FC<DirectoryListProps> = ({ data, state, selectedItem, onSelect }) => {

    // 1. Filter using Fuse.js if q exists
    const filteredData = useMemo(() => {
        if (!state.q || state.q.trim().length === 0) {
            return data;
        }

        const fuse = new Fuse(data, {
            keys: ['nombre', 'numeroEconomico'],
            threshold: 0.3,
            distance: 100,
            ignoreLocation: true
        });

        return fuse.search(state.q).map(r => r.item);
    }, [data, state.q]);

    // 2. Sort
    const sortedData = useMemo(() => {
        const sorted = [...filteredData];
        const key = state.sort === 'numeroEconomico' ? 'numeroEconomico' : 'nombre';

        sorted.sort((a, b) => {
            const valA = (a[key] || '').toString().toLowerCase();
            const valB = (b[key] || '').toString().toLowerCase();

            if (valA < valB) return state.sortDir === 'ASC' ? -1 : 1;
            if (valA > valB) return state.sortDir === 'ASC' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [filteredData, state.sort, state.sortDir]);

    if (sortedData.length === 0) {
        return <div className="p-3 text-center text-muted">Sin resultados</div>;
    }

    return (
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <table className="table table-sm table-hover">
                <thead className="sticky-top bg-white">
                    <tr>
                        <th>Nombre</th>
                        <th>No. Económico</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map(item => {
                        const isSelected = selectedItem?.id === item.id && selectedItem?.tipo === item.tipo;

                        let rowClass = '';
                        // Highlight logic for Jefes
                        if (item.tipo === 'profesor') {
                            const p = item.raw as Professor;
                            if (state.areaAcademica && p.isJefeArea && Number(p.isJefeArea) === 1) {
                                rowClass = 'table-warning';
                            } else if (state.grupoTematico && p.isJefeGrupo && Number(p.isJefeGrupo) === 1) {
                                rowClass = 'table-warning';
                            }
                        }

                        return (
                            <DirectoryListRow
                                key={`${item.tipo}-${item.id}`}
                                item={item}
                                isSelected={isSelected}
                                rowClass={rowClass}
                                onClick={() => onSelect(item)}
                            />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// Helper subcomponent for Row to handle "isSelected" logic cleanly if we pass the full object?
// Or just update the main component to accept selectedItem.

interface DirectoryListRowProps {
    item: DirectoryItem;
    isSelected: boolean;
    rowClass: string;
    onClick: () => void;
}

const DirectoryListRow: React.FC<DirectoryListRowProps> = React.memo(({ item, isSelected, rowClass, onClick }) => {
    return (
        <tr
            className={`${rowClass} ${isSelected ? 'table-primary' : ''}`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
        >
            <td>
                {item.nombre}
                <small className="text-muted ms-1">
                    {item.tipo === 'profesor' ? '(Prof.)' : '(Adm.)'}
                </small>
            </td>
            <td>{item.numeroEconomico}</td>
        </tr>
    );
}, (prev, next) => {
    return prev.item.id === next.item.id &&
        prev.item.tipo === next.item.tipo &&
        prev.isSelected === next.isSelected &&
        prev.rowClass === next.rowClass;
});

// Re-export correctly
export default DirectoryList;
