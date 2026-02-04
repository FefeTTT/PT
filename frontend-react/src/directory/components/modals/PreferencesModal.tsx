import React, { useState, useEffect } from 'react';
import { Trimester, UEA, TimeSlot, PreferenceData } from '../../types';
import { BaseModal } from './BaseModal';

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    professorId: string | number;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose, professorId }) => {
    // Catalogs
    const [trimesters, setTrimesters] = useState<Trimester[]>([]);
    const [allUEAs, setAllUEAs] = useState<UEA[]>([]);
    const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);

    // Selection State
    const [selectedTrimestre, setSelectedTrimestre] = useState<string>('');

    // Form State
    const [formData, setFormData] = useState<PreferenceData>({
        noGrupos: '', // string for input
        observaciones: '',
        ueas: [],
        horarios: [] // We store IDs here for check state? No, type says object. 
        // But for local editing maybe just IDs in a Set?
        // Let's store IDs in a separate set for easier handling
    });
    const [selectedTimeSlotIds, setSelectedTimeSlotIds] = useState<Set<number>>(new Set());

    // Status
    const [loadingCatalogs, setLoadingCatalogs] = useState(false);
    const [loadingPrefs, setLoadingPrefs] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCatalogs();
        } else {
            // Reset
            setFormData({ noGrupos: '', observaciones: '', ueas: [] });
            setSelectedTimeSlotIds(new Set());
            setMessage(null);
            setError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedTrimestre && isOpen) {
            fetchPreferences();
        }
    }, [selectedTrimestre, professorId]);

    const fetchCatalogs = async () => {
        setLoadingCatalogs(true);
        try {
            // 1. Trimesters
            const resTrim = await fetch('controlador/recuperaTrimestresTodos.php', { method: 'POST' });
            const jsonTrim = await resTrim.json();
            if (jsonTrim.ok) {
                const sorted = jsonTrim.trimestres.sort((a: Trimester, b: Trimester) => {
                    if (Number(a.anio) !== Number(b.anio)) return Number(b.anio) - Number(a.anio);
                    return a.trimestre.localeCompare(b.trimestre) * -1;
                });
                setTrimesters(sorted);
                if (sorted.length > 0) setSelectedTrimestre(sorted[0].idTrimestre.toString());
            }

            // 2. UEAs
            const resUEA = await fetch('controlador/recuperarUEAsTodos.php');
            const jsonUEA = await resUEA.json();
            if (jsonUEA.ok) setAllUEAs(jsonUEA.ueas);

            // 3. TimeSlots
            const resTime = await fetch('controlador/recuperarHorarios.php');
            const jsonTime = await resTime.json();
            if (jsonTime.ok) setAllTimeSlots(jsonTime.horarios);

        } catch (e) {
            console.error('Error fetching catalogs', e);
            setError('Error al cargar catálogos');
        } finally {
            setLoadingCatalogs(false);
        }
    };

    const fetchPreferences = async () => {
        setLoadingPrefs(true);
        setMessage(null);
        setError(null);
        try {
            const data = new FormData();
            data.append('idTrimestre', selectedTrimestre);
            data.append('idProfesor', professorId.toString());

            const res = await fetch('controlador/recuperarPreferenciasProfesorTrimestre.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok && json.data) {
                const d = json.data;
                // Map response to form state
                setFormData({
                    idPreferencia: d.idPreferencia,
                    noGrupos: d.noGrupos || '',
                    observaciones: d.observaciones || '',
                    ueas: d.ueas || []
                });

                // Map horarios to Set
                const ids = new Set<number>();
                if (d.horarios && Array.isArray(d.horarios)) {
                    d.horarios.forEach((h: any) => ids.add(Number(h.idHorario)));
                }
                setSelectedTimeSlotIds(ids);
            } else {
                // No prefs yet? Result ok=true but data might be null or empty
                setFormData({ noGrupos: '', observaciones: '', ueas: [] });
                setSelectedTimeSlotIds(new Set());
            }
        } catch (e) {
            console.error('Error fetching preferences', e);
            setError('Error al cargar preferencias');
        } finally {
            setLoadingPrefs(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            const data = new FormData();
            data.append('idTrimestre', selectedTrimestre);
            data.append('idProfesor', professorId.toString());
            if (formData.idPreferencia) {
                data.append('idPreferencia', formData.idPreferencia.toString());
            }
            data.append('noGrupos', formData.noGrupos ? formData.noGrupos.toString() : '');
            data.append('observaciones', formData.observaciones || '');

            // UEAs (uea1..uea5)
            // The output script supports 'ueas' as JSON, let's try that first as it is cleaner
            // "Manejar UEAs: puede venir como JSON en 'ueas'"
            const ueasToSend = (formData.ueas || []).map((u, i) => ({
                idUEA: u.idUEA,
                prioridad: i + 1
            }));
            data.append('ueas', JSON.stringify(ueasToSend));

            // Horarios - JSON 'horarios' or 'horario[]'
            // "Manejar horarios: puede venir como JSON objetos {dia,horaInicio,horaFin} en 'horarios' o como lista de ids en 'horario'"
            // We have IDs. Best to send IDs.
            // But script prefers "horariosObjs" via JSON or "horario[]" IDs.
            // It says: "Si vienen ids, borramos ... y añadimos por id" (lines 91-92).
            // So we can send `horario[]`.
            Array.from(selectedTimeSlotIds).forEach(id => {
                data.append('horario[]', id.toString());
            });

            const res = await fetch('controlador/actualizarPreferenciasProfesor.php', { method: 'POST', body: data });
            const json = await res.json();

            if (json.ok) {
                setMessage('Preferencias guardadas correctamente');
                fetchPreferences(); // Reload to get IDs etc
            } else {
                throw new Error(json.msg || 'Error al guardar');
            }
        } catch (e: any) {
            console.error('Error saving', e);
            setError(e.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    // UI Helpers
    const toggleTimeSlot = (id: number) => {
        const next = new Set(selectedTimeSlotIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTimeSlotIds(next);
    };

    const addUEA = (idUEA: string) => {
        if (!idUEA) return;
        const current = formData.ueas || [];
        if (current.some(u => String(u.idUEA) === String(idUEA))) return;
        if (current.length >= 5) {
            alert('Máximo 5 UEAs preferidas');
            return;
        }

        // Lookup info
        const ueaInfo = allUEAs.find(u => String(u.idUEA) === String(idUEA));
        const newItem = {
            idUEA,
            prioridad: current.length + 1,
            claveUEA: ueaInfo?.claveUEA,
            nombreUEA: ueaInfo?.nombreUEA
        };

        setFormData({ ...formData, ueas: [...current, newItem] });
    };

    const removeUEA = (idx: number) => {
        const current = [...(formData.ueas || [])];
        current.splice(idx, 1);
        // Re-calc priorities
        const updated = current.map((u, i) => ({ ...u, prioridad: i + 1 }));
        setFormData({ ...formData, ueas: updated });
    };

    // Group TimeSlots by Day
    const slotsByDay: { [key: string]: TimeSlot[] } = {};
    allTimeSlots.forEach(ts => {
        if (!slotsByDay[ts.dia]) slotsByDay[ts.dia] = [];
        slotsByDay[ts.dia].push(ts);
    });
    // Sort days? LUN, MAR, MIE, JUE, VIE
    const dayOrder = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
    const sortedDays = Object.keys(slotsByDay).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));


    if (!isOpen) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Preferencias de Docencia"
            size="xl"
            loading={loadingPrefs || saving}
            error={error}
            cancelText="Cerrar"
            confirmText="Guardar Preferencias"
            onConfirm={handleSave}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cerrar</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loadingPrefs}>
                        {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
                        Guardar Preferencias
                    </button>
                </>
            }
        >
            {loadingCatalogs && <div className="text-center"><div className="spinner-border text-primary"></div></div>}
            {!loadingCatalogs && (
                <div className="row g-3">
                    <div className="col-12">
                        <label className="form-label fw-bold">Trimestre</label>
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

                    {loadingPrefs ? (
                        <div className="col-12 text-center py-4"><div className="spinner-border text-secondary"></div></div>
                    ) : (
                        <>
                            {message && <div className="col-12"><div className="alert alert-success">{message}</div></div>}

                            {/* General Info */}
                            <div className="col-md-4">
                                <label className="form-label">No. Grupos Deseados</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    value={formData.noGrupos || ''}
                                    onChange={e => setFormData({ ...formData, noGrupos: e.target.value })}
                                    min={0} max={10}
                                />
                            </div>
                            <div className="col-md-8">
                                <label className="form-label">Observaciones</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.observaciones || ''}
                                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                                    placeholder="Comentarios adicionales..."
                                />
                            </div>

                            <div className="col-12"><hr /></div>

                            {/* UEAs Selection */}
                            <div className="col-12 col-lg-6">
                                <h6 className="fw-bold">UEAs Preferidas</h6>
                                <div className="input-group mb-2">
                                    <select className="form-select" id="uea-select">
                                        <option value="">Seleccionar UEA...</option>
                                        {allUEAs.map(u => (
                                            <option key={u.idUEA} value={u.idUEA}>{u.claveUEA} - {u.nombreUEA}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        onClick={() => {
                                            const sel = document.getElementById('uea-select') as HTMLSelectElement;
                                            addUEA(sel.value);
                                            sel.value = '';
                                        }}
                                    >
                                        Agregar
                                    </button>
                                </div>
                                <ul className="list-group">
                                    {(formData.ueas || []).map((item, idx) => (
                                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                                            <span>
                                                <span className="badge bg-secondary me-2">{item.prioridad}</span>
                                                {item.claveUEA || item.idUEA} - {item.nombreUEA}
                                            </span>
                                            <button className="btn btn-sm btn-danger py-0" onClick={() => removeUEA(idx)}>&times;</button>
                                        </li>
                                    ))}
                                    {(formData.ueas || []).length === 0 && <li className="list-group-item text-muted fst-italic">Ninguna asignada</li>}
                                </ul>
                            </div>

                            {/* Time Slots */}
                            <div className="col-12 col-lg-6">
                                <h6 className="fw-bold">Disponibilidad / Preferencia Horaria</h6>
                                <div className="border rounded p-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {sortedDays.map(day => (
                                        <div key={day} className="mb-2">
                                            <strong>{day}</strong>
                                            <div className="d-flex flex-wrap gap-2 mt-1">
                                                {slotsByDay[day].map(ts => {
                                                    const isSel = selectedTimeSlotIds.has(Number(ts.idHorario));
                                                    return (
                                                        <div key={ts.idHorario} className="form-check">
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                checked={isSel}
                                                                onChange={() => toggleTimeSlot(Number(ts.idHorario))}
                                                                id={`ts-${ts.idHorario}`}
                                                            />
                                                            <label className="form-check-label small" htmlFor={`ts-${ts.idHorario}`}>
                                                                {ts.horaInicio}-{ts.horaFin}
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </BaseModal>
    );
};
