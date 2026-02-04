<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';

try {
    $sql = "SELECT idEdificio, nombreEdificio FROM edificios ORDER BY nombreEdificio";
    $stmt = $pdo->query($sql);
    $edificios = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($edificios);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
