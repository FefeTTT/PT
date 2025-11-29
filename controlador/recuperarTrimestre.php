<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
// Usar DAO/VO desde modelo
require_once __DIR__ . '/../modelo/TrimDAO.php';
require_once __DIR__ . '/../modelo/TrimVO.php';

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $trim = null;
    if ($method === 'GET') {
        $trim = isset($_GET['trim']) ? (int)$_GET['trim'] : null;
    } else {
        $trim = isset($_POST['trim']) ? (int)$_POST['trim'] : null;
    }

    if (!$trim || $trim <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Parámetro trim inválido']);
        exit;
    }

    // Delegar en el DAO
    $trimDao = new TrimDAO($pdo);
    $row = $trimDao->obtenerPorId((int)$trim);
    if (!$row) {
        // Devolver 200 con ok:false para que el frontend pueda leer el mensaje de error
        // y mostrar un aviso claro al usuario indicando que no se pueden registrar preferencias.
        echo json_encode(['ok' => false, 'error' => 'El trimestre proporcionado no existe; no se pueden registrar las preferencias.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    echo json_encode(['ok' => true, 'data' => $row], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
