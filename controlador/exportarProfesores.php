<?php
// controlador/exportarProfesores.php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../modelo/pdo.php'; // debe proveer $pdo
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

$dao = new ProfesorDAO($pdo);
$profes = $dao->buscarProfesores(null, []);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

$headers = ['numeroEconomico','nombre','correo_uam','correo_personal','gradoEstudios','celular'];
$col = 'A';
foreach ($headers as $h) {
    $sheet->setCellValue($col . '1', $h);
    $col++;
}

$rowNum = 2;
foreach ($profes as $p) {
    $sheet->setCellValue('A' . $rowNum, $p['numeroEconomico']);
    $sheet->setCellValue('B' . $rowNum, $p['nombre']);
    $sheet->setCellValue('C' . $rowNum, $p['correo_uam']);
    $sheet->setCellValue('D' . $rowNum, $p['correo_personal']);
    $sheet->setCellValue('E' . $rowNum, $p['gradoEstudios']);
    $sheet->setCellValue('F' . $rowNum, $p['celular']);
    $rowNum++;
}

$filename = 'profesores_export_' . date('Ymd_His') . '.xlsx';
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;
