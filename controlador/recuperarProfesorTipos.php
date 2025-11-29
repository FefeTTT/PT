<?php

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../modelo/pdo.php';
    require_once __DIR__ . '/../modelo/ProfesorTipoVO.php';
    require_once __DIR__ . '/../modelo/ProfesorTipoDAO.php';

    $dao = new ProfesorTipoDAO($pdo);
    $tipos = $dao->obtenerTodos();

    echo json_encode(['ok' => true, 'data' => $tipos], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
