import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FranjaHorariaDTO, GrupoDTO, ProfesorDTO } from '@solution/types/AssignmentTypes';
import { parseHorarioString } from '../utils/schedule';

export interface RuleViolationInfoProps {
    /** Código de la regla que falló, p. ej. "REGLA_TRASLAPE_UEA". */
    rule: string | undefined;
    /** Etiqueta natural ya traducida (la provee el llamador); úsala como título de la tarjeta. */
    titulo: string;
    /** Texto crudo de respaldo emitido por la FSM (fallback cuando no hay detalle específico). */
    motivo?: string;
    /** El grupo-UEA candidato que se intenta asignar (tiene .horarios y .horarioStringRaw). */
    candidato: GrupoDTO;
    /** Profesor del eco (para REGLA_HORARIO_LABORAL). Puede faltar. */
    profesorEco?: ProfesorDTO;
    /** Asignaciones ACTUALES del eco en la solución (para REGLA_TRASLAPE_UEA). */
    ecoAsignados: { uea: number; claveGrupo: string; horarioStringRaw: string }[];
}

/** Dos franjas se traslapan si caen el mismo día y sus rangos horarios se cruzan. */
function franjasSeTraslapan(a: FranjaHorariaDTO, b: FranjaHorariaDTO): boolean {
    return a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
}

const cardBaseStyle: React.CSSProperties = {
    minWidth: 240,
    maxWidth: 340,
    padding: 10,
    background: 'var(--tt-panel2)',
    border: '1px solid var(--tt-line)',
    borderRadius: 'var(--tt-radius-sm)',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
    color: 'var(--tt-ink)',
    fontSize: 12,
    fontWeight: 400,
    textAlign: 'left',
    whiteSpace: 'normal',
    lineHeight: 1.45,
};

const headerStyle: React.CSSProperties = {
    fontWeight: 700,
    marginBottom: 6,
    color: 'var(--tt-ink)',
};

const labelStyle: React.CSSProperties = {
    color: 'var(--tt-sub)',
    marginTop: 6,
    marginBottom: 2,
};

const monoLineStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    color: 'var(--tt-ink)',
};

const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginLeft: 4,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--tt-sub)',
    verticalAlign: 'middle',
    lineHeight: 0,
};

/** Cuerpo de la tarjeta para REGLA_TRASLAPE_UEA. */
function TraslapeBody(props: {
    candidato: GrupoDTO;
    ecoAsignados: RuleViolationInfoProps['ecoAsignados'];
    motivo?: string;
}) {
    const { candidato, ecoAsignados, motivo } = props;

    const enConflicto = ecoAsignados.filter((asignado) => {
        const franjasAsignado = parseHorarioString(asignado.horarioStringRaw);
        return franjasAsignado.some((fa) =>
            candidato.horarios.some((fc) => franjasSeTraslapan(fa, fc)),
        );
    });

    if (enConflicto.length === 0) {
        return <div>{motivo ?? 'Hay un traslape de horario.'}</div>;
    }

    return (
        <div>
            <div>Se traslapa con estas asignaciones del profesor:</div>
            {enConflicto.map((asignado) => (
                <div key={`${asignado.uea}-${asignado.claveGrupo}`} style={monoLineStyle}>
                    {`UEA ${asignado.uea} · ${asignado.claveGrupo} — ${asignado.horarioStringRaw}`}
                </div>
            ))}
            <div style={labelStyle}>Horario de la clase candidata:</div>
            <div style={monoLineStyle}>{candidato.horarioStringRaw || 'Sin horario'}</div>
        </div>
    );
}

/** Cuerpo de la tarjeta para REGLA_HORARIO_LABORAL. */
function HorarioLaboralBody(props: { candidato: GrupoDTO; profesorEco?: ProfesorDTO }) {
    const { candidato, profesorEco } = props;
    const bloques = profesorEco?.horariosContratacion ?? [];

    return (
        <div>
            <div style={labelStyle}>Horario de contratación del profesor:</div>
            {bloques.length === 0 ? (
                <div>Sin horario de contratación registrado.</div>
            ) : (
                bloques.map((bloque, index) => {
                    if (bloque.idDiasDeTrabajo === 'FLEX_TOTAL') {
                        return (
                            <div key={index} style={monoLineStyle}>
                                **  · totalmente flexible
                            </div>
                        );
                    }
                    if (bloque.idDiasDeTrabajo === 'FLEX_PARCIAL') {
                        return (
                            <div key={index} style={monoLineStyle}>
                                *  · parcialmente flexible
                            </div>
                        );
                    }
                    const inicio = bloque.horaInicio.slice(0, 5);
                    const fin = bloque.horaFin.slice(0, 5);
                    return (
                        <div key={index} style={monoLineStyle}>
                            {`${bloque.idDiasDeTrabajo}  ${inicio}–${fin}`}
                        </div>
                    );
                })
            )}
            <div style={labelStyle}>La clase pide:</div>
            <div style={monoLineStyle}>{candidato.horarioStringRaw || 'Sin horario'}</div>
        </div>
    );
}

/** Frases breves por regla para el resto de los casos. */
const GENERIC_ONE_LINERS: Record<string, string> = {
    REGLA_AREA: 'El área de esta UEA no está entre las áreas del profesor.',
    REGLA_AREAS_VISTAS: 'El área de esta UEA no está entre las áreas del profesor.',
    REGLA_MAXIMO_HORAS_DIARIAS:
        'Asignarla superaría el máximo de horas que el profesor puede dar en un día.',
    REGLA_ASIGNACION_GLOBAL: 'Este grupo ya fue asignado a otro profesor.',
    REGLA_GRUPO_TIENE_PROGRAMACION: 'El grupo no tiene horarios programados.',
    REGLA_IGNORAR_GRUPOS: 'Grupo tipo SAI/CPRO: excluido del pase.',
    REGLA_PROFESOR_VIGENTE: 'El profesor no figura como vigente en los catálogos.',
};

/** Cuerpo genérico: frase breve (si existe) más el motivo de respaldo. */
function GenericBody(props: { rule: string | undefined; motivo?: string }) {
    const { rule, motivo } = props;
    const oneLiner = rule ? GENERIC_ONE_LINERS[rule] : undefined;

    return (
        <div>
            {oneLiner ? <div>{oneLiner}</div> : null}
            {motivo ? (
                <div style={{ ...labelStyle, marginTop: oneLiner ? 6 : 0, color: 'var(--tt-sub)' }}>
                    {motivo}
                </div>
            ) : null}
            {!oneLiner && !motivo ? <div>Esta regla no permitió la asignación.</div> : null}
        </div>
    );
}

function CardBody(props: RuleViolationInfoProps) {
    const { rule, motivo, candidato, profesorEco, ecoAsignados } = props;

    if (rule === 'REGLA_TRASLAPE_UEA') {
        return <TraslapeBody candidato={candidato} ecoAsignados={ecoAsignados} motivo={motivo} />;
    }
    if (rule === 'REGLA_HORARIO_LABORAL') {
        return <HorarioLaboralBody candidato={candidato} profesorEco={profesorEco} />;
    }
    return <GenericBody rule={rule} motivo={motivo} />;
}

export function RuleViolationInfo(props: RuleViolationInfoProps) {
    const { titulo } = props;
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const wrapperRef = useRef<HTMLSpanElement | null>(null);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const recalcular = () => {
            const r = btnRef.current?.getBoundingClientRect();
            if (!r) return;
            // Debajo del icono, alineado a su borde derecho; el ancho de la tarjeta es ~ minWidth..maxWidth.
            setCoords({ top: r.bottom + 4, left: r.right });
        };

        recalcular();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (wrapperRef.current?.contains(target)) return;
            if (cardRef.current?.contains(target)) return;
            setOpen(false);
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('scroll', recalcular, true);
        window.addEventListener('resize', recalcular);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', recalcular, true);
            window.removeEventListener('resize', recalcular);
        };
    }, [open]);

    const cardFixedStyle: React.CSSProperties = coords
        ? {
              ...cardBaseStyle,
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: 'translateX(-100%)',
              zIndex: 10010,
          }
        : cardBaseStyle;

    return (
        <span ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                ref={btnRef}
                type="button"
                aria-label="Ver detalle de la regla"
                aria-expanded={open}
                style={buttonStyle}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((prev) => !prev);
                }}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                >
                    <circle cx="8" cy="8" r="6.5" />
                    <line x1="8" y1="7" x2="8" y2="11.5" />
                    <circle cx="8" cy="4.75" r="0.85" fill="currentColor" stroke="none" />
                </svg>
            </button>

            {open && coords
                ? createPortal(
                      <div
                          ref={cardRef}
                          role="note"
                          style={cardFixedStyle}
                          onClick={(event) => event.stopPropagation()}
                      >
                          <div style={headerStyle}>{titulo}</div>
                          <CardBody {...props} />
                      </div>,
                      document.body,
                  )
                : null}
        </span>
    );
}
