<?php
require_once __DIR__ . '/../modelo/pdo.php';
// Incluir VOs antes de los DAOs según convención
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProgramacionVO.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
header('Content-Type: application/json; charset=utf-8');

$raw = $_POST;
$rawInput = @file_get_contents('php://input');
if (empty($raw) && $rawInput) {
    $dec = json_decode($rawInput, true);
    if (is_array($dec)) $raw = $dec;
}

$idTrimestre = isset($raw['idTrimestre']) ? (int)$raw['idTrimestre'] : 0;
if ($idTrimestre <= 0) {
    echo json_encode(['ok' => false, 'msg' => 'idTrimestre inválido']);
    exit;
}

try {
    $dao = new ProgramacionDAO($pdo);
    $rows = $dao->obtenerAsignacionPorTrimestre($idTrimestre);
    echo json_encode(['ok' => true, 'asignaciones' => $rows], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}

?>
