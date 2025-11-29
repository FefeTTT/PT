<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $dao = new ProfesorDAO($pdo);
    // Para el filtro de "área" en Programación deberíamos usar la tabla profesorAreaTipo
    $profesorAreaTipos = $dao->listarProfesorAreaTipos();
    $profTipos = $dao->listarProfesorTipos();
    // también devolver areaacademicas y grupotematicos por si son útiles
    $areaAcademicas = $dao->listarAreaAcademicas();
    $gruposTematicos = $dao->listarGruposTematicos();

    echo json_encode([
        'ok' => true,
        // key 'profesorAreaTipos' contiene las filas de profesorAreaTipo (idProfesorAreaTipo, descripcion)
        'profesorAreaTipos' => $profesorAreaTipos,
        'profesorTipos' => $profTipos,
        'areaAcademicas' => $areaAcademicas,
        'gruposTematicos' => $gruposTematicos
    ]);
} catch (Throwable $e) {
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}
