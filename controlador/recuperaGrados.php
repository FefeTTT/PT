<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $dao = new ProfesorDAO($pdo);
    $grados = $dao->listarGrados();
    echo json_encode(['isItOk' => true, 'grados' => $grados], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['isItOk' => false, 'error' => $e->getMessage()]);
}
?>
