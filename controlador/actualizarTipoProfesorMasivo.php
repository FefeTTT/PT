<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['ids']) || !isset($input['idTipo'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Datos inválidos']);
        exit;
    }

    $ids = $input['ids'];
    $idTipo = (int)$input['idTipo'];

    if (!is_array($ids) || empty($ids) || $idTipo <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Lista de profesores o tipo inválido']);
        exit;
    }

    $dao = new ProfesorDAO($pdo);
    $updatedCount = 0;
    $errors = 0;

    foreach ($ids as $numEco) {
        $numEco = (int)$numEco;
        if ($numEco <= 0) continue;
        
        $res = $dao->actualizarTipoContrato($numEco, $idTipo);
        if ($res) {
            $updatedCount++;
        } else {
            $errors++;
        }
    }

    echo json_encode([
        'ok' => true,
        'updated' => $updatedCount,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>
