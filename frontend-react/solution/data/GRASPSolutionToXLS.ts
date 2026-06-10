import * as XLSX from 'xlsx';
import { GrupoDTO } from '../types/AssignmentTypes';
import { AsignacionInput } from '../greedy/GreedyTypes';

export interface XLSIssuesReport {
    archivo_resoluciones: string;
    filas_generadas: number;
    sin_eco_elegido: number[];
    sin_grupo_en_programacion_vacia: number[];
}

export interface XLSBuildResult {
    workbook: XLSX.WorkBook;
    issuesReport: XLSIssuesReport;
    rowCount: number;
}

/**
 * Construye la planilla XLSX y el reporte de incidencias sin tocar disco.
 * Compatible con browser; el wrapper Node vive en GRASPSolutionToXLSIO.
 */
export class GRASPSolutionToXLS {
    private static dayToColumns: Record<string, string[]> = {
        'L': ['L_I', 'L_F'],
        'M': ['M_I', 'M_F'],
        'Mi': ['Mi_I', 'Mi_F'],
        'J': ['J_I', 'J_F'],
        'V': ['V_I', 'V_F'],
    };

    private static canonicalDayOrder = ['L', 'M', 'Mi', 'J', 'V'];

    static buildWorkbook(
        asignaciones: AsignacionInput[],
        grupos: GrupoDTO[],
        ecoNombre: Record<string, string>
    ): XLSBuildResult {
        const rows: any[] = [];

        for (const asig of asignaciones) {
            const grupoInfo = grupos.find(g => g.idUeaGrupo === asig.idUeaGrupo);
            if (!grupoInfo) continue;

            const row: any = {
                'ECO': String(asig.numeroEconomico),
                'NOMBRE': ecoNombre[asig.numeroEconomico] || '',
                'UEA': String(grupoInfo.ueaClave),
                'GRUPO': String(grupoInfo.claveGrupo),
            };

            const horarioCols = this.parseHorarioToColumns(grupoInfo.horarioStringRaw);
            Object.assign(row, horarioCols);
            rows.push(row);
        }

        const worksheet = XLSX.utils.json_to_sheet(rows, {
            header: ['ECO', 'NOMBRE', 'UEA', 'GRUPO', 'L_I', 'L_F', 'M_I', 'M_F', 'Mi_I', 'Mi_F', 'J_I', 'J_F', 'V_I', 'V_F']
        });

        worksheet['!cols'] = [
            { wch: 10 }, { wch: 35 }, { wch: 10 }, { wch: 10 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
            { wch: 8 }, { wch: 8 }
        ];
        worksheet['!views'] = [{ state: 'frozen', ySplit: 1 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja 1');

        const issuesReport: XLSIssuesReport = {
            archivo_resoluciones: 'Resultado interno GRASP',
            filas_generadas: rows.length,
            sin_eco_elegido: [],
            sin_grupo_en_programacion_vacia: [],
        };

        return { workbook, issuesReport, rowCount: rows.length };
    }

    /**
     * Versión browser: devuelve los bytes del XLSX listos para Blob.
     */
    static toUint8Array(
        asignaciones: AsignacionInput[],
        grupos: GrupoDTO[],
        ecoNombre: Record<string, string>
    ): { xlsx: Uint8Array; issuesReport: XLSIssuesReport } {
        const { workbook, issuesReport } = this.buildWorkbook(asignaciones, grupos, ecoNombre);
        const raw = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        return { xlsx: new Uint8Array(raw), issuesReport };
    }

    private static normalizeText(value: any): string | null {
        if (value === null || value === undefined) return null;
        const text = String(value).trim();
        return text || null;
    }

    private static normalizeTime(value: any): string | null {
        const text = this.normalizeText(value);
        if (!text) return null;
        const parts = text.split(':');
        if (parts.length >= 2) {
            return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        return text;
    }

    private static canonicalizeHorario(horario: any): string | null {
        const text = this.normalizeText(horario);
        if (!text) return null;

        const rangesByDay: Record<string, [string | null, string | null]> = {};
        const sections = text.split('|');
        for (let section of sections) {
            section = section.trim();
            if (!section) continue;
            const splitIdx = section.indexOf(':');
            if (splitIdx === -1) continue;
            const dayCode = section.substring(0, splitIdx).trim();
            const intervalText = section.substring(splitIdx + 1).trim();
            const [startText, endText] = intervalText.split('-');
            rangesByDay[dayCode] = [
                this.normalizeTime(startText),
                this.normalizeTime(endText),
            ];
        }

        const canonicalSections: string[] = [];
        for (const dayCode of this.canonicalDayOrder) {
            if (rangesByDay[dayCode]) {
                const [startText, endText] = rangesByDay[dayCode];
                canonicalSections.push(`${dayCode}:${startText}-${endText}`);
            }
        }

        return canonicalSections.length > 0 ? canonicalSections.join('|') : null;
    }

    private static parseHorarioToColumns(horario: string | null): Record<string, string | null> {
        const row: Record<string, string | null> = {};
        for (const pair of Object.values(this.dayToColumns)) {
            row[pair[0]] = null;
            row[pair[1]] = null;
        }

        if (!horario) return row;
        const canonical = this.canonicalizeHorario(horario);
        if (!canonical) return row;

        for (const section of canonical.split('|')) {
            const splitIdx = section.indexOf(':');
            const dayCode = section.substring(0, splitIdx).trim();
            const intervalText = section.substring(splitIdx + 1).trim();
            const [startText, endText] = intervalText.split('-');
            if (this.dayToColumns[dayCode]) {
                const [startColumn, endColumn] = this.dayToColumns[dayCode];
                row[startColumn] = startText;
                row[endColumn] = endText;
            }
        }

        return row;
    }
}
