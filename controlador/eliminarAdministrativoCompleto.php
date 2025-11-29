<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoVO.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $id = isset($_POST['idAdministrativo']) ? (int)$_POST['idAdministrativo'] : 0;
    if ($id <= 0) throw new Exception('idAdministrativo inválido');

    $dao = new AdministrativoDAO($pdo);
    $ok = $dao->eliminarAdministrativoCompleto($id);
    if ($ok) {
        echo json_encode(['ok' => true]);
    } else {
        throw new Exception('No se pudo eliminar el administrativo');
    }
} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
