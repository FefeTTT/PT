<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';

try {
    // Se aceptan dos esquemas de invocación por retrocompatibilidad:
    // 1) Nuevo/actual: idPreferencia + ueas (JSON) + horarios (JSON objetos {dia,horaInicio,horaFin})
    // 2) Compatible con menuTrimestres: idTrimestre + idProfesor + noEco + noGrupos + obser + uea1..uea5 (idUEA) + horario[] (idHorario)

    $idTrimestre    = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $idProfesor     = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idPreferencia  = isset($_POST['idPreferencia']) ? (int)$_POST['idPreferencia'] : 0;
    $noGrupos       = isset($_POST['noGrupos']) && $_POST['noGrupos'] !== '' ? (int)$_POST['noGrupos'] : null;
    $observaciones  = null;
    // Aceptar ambos nombres de campo por compatibilidad con distintos frontends
    if (isset($_POST['observaciones'])) {
        $observaciones = trim($_POST['observaciones']);
    } elseif (isset($_POST['obser'])) {
        // `menuTrimestres.js` envía el campo como 'obser'
        $observaciones = trim($_POST['obser']);
    }

    // Inicializar DAO
    $dao = new PreferenciasDAO($pdo);

    // Si no viene idPreferencia, intentar asegurar una preferencia base a partir de idTrimestre + idProfesor
    if ($idPreferencia <= 0) {
        if ($idTrimestre > 0 && $idProfesor > 0) {
            $idPreferencia = $dao->ensurePreferenciaBase($idTrimestre, $idProfesor);
            if ($idPreferencia === null) {
                http_response_code(500);
                echo json_encode(['ok' => false, 'msg' => 'No se pudo asegurar la preferencia base']);
                exit;
            }
        }
    }

    if ($idPreferencia <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros inválidos: falta idPreferencia o idTrimestre+idProfesor']);
        exit;
    }

    // Manejar UEAs: puede venir como JSON en 'ueas' (array de objetos {idUEA, prioridad})
    // o como campos individuales uea1..uea5 con valores idUEA
    $ueas = [];
    if (isset($_POST['ueas'])) {
        $tmp = json_decode($_POST['ueas'], true);
        if (is_array($tmp)) $ueas = $tmp;
    } else {
        // leer uea1..uea5
        for ($i = 1; $i <= 5; $i++) {
            $k = 'uea' . $i;
            if (isset($_POST[$k]) && $_POST[$k] !== '' && $_POST[$k] !== '0') {
                $idU = (int)$_POST[$k];
                $ueas[] = ['idUEA' => $idU, 'prioridad' => $i];
            }
        }
    }

    // Manejar horarios: puede venir como JSON objetos {dia,horaInicio,horaFin} en 'horarios'
    // o como lista de ids en 'horario' (campo horario[])
    $horariosObjs = [];
    $horarioIds = [];
    if (isset($_POST['horarios'])) {
        $tmp = json_decode($_POST['horarios'], true);
        if (is_array($tmp)) $horariosObjs = $tmp;
    }
    if (isset($_POST['horario']) && is_array($_POST['horario'])) {
        // 'horario' es el nombre de los checkbox si se envía como horario[]
        foreach ($_POST['horario'] as $h) {
            $hh = (int)$h;
            if ($hh > 0) $horarioIds[] = $hh;
        }
    }

    // Actualizar base (solo si vienen valores)
    if ($noGrupos !== null || $observaciones !== null) {
        $dao->actualizarPreferenciaBase($idPreferencia, $noGrupos, $observaciones);
    }

    // Reemplazar UEAs si vienen
    if (!empty($ueas)) {
        $dao->reemplazarUEAsPreferidas($idPreferencia, $ueas);
    }

    // Reemplazar horarios: si vienen objetos (dia/horaInicio/horaFin) usar reemplazarHorariosPreferidos
    if (!empty($horariosObjs)) {
        $dao->reemplazarHorariosPreferidos($idPreferencia, $horariosObjs);
    } elseif (!empty($horarioIds)) {
        // Si vienen ids, borramos los existentes y añadimos por id usando el método directo del DAO
        try {
            $pdo->beginTransaction();
            $del = $pdo->prepare('DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias = :idP');
            $del->execute([':idP' => $idPreferencia]);
            foreach ($horarioIds as $hid) {
                $dao->insertarHorarioPreferenciaDirecto($idPreferencia, (int)$hid);
            }
            $pdo->commit();
        } catch (Exception $e) {
            try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
            http_response_code(500);
            echo json_encode(['ok' => false, 'msg' => 'Error al actualizar horarios: ' . $e->getMessage()]);
            exit;
        }
    }

    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    // Si ocurre un error, los DAOs deberían haber hecho rollback cuando correspondía.
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}
