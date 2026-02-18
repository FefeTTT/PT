<?php
require_once '../ReactLoader.php';

header('Content-Type: application/json');

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido.');
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data)) {
        throw new Exception('Payload inválido.');
    }

    require_once '../modelo/pdo.php';
    global $pdo;

    $processed = 0;
    $successes = 0;
    $errors = 0;
    $details = [];

    $stmtGetDiaId = $pdo->prepare("SELECT idDiasDeTrabajo FROM dias_de_trabajo WHERE codigo_dias = ?");
    
    $stmtGetHorarioId = $pdo->prepare("
        SELECT idHorario 
        FROM horarios_contratacion 
        WHERE idDiasDeTrabajo = ? AND horaInicio = ? AND horaFin = ?
    ");

    $stmtInsertRelacion = $pdo->prepare("
        INSERT INTO profesor_has_horario_contratacion (numeroEconomico, idHorario) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE idHorario=idHorario
    ");

    $pdo->beginTransaction();

    foreach ($data as $codigoDia => $horariosPorDia) {
        $stmtGetDiaId->execute([$codigoDia]);
        $diaId = $stmtGetDiaId->fetchColumn();

        if (!$diaId) {
            $errors++;
            $details[] = "No encontrado codigo_dias: '$codigoDia'.";
            continue;
        }

        if (!is_array($horariosPorDia)) {
             continue;
        }

        foreach ($horariosPorDia as $rango => $objData) {
            $parts = explode('-', $rango);
            if (count($parts) !== 2) {
                $errors++;
                $details[] = "Rango inválido '$rango' en '$codigoDia'.";
                continue;
            }

            $inicio = trim($parts[0]) . ":00";
            $fin = trim($parts[1]) . ":00";

            $stmtGetHorarioId->execute([$diaId, $inicio, $fin]);
            $idHorario = $stmtGetHorarioId->fetchColumn();

            if (!$idHorario) {
                $errors++;
                $details[] = "No existe horario '$rango' ($inicio - $fin) para '$codigoDia'.";
                continue;
            }

            if (isset($objData['numerosEconomicos']) && is_array($objData['numerosEconomicos'])) {
                foreach ($objData['numerosEconomicos'] as $numEco) {
                    $processed++;
                    try {
                        $stmtInsertRelacion->execute([$numEco, $idHorario]);
                        $successes++;
                    } catch (PDOException $e) {
                         $errors++;
                         $details[] = "Error asignando horario $idHorario a profe $numEco: " . $e->getMessage();
                    }
                }
            }
        }
    }

    $pdo->commit();

    error_log(print_r($details, true));

    echo json_encode([
        'isItOk' => true,
        'processed' => $processed,
        'successes' => $successes,
        'errors' => $errors,
        'details' => $details
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'isItOk' => false,
        'error' => $e->getMessage()
    ]);
}
