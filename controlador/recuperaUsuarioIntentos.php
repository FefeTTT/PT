<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';

// Asumimos max intentos antes de bloqueo
$MAX_INTENTOS = 3;

$usuario = $_GET['usuario'] ?? $_POST['usuario'] ?? '';
if (strlen(trim($usuario)) < 1) {
    echo json_encode(['success' => false, 'error' => 'Parámetro usuario ausente']);
    exit;
}

try {
    global $pdo;
    $sql = "SELECT idUsuario, usuario, intento FROM usuario WHERE usuario = :usuario LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':usuario' => $usuario]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        echo json_encode(['success' => false, 'error' => 'Usuario no encontrado']);
        exit;
    }
    $intento = isset($row['intento']) ? (int)$row['intento'] : 0;
    $restantes = $MAX_INTENTOS - $intento;
    if ($restantes < 0) $restantes = 0;

    echo json_encode([
        'success' => true,
        'idUsuario' => (int)$row['idUsuario'],
        'usuario' => $row['usuario'],
        'intento' => $intento,
        'restantes' => $restantes,
        'max' => $MAX_INTENTOS
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

?>