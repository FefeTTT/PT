<?php
// controlador/actualizarUsuarioContraseña.php
// Recibe POST 'usuario' y 'contraseña' (nueva) y actualiza la contraseña usando UsuarioDAO/UsuarioVO

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'msg' => 'Método no permitido. Use POST.']);
        exit;
    }

    $usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : null;
    $nueva = isset($_POST['contraseña']) ? $_POST['contraseña'] : null;

    if (empty($usuario) || $nueva === null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros "usuario" y "contraseña" requeridos.']);
        exit;
    }

    require_once __DIR__ . '/../modelo/pdo.php';
    require_once __DIR__ . '/../modelo/UsuarioVO.php';
    require_once __DIR__ . '/../modelo/UsuarioDAO.php';

    $usuarioDAO = new UsuarioDAO($pdo);
    $fila = $usuarioDAO->buscaUsuarioNombre($usuario);
    if ($fila === null) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'msg' => 'Usuario no encontrado.']);
        exit;
    }

    $idUsuario = isset($fila['idUsuario']) ? (int)$fila['idUsuario'] : null;
    if ($idUsuario === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'Id de usuario inválido.']);
        exit;
    }

    // Validación server-side: contraseña no puede ser vacía y no puede ser igual a la actual
    $nuevaTrim = trim((string)$nueva);
    if ($nuevaTrim === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'La nueva contraseña no puede estar vacía.']);
        exit;
    }

    // Si la contraseña actual está disponible como hash, verificar que no coincida
    if (!empty($fila['contraseña'])) {
        try {
            if (password_verify($nuevaTrim, $fila['contraseña'])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'msg' => 'La nueva contraseña no puede ser igual a la actual.']);
                exit;
            }
        } catch (Exception $e) {
            // Si ocurre algún error en verification, no bloquear la operación; continuar con el cambio
        }
    }

    // Construir VO con la nueva contraseña (DAO la hasheará)
    $usuarioVO = new UsuarioVO($usuario, $nuevaTrim, $fila['intento'] ?? 0, $idUsuario);
    $ok = $usuarioDAO->actualizarUsuarioContraseña($usuarioVO);
    if ($ok) {
        echo json_encode(['ok' => true, 'idUsuario' => $idUsuario]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'No se pudo actualizar la contraseña.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => 'Error del servidor', 'error' => $e->getMessage()]);
    exit;
}

?>
