import fs from 'fs';
import path from 'path';

function parseArgs() {
    const args = process.argv.slice(2);
    let progVaciaName = 'programacion_vacia_26P.json';
    let inputDir = path.resolve(process.cwd(), 'ml/files');
    let outputDir = process.cwd();

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prog-vacia' && i + 1 < args.length) {
            progVaciaName = args[i + 1];
            i++;
        } else if (args[i] === '--input-dir' && i + 1 < args.length) {
            inputDir = path.resolve(args[i + 1]);
            i++;
        } else if (args[i] === '--output-dir' && i + 1 < args.length) {
            outputDir = path.resolve(args[i + 1]);
            i++;
        }
    }
    return { progVaciaName, inputDir, outputDir };
}

function main() {
    const { progVaciaName, inputDir, outputDir } = parseArgs();

    console.log(`Buscando archivos en: ${inputDir}`);
    console.log(`Usando archivo de programación vacía: ${progVaciaName}`);

    const archivos = [
        'df_hist.json',
        'eco-nombre.json',
        // Mapa clave de UEA -> nombre legible. El frontend lo usa para mostrar el nombre de la
        // UEA (en vez de solo la clave) en la tabla de candidatos. Opcional para el GRASP.
        'clave-uea.json',
        'area_profesor.json',
        progVaciaName,
        'ecos_vigentes_con_horario_regular.json',
        'ecos_vigentes_con_horario_irregular.json',
        // Horarios irregulares inferidos por trimestre: el modo KDE los usa para construir
        // los horariosContratacion de ~36 profesores irregulares. Sin este archivo esos ECOs
        // no entran al GRASP y el pase 0 no iguala a testAsinacionKDE.
        'ecos_irregulares_inferidos.json'
    ];

    const dataUnificada: Record<string, any> = {};

    for (const archivo of archivos) {
        const filePath = path.join(inputDir, archivo);
        if (fs.existsSync(filePath)) {
            console.log(`Leyendo: ${archivo}...`);
            const content = fs.readFileSync(filePath, 'utf-8');
            try {
                dataUnificada[archivo] = JSON.parse(content);
            } catch (e) {
                console.error(`Error parseando JSON en ${archivo}:`, e);
                process.exit(1);
            }
        } else {
            console.warn(`ADVERTENCIA: No se encontró el archivo ${filePath}`);
            dataUnificada[archivo] = null;
        }
    }

    const outputFile = path.join(outputDir, 'archivos_requeridos.json');
    console.log(`Escribiendo JSON unificado en: ${outputFile}...`);
    fs.writeFileSync(outputFile, JSON.stringify(dataUnificada, null, 2), 'utf-8');
    console.log('¡Proceso completado exitosamente!');
}

main();
