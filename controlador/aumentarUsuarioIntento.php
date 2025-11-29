<?php
// controlador/insertarIntentoUsuario.php
// Recibe POST 'usuario', busca el usuario, incrementa el campo 'intento' en 1 y lo actualiza.

header('Content-Type: application/json; charset=utf-8');

try {
    // Validar método
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'msg' => 'Método no permitido. Use POST.']);
        exit;
    }

    // Nombre de usuario esperado en POST
    $nombreUsuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : null;
    if (empty($nombreUsuario)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetro "usuario" requerido.']);
        exit;
    }

    // Cargar conexión y clases
    require_once __DIR__ . '/../modelo/pdo.php';
    require_once __DIR__ . '/../modelo/UsuarioVO.php';
    require_once __DIR__ . '/../modelo/UsuarioDAO.php';

    $usuarioDAO = new UsuarioDAO($pdo);

    // Buscar usuario por nombre
    $fila = $usuarioDAO->buscaUsuarioNombre($nombreUsuario);
    if ($fila === null) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'msg' => 'Usuario no encontrado.']);
        exit;
    }

    // $fila viene como array con keys: idUsuario, usuario, contraseña, intento
    $idUsuario = isset($fila['idUsuario']) ? (int)$fila['idUsuario'] : null;
    $intentoActual = isset($fila['intento']) ? (int)$fila['intento'] : 0;

    if ($idUsuario === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'Id de usuario inválido en registro.']);
        exit;
    }

    // Incrementar intento
    $nuevoIntento = $intentoActual + 1;

    // Construir VO y actualizar solo el intento
    $usuarioVO = new UsuarioVO($fila['usuario'], $fila['contraseña'], $nuevoIntento, $idUsuario);

    $actualizado = $usuarioDAO->actualizarUsuarioIntento($usuarioVO);
    if ($actualizado) {
        echo json_encode(['ok' => true, 'msg' => 'Intento incrementado.', 'idUsuario' => $idUsuario, 'intento' => $nuevoIntento]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'msg' => 'No se pudo actualizar el intento.']);
        exit;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => 'Error del servidor.', 'error' => $e->getMessage()]);
    exit;
}

?>
