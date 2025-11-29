<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/UsuarioVO.php';
require_once __DIR__ . '/../modelo/FuncionVO.php';
require_once __DIR__ . '/../modelo/FuncionDAO.php';

$respuesta = ['ok' => false, 'funciones' => []];

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        $respuesta['msg'] = 'Método no permitido, usar POST';
        echo json_encode($respuesta);
        exit;
    }

    $usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : '';
    if ($usuario === '') {
        http_response_code(400);
        $respuesta['msg'] = 'Falta parámetro usuario';
        echo json_encode($respuesta);
        exit;
    }

    $dao = new FuncionDAO($pdo);
    $funciones = $dao->obtenerFuncionesPorNombreUsuario($usuario);

    $respuesta['ok'] = true;
    $respuesta['funciones'] = $funciones; // ya vienen en formato array (toJSON)
    echo json_encode($respuesta);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    $respuesta['msg'] = 'Error interno: ' . $e->getMessage();
    // No exponer stack en producción — aquí lo registramos en un archivo
    file_put_contents(__DIR__ . '/debug_recupera_funcion_nombre.txt', date('c') . " - " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode($respuesta);
    exit;
}

?>
