<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoVO.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';

try{
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    $sort = isset($_GET['sort']) ? trim($_GET['sort']) : 'nombre';
    $sortDir = isset($_GET['sortDir']) ? trim($_GET['sortDir']) : 'ASC';
    $idAdministrativoTipo = isset($_GET['idAdministrativoTipo']) && $_GET['idAdministrativoTipo'] !== '' ? (int)$_GET['idAdministrativoTipo'] : null;

    $dao = new AdministrativoDAO($pdo);
    $rows = $dao->listarAdministrativos(['q' => $q, 'sort' => $sort, 'sortDir' => $sortDir, 'idAdministrativoTipo' => $idAdministrativoTipo]);

    echo json_encode(['ok' => true, 'administrativos' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
