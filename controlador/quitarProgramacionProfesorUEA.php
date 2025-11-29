<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';

try{
    $idTr = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProf = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idUEA = isset($_POST['idUEA']) ? (int)$_POST['idUEA'] : 0;
    $claveUEA = isset($_POST['claveUEA']) ? trim((string)$_POST['claveUEA']) : '';

    if ($idTr <= 0 || $idProf <= 0 || ($idUEA <= 0 && $claveUEA === '')){
        http_response_code(400);
        echo json_encode(['ok'=>false,'msg'=>'Parámetros inválidos']);
        exit;
    }

    // Usar DAO para manejar la operación en BD
    $progDao = new ProgramacionDAO($pdo);

    // resolver idUEA por clave si no se proporcionó (usando DAO)
    if ($idUEA <= 0 && $claveUEA !== ''){
        $found = $progDao->obtenerIdUEAPorClave($claveUEA);
        if ($found !== null) $idUEA = $found;
    }

    $deleted = 0;
    if ($idUEA > 0) {
        $deleted = $progDao->borrarProgramacionProfesorUEA($idTr, $idProf, $idUEA);
    }
    if ($deleted === 0){
        // Podría significar que no había filas o que hubo un error; retornamos ok=true pero con deleted=0
        echo json_encode(['ok'=>true,'deleted'=>0]);
    } else {
        echo json_encode(['ok'=>true,'deleted'=>$deleted]);
    }
} catch (Throwable $e){ http_response_code(500); echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]); }

?>
