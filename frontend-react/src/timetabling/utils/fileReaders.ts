import * as XLSX from 'xlsx';

export async function readJsonFile(file: File): Promise<unknown> {
    const text = await file.text();
    return JSON.parse(text) as unknown;
}

export async function readWorkbookRows(file: File): Promise<Record<string, unknown>[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];

    if (!firstSheet) {
        throw new Error('El XLSX no contiene hojas.');
    }

    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}
