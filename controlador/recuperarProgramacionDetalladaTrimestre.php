<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProgramacionVO.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
header('Content-Type: application/json; charset=utf-8');

try{
    $raw = $_POST;
    if (empty($raw)){
        $rawInput = @file_get_contents('php://input');
        if ($rawInput) { $dec = json_decode($rawInput, true); if (is_array($dec)) $raw = $dec; }
    }
    $idTr = isset($raw['idTrimestre']) ? (int)$raw['idTrimestre'] : 0;
    if ($idTr <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'idTrimestre inválido']); exit; }

    $dao = new ProgramacionDAO($pdo);
    // Si se envía idProfesor, devolver solo la programación de ese profesor en el trimestre
    $idProf = isset($raw['idProfesor']) ? (int)$raw['idProfesor'] : 0;
    if ($idProf > 0) {
        $rows = $dao->obtenerProgramacionDetalladaPorTrimestreYProfesor($idTr, $idProf);
    } else {
        $rows = $dao->obtenerProgramacionDetalladaPorTrimestre($idTr);
    }
    echo json_encode(['ok'=>true,'programacion'=>$rows], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
