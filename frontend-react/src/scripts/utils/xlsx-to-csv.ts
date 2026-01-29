import { read, utils } from 'xlsx';

export async function convertXlsxToCsv(file: File, nombreHoja = 'CB'): Promise<File> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer);

    const sheet = workbook.Sheets[nombreHoja];

    if (!sheet) {
        throw new Error('Nombre de hoja no encontrado.');
    }

    const csv = utils.sheet_to_csv(sheet);

    const newFileName = file.name.replace(/\.xlsx$/i, '.csv');

    return new File([csv], newFileName, {
        type: 'text/csv',
        lastModified: Date.now()
    });
}
