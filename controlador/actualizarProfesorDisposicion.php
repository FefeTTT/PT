<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $incluir = isset($_POST['incluir']) ? (int)$_POST['incluir'] : 0; // 1 incluir, 0 excluir

    if ($idTrimestre <= 0 || $idProfesor <= 0) {
        echo json_encode([ 'ok' => false, 'msg' => 'Parámetros inválidos' ]);
        exit;
    }

    $dao = new ProfesordisposicionDAO($pdo);
    $ok = $dao->actualizarEstadoPorProfesorTrimestre($idProfesor, $idTrimestre, $incluir ? 1 : 0);

    if ($ok) {
        echo json_encode([ 'ok' => true, 'msg' => 'Actualizado' ]);
    } else {
        echo json_encode([ 'ok' => false, 'msg' => 'No se pudo actualizar' ]);
    }
} catch (Throwable $e) {
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}
