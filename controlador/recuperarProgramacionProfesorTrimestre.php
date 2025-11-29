<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if (!isset($_GET['idProfesor']) || !isset($_GET['idTrimestre'])) throw new Exception('Faltan parámetros');
    $idProfesor = (int)$_GET['idProfesor'];
    $idTrimestre = (int)$_GET['idTrimestre'];
    $dao = new ProfesorDAO($pdo);
    $rows = $dao->obtenerProgramacionDetalleProfesorTrimestre($idProfesor, $idTrimestre);
    echo json_encode(['ok'=>true,'programacion'=>$rows], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
}
