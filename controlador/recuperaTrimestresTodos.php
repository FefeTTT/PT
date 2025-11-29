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
    $dao = new TrimDAO($pdo);
    $rows = $dao->obtenerTodosTrimestres();
    echo json_encode(['ok'=>true,'trimestres'=>$rows], JSON_UNESCAPED_UNICODE);
    exit;
} catch(Exception $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}

?>
