<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/LugarVO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/LugarDAO.php';

try{
    if (!isset($_GET['idProfesor'])) throw new Exception('Falta parámetro idProfesor');
    $idProfesor = (int)$_GET['idProfesor'];
    $dao = new LugarDAO($pdo);
    $lugares = $dao->listarPorProfesorId($idProfesor);
    echo json_encode(['ok' => true, 'lugares' => $lugares], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
