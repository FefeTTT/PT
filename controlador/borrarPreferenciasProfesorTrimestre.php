<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

try {
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idProfesor <= 0 || $idTrimestre <= 0) {
        echo json_encode(['ok' => false, 'error' => 'Parámetros inválidos']);
        exit;
    }

    $dao = new PreferenciasDAO($pdo);
    $res = $dao->borrarPreferenciasPorIdProfesorYTrimestre($idProfesor, $idTrimestre);
    if ($res && isset($res['ok']) && $res['ok'] === true) {
        echo json_encode(array_merge(['ok' => true, 'msg' => 'Preferencias eliminadas correctamente'], $res));
    } else {
        $err = $res && isset($res['error']) ? $res['error'] : 'Error desconocido';
        echo json_encode(['ok' => false, 'error' => $err]);
    }
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
