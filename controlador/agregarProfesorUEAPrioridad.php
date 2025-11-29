<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';
// Incluir VO para seguir convención del proyecto
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/UEAVO.php';
header('Content-Type: application/json; charset=utf-8');

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Método no permitido']); exit; }
    $idTr = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $numeroEconomico = isset($_POST['numeroEconomico']) ? (int)$_POST['numeroEconomico'] : 0;
    $prioridad = isset($_POST['prioridad']) ? (int)$_POST['prioridad'] : 0;
    $idUEA = isset($_POST['idUEA']) ? (int)$_POST['idUEA'] : 0;
    $claveUEA = isset($_POST['claveUEA']) ? trim((string)$_POST['claveUEA']) : '';

    if (!$idTr || !$numeroEconomico) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Parámetros requeridos: idTrimestre y numeroEconomico']); exit; }

    $progDao = new ProgramacionDAO($pdo);
    $prefDao = new PreferenciasDAO($pdo);

    if (!$idUEA && $claveUEA !== ''){ $idUEA = (int)$progDao->obtenerIdUEAPorClave($claveUEA); }
    if (!$idUEA) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'UEA no localizada']); exit; }

    $idProfesor = (int)$progDao->obtenerIdProfesorPorEconomico($numeroEconomico);
    if (!$idProfesor) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'Profesor no localizado por número económico']); exit; }

    // Asegurar preferencia base para el profesor en el trimestre
    $idPref = $prefDao->ensurePreferenciaBase($idTr, $idProfesor);
    if (!$idPref) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No fue posible crear/obtener preferencia base']); exit; }

    $ok = $prefDao->insertarUEAEnPreferencia($idPref, $idUEA, $prioridad);
    if (!$ok) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'No se pudo insertar UEA en la preferencia']); exit; }

    echo json_encode(['ok'=>true]);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
