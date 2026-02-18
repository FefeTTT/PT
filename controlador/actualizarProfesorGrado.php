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

$idGrado = isset($data['idGrado']) ? (int)$data['idGrado'] : null;

$profesorDAO = new ProfesorDAO($pdo);
if ($profesorDAO->actualizarGrado($data['numeroEconomico'], $idGrado)) {
    echo json_encode(['isItOk' => true]);
} else {
    echo json_encode(['isItOk' => false, 'error' => 'Error al actualizar grado']);
}
?>
