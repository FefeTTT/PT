import React, { useState, useEffect } from 'react';
import * as API from './api';
import Modal from '../components/common/Modal';
import FormSelect from '../components/common/FormSelect';
import FormInput from '../components/common/FormInput';

interface NewTrimestreModalProps {
    show: boolean;
    onClose: () => void;
    onSuccess: (anio: string) => void;
}

const NewTrimestreModal: React.FC<NewTrimestreModalProps> = ({ show, onClose, onSuccess }) => {
    const [anios, setAnios] = useState<string[]>([]);
    const [selectedAnio, setSelectedAnio] = useState<string>('');
    const [customAnio, setCustomAnio] = useState<string>('');
    const [isCustomAnio, setIsCustomAnio] = useState<boolean>(false);

    const [periodos, setPeriodos] = useState<API.Periodo[]>([]);
    const [selectedPeriodo, setSelectedPeriodo] = useState<string>('');
    const [loadingPeriodos, setLoadingPeriodos] = useState<boolean>(false);
    const [periodoError, setPeriodoError] = useState<string | null>(null);

    const [estados, setEstados] = useState<API.TrimestreEstado[]>([]);
    const [selectedEstado, setSelectedEstado] = useState<string>('');

    const [fechaLimite, setFechaLimite] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [globalError, setGlobalError] = useState<string | null>(null);

    // Initial load: years and states
    useEffect(() => {
        if (show) {
            // Reset state
            setGlobalError(null);
            setSubmitting(false);
            setCustomAnio('');
            setIsCustomAnio(false);
            setSelectedPeriodo('');
            setPeriodos([]);

            // Years
            const cy = new Date().getFullYear();
            const arr = [];
            for (let i = cy - 2; i <= cy + 2; i++) arr.push(String(i));
            setAnios(arr);
            setSelectedAnio(String(cy));

            // Min date (tomorrow)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setFechaLimite(tomorrow.toISOString().split('T')[0]);

            // States
            API.fetchTrimestreEstados().then(res => {
                if (res && res.estados) {
                    setEstados(res.estados);
                    // Default to 'Recepcion de preferencias' or first
                    const def = res.estados.find(e =>
                        e.estado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("recepcion")
                    );
                    setSelectedEstado(def ? String(def.idTrimestreEstado) : String(res.estados[0]?.idTrimestreEstado || ''));
                }
            });
        }
    }, [show]);

    // When Anio changes, load periods
    useEffect(() => {
        const actualAnio = isCustomAnio ? customAnio : selectedAnio;
        if (!actualAnio || (isCustomAnio && Number(actualAnio) < 2000)) {
            setPeriodos([]);
            return;
        }

        setLoadingPeriodos(true);
        setPeriodoError(null);
        setSelectedPeriodo('');

        API.fetchPeriodosTrimestre(actualAnio).then(res => {
            if (res && res.ok && res.periodos) {
                // Filter used
                const used = (res.used || []).map(Number);
                const avail = res.periodos.filter(p => !used.includes(Number(p.idPeriodo)));
                setPeriodos(avail);
                if (avail.length === 0) setPeriodoError('Todos los periodos ocupados para este año');
                else setSelectedPeriodo(String(avail[0].idPeriodo));
            } else {
                setPeriodoError(res.error || 'No hay periodos disponibles');
                setPeriodos([]);
            }
        }).catch(() => {
            setPeriodoError('Error cargando periodos');
        }).finally(() => setLoadingPeriodos(false));
    }, [selectedAnio, customAnio, isCustomAnio]);

    const handleCreate = async () => {
        const actualAnio = isCustomAnio ? customAnio : selectedAnio;
        if (!actualAnio) { setGlobalError('El año es requerido'); return; }
        if (!selectedPeriodo) { setGlobalError('El periodo es requerido'); return; }
        if (!fechaLimite) { setGlobalError('La fecha limite es requerida'); return; }

        setSubmitting(true);
        setGlobalError(null);

        try {
            const res = await API.createTrimestre({
                anio: actualAnio,
                idPeriodo: selectedPeriodo,
                fechaLimite: fechaLimite,
                estadoId: selectedEstado
            });

            if (res.ok) {
                alert('Trimestre creado correctamente');
                onSuccess(actualAnio);
                onClose();
            } else {
                setGlobalError(res.error || 'Error al crear trimestre');
            }
        } catch (e) {
            setGlobalError('Error de red');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            show={show}
            title="Crear nuevo trimestre"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
                        {submitting ? 'Creando...' : 'Crear'}
                    </button>
                </>
            }
        >
            {globalError && <div className="alert alert-danger">{globalError}</div>}

            <FormSelect
                label="Año"
                value={isCustomAnio ? 'insertar' : selectedAnio}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'insertar') {
                        setIsCustomAnio(true);
                    } else {
                        setIsCustomAnio(false);
                        setSelectedAnio(val);
                    }
                }}
                options={[
                    ...anios.map(y => ({ value: y, label: y })),
                    { value: 'insertar', label: 'Insertar año...' }
                ]}
            />

            {isCustomAnio && (
                <FormInput
                    label=""
                    type="number"
                    placeholder="Introduce año (>= 2000)"
                    min="2000"
                    value={customAnio}
                    onChange={e => setCustomAnio(e.target.value)}
                    className="mt-2"
                />
            )}

            <FormSelect
                label="Periodo (trimestre)"
                value={selectedPeriodo}
                onChange={e => setSelectedPeriodo(e.target.value)}
                disabled={periodos.length === 0 || loadingPeriodos}
                error={periodoError || undefined}
                options={periodos.map(p => ({ value: p.idPeriodo, label: p.nombre || String(p.sigla) }))}
            >
                {loadingPeriodos ? <option>Cargando...</option> :
                    periodos.length === 0 ? <option value="">No disponible</option> : null}
            </FormSelect>

            <FormSelect
                label="Estado"
                value={selectedEstado}
                onChange={e => setSelectedEstado(e.target.value)}
                options={estados.map(st => ({ value: st.idTrimestreEstado, label: st.estado }))}
            />

            <FormInput
                label="Fecha límite"
                type="date"
                value={fechaLimite}
                onChange={e => setFechaLimite(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
            />
        </Modal>
    );
};

export default NewTrimestreModal;
