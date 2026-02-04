<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';

try {
    $idEdificio = isset($_GET['idEdificio']) ? (int)$_GET['idEdificio'] : 0;
    
    if ($idEdificio > 0) {
        $sql = "SELECT idPiso, nombrePiso, idEdificio FROM pisos WHERE idEdificio = ? ORDER BY nombrePiso";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$idEdificio]);
    } else {
        // Return all or empty? Maybe all for valid searches?
        // Let's return empty if no building selected, or all if needed. Safe: empty.
        $stmt = $pdo->query("SELECT idPiso, nombrePiso, idEdificio FROM pisos ORDER BY idEdificio, nombrePiso");
    }
    
    $pisos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($pisos);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
