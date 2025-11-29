<?php
require_once __DIR__.'/../modelo/pdo.php';
require_once __DIR__.'/../modelo/UEAVO.php';
require_once __DIR__.'/../modelo/UEADAO.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['success']) || !$_SESSION['success']) {
    http_response_code(401);
    echo json_encode(['ok'=>false,'error'=>'NO_SESSION']);
    exit;
}

$idTrimestre = isset($_GET['idTrimestre']) ? (int)$_GET['idTrimestre'] : 0;
if ($idTrimestre <= 0) {
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>'TRIM_INVALID']);
    exit;
}

try {
    $dao = new UEADAO($pdo);
    $data = $dao->resumenUEAsPorTrimestre($idTrimestre);
    echo json_encode(['ok'=>true,'data'=>$data]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'EXCEPTION','msg'=>$e->getMessage()]);
}
