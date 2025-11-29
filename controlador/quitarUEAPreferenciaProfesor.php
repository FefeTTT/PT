<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor  = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idPreferencia = isset($_POST['idPreferencia']) ? (int)$_POST['idPreferencia'] : 0;
    $idUEA = isset($_POST['idUEA']) ? (int)$_POST['idUEA'] : 0;

    if ($idTrimestre <= 0 || $idProfesor <= 0 || $idPreferencia <= 0 || $idUEA <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros inválidos']);
        exit;
    }

    $progDao = new ProgramacionDAO($pdo);
    $prefDao = new PreferenciasDAO($pdo);

    // 1) Borrar programaciones del profesor en la UEA/Trimestre (si existen)
    $deletedProgramacion = $progDao->borrarProgramacionProfesorUEA($idTrimestre, $idProfesor, $idUEA);

    // 2) Eliminar la UEA de la preferencia
    $ok = $prefDao->eliminarUEAEnPreferencia($idPreferencia, $idUEA);
    if (!$ok) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'No se pudo eliminar la UEA en la preferencia']);
        exit;
    }

    echo json_encode(['ok' => true, 'deletedProgramacion' => $deletedProgramacion, 'removed' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}

?>
