<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/LugarVO.php';
require_once __DIR__ . '/../modelo/LugarDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');

    $edificio = isset($_POST['edificio']) ? trim($_POST['edificio']) : '';
    $piso = isset($_POST['piso']) ? (int)$_POST['piso'] : 0;
    $cubiculo = isset($_POST['cubiculo']) ? trim($_POST['cubiculo']) : '';
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
    $notas = isset($_POST['notas']) ? trim($_POST['notas']) : null;

    if ($edificio === '' || $nombre === '') throw new Exception('Edificio y Nombre son obligatorios');

    $dao = new LugarDAO($pdo);
    $lvo = new LugarVO(0, $edificio, $piso, $cubiculo, $nombre, $notas, null);
    $insertado = $dao->insertarYAsociar($lvo, $idProfesor);

    echo json_encode(['ok' => true, 'lugar' => $insertado], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
