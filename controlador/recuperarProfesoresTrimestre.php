<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';
require_once __DIR__ . '/../modelo/ProfesorDisposicionVO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0) { echo json_encode([ 'ok' => false, 'msg' => 'Parámetro idTrimestre inválido' ]); exit; }

    $profDao = new ProfesorDAO($pdo);
    $dispoDao = new ProfesordisposicionDAO($pdo);

    // Obtener todos los profesores (simple)
    $profes = $profDao->obtenerProfesoresTodosSimple(); // array de arrays con idProfesor, numeroEconomico, nombre, etc.

    // Consultar una sola vez qué profesores están en este trimestre (estado=1)
    $stmt = $pdo->prepare("SELECT profesor_idProfesor FROM profesordisposicion WHERE trimestre_idTrimestre = ? AND estado = 1");
    $stmt->execute([$idTrimestre]);
    $enIds = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    $enSet = [];
    foreach ($enIds as $pid) { $enSet[(int)$pid] = true; }

    $out = [];
    foreach ($profes as $p) {
        $idP = isset($p['idProfesor']) ? (int)$p['idProfesor'] : 0;
        $out[] = [
            'idProfesor' => $idP,
            'numeroEconomico' => isset($p['numeroEconomico']) ? (int)$p['numeroEconomico'] : null,
            'nombre' => $p['nombre'] ?? '',
            'enTrimestre' => isset($enSet[$idP]) ? 1 : 0
        ];
    }

    echo json_encode([ 'ok' => true, 'profesores' => $out ]);
} catch (Throwable $e) {
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}
