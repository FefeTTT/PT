<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
// Incluir VOs antes de los DAOs (convención)
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProgramacionVO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor  = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idGrupo     = isset($_POST['idGrupo']) ? (int)$_POST['idGrupo'] : 0;
    if ($idTrimestre <= 0 || $idProfesor <= 0 || $idGrupo <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros inválidos']);
        exit;
    }

    $dispDao = new ProfesordisposicionDAO($pdo);
    $progDao = new ProgramacionDAO($pdo);
    $trimDao = new TrimDAO($pdo);

    // 1) Validación servidor: detectar traslapes/empalmes con programación existente del profesor
    // Obtener horarios del grupo a asignar y programación actual del profesor
    $grupoInfo = $trimDao->obtenerGrupoConHorariosPorId($idGrupo);
    if (!$grupoInfo) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'msg' => 'Grupo no encontrado']);
        exit;
    }
    $progExist = $trimDao->obtenerProgramacionProfesorConHorarios($idTrimestre, $idProfesor);

    // Funciones de apoyo para comparar horarios
    $toMin = function($t){
        if ($t === null) return 0; $p = explode(':', (string)$t); $h = (int)($p[0] ?? 0); $m = (int)($p[1] ?? 0); return $h*60 + $m;
    };
    $overlap = function($aIni,$aFin,$bIni,$bFin) use ($toMin){
        $ai = $toMin($aIni); $af = $toMin($aFin); $bi = $toMin($bIni); $bf = $toMin($bFin);
        return ($ai < $bf) && ($bi < $af);
    };

    $conflicts = [];
    // Para cada horario del grupo destino, buscar traslape con cada horario de las asignaciones existentes
    $horariosNew = is_array($grupoInfo['horarios']) ? $grupoInfo['horarios'] : [];
    foreach ($horariosNew as $hn) {
        $dNew = mb_strtolower((string)$hn['dia']);
        foreach ($progExist as $ex) {
            $dEx = mb_strtolower((string)$ex['dia']);
            if ($dNew !== $dEx) continue;
            if ($overlap($hn['horaInicio'], $hn['horaFin'], $ex['horaInicio'], $ex['horaFin'])) {
                $conflicts[] = [
                    'existing' => [
                        'claveUEA' => $ex['claveUEA'] ?? '',
                        'nombreUEA' => $ex['nombreUEA'] ?? '',
                        'claveGrupo' => $ex['claveGrupo'] ?? '',
                        'dia' => $ex['dia'] ?? '',
                        'horaInicio' => $ex['horaInicio'] ?? '',
                        'horaFin' => $ex['horaFin'] ?? '',
                        'salon' => $ex['salon'] ?? ''
                    ],
                    'incoming' => [
                        'claveUEA' => $grupoInfo['uea']['claveUEA'] ?? '',
                        'nombreUEA' => $grupoInfo['uea']['nombreUEA'] ?? '',
                        'claveGrupo' => $grupoInfo['claveGrupo'] ?? '',
                        'dia' => $hn['dia'] ?? '',
                        'horaInicio' => $hn['horaInicio'] ?? '',
                        'horaFin' => $hn['horaFin'] ?? '',
                        'salon' => $grupoInfo['salon'] ?? ''
                    ],
                    'sameUEA' => (($ex['claveUEA'] ?? '') === ($grupoInfo['uea']['claveUEA'] ?? ''))
                ];
            }
        }
    }

    if (!empty($conflicts)) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'code' => 'overlap', 'msg' => 'Traslape de horario con programación existente', 'conflicts' => $conflicts]);
        exit;
    }

    // Asegurar o recuperar la disposicion
    $disp = $dispDao->buscarPorProfesorYTrimestre($idProfesor, $idTrimestre);
    $idPD = null;
    if ($disp && isset($disp['idProfesorDisposicion'])) {
        $idPD = (int)$disp['idProfesorDisposicion'];
    } else {
        $idPD = $dispDao->insertar($idTrimestre, $idProfesor, 1, 'creada automáticamente al asignar grupo');
        if (!$idPD) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'msg' => 'No se pudo crear la disposición del profesor']);
            exit;
        }
    }

    // 2) Si el grupo ya está asignado a otro profesor, borramos esa asignación antes de insertar
    $existing = $progDao->obtenerAsignacionPorGrupo($idTrimestre, $idGrupo);

    try {
        // usar transacción para evitar estado intermedio inconsistente
        $pdo->beginTransaction();

        if ($existing && isset($existing['idProfesor']) && (int)$existing['idProfesor'] !== (int)$idProfesor) {
            // eliminar programacion existente para este grupo en el trimestre
            $progDao->borrarProgramacionPorGrupo($idTrimestre, $idGrupo);
        }

        // insertar la nueva programacion
        $ok = $progDao->insertarProgramacion($idTrimestre, $idGrupo, $idPD);
        if (!$ok) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['ok' => false, 'msg' => 'No se pudo asignar el grupo (posible duplicado o restricción)']);
            exit;
        }

        $pdo->commit();
    } catch (Throwable $te) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $te;
    }

    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}
