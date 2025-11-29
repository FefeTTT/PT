<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $id = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : (isset($_POST['id']) ? (int)$_POST['id'] : null);
    if ($id === null) { http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parametro idTrimestre requerido']); exit; }
    $dao = new TrimDAO($pdo);
    $count = $dao->contarProgramacionPorTrimestre($id);
    echo json_encode(['ok'=>true,'count'=>$count], JSON_UNESCAPED_UNICODE);
    exit;
} catch(Exception $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}

?>
