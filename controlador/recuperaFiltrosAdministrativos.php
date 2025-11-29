<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';

try{
    $dao = new AdministrativoDAO($pdo);
    $tipos = $dao->listarAdministrativoTipos();
    echo json_encode(['ok' => true, 'administrativoTipos' => $tipos], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
