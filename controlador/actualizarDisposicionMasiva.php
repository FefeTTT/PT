<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0) {
        echo json_encode([ 'ok' => false, 'msg' => 'idTrimestre inválido' ]);
        exit;
    }

    $profDao = new ProfesorDAO($pdo);
    $pdDao = new ProfesordisposicionDAO($pdo);

    // obtener todos los profesores (simple)
    $profs = $profDao->obtenerProfesoresTodosSimple();
    $ids = array_map(function($p){ return isset($p['idProfesor']) ? (int)$p['idProfesor'] : 0; }, $profs);
    $ids = array_filter($ids, function($v){ return $v > 0; });

    if (empty($ids)) {
        echo json_encode([ 'ok' => true, 'msg' => 'No hay profesores para procesar', 'total' => 0 ]);
        exit;
    }

    // obtener los ids que tienen preferencias y que tienen programacion
    $withPrefs = $profDao->obtenerProfesConPreferenciasEnTrimestre($ids, $idTrimestre);
    $withProg = $profDao->obtenerProfesConProgramacionEnTrimestre($ids, $idTrimestre);

    // convertir a sets para búsqueda rápida
    $setPrefs = array_flip(array_map('intval', $withPrefs));
    $setProg = array_flip(array_map('intval', $withProg));

    $total = 0; $toOne = 0; $toZero = 0; $errors = [];

    // usar transacción para consistencia
    $pdo->beginTransaction();
    try {
        foreach ($ids as $profId) {
            $total++;
            $estado = (isset($setPrefs[$profId]) || isset($setProg[$profId])) ? 1 : 0;
            $ok = $pdDao->actualizarEstadoPorProfesorTrimestre($profId, $idTrimestre, $estado);
            if ($ok) {
                if ($estado) $toOne++; else $toZero++;
            } else {
                $errors[] = "No se actualizó profesor {$profId}";
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    echo json_encode([ 'ok' => true, 'msg' => 'Actualización masiva completada', 'total' => $total, 'set1' => $toOne, 'set0' => $toZero, 'errors' => $errors ]);

} catch (Throwable $e) {
    try { if ($pdo && $pdo->inTransaction()) $pdo->rollBack(); } catch(Throwable $_){}
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}

?>
