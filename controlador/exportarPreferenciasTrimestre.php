<?php
// Exportar preferencias llenadas por profesores para un trimestre en Excel
// Ocultar errores en salida (se registran vía HTTP 400 si ocurren)
@ini_set('display_errors', '0');
error_reporting(0);
if (!ob_get_level()) ob_start();
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/PreferenciasProfesorVO.php';
require_once __DIR__ . '/../modelo/PreferenciasUeaVO.php';
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

require_once __DIR__ . '/../vendor/autoload.php';
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

try {
    // Buffer output to avoid accidental echo/whitespace from included files breaking the XLSX binary
    if (!ob_get_level()) ob_start();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Uso: POST');
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if (!$idTrimestre) throw new Exception('idTrimestre requerido');

    $dao = new PreferenciasDAO($pdo);
    $rows = $dao->obtenerPreferenciasPorTrimestreCompleto($idTrimestre);
    // Mapa de horarios detallados por profesor y día (para escribir rangos en lugar de sólo X)
    $horarios = $dao->obtenerHorariosPreferenciasPorTrimestre($idTrimestre);
    $horariosPorProfesorDia = [];
    foreach ($horarios as $h) {
        $pid = $h['idProfesor'] ?? null;
        $dia = strtolower($h['dia'] ?? '');
        if (!$pid || !$dia) continue;
        if (!isset($horariosPorProfesorDia[$pid])) $horariosPorProfesorDia[$pid] = [];
        if (!isset($horariosPorProfesorDia[$pid][$dia])) $horariosPorProfesorDia[$pid][$dia] = [];
        $rangotxt = trim(($h['horaInicio'] ?? '').' - '.($h['horaFin'] ?? ''));
        if ($rangotxt !== ' - ') $horariosPorProfesorDia[$pid][$dia][] = $rangotxt;
    }

    if (!$rows || count($rows) === 0) {
        // No hay preferencias para exportar
        http_response_code(204);
        exit;
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Preferencias');

    // Encabezados
    $headers = [
        'NUMERO ECONOMICO', 'NOMBRE', 'NO. DE GRUPOS QUE DESEA IMPARTIR'
    ];
    // 5 pares UEA
    for ($i = 1; $i <= 5; $i++) {
        $headers[] = 'clave ' . $i . '. UEA';
        $headers[] = 'nombre ' . $i . '. UEA';
    }
    $headers = array_merge($headers, ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','OBSERVACIONES']);

    // escribir encabezados
    $col = 1;
    foreach ($headers as $h) {
        $sheet->setCellValueByColumnAndRow($col, 1, $h);
        $col++;
    }

    $rowNum = 2;
    foreach ($rows as $r) {
        $col = 1;
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['numeroEconomico']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['nombre']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['noGrupos']);
        // UEAs up to 5
        for ($i = 0; $i < 5; $i++) {
            if (isset($r['ueas'][$i])) {
                $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['ueas'][$i]['claveUEA'] ?? $r['ueas'][$i]['clave'] ?? '');
                $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['ueas'][$i]['nombre'] ?? $r['ueas'][$i]['nombreUEA'] ?? '');
            } else {
                $sheet->setCellValueByColumnAndRow($col++, $rowNum, '');
                $sheet->setCellValueByColumnAndRow($col++, $rowNum, '');
            }
        }
        // Dias: construir texto de horarios por día usando $horariosPorProfesorDia
        $pid = $r['idProfesor'] ?? null;
        $diasTxt = ['lunes'=>'','martes'=>'','miercoles'=>'','jueves'=>'','viernes'=>''];
        if ($pid && isset($horariosPorProfesorDia[$pid])) {
            foreach ($diasTxt as $dKey => $_) {
                if (!empty($horariosPorProfesorDia[$pid][$dKey])) {
                    $diasTxt[$dKey] = implode(' | ', $horariosPorProfesorDia[$pid][$dKey]);
                }
            }
        }
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $diasTxt['lunes']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $diasTxt['martes']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $diasTxt['miercoles']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $diasTxt['jueves']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $diasTxt['viernes']);
        // Observaciones
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $r['observaciones'] ?? '');

        $rowNum++;
    }

    // Auto size columns (simple loop)
    $highestColumn = $sheet->getHighestColumn();
    $highestColumnIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestColumn);
    for ($c = 1; $c <= $highestColumnIndex; $c++) {
        $sheet->getColumnDimensionByColumn($c)->setAutoSize(true);
    }

    // Nombre de archivo
    $yearPart = date('Y');
    $fileName = 'Preferencias_trimestre_' . $idTrimestre . '_' . $yearPart . '.xlsx';

    // Limpiar cualquier buffer previo y desactivar compresión que pueda corromper el binario
    if (ob_get_length() !== false) {
        while (ob_get_level() > 0) ob_end_clean();
    }
    @ini_set('zlib.output_compression', '0');

    // Headers para forzar descarga
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
    header('Cache-Control: max-age=0');

    // Enviar directamente al output
    // Depuración: si hay salida restante en buffers, guardarla para inspección
    $tempDir = __DIR__ . '/temporales/';
    if (!is_dir($tempDir)) @mkdir($tempDir, 0777, true);
    if (ob_get_length() !== false && ob_get_length() > 0) {
        $left = ob_get_clean();
        if ($left !== '') {
            @file_put_contents($tempDir . 'last_output_debug.txt', $left);
        }
    }

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;

} catch (Exception $e) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'ERROR_EXPORT_PREFS: ' . $e->getMessage();
    exit;
}
