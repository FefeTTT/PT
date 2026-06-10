import { useMemo, useState } from 'react';
import type { CandidateRow } from '../engine/kde/candidateRow';
import { EcoUeasScheduleTable } from './EcoUeasScheduleTable';
import { useBackendConfig } from '../hooks/useBackendConfig';

export interface CandidatoSolucionModalProps {
    eco: number;
    ecoNombre?: Record<string, string>;
    ueas: CandidateRow[];
    /** Cambia tras reentrenar joblibs KDE; se usa como cache-bust de las graficas. */
    chartsVersion?: number;
    onClose: () => void;
}

type TipoGrafica = 'ih' | 'ij' | 'horario_unificado' | 'horario_inferido';

const GRAFICAS: ReadonlyArray<{ tipo: TipoGrafica; titulo: string }> = [
    { tipo: 'ih',                titulo: 'KDE IH' },
    { tipo: 'ij',                titulo: 'KDE IJ' },
    { tipo: 'horario_unificado', titulo: 'Horario unificado' },
    { tipo: 'horario_inferido',  titulo: 'Horario inferido' },
];

// Version del RENDERIZADO de graficas (cliente). Subela cuando cambie la logica de
// las graficas en el backend (p.ej. repuntar ih/inferido al unificado): invalida el
// PNG cacheado por el navegador aunque la URL/joblib no cambien.
const CHART_VERSION = 2;

export function CandidatoSolucionModal({ eco, ecoNombre, ueas, chartsVersion, onClose }: CandidatoSolucionModalProps) {
    const { baseUrl } = useBackendConfig();
    const [errores, setErrores] = useState<Record<TipoGrafica, boolean>>({
        ih:                false,
        ij:                false,
        horario_unificado: false,
        horario_inferido:  false,
    });
    const [ampliada, setAmpliada] = useState<TipoGrafica | null>(null);

    const fuentes = useMemo(() => {
        const map: Record<TipoGrafica, string> = {} as Record<TipoGrafica, string>;
        // `cv` invalida el cache ante cambios de logica de graficas; `v` (chartsVersion)
        // fuerza el refetch tras reentrenar el joblib. El backend ahora sirve `no-cache`,
        // asi que el navegador revalida por ETag en cada apertura del modal.
        const bust = `&cv=${CHART_VERSION}${chartsVersion ? `&v=${chartsVersion}` : ''}`;
        for (const g of GRAFICAS) {
            map[g.tipo] = `${baseUrl}/charts/kde/${eco}?tipo=${g.tipo}${bust}`;
        }
        return map;
    }, [baseUrl, eco, chartsVersion]);

    const marcarError = (tipo: TipoGrafica) => {
        setErrores(prev => (prev[tipo] ? prev : { ...prev, [tipo]: true }));
    };

    return (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: '#f8f4ea', borderRadius: 8, padding: 20,
                    width: '90%', maxWidth: 1200, maxHeight: '90vh', overflowY: 'auto',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, color: '#182023' }}>
                        Eco {eco}{ecoNombre?.[String(eco)] ? ` - ${ecoNombre[String(eco)]}` : ''}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#8f2d2d', color: '#fff7ed', border: 'none', borderRadius: 4,
                            padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold',
                        }}
                    >
                        Cerrar
                    </button>
                </div>

                <EcoUeasScheduleTable ueas={ueas} />

                <h4 style={{ color: '#182023', marginTop: 24, marginBottom: 12 }}>Gráficas KDE</h4>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: 16,
                    }}
                >
                    {GRAFICAS.map(({ tipo, titulo }) => (
                        <figure
                            key={tipo}
                            style={{
                                margin: 0, padding: 12, backgroundColor: '#fff7ed',
                                border: '1px solid #d8cdb5', borderRadius: 6,
                            }}
                        >
                            <figcaption style={{ fontWeight: 600, marginBottom: 6, color: '#182023' }}>
                                {titulo}
                            </figcaption>
                            {errores[tipo] ? (
                                <div
                                    style={{
                                        color: '#8f2d2d', fontStyle: 'italic',
                                        padding: '40px 0', textAlign: 'center',
                                    }}
                                >
                                    No disponible
                                </div>
                            ) : (
                                <img
                                    src={fuentes[tipo]}
                                    alt={`${titulo} para Eco ${eco}`}
                                    loading="lazy"
                                    onError={() => marcarError(tipo)}
                                    onClick={() => setAmpliada(tipo)}
                                    style={{ width: '100%', height: 'auto', display: 'block', cursor: 'zoom-in' }}
                                />
                            )}
                        </figure>
                    ))}
                </div>
            </div>

            {ampliada && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                    }}
                    onClick={e => { e.stopPropagation(); setAmpliada(null); }}
                >
                    <button
                        onClick={e => { e.stopPropagation(); setAmpliada(null); }}
                        aria-label="Cerrar"
                        style={{
                            position: 'absolute', top: 16, right: 24,
                            background: 'transparent', color: '#fff', border: 'none',
                            fontSize: 36, lineHeight: 1, cursor: 'pointer', fontWeight: 'bold',
                        }}
                    >
                        &times;
                    </button>
                    <img
                        src={fuentes[ampliada]}
                        alt={`${GRAFICAS.find(g => g.tipo === ampliada)?.titulo} para Eco ${eco}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain',
                            backgroundColor: '#fff', borderRadius: 4,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        }}
                    />
                </div>
            )}
        </div>
    );
}
