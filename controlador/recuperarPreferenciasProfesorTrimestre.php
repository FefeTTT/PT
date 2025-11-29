<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor  = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    if ($idTrimestre <= 0 || $idProfesor <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros inválidos']);
        exit;
    }

    $dao = new PreferenciasDAO($pdo);
    $data = $dao->obtenerPreferenciasProfesorPorTrimestre($idTrimestre, $idProfesor);
    echo json_encode(['ok' => true, 'data' => $data]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}
