<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try{
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0){ http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parámetro idTrimestre inválido']); exit; }

    $dao = new TrimDAO($pdo);
    $rows = $dao->obtenerProgramacionPorTrimestre($idTrimestre);
    echo json_encode(['ok'=>true, 'programacion'=>$rows]);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}
