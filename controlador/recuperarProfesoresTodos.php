<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $dao = new ProfesorDAO($pdo);
    $list = $dao->obtenerProfesoresTodosSimple();
    echo json_encode(['ok' => true, 'profesores' => $list], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
