import React, { useState, useEffect } from 'react';
import { Trimester } from '../../types';
import { BaseModal } from './BaseModal';

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    professorId: string | number;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, professorId }) => {
    const [trimesters, setTrimesters] = useState<Trimester[]>([]);
    const [selectedTrimestre, setSelectedTrimestre] = useState<string>('');
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingTrims, setLoadingTrims] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTrimesters();
        } else {
            setSchedule([]);
            setSelectedTrimestre('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedTrimestre && isOpen) {
            fetchSchedule();
        }
    }, [selectedTrimestre, professorId]);

    const fetchTrimesters = async () => {
        setLoadingTrims(true);
        try {
            const res = await fetch('controlador/recuperaTrimestresTodos.php', { method: 'POST' });
            const json = await res.json();
            if (json.ok) {
                // Sort descending by year/trim
                const sorted = json.trimestres.sort((a: Trimester, b: Trimester) => {
                    if (Number(a.anio) !== Number(b.anio)) return Number(b.anio) - Number(a.anio);
                    return a.trimestre.localeCompare(b.trimestre) * -1; // Roughly P > O > I
                });
                setTrimesters(sorted);
                if (sorted.length > 0) {
                    setSelectedTrimestre(sorted[0].idTrimestre.toString());
                }
            }
        } catch (e) {
            console.error('Error fetching trimesters', e);
        } finally {
            setLoadingTrims(false);
        }
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const data = new FormData();
            data.append('idTrimestre', selectedTrimestre);

            const res = await fetch('controlador/recuperarGruposAsignadosTrimestre.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                // json.assignedMap is key => {idProfesor, ...}
                // We need to filter for this professor
                const assigned = [];
                for (const key in json.assignedMap) {
                    const item = json.assignedMap[key];
                    if (String(item.idProfesor) === String(professorId)) {
                        // We need more info about the group (UEA name, etc). 
                        // The endpoint returns keys like "claveUEA|claveGrupo". 
                        // It doesn't seem to return UEA name in the map.
                        // However, json.assignedKeys is a list.
                        // We might need to look up in the 'groups' list?
                        // Wait, the PHP script: 
                        // $groups = $dao->obtenerGruposConHorariosPorTrimestre($idTrimestre);
                        // It doesn't return $groups in the JSON response!
                        // That script seems designed for a specific view that knows UEAs.

                        // Workaround: We parse the key "claveUEA|claveGrupo"
                        const [uea, grp] = key.split('|');
                        assigned.push({
                            claveUEA: uea,
                            claveGrupo: grp,
                            ...item
                        });
                    }
                }
                setSchedule(assigned);
            }
        } catch (e) {
            console.error('Error fetching schedule', e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Horario Asignado"
            size="lg"
            cancelText="Cerrar"
        >
            {loadingTrims ? (
                <div className="text-center"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
                <div className="mb-3">
                    <label className="form-label">Trimestre</label>
                    <select
                        className="form-select"
                        value={selectedTrimestre}
                        onChange={e => setSelectedTrimestre(e.target.value)}
                    >
                        {trimesters.map(t => (
                            <option key={t.idTrimestre} value={t.idTrimestre}>
                                {t.anio} - {t.trimestre}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
                <>
                    {schedule.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-bordered table-striped">
                                <thead>
                                    <tr>
                                        <th>Clave UEA</th>
                                        <th>Grupo</th>
                                        {/* Since we don't get UEA Name easily, we omit or show strict data */}
                                        <th>Info</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedule.map((s, idx) => (
                                        <tr key={idx}>
                                            <td>{s.claveUEA}</td>
                                            <td>{s.claveGrupo}</td>
                                            <td>
                                                <small className="text-muted">ID Grupo: {s.idGrupo}</small>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-muted small">
                                Nota: Solo se muestran los grupos donde el profesor es el titular asignado.
                            </p>
                        </div>
                    ) : (
                        <div className="alert alert-info">
                            No se encontraron grupos asignados para este trimestre.
                        </div>
                    )}
                </>
            )}
        </BaseModal>
    );
};
