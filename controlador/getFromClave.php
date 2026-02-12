<?php
header('Content-Type: application/json');
include_once "../modelo/pdo.php";
include_once "../modelo/UEADAO.php";

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['clave'])) {
    echo json_encode(['exists' => false, 'error' => 'Falta clave']);
    exit;
}

$ueaDAO = new UEADAO($pdo);
$uea = $ueaDAO->getFromClave($data['clave']);

if ($uea) {
    echo json_encode(['exists' => true]);
} else {
    echo json_encode(['exists' => false]);
}
?>
