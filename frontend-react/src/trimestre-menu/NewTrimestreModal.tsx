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
    const [formData, setFormData] = useState({
        selectedAnio: '',
        customAnio: '',
        isCustomAnio: false,
        selectedPeriodo: '',
        selectedEstado: '',
        fechaLimite: ''
    });

    const [options, setOptions] = useState({
        anios: [] as string[],
        periodos: [] as API.Periodo[],
        estados: [] as API.TrimestreEstado[]
    });

    const [status, setStatus] = useState<{
        loadingPeriodos: boolean;
        submitting: boolean;
        periodoError: string | null;
        globalError: string | null;
    }>({
        loadingPeriodos: false,
        submitting: false,
        periodoError: null,
        globalError: null
    });

    // Initial load: years and states
    useEffect(() => {
        if (show) {
            const cy = new Date().getFullYear();
            const aniosArr: string[] = [];
            for (let i = cy - 2; i <= cy + 2; i++) aniosArr.push(String(i));

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            setStatus(prev => ({ ...prev, globalError: null, submitting: false }));
            setFormData(prev => ({
                ...prev,
                selectedAnio: String(cy),
                customAnio: '',
                isCustomAnio: false,
                selectedPeriodo: '',
                fechaLimite: tomorrow.toISOString().split('T')[0]
            }));

            // Only clear periodos, keep existing estados if possible or reload
            setOptions(prev => ({ ...prev, anios: aniosArr, periodos: [] }));

            API.fetchTrimestreEstados().then(res => {
                if (res && res.estados) {
                    const def = res.estados.find(e =>
                        e.estado.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("recepcion")
                    );
                    setOptions(prev => ({ ...prev, estados: res.estados || [] }));
                    setFormData(prev => ({
                        ...prev,
                        selectedEstado: def ? String(def.idTrimestreEstado) : String(res.estados?.[0]?.idTrimestreEstado || '')
                    }));
                }
            });
        }
    }, [show]);

    // When Anio changes, load periods
    useEffect(() => {
        const { isCustomAnio, customAnio, selectedAnio } = formData;
        const actualAnio = isCustomAnio ? customAnio : selectedAnio;

        if (!actualAnio || (isCustomAnio && Number(actualAnio) < 2000)) {
            setOptions(prev => ({ ...prev, periodos: [] }));
            return;
        }

        setStatus(prev => ({ ...prev, loadingPeriodos: true, periodoError: null }));
        setFormData(prev => ({ ...prev, selectedPeriodo: '' }));

        API.fetchPeriodosTrimestre(actualAnio).then(res => {
            if (res && res.ok && res.periodos) {
                const used = (res.used || []).map(Number);
                const avail = res.periodos.filter(p => !used.includes(Number(p.idPeriodo)));
                setOptions(prev => ({ ...prev, periodos: avail }));

                if (avail.length === 0) setStatus(prev => ({ ...prev, periodoError: 'Todos los periodos ocupados para este año' }));
                else setFormData(prev => ({ ...prev, selectedPeriodo: String(avail[0].idPeriodo) }));
            } else {
                setStatus(prev => ({ ...prev, periodoError: res.error || 'No hay periodos disponibles' }));
                setOptions(prev => ({ ...prev, periodos: [] }));
            }
        }).catch(() => {
            setStatus(prev => ({ ...prev, periodoError: 'Error cargando periodos' }));
        }).finally(() => {
            setStatus(prev => ({ ...prev, loadingPeriodos: false }));
        });
    }, [formData.selectedAnio, formData.customAnio, formData.isCustomAnio]);

    const handleCreate = async () => {
        const { isCustomAnio, customAnio, selectedAnio, selectedPeriodo, selectedEstado, fechaLimite } = formData;
        const actualAnio = isCustomAnio ? customAnio : selectedAnio;

        if (!actualAnio) { setStatus(prev => ({ ...prev, globalError: 'El año es requerido' })); return; }
        if (!selectedPeriodo) { setStatus(prev => ({ ...prev, globalError: 'El periodo es requerido' })); return; }
        if (!fechaLimite) { setStatus(prev => ({ ...prev, globalError: 'La fecha limite es requerida' })); return; }

        setStatus(prev => ({ ...prev, submitting: true, globalError: null }));

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
                setStatus(prev => ({ ...prev, globalError: res.error || 'Error al crear trimestre' }));
            }
        } catch (e) {
            setStatus(prev => ({ ...prev, globalError: 'Error de red' }));
        } finally {
            setStatus(prev => ({ ...prev, submitting: false }));
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
                    <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={status.submitting}>
                        {status.submitting ? 'Creando...' : 'Crear'}
                    </button>
                </>
            }
        >
            {status.globalError && <div className="alert alert-danger">{status.globalError}</div>}

            <FormSelect
                label="Año"
                value={formData.isCustomAnio ? 'insertar' : formData.selectedAnio}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'insertar') {
                        setFormData(prev => ({ ...prev, isCustomAnio: true }));
                    } else {
                        setFormData(prev => ({ ...prev, isCustomAnio: false, selectedAnio: val }));
                    }
                }}
                options={[
                    ...options.anios.map(y => ({ value: y, label: y })),
                    { value: 'insertar', label: 'Insertar año...' }
                ]}
            />

            {formData.isCustomAnio && (
                <FormInput
                    label=""
                    type="number"
                    placeholder="Introduce año (>= 2000)"
                    min="2000"
                    value={formData.customAnio}
                    onChange={e => setFormData(prev => ({ ...prev, customAnio: e.target.value }))}
                    className="mt-2"
                />
            )}

            <FormSelect
                label="Periodo (trimestre)"
                value={formData.selectedPeriodo}
                onChange={e => setFormData(prev => ({ ...prev, selectedPeriodo: e.target.value }))}
                disabled={options.periodos.length === 0 || status.loadingPeriodos}
                error={status.periodoError || undefined}
                options={options.periodos.map(p => ({ value: p.idPeriodo, label: p.nombre || String(p.sigla) }))}
            >
                {status.loadingPeriodos ? <option>Cargando...</option> :
                    options.periodos.length === 0 ? <option value="">No disponible</option> : null}
            </FormSelect>

            <FormSelect
                label="Estado"
                value={formData.selectedEstado}
                onChange={e => setFormData(prev => ({ ...prev, selectedEstado: e.target.value }))}
                options={options.estados.map(st => ({ value: st.idTrimestreEstado, label: st.estado }))}
            />

            <FormInput
                label="Fecha límite"
                type="date"
                value={formData.fechaLimite}
                onChange={e => setFormData(prev => ({ ...prev, fechaLimite: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
            />
        </Modal>
    );
};

export default NewTrimestreModal;
