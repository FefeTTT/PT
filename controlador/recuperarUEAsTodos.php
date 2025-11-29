<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/UEADAO.php';
require_once __DIR__ . '/../modelo/UEAVO.php';
header('Content-Type: application/json; charset=utf-8');
try {
    $dao = new UEADAO($pdo);
    // El DAO actual expone ueas() que devuelve un arreglo de VO serializados
    $list = $dao->ueas();
    echo json_encode(['ok' => true, 'ueas' => $list], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
