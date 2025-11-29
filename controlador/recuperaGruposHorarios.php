<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']); exit;
    }
    $id = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : (isset($_POST['id']) ? (int)$_POST['id'] : null);
    if ($id === null) { http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parametro idTrimestre requerido']); exit; }

    $dao = new TrimDAO($pdo);
    $grupos = $dao->obtenerGruposConHorariosPorTrimestre($id);
    $horarios = $dao->listarHorarios();
    // Validación extra: ¿hay programación hecha para el trimestre?
    $progCount = $dao->contarProgramacionPorTrimestre($id);
    $hasProgramacion = $progCount > 0;
    if ($hasProgramacion) {
        // Obtener el mapa idGrupo -> profesor asignado (económico y nombre)
        $mapProf = $dao->obtenerProfesorAsignadoPorGrupoEnTrimestre($id);
        // Anexar los datos de profesor a cada grupo
        foreach ($grupos as &$g) {
            $gid = isset($g['idGrupo']) ? (int)$g['idGrupo'] : null;
            if ($gid !== null && isset($mapProf[$gid])) {
                $g['profesor'] = [
                    'idProfesor' => $mapProf[$gid]['idProfesor'],
                    'numeroEconomico' => $mapProf[$gid]['numeroEconomico'],
                    'nombre' => $mapProf[$gid]['nombreProfesor']
                ];
            } else {
                $g['profesor'] = null;
            }
        }
        unset($g);
    }

    echo json_encode(['ok'=>true, 'grupos' => $grupos, 'horarios' => $horarios, 'hasProgramacion' => $hasProgramacion]);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
    exit;
}



