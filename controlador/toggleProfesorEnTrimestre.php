<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProgramacionVO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/ProfesorTrimestreDAO.php';

try {
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $action = isset($_POST['action']) ? trim((string)$_POST['action']) : '';
    if ($idProfesor <= 0 || $idTrimestre <= 0 || !in_array($action, ['include','exclude'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Parámetros inválidos']);
        exit;
    }

    $prefDao = new PreferenciasDAO($pdo);
    $dispoDao = new ProfesordisposicionDAO($pdo);
    $orqDao = new ProfesorTrimestreDAO($pdo);

    if ($action === 'exclude') {
        // Realizar operación atómica usando el DAO orquestador
        $res = $orqDao->excluirProfesorDelTrimestreAtomic($idTrimestre, $idProfesor);
        if (!($res && isset($res['ok']) && $res['ok'] === true)) {
            echo json_encode(['ok' => false, 'error' => ($res['error'] ?? 'Error en operación atómica')]);
            exit;
        }
        echo json_encode([
            'ok' => true,
            'action' => 'exclude',
            'deleted_preferencias' => $res['deleted_preferencias'] ?? 0,
            'deleted_uea' => $res['deleted_uea'] ?? 0,
            'deleted_horario' => $res['deleted_horario'] ?? 0,
            'deleted_programacion' => $res['deleted_programacion'] ?? 0,
            'disposicion_actualizada' => $res['disposicion_actualizada'] ?? false
        ]);
        exit;
    }

    // include
    if ($action === 'include') {
        // Actualizar/insertar disposición estado = 1
        $okDis = $dispoDao->actualizarEstadoPorProfesorTrimestre($idProfesor, $idTrimestre, 1);
        if (!$okDis) {
            echo json_encode(['ok' => false, 'error' => 'Error actualizando disposición']);
            exit;
        }

        // Asegurar preferencia base y agregar horarios base
        $idPref = $prefDao->ensurePreferenciaBase($idTrimestre, $idProfesor);
        if ($idPref === null) {
            echo json_encode(['ok' => false, 'error' => 'No se pudo crear la preferencia base']);
            exit;
        }
        $insertedHor = $prefDao->insertarHorariosBase($idPref);

        echo json_encode(['ok' => true, 'action' => 'include', 'idPreferencia' => $idPref, 'inserted_horarios' => $insertedHor]);
        exit;
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
