<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $excludeProfesor = isset($_POST['excludeProfesor']) ? (int)$_POST['excludeProfesor'] : 0; // opcional: idProfesor a excluir
    if ($idTrimestre <= 0) { echo json_encode(['ok' => false, 'msg' => 'Parámetro idTrimestre inválido']); exit; }

    $dao = new TrimDAO($pdo);
    // Obtener grupos con su id y claveUEA/claveGrupo
    $groups = $dao->obtenerGruposConHorariosPorTrimestre($idTrimestre);
    // Obtener mapa de profesor asignado por grupo (idGrupo => {idProfesor, numeroEconomico, nombreProfesor})
    $asigMap = $dao->obtenerProfesorAsignadoPorGrupoEnTrimestre($idTrimestre);

    $assignedKeys = [];
    $assignedMap = [];
    foreach ($groups as $g) {
        $gid = (int)($g['idGrupo'] ?? 0);
        if ($gid <= 0) continue;
        if (isset($asigMap[$gid]) && $asigMap[$gid]['idProfesor']) {
            $assignedProfesorId = (int)$asigMap[$gid]['idProfesor'];
            if ($excludeProfesor > 0 && $assignedProfesorId === $excludeProfesor) continue; // permitir los grupos asignados a este profesor
            $claveUEA = isset($g['uea']['claveUEA']) ? $g['uea']['claveUEA'] : '';
            $claveGrupo = isset($g['claveGrupo']) ? $g['claveGrupo'] : '';
            $key = trim($claveUEA) . '|' . trim($claveGrupo);
            if ($key === '|') continue;
            $assignedKeys[] = $key;
            $assignedMap[$key] = [ 'idProfesor' => $assignedProfesorId, 'numeroEconomico' => $asigMap[$gid]['numeroEconomico'] ?? null, 'nombreProfesor' => $asigMap[$gid]['nombreProfesor'] ?? null, 'idGrupo' => $gid ];
        }
    }

    // devolver conjunto único
    $assignedKeys = array_values(array_unique($assignedKeys));
    echo json_encode(['ok' => true, 'assignedKeys' => $assignedKeys, 'assignedMap' => $assignedMap]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}
