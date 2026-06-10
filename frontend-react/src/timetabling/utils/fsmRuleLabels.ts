/*
 * fsmRuleLabels.ts — etiquetas legibles para los códigos de regla del FSM.
 *
 * Mapea los `nombreRegla` que emite el FSM de asignación (definidos en
 * `solution/rules/ReglasImplementacion.ts` y `solution/fsm/FSMAsignador.ts`) a
 * etiquetas cortas en español, pensadas para la columna FSM del modal "Asignar UEA".
 *
 * Módulo puro: sin React ni dependencias.
 *
 * Nota: las etiquetas "Traslape de horario" (REGLA_TRASLAPE_UEA) y "Fuera de horario
 * laboral" (REGLA_HORARIO_LABORAL) son redacciones intencionales solicitadas por el
 * usuario; no deben reescribirse.
 */

export const RULE_LABELS: Record<string, string> = {
    REGLA_TRASLAPE_UEA: 'Traslape de horario',
    REGLA_HORARIO_LABORAL: 'Fuera de horario laboral',
    REGLA_AREA: 'Área no corresponde',
    REGLA_AREAS_VISTAS: 'Área nunca impartida',
    REGLA_MAXIMO_HORAS_DIARIAS: 'Excede horas del día',
    REGLA_GRUPO_TIENE_PROGRAMACION: 'Grupo sin horario',
    REGLA_ASIGNACION_GLOBAL: 'Grupo ya asignado',
    REGLA_IGNORAR_GRUPOS: 'Grupo excluido (SAI/CPRO)',
    REGLA_PROFESOR_VIGENTE: 'Profesor no vigente',
    INTEGRIDAD_GRAFO: 'Datos incompletos',
    FATAL_MUTACION: 'Error interno'
};

/**
 * Devuelve la etiqueta legible para un código de regla del FSM.
 *
 * - Si el código existe en `RULE_LABELS`, devuelve su etiqueta.
 * - Si el código es falsy (undefined/null/''), devuelve "No viable".
 * - Si el código es desconocido, devuelve el código tal cual (nada se pierde).
 */
export function ruleLabel(code: string | undefined | null): string {
    if (!code) {
        return 'No viable';
    }

    return RULE_LABELS[code] ?? code;
}
