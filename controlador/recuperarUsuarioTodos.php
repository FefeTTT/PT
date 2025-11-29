<?php
require_once '../modelo/UsuarioVO.php';
require_once '../modelo/UsuarioDAO.php';
require_once '../modelo/pdo.php';

header('Content-Type: application/json');

try {
    // Crear el DAO con la conexión PDO
    $dao = new UsuarioDAO($pdo);
    // Obtener todos los usuarios (devuelve array de JSON)
    $usuarios = $dao->obtenerTodosUsuarios();
    // Si el método devuelve array de JSON, decodificar cada uno para obtener array asociativo
    $usuariosArray = array_map(function($u) {
        return is_string($u) ? json_decode($u, true) : $u;
    }, $usuarios);
    echo json_encode($usuariosArray, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    error_log('Error en recuperarUsuarioTodos.php: ' . $e->getMessage());
}
?>
