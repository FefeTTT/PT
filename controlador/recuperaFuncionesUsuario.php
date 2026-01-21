<?php
require_once "../modelo/pdo.php";
require_once "../modelo/UsuarioVO.php";
require_once "../modelo/FuncionVO.php";
require_once "../modelo/FuncionDAO.php";

header('Content-Type: application/json; charset=utf-8');

if (!isset($_GET['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'ID de usuario no proporcionado']);
    exit;
}

$idUsuario = intval($_GET['id']);

try {
    $funcionDAO = new FuncionDAO($pdo);

    $funciones = $funcionDAO->obtenerFuncionUsuarioId($idUsuario);
    
    echo json_encode($funciones, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al recuperar funciones: ' . $e->getMessage()]);
}
?>
