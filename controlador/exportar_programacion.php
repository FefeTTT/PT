<?php
// Exportar programación de un trimestre en XLSX (PhpSpreadsheet)
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';
// Composer autoload for PhpSpreadsheet
require_once __DIR__ . '/../vendor/autoload.php';
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $id = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : (isset($_POST['id']) ? (int)$_POST['id'] : null);
    if ($id === null) { http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parametro idTrimestre requerido']); exit; }

    $dao = new TrimDAO($pdo);
    $rows = $dao->obtenerProgramacionPorTrimestre($id);

    if (!$rows || count($rows) === 0) {
        // no hay programación
        http_response_code(204);
        exit;
    }

    // Agrupar por UEA+Grupo para pivotar horarios por día
    $groups = [];
    foreach ($rows as $r) {
        $key = $r['claveUEA'] . '||' . $r['claveGrupo'];
        if (!isset($groups[$key])) {
            $groups[$key] = [
                'CLAVEUEA' => $r['claveUEA'],
                'UEA' => $r['nombreUEA'],
                'GRUPO' => $r['claveGrupo'],
                'Cupo' => $r['cupo'],
                'INSCRITOS' => $r['inscritos'],
                'SALON' => $r['salon'],
                'L_I' => '', 'L_F' => '',
                'M_I' => '', 'M_F' => '',
                'Mi_I' => '', 'Mi_F' => '',
                'J_I' => '', 'J_F' => '',
                'V_I' => '', 'V_F' => '',
                'ECOnomico' => $r['numeroEconomico'],
                'PROFESOR' => $r['nombreProfesor']
            ];
        }
        // Normalizar día y asignar columnas
        $dia = isset($r['dia']) ? trim(mb_strtolower($r['dia'])) : '';
        $hi = isset($r['horaInicio']) ? $r['horaInicio'] : '';
        $hf = isset($r['horaFin']) ? $r['horaFin'] : '';
        // match by prefix
        if (strpos($dia, 'lu') === 0 || strpos($dia, 'lunes') === 0) { $groups[$key]['L_I'] = $hi; $groups[$key]['L_F'] = $hf; }
        else if (strpos($dia, 'ma') === 0 || strpos($dia, 'martes') === 0) { $groups[$key]['M_I'] = $hi; $groups[$key]['M_F'] = $hf; }
        else if (strpos($dia, 'mi') === 0 || strpos($dia, 'mier') === 0 || strpos($dia, 'miercoles') === 0) { $groups[$key]['Mi_I'] = $hi; $groups[$key]['Mi_F'] = $hf; }
        else if (strpos($dia, 'ju') === 0 || strpos($dia, 'jueves') === 0) { $groups[$key]['J_I'] = $hi; $groups[$key]['J_F'] = $hf; }
        else if (strpos($dia, 'vi') === 0 || strpos($dia, 'viernes') === 0) { $groups[$key]['V_I'] = $hi; $groups[$key]['V_F'] = $hf; }
        else if (strpos($dia, 'sa') === 0 || strpos($dia, 'sab') === 0) { /* opcional: no hay columnas específicas */ }
    }

    // Crear spreadsheet
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Programacion');

    // Header columns in requested order
    $hdr = ['CLAVEUEA','UEA','GRUPO','Cupo','INSCRITOS','L_I','L_F','M_I','M_F','Mi_I','Mi_F','J_I','J_F','V_I','V_F','SALÓN','ECOnomico','PROFESOR'];
    // escribir encabezados
    $col = 1;
    foreach ($hdr as $h) {
        $sheet->setCellValueByColumnAndRow($col, 1, $h);
        $col++;
    }

    $rowNum = 2;
    foreach ($groups as $g) {
        $col = 1;
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['CLAVEUEA']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['UEA']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['GRUPO']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['Cupo']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['INSCRITOS']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['L_I']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['L_F']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['M_I']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['M_F']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['Mi_I']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['Mi_F']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['J_I']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['J_F']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['V_I']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['V_F']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['SALON']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['ECOnomico']);
        $sheet->setCellValueByColumnAndRow($col++, $rowNum, $g['PROFESOR']);
        $rowNum++;
    }

    // Enviar como XLSX
    $filename = 'programacion_trimestre_' . $id . '.xlsx';
    // limpiar buffers previos para evitar corrupción del archivo en la salida
    if (ob_get_length() !== false) {
        while (ob_get_level() > 0) ob_end_clean();
    }
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // incluir filename* para soportar UTF-8 en navegadores
    header('Content-Disposition: attachment; filename="' . $filename . '"; filename*=UTF-8\'\'' . rawurlencode($filename));
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;

} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
    exit;
}
