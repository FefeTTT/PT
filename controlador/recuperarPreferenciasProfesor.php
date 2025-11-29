<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
        exit;
    }
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor  = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    if ($idTrimestre <= 0 || $idProfesor <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Parámetros inválidos']);
        exit;
    }

    $prefDao = new PreferenciasDAO($pdo);
    $res = $prefDao->obtenerPreferenciasProfesorPorTrimestre($idTrimestre, $idProfesor);
    // el DAO devuelve ['profesor'=>..., 'preferencia'=>..., 'ueas'=>..., 'horarios'=>...] o ['ok'=>true,'data'=>null]
    if (isset($res['ok']) && $res['ok'] === true && array_key_exists('data', $res)) {
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        exit;
    }
    // Devolver la estructura esperada por el front
    echo json_encode(['ok' => true, 'data' => $res], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
