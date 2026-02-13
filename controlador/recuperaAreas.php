<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $dao = new ProfesorDAO($pdo);
    $areas = $dao->listarAreas();
    echo json_encode(['ok' => true, 'areas' => $areas], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>
