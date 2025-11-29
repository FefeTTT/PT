<?php
// controlador/insertarUsuarioIntento.php
// Recibe POST 'usuario' e 'intento' y actualiza el campo intento del usuario usando UsuarioDAO/UsuarioVO

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'msg' => 'Método no permitido. Use POST.']);
        exit;
    }

    $usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : null;
    $intento = isset($_POST['intento']) ? intval($_POST['intento']) : null;

    if (empty($usuario) || $intento === null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros "usuario" e "intento" requeridos.']);
        exit;
    }

    require_once __DIR__ . '/../modelo/pdo.php';
    require_once __DIR__ . '/../modelo/UsuarioDAO.php';
    require_once __DIR__ . '/../modelo/UsuarioVO.php';

    $usuarioDAO = new UsuarioDAO($pdo);
    $fila = $usuarioDAO->buscaUsuarioNombre($usuario);
    if ($fila === null) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'msg' => 'Usuario no encontrado.']);
        exit;
    }

    $idUsuario = isset($fila['idUsuario']) ? (int)$fila['idUsuario'] : null;
    $passwordHash = $fila['contraseña'] ?? '';

    if ($idUsuario === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'Id de usuario inválido.']);
        exit;
    }

    $usuarioVO = new UsuarioVO($usuario, $passwordHash, $intento, $idUsuario);
    $ok = $usuarioDAO->actualizarUsuarioIntento($usuarioVO);
    if ($ok) {
        echo json_encode(['ok' => true, 'idUsuario' => $idUsuario, 'intento' => $intento]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'No se pudo actualizar intento.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => 'Error del servidor', 'error' => $e->getMessage()]);
    exit;
}

?>
