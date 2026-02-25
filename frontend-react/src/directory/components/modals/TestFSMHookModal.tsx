import React, { useState } from 'react';
import { useFSMAsignador } from '../../hooks/useFSMAsignador';
import { ResultadoAsignacion } from '../../../Code/fsm/FSMAsignador';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const TestFSMHookModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { grafoActual, inicializarDatos, intentarAsignacion } = useFSMAsignador();
    const [result, setResult] = useState<ResultadoAsignacion | null>(null);
    const [numeroEconomico, setNumeroEconomico] = useState<number>(47399);
    const [idUeaGrupo, setIdUeaGrupo] = useState<number>(1);
    const [testPaso, setTestPaso] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleInitAndTest = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const response = await fetch(`controlador/testFSMDatos.php?numeroEconomico=${numeroEconomico}&idUeaGrupo=${idUeaGrupo}`);
            const data = await response.json();

            if (!data.ok) {
                alert("Error al obtener datos: " + data.error);
                setIsLoading(false);
                return;
            }

            // 1. Inicializar con datos reales de BD
            inicializarDatos([data.profesor], [data.grupo]);

            // 2. Disparar efecto para intentar asignación en el siguiente renderizado
            setTestPaso(1);
        } catch (error) {
            alert("Error de red: " + error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (testPaso === 1) {
            const res = intentarAsignacion(numeroEconomico, idUeaGrupo);
            setResult(res);
            setTestPaso(0);
        }
    }, [testPaso, intentarAsignacion, numeroEconomico, idUeaGrupo]);

    if (!isOpen) return null;

    return (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Test FSM Asignador Hook</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        <p>Ingresa un número económico y un id de UEA Grupo y haz clic para inicializar un Profesor Mock y un Grupo Mock e intentar la asignación.</p>

                        <div className="mb-3">
                            <label className="form-label">Número Económico</label>
                            <input
                                type="number"
                                className="form-control"
                                value={numeroEconomico}
                                onChange={(e) => setNumeroEconomico(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">ID UEA Grupo</label>
                            <input
                                type="number"
                                className="form-control"
                                value={idUeaGrupo}
                                onChange={(e) => setIdUeaGrupo(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={handleInitAndTest} disabled={isLoading}>
                            {isLoading ? 'Cargando...' : 'Ejecutar Test'}
                        </button>

                        {result && (
                            <div className="mt-3">
                                <h6>Resultado de la asignación:</h6>
                                <pre className="bg-light p-2 border rounded">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}

                        <div className="mt-3">
                            <h6>Estado Interno del Grafo:</h6>
                            <p>Grupos Registrados: {grafoActual['grupos']?.size || 0}</p>
                            <p>Profesores Registrados: {grafoActual['profesores']?.size || 0}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
