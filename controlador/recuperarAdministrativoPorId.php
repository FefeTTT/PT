<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoVO.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';

try{
    if (!isset($_GET['id'])) throw new Exception('Falta parámetro id');
    $id = (int)$_GET['id'];
    if ($id <= 0) throw new Exception('Id inválido');

    $dao = new AdministrativoDAO($pdo);
    $row = $dao->obtenerAdministrativoPorId($id);
    if (!$row){
        echo json_encode(['ok' => false, 'error' => 'Administrativo no encontrado']);
        exit;
    }
    echo json_encode(['ok' => true, 'administrativo' => $row], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
