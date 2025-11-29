<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';
// Incluir VOs utilizados por los DAO (convención del proyecto)
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/UEAVO.php';
header('Content-Type: application/json; charset=utf-8');

try{
    $idTr = null; $idUEA = null; $claveUEA = null;
    if (isset($_GET['idTrimestre'])) $idTr = (int)$_GET['idTrimestre'];
    if (isset($_POST['idTrimestre'])) $idTr = (int)$_POST['idTrimestre'];
    if (isset($_GET['idUEA'])) $idUEA = (int)$_GET['idUEA'];
    if (isset($_POST['idUEA'])) $idUEA = (int)$_POST['idUEA'];
    if (isset($_GET['claveUEA'])) $claveUEA = trim((string)$_GET['claveUEA']);
    if (isset($_POST['claveUEA'])) $claveUEA = trim((string)$_POST['claveUEA']);

    if (!$idTr) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'idTrimestre requerido']); exit; }

    $progDao = new ProgramacionDAO($pdo);
    $prefDao = new PreferenciasDAO($pdo);

    if (!$idUEA && $claveUEA !== null && $claveUEA !== ''){
        $idUEA = (int)$progDao->obtenerIdUEAPorClave($claveUEA);
    }
    if (!$idUEA) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'UEA no localizada']); exit; }

    $prioridades = $prefDao->obtenerProfesoresPorUEAEnTrimestre($idTr, $idUEA);

    echo json_encode([
        'ok' => true,
        'idUEA' => $idUEA,
        'claveUEA' => $claveUEA,
        'prioridades' => $prioridades
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
