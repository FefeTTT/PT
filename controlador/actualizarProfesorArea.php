<?php
header('Content-Type: application/json');
include_once "../modelo/pdo.php";
include_once "../modelo/ProfesorVO.php";
include_once "../modelo/ProfesorDAO.php";

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['numeroEconomico'])) {
    echo json_encode(['ok?' => false, 'error' => 'Falta numeroEconomico']);
    exit;
}

$idArea = isset($data['idArea']) ? (int)$data['idArea'] : null;

$profesorDAO = new ProfesorDAO($pdo);
if ($profesorDAO->actualizarArea($data['numeroEconomico'], $idArea)) {
    echo json_encode(['ok?' => true]);
} else {
    echo json_encode(['ok?' => false, 'error' => 'Error al actualizar área']);
}
?>
