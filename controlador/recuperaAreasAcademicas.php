<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $dao = new ProfesorDAO($pdo);
    $rows = $dao->listarAreaAcademicas();
    echo json_encode(['ok' => true, 'areas' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    error_log("recuperaAreasAcademicas error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
