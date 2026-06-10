import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const basePath = path.join(__dirname, '..', 'ml', 'files');
    const dfHistFile = path.join(basePath, 'df_hist.json');

    console.log("Cargando df_hist.json...");
    const dfHist = JSON.parse(fs.readFileSync(dfHistFile, 'utf-8'));
    
    const ueaCountsPorEco = new Map<number, Map<number, number>>();
    for (const fila of dfHist) {
        const eco = Number(fila.eco);
        const uea = Number(fila.uea);
        if (!ueaCountsPorEco.has(eco)) ueaCountsPorEco.set(eco, new Map<number, number>());
        const mapEco = ueaCountsPorEco.get(eco)!;
        mapEco.set(uea, (mapEco.get(uea) || 0) + 1);
    }

    const ecosAVerificar = [19834, 28650, 14416];
    const sigma = 2.0;

    let datasets = [];

    for (const eco of ecosAVerificar) {
        const mapEco = ueaCountsPorEco.get(eco);
        if (!mapEco) continue;

        let dataPoints = [];
        let labels = [];
        let backgroundColors = [];

        for (const [uea, count] of mapEco.entries()) {
            const kde_ij = 1.0 - Math.exp(-(Math.pow(count, 2)) / (2 * Math.pow(sigma, 2)));
            labels.push(uea.toString());
            dataPoints.push(kde_ij);
            backgroundColors.push(`rgba(${eco % 255}, ${(eco * 2) % 255}, ${(eco * 3) % 255}, 0.6)`);
        }

        datasets.push({
            label: `ECO ${eco} (KDE)`,
            data: dataPoints,
            labels: labels,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(c => c.replace('0.6', '1')),
            borderWidth: 1
        });
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Gráfica KDE por ECO</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .chart-container { width: 80%; margin: 20px auto; }
    </style>
</head>
<body>
    <h1>Función de Probabilidad kde_ij</h1>
    <p>Visualizando el score kde_ij de las UEAs observadas para ECOs 28650, 19834 y 14416.</p>
    
    <div id="charts"></div>

    <script>
        const datasets = ${JSON.stringify(datasets)};
        const chartsDiv = document.getElementById('charts');

        datasets.forEach((ds, index) => {
            const container = document.createElement('div');
            container.className = 'chart-container';
            const canvas = document.createElement('canvas');
            canvas.id = 'chart-' + index;
            container.appendChild(canvas);
            chartsDiv.appendChild(container);

            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: ds.labels,
                    datasets: [{
                        label: ds.label,
                        data: ds.data,
                        backgroundColor: ds.backgroundColor,
                        borderColor: ds.borderColor,
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 1.0,
                            title: { display: true, text: 'Probabilidad kde_ij' }
                        },
                        x: {
                            title: { display: true, text: 'Clave UEA' }
                        }
                    }
                }
            });
        });
    </script>
</body>
</html>
    `;

    // Asumimos linux, adaptado a windows
    const actualArtifactPath = 'c:\\Users\\jafet\\.gemini\\antigravity\\brain\\392deec8-63fe-4088-bdb1-c679072561cb\\grafica_kde.html';
    fs.writeFileSync(actualArtifactPath, htmlContent, 'utf-8');
    console.log("Gráfica generada en:", actualArtifactPath);
}

run();
