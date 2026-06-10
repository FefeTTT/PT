import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { GrupoDTO } from '../types/AssignmentTypes';
import { AsignacionInput } from '../greedy/GreedyTypes';
import { GRASPSolutionToXLS } from './GRASPSolutionToXLS';

/**
 * Wrapper Node que escribe a disco con fallback ante archivos bloqueados (EBUSY).
 */
export class GRASPSolutionToXLSIO {
    static export(
        asignaciones: AsignacionInput[],
        grupos: GrupoDTO[],
        ecoNombre: Record<string, string>,
        xlsxPath: string,
        issuesPath: string
    ): void {
        const { workbook, issuesReport } = GRASPSolutionToXLS.buildWorkbook(asignaciones, grupos, ecoNombre);

        let finalXlsxPath = xlsxPath;
        let suffix = '';
        try {
            XLSX.writeFile(workbook, xlsxPath);
        } catch (error: any) {
            if (error.code === 'EBUSY') {
                const parsed = path.parse(xlsxPath);
                let counter = 1;
                while (counter <= 100) {
                    const fallbackPath = path.join(parsed.dir, `${parsed.name}_${counter}${parsed.ext}`);
                    try {
                        XLSX.writeFile(workbook, fallbackPath);
                        console.warn(`\n[WARNING] El archivo Excel está abierto o bloqueado por otro programa (como Excel).`);
                        console.warn(`[WARNING] Se guardó la programación reconstruida en: ${fallbackPath}\n`);
                        finalXlsxPath = fallbackPath;
                        suffix = `${counter}`;
                        break;
                    } catch (innerError: any) {
                        if (innerError.code === 'EBUSY') {
                            counter++;
                        } else {
                            throw innerError;
                        }
                    }
                }
                if (finalXlsxPath === xlsxPath) {
                    throw error;
                }
            } else {
                throw error;
            }
        }

        let finalIssuesPath = issuesPath;
        if (suffix) {
            const parsed = path.parse(issuesPath);
            finalIssuesPath = path.join(parsed.dir, `${parsed.name}_${suffix}${parsed.ext}`);
        }

        try {
            fs.writeFileSync(finalIssuesPath, JSON.stringify(issuesReport, null, 2));
        } catch (error: any) {
            if (error.code === 'EBUSY') {
                const parsed = path.parse(finalIssuesPath);
                let counter = 1;
                while (counter <= 100) {
                    const fallbackPath = path.join(parsed.dir, `${parsed.name}_${counter}${parsed.ext}`);
                    try {
                        fs.writeFileSync(fallbackPath, JSON.stringify(issuesReport, null, 2));
                        console.warn(`[WARNING] El archivo JSON de incidencias estaba bloqueado. Se guardó en: ${fallbackPath}`);
                        break;
                    } catch (innerError: any) {
                        if (innerError.code === 'EBUSY') {
                            counter++;
                        } else {
                            throw innerError;
                        }
                    }
                }
            } else {
                throw error;
            }
        }
    }
}
