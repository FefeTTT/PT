<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $idTr = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idP  = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idU  = isset($_POST['idUEA']) ? (int)$_POST['idUEA'] : 0;
    if ($idTr<=0 || $idP<=0 || $idU<=0){ http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parámetros inválidos']); exit; }

    $dao = new PreferenciasDAO($pdo);

    // Verificar si ya existía una preferencia para este profesor en el trimestre (delegado al DAO)
    $existiaPreferencia = $dao->existePreferencia($idTr, $idP);

    $idPref = $dao->ensurePreferenciaBase($idTr, $idP);
    if (!$idPref){ http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo crear/obtener preferencia base']); exit; }

    // Solo insertar horarios base cuando NO existía preferencia previa en ese trimestre
    $insHor = 0;
    if (!$existiaPreferencia) {
        $insHor = $dao->insertarHorariosBase($idPref);
    }

    // Insertar UEA prioridad 0
    $okUea = $dao->insertarUEAEnPreferencia($idPref, $idU, 0);
    if (!$okUea){ http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo insertar la UEA en la preferencia']); exit; }

    echo json_encode(['ok'=>true, 'idPreferencia'=>$idPref, 'horariosInsertados'=>$insHor]);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}
