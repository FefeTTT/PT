<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';

try{
    $idTr = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProf = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $claveGrupo = isset($_POST['claveGrupo']) ? trim((string)$_POST['claveGrupo']) : '';

    if ($idTr <= 0 || $idProf <= 0 || $claveGrupo === ''){
        http_response_code(400);
        echo json_encode(['ok'=>false,'msg'=>'Parámetros inválidos']);
        exit;
    }

    $progDao = new ProgramacionDAO($pdo);
    $deleted = $progDao->borrarProgramacionProfesorPorClaveGrupo($idTr, $idProf, $claveGrupo);
    echo json_encode(['ok'=>true,'deleted'=>$deleted]);
} catch (Throwable $e){ http_response_code(500); echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]); }

?>