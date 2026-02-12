<?php
require_once '../ReactLoader.php';
require_once '../modelo/ProfesorDAO.php';

header('Content-Type: application/json');

try {
    // Only accept POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido. Use POST.');
    }

    // Get JSON payload
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data)) {
        throw new Exception('Payload inválido. Se espera un JSON.');
    }

    // Connect DB
    require_once '../modelo/pdo.php';
    global $pdo;
    $dao = new ProfesorDAO($pdo);

    // Run batch update
    // Data expected structure: array of { numeroEconomico, grado, idArea }
    $result = $dao->actualizarGradoYAreaBatch($data);

    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'isItOk' => false,
        'error' => $e->getMessage()
    ]);
}
