<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/HorarioVO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';
header('Content-Type: application/json; charset=utf-8');

try{
    $raw = $_POST;
    if (empty($raw)){
        $rawInput = @file_get_contents('php://input');
        if ($rawInput) { $dec = json_decode($rawInput, true); if (is_array($dec)) $raw = $dec; }
    }
    $idTr = isset($raw['idTrimestre']) ? (int)$raw['idTrimestre'] : 0;
    if ($idTr <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'idTrimestre inválido']); exit; }

    $dao = new PreferenciasDAO($pdo);
    $rows = $dao->obtenerHorariosPreferenciasPorTrimestre($idTr);
    echo json_encode(['ok'=>true,'horarios'=>$rows], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
