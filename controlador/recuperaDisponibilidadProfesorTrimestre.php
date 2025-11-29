<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimVO.php';
require_once __DIR__ . '/../modelo/ProfesorDisposicionVO.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';
header('Content-Type: application/json; charset=utf-8');
session_start();

if (!isset($_SESSION['success']) || !$_SESSION['success']) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'NO_SESSION']);
    exit;
}

$idProfesor = isset($_GET['idProfesor']) ? (int)$_GET['idProfesor'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);
if ($idProfesor <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'PROF_INVALID']);
    exit;
}

try {
    $trimDao = new TrimDAO($pdo);
    $trims = $trimDao->obtenerTodosTrimestres();
    if (empty($trims)) {
        echo json_encode(['ok' => false, 'error' => 'NO_TRIMESTRES']);
        exit;
    }

    // Seleccionar el trimestre con año mayor y, dentro del mismo año, con idTrimestrePeriodo mayor
    $best = null;
    foreach ($trims as $t) {
        $anio = isset($t['año']) ? (int)$t['año'] : (isset($t['anio']) ? (int)$t['anio'] : 0);
        $periodoId = isset($t['trimestreperiodo_idTrimestrePeriodo']) ? (int)$t['trimestreperiodo_idTrimestrePeriodo'] : 0;
        if ($best === null) { $best = ['row' => $t, 'anio' => $anio, 'periodoId' => $periodoId]; continue; }
        if ($anio > $best['anio'] || ($anio == $best['anio'] && $periodoId > $best['periodoId'])) {
            $best = ['row' => $t, 'anio' => $anio, 'periodoId' => $periodoId];
        }
    }

    $target = $best['row'];
    $idTrimestre = (int)$target['idTrimestre'];

    $profDao = new ProfesordisposicionDAO($pdo);
    $disp = $profDao->buscarPorProfesorYTrimestre($idProfesor, $idTrimestre);

    echo json_encode(['ok' => true, 'trimestre' => $target, 'disposicion' => $disp]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'EXCEPTION', 'msg' => $e->getMessage()]);
}

