import React, { useState, useEffect } from 'react';
import * as API from './api';
import styles from './trimestre-menu.module.css';
import TrimestreTableHeaders from './TrimestreTableHeaders';
import LoadingLabel from '../components/common/LoadingLabel';
import ActionButton from '../components/common/ActionButton';
import NewTrimestreModal from './NewTrimestreModal';
import ImportUEAModal from './ImportUEAModal';
import ProfesoresTrimestre from './ProfesoresTrimestre';
import listaDeUEA from './data/listaDeUEA.json';
import { UEA_AREA_MAPPING } from '../scripts/utils/constants';
import { DatosUEA } from '../scripts/utils/types';

interface SortState {
    col: string | null;
    asc: boolean;
}

const MenuTrimestres: React.FC = () => {
    const [trimestres, setTrimestres] = useState<API.Trimestre[]>([]);
    const [selectedYear, setSelectedYear] = useState<string>('todos');
    const [sortState, setSortState] = useState<SortState>({ col: null, asc: true });
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState<boolean>(false);
    const [showImportModal, setShowImportModal] = useState<boolean>(false);
    const [selectedTrimestreForProfessors, setSelectedTrimestreForProfessors] = useState<API.Trimestre | null>(null);

    useEffect(() => {
        loadTrimestres(selectedYear);
    }, [selectedYear]);

    const loadTrimestres = async (anio: string) => {
        setLoading(true);
        setError(null);
        try {
            const data = await API.fetchTrimestres(anio);
            if (data && data.trimestres) {
                setTrimestres(Array.isArray(data.trimestres) ? data.trimestres : []);
            } else if (!data.ok) {
                setTrimestres([]);
                if (data.error) setError(data.error);
            }
        } catch (err) {
            console.error(err);
            setError('Error de red al cargar trimestres.');
            setTrimestres([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: string) => {
        setSortState(prev => {
            if (prev.col === key) {
                return { col: key, asc: !prev.asc };
            }
            return { col: key, asc: true };
        });
    };

    const getSortedTrimestres = () => {
        if (!sortState.col) return trimestres;

        return [...trimestres].sort((a, b) => {
            let va = a[sortState.col!];
            let vb = b[sortState.col!];

            if (sortState.col === 'fechaLimite') {
                va = new Date(va).getTime();
                vb = new Date(vb).getTime();
            } else {
                // Simple string compare
                va = String(va || '').toLowerCase();
                vb = String(vb || '').toLowerCase();
            }

            if (va < vb) return sortState.asc ? -1 : 1;
            if (va > vb) return sortState.asc ? 1 : -1;
            return 0;
        });
    };

    const handleDelete = async (row: API.Trimestre) => {
        if (!confirm(`¿Eliminar el trimestre ${row.periodoNombre || row.idTrimestre}?`)) return;

        try {
            const res = await API.deleteTrimestre(row.idTrimestre);
            if (res && res.ok) {
                alert('Eliminado correctamente');
                loadTrimestres(selectedYear);
            } else {
                alert(res.error || 'No se pudo eliminar');
            }
        } catch (e) {
            alert('Error al eliminar');
        }
    };

    const handleAction = (action: string, row?: API.Trimestre) => {
        if (action === 'Nuevo Trimestre') {
            setShowNewModal(true);
            return;
        } else if (action === 'importar-uea') {
            setShowImportModal(true);
            return;
        } else if (action === 'Profesores' && row) {
            setSelectedTrimestreForProfessors(row);
            return;
        }
        alert(`Acción '${action}' en construcción (React Port). \nID: ${row?.idTrimestre || 'N/A'}`);

    };

    const handleLoadAllUEAs = async () => {
        if (!confirm("¿Cargar todas las UEAs desde el JSON?")) return

        let successCount = 0;
        let errorCount = 0;
        const ueas = Object.entries(listaDeUEA as Record<string, DatosUEA>);
        console.log("UEA totales: ", ueas.length);

        for (const [clave, data] of ueas) {
            const nombre = data.nombre;
            const areaNombre = data.area;

            console.log(`UEA a insertar: ${clave} - ${nombre} (${areaNombre})`);

            if (!UEA_AREA_MAPPING[areaNombre]) {
                console.error(`Area desconocida: ${areaNombre}`);
                errorCount++;
                continue;
            }

            const areaId = UEA_AREA_MAPPING[areaNombre];

            try {
                const res = await API.insertarUEA({
                    clave: parseInt(clave),
                    nombre: nombre,
                    areaId: areaId
                });

                if (res.isItOk) {
                    console.log(`UEA insertada: ${clave}`);
                    successCount++;
                } else {
                    console.error(`Error al insertar UEA ${clave}: ${res.error}`);
                    errorCount++;
                }
            } catch (e: any) {
                console.error(`Error al insertar UEA ${clave}:`, e);
                errorCount++;
            }
        }

        console.log(`Finalizado. Exitos: ${successCount}, Errores: ${errorCount}`);
        alert(`Resultados de la carga:\nExitos -> ${successCount}\nErrores -> ${errorCount}`);
    };

    const sortedTrimestres = getSortedTrimestres();

    // Year options: Current year +- 2
    const currentYear = new Date().getFullYear();
    const years = ['todos'];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) years.push(String(i));

    return (

        <div className={`container mt-3 ${styles.menuContainer}`} style={{ position: 'relative' }}>
            {loading && <LoadingLabel />}
            {/* Header */}
            <div className={styles.headerBar}>
                <button className={`btn btn-sm btn-outline-secondary ${styles.backBtn}`} onClick={() => {
                    if (typeof (window as any).onExitTrimestres === 'function') {
                        (window as any).onExitTrimestres();
                    } else {
                        window.location.href = 'index.php';
                    }
                }}>
                    &#8592; Volver
                </button>
                <h5 className="m-0 ms-2">Trimestres (React)</h5>
            </div>

            {/* Actions Bar */}
            <div className={styles.menuBar}>
                <div className={styles.actionsLeft}>
                    <ActionButton textLabel="Nuevo trimestre" onButtonClicked={() => handleAction('Nuevo Trimestre')} />
                    <ActionButton textLabel="Importar UEA" onButtonClicked={() => handleAction('importar-uea')} />
                    <ActionButton textLabel="Cargar todas las UEA" onButtonClicked={handleLoadAllUEAs} />
                    <ActionButton textLabel="Refrescar" onButtonClicked={() => loadTrimestres(selectedYear)} />
                    {/* Legacy Placeholders */}
                    {['cargar-planeacion', 'hist-programacion'].map(act => (
                        <ActionButton key={act} textLabel={act} onButtonClicked={() => handleAction(act)} />
                    ))}
                </div>

                {/* Year Filter */}
                <div className={styles.yearFilter}>
                    <span style={{ color: '#148aff' }} className="me-2">Año:</span>
                    <div className={styles.radioGroup}>
                        {years.map(y => (
                            <div key={y} className={styles.radioItem} onClick={() => setSelectedYear(y)}>
                                <input
                                    type="radio"
                                    name="anio_filter"
                                    checked={selectedYear === y}
                                    readOnly
                                    style={{ cursor: 'pointer' }}
                                />
                                <label style={{ cursor: 'pointer' }}>{y === 'todos' ? 'Todos' : y}</label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="card" style={{ minHeight: '150px' }}>
                <div className="card-body">
                    {selectedTrimestreForProfessors ? (
                        <ProfesoresTrimestre
                            trimestre={selectedTrimestreForProfessors}
                            onBack={() => setSelectedTrimestreForProfessors(null)}
                        />
                    ) : (
                        <>
                            {error && <div className="text-danger small">{error}</div>}

                            {!error && (
                                <div className="table-responsive">
                                    <table className="table table-striped table-sm">
                                        <thead>
                                            <TrimestreTableHeaders>
                                                <th className="text-start"><button className={styles.sortBtn} onClick={() => handleSort('periodoNombre')}>Periodo</button></th>
                                                <th className="text-start"><button className={styles.sortBtn} onClick={() => handleSort('año')}>Año</button></th>
                                                <th className="text-start"><button className={styles.sortBtn} onClick={() => handleSort('fechaLimite')}>Fecha límite</button></th>
                                                <th className="text-start"><button className={styles.sortBtn} onClick={() => handleSort('estado')}>Estado</button></th>
                                                <th className="text-start">Acciones</th>
                                            </TrimestreTableHeaders>
                                        </thead>

                                        <tbody>
                                            {sortedTrimestres.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center">No hay trimestres.</td></tr>
                                            ) : (
                                                sortedTrimestres.map((row, idx) => (
                                                    <tr key={row.idTrimestre || idx}>
                                                        <td>{row.periodoNombre || row.sigla}</td>
                                                        <td>{row.año || row.anio}</td>
                                                        <td>{row.fechaLimite || '-'}</td>
                                                        <td><span className="badge bg-secondary">{row.estado || row.trimestreEstado}</span></td>
                                                        <td>
                                                            <button className="btn btn-sm btn-danger me-1" onClick={() => handleDelete(row)}>Eliminar</button>
                                                            <button className="btn btn-sm btn-info me-1" onClick={() => handleAction('Profesores', row)}>Profesores</button>
                                                            <button className="btn btn-sm btn-warning" onClick={() => handleAction('Grupos', row)}>Grupos</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <NewTrimestreModal
                show={showNewModal}
                onClose={() => setShowNewModal(false)}
                onSuccess={(anio) => {
                    setSelectedYear(anio);
                    loadTrimestres(anio);
                }}
            />
            <ImportUEAModal
                show={showImportModal}
                onClose={() => setShowImportModal(false)}
            />
        </div>
    );
};

export default MenuTrimestres;
