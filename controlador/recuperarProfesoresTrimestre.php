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
    $stmt = $pdo->prepare("SELECT profesor_numeroEconomico FROM profesordisposicion WHERE trimestre_idTrimestre = ? AND estado = 1");
    $stmt->execute([$idTrimestre]);
    $enIds = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
    $enSet = [];
    foreach ($enIds as $pid) { $enSet[(int)$pid] = true; }

    $out = [];
    foreach ($profes as $p) {
        // ProfesorVO uses numeroEconomico. Check if idProfesor is present, otherwise use numeroEconomico
        $numEco = isset($p['numeroEconomico']) ? (int)$p['numeroEconomico'] : 0;
        $idP = isset($p['idProfesor']) ? (int)$p['idProfesor'] : $numEco; 
        
        $out[] = [
            'idProfesor' => $idP, // Keep idProfesor for frontend compatibility if it expects it
            'numeroEconomico' => $numEco,
            'nombre' => $p['nombre'] ?? '',
            'enTrimestre' => isset($enSet[$numEco]) ? 1 : 0
        ];
    }

    echo json_encode([ 'ok' => true, 'profesores' => $out ]);
} catch (Throwable $e) {
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}
