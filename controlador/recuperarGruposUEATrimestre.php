<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $claveUEA = isset($_POST['claveUEA']) ? trim($_POST['claveUEA']) : '';
    if ($idTrimestre <= 0 || $claveUEA === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros inválidos']);
        exit;
    }

    $dao = new TrimDAO($pdo);
    $grupos = $dao->obtenerGruposDeUEAConHorarios($idTrimestre, $claveUEA);
    echo json_encode(['ok' => true, 'grupos' => $grupos]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}
 