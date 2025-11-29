<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
        exit;
    }
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'idTrimestre inválido']);
        exit;
    }

    $dao = new ProfesordisposicionDAO($pdo);
    // Devolver todos los profesores configurados para el trimestre con su estado (0/1)
    // y si ya tienen preferencias (filledPrefs 0/1) para permitir filtrado completo en el cliente
    $lista = $dao->listarProfesoresTrimestreConEstatusPreferencias($idTrimestre);

    echo json_encode(['ok' => true, 'data' => $lista]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
