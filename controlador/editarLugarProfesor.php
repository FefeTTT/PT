<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/LugarVO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/LugarDAO.php';

try{
    // Espera: idLugar, edificio, piso, cubiculo, nombre, notas
    $idLugar = isset($_POST['idLugar']) ? (int)$_POST['idLugar'] : 0;
    if ($idLugar <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Falta idLugar']); exit; }

    $edificio = isset($_POST['edificio']) ? trim($_POST['edificio']) : '';
    $piso = isset($_POST['piso']) && $_POST['piso'] !== '' ? (int)$_POST['piso'] : 0;
    $cubiculo = isset($_POST['cubiculo']) ? trim($_POST['cubiculo']) : '';
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
    $notas = isset($_POST['notas']) ? trim($_POST['notas']) : null;

    $lvo = new LugarVO($idLugar, $edificio, $piso, $cubiculo, $nombre, $notas, null);
    $dao = new LugarDAO($pdo);
    $ok = $dao->actualizarLugar($lvo);
    if (!$ok){ http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo actualizar lugar']); exit; }
    echo json_encode(['ok'=>true]);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}
