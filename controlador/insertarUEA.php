<?php
header('Content-Type: application/json');
include_once "../modelo/pdo.php";
include_once "../modelo/UEADAO.php";
include_once "../modelo/Respuesta.php";

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['clave']) || !isset($data['nombre']) || !isset($data['areaId'])) {
    Respuesta::json(false, 'Faltan datos de la UEA');
}

$ueaDAO = new UEADAO($pdo);
$resultado = $ueaDAO->insertar($data['clave'], $data['nombre'], $data['areaId']);

if ($resultado['isItOk']) {
    Respuesta::json(true);
} else {
    Respuesta::json(false, $resultado['error'] ?? 'Error desconocido');
}
?>
