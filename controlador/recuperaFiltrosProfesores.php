<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    $dao = new ProfesorDAO($pdo);
    $areaAcademicas = $dao->listarAreaAcademicas();
    $grupos = $dao->listarGruposTematicos();
    // Reemplazar 'areas' por 'profesorAreaTipos' para el filtro correcto
    $profesorAreaTipos = $dao->listarProfesorAreaTipos();
    $profesorTipos = $dao->listarProfesorTipos();
    $trimestres = $dao->listarTrimestres();

    echo json_encode([
        'ok' => true,
        'areaAcademicas' => $areaAcademicas,
        'gruposTematicos' => $grupos,
    'profesorAreaTipos' => $profesorAreaTipos,
        'profesorTipos' => $profesorTipos,
        'trimestres' => $trimestres
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
