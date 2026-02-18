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
    $stmtInsertHorario = $pdo->prepare("
        INSERT INTO horarios_contratacion (idDiasDeTrabajo, horaInicio, horaFin) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE idHorario=idHorario
    ");

    $pdo->beginTransaction();

    foreach ($data as $codigoDia => $horarios) {
        $stmtGetDiaId->execute([$codigoDia]);
        $diaId = $stmtGetDiaId->fetchColumn();

        if (!$diaId) {
            $errors++;
            $details[] = "Dias de trabajo '$codigoDia' no encontrados en la base de datos.";
            continue;
        }

        if (!is_array($horarios)) {
            $errors++;
            $details[] = "Formato inválido para '$codigoDia'. Se espera un arreglo de horarios.";
            continue;
        }

        foreach ($horarios as $rango) {
            $processed++;
            $parts = explode('-', $rango);
            if (count($parts) !== 2) {
                $errors++;
                $details[] = "Formato de rango inválido '$rango' en '$codigoDia'.";
                continue;
            }

            // Se agregan segundos para compatibilidad con type TIME en DB
            $inicio = trim($parts[0]) . ":00";
            $fin = trim($parts[1]) . ":00";

            try {
                $stmtInsertHorario->execute([$diaId, $inicio, $fin]);
                $successes++;
            } catch (PDOException $e) {
                $errors++;
                $details[] = "Error al insertar '$rango' para '$codigoDia': " . $e->getMessage();
            }
        }
    }

    $pdo->commit();

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
