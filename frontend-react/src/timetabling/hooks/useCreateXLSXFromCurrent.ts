import { useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { FranjaHorariaDTO, GrupoDTO } from '@solution/types/AssignmentTypes';
import type { KdeRawInputs, KdeWorkerConfig } from '../engine/kde/graspKdeTypes';
import type { IterativeRunState } from '../engine/kde/runKdeGraspIterative';
import {
    buildSaveAssignationSolutionPayload,
    type SaveAssignationSolutionPayload,
} from './useSaveAssignationSolution';

export const CREATE_XLSX_FROM_CURRENT_EVENT = 'timetabling:create-xlsx-from-current';

export const CURRENT_XLSX_HEADERS = [
    'U.E.A.',
    '',
    'CUPO',
    'Grupo',
    'LUNES',
    'LUNES_F',
    '',
    'MARTES',
    'MARTES_F',
    '',
    'MIERCOLES',
    'MIERCOLES_F',
    'JUEVES',
    'JUEVES_F',
    'VIERNES',
    'VIERNES_F',
    '',
    'NO. ECO.',
    'PROFESOR PROPUESTO',
] as const;

type DayKey = 'L' | 'M' | 'MI' | 'J' | 'V';
type CurrentXlsxCell = string | number | null;

interface DayRange {
    inicio: string;
    fin: string;
}

interface UseCreateXLSXFromCurrentOptions {
    state: IterativeRunState | null;
    config: KdeWorkerConfig;
    rawInputs: KdeRawInputs;
    completedEcos: Set<number>;
    /** Catálogo CRUDO del workspace (ids estables). Se propaga al snapshot del runner. */
    gruposCatalogo?: GrupoDTO[];
}

type ProgramacionRow = {
    grupo?: string | number;
    cupo?: unknown;
    CUPO?: unknown;
    capacidad?: unknown;
};

export function requestCreateXLSXFromCurrent() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(CREATE_XLSX_FROM_CURRENT_EVENT));
}

export function useCreateXLSXFromCurrent({ state, config, rawInputs, completedEcos, gruposCatalogo }: UseCreateXLSXFromCurrentOptions) {
    const createXlsx = useCallback(() => {
        if (!state) return;
        const payload = buildSaveAssignationSolutionPayload(state, config, rawInputs, completedEcos, gruposCatalogo);
        const { workbook } = buildCurrentXlsxWorkbook([payload]);
        downloadWorkbook(`solucion_asignacion_pase${state.pass}.xlsx`, workbook);
    }, [state, config, rawInputs, completedEcos, gruposCatalogo]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onRequest = () => createXlsx();
        window.addEventListener(CREATE_XLSX_FROM_CURRENT_EVENT, onRequest);
        return () => window.removeEventListener(CREATE_XLSX_FROM_CURRENT_EVENT, onRequest);
    }, [createXlsx]);

    return createXlsx;
}

export function buildCurrentXlsxWorkbook(
    input: SaveAssignationSolutionPayload | SaveAssignationSolutionPayload[],
): { workbook: XLSX.WorkBook; rowCount: number } {
    const rows = buildCurrentXlsxRows(input);
    const worksheet = XLSX.utils.aoa_to_sheet<CurrentXlsxCell>([
        [...CURRENT_XLSX_HEADERS],
        ...rows,
    ]);

    worksheet['!cols'] = [
        { wch: 12 },
        { wch: 42 },
        { wch: 8 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 4 },
        { wch: 10 },
        { wch: 10 },
        { wch: 4 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 4 },
        { wch: 12 },
        { wch: 34 },
    ];
    worksheet['!views'] = [{ state: 'frozen', ySplit: 1 }];
    worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: CURRENT_XLSX_HEADERS.length - 1 } }),
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja 1');
    return { workbook, rowCount: rows.length };
}

export function buildCurrentXlsxRows(
    input: SaveAssignationSolutionPayload | SaveAssignationSolutionPayload[],
): CurrentXlsxCell[][] {
    const payloads = Array.isArray(input) ? input : [input];
    return payloads.flatMap(payload => rowsFromPayload(payload));
}

function rowsFromPayload(payload: SaveAssignationSolutionPayload): CurrentXlsxCell[][] {
    const xlsData = payload.GRASPSolutionToXLS;
    const gruposById = new Map(xlsData.grupos.map(grupo => [grupo.idUeaGrupo, grupo]));

    return xlsData.asignaciones
        .map(asignacion => {
            const grupo = gruposById.get(asignacion.idUeaGrupo);
            if (!grupo) return null;
            const dias = buildDayRanges(grupo);
            return [
                grupo.ueaClave,
                getUeaNombre(payload, grupo.ueaClave),
                getCupo(payload, grupo),
                grupo.claveGrupo,
                dias.L?.inicio ?? '',
                dias.L?.fin ?? '',
                '',
                dias.M?.inicio ?? '',
                dias.M?.fin ?? '',
                '',
                dias.MI?.inicio ?? '',
                dias.MI?.fin ?? '',
                dias.J?.inicio ?? '',
                dias.J?.fin ?? '',
                dias.V?.inicio ?? '',
                dias.V?.fin ?? '',
                '',
                asignacion.numeroEconomico,
                xlsData.ecoNombre[String(asignacion.numeroEconomico)] ?? '',
            ];
        })
        .filter((row): row is CurrentXlsxCell[] => Boolean(row));
}

function getUeaNombre(payload: SaveAssignationSolutionPayload, ueaClave: number): string {
    const claveUea = payload.GRASPSolutionToXLS.claveUea ?? payload.snapshot.inputs.claveUea;
    return claveUea?.[String(ueaClave)] ?? '';
}

function getCupo(payload: SaveAssignationSolutionPayload, grupo: GrupoDTO): CurrentXlsxCell {
    const programacion = payload.GRASPSolutionToXLS.programacionVacia ?? payload.snapshot.inputs.programacionVacia;
    const rows = programacion[String(grupo.ueaClave)] as ProgramacionRow[] | undefined;
    const source = rows?.find(row => String(row.grupo) === String(grupo.claveGrupo));
    return normalizeCell(source?.cupo ?? source?.CUPO ?? source?.capacidad);
}

function normalizeCell(value: unknown): CurrentXlsxCell {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value).trim();
    if (!text) return '';
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : text;
}

function buildDayRanges(grupo: GrupoDTO): Partial<Record<DayKey, DayRange>> {
    const dias: Partial<Record<DayKey, DayRange>> = {};

    for (const franja of grupo.horarios ?? []) {
        const key = dayFromNumber(franja.dia);
        if (key) dias[key] = rangeFromFranja(franja);
    }

    if (!grupo.horarioStringRaw) return dias;
    for (const section of grupo.horarioStringRaw.split('|')) {
        const splitIdx = section.indexOf(':');
        if (splitIdx === -1) continue;
        const day = normalizeDay(section.substring(0, splitIdx));
        if (!day) continue;
        const [inicio, fin] = section.substring(splitIdx + 1).split('-');
        dias[day] = {
            inicio: normalizeTime(inicio),
            fin: normalizeTime(fin),
        };
    }

    return dias;
}

function rangeFromFranja(franja: FranjaHorariaDTO): DayRange {
    return {
        inicio: formatDecimalTime(franja.horaInicio),
        fin: formatDecimalTime(franja.horaFin),
    };
}

function dayFromNumber(value: number): DayKey | null {
    if (value === 1) return 'L';
    if (value === 2) return 'M';
    if (value === 3) return 'MI';
    if (value === 4) return 'J';
    if (value === 5) return 'V';
    return null;
}

function normalizeDay(value: string): DayKey | null {
    const key = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
    if (key === 'L' || key.startsWith('LU')) return 'L';
    if (key === 'MI' || key.startsWith('MIE') || key === 'X') return 'MI';
    if (key === 'M' || key.startsWith('MA') || key.startsWith('MAR')) return 'M';
    if (key === 'J' || key.startsWith('JU')) return 'J';
    if (key === 'V' || key.startsWith('VI')) return 'V';
    return null;
}

function normalizeTime(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) return formatDecimalTime(value);
    const text = String(value ?? '').trim();
    if (!text) return '';
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return formatDecimalTime(numeric);
    const [hour, minute] = text.split(':');
    if (hour !== undefined && minute !== undefined) {
        return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    return text;
}

function formatDecimalTime(value: number): string {
    const hour = Math.floor(value);
    const minutes = Math.round((value - hour) * 60);
    return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function downloadWorkbook(filename: string, workbook: XLSX.WorkBook) {
    const raw = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([raw], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}
