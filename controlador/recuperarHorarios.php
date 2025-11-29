<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/HorarioDAO.php';

try {
    $dao = new HorarioDAO($pdo);
    $horarios = $dao->obtenerTodos();
    echo json_encode(['ok' => true, 'horarios' => $horarios], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
