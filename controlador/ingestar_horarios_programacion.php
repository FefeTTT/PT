<?php
require_once '../ReactLoader.php';

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido.');
    }

    $inputJSON = file_get_contents('php://input');
    $ueas = json_decode($inputJSON, true);

    if (!is_array($ueas)) {
        throw new Exception('Payload inválido.');
    }

    require_once '../modelo/pdo.php';
    global $pdo;

    // Mapeo de días a enteros
    $mapaDias = ['L' => 1, 'M' => 2, 'Mi' => 3, 'J' => 4, 'V' => 5];

    $pdo->beginTransaction();

    // Prepared statements para optimizar inserciones en bucle
    $stmtInsertGrupo = $pdo->prepare("INSERT IGNORE INTO grupo (nombre) VALUES (:nombre)");
    $stmtSelectGrupo = $pdo->prepare("SELECT id FROM grupo WHERE nombre = :nombre LIMIT 1");
    
    $stmtInsertUeaGrupo = $pdo->prepare("INSERT IGNORE INTO uea_grupo (uea_clave, idGrupo, cupo_maximo) VALUES (:uea_clave, :idGrupo, :cupo)");
    $stmtSelectUeaGrupo = $pdo->prepare("SELECT id FROM uea_grupo WHERE uea_clave = :uea_clave AND idGrupo = :idGrupo LIMIT 1");
    
    $stmtInsertHorario = $pdo->prepare("INSERT INTO horario_grupo_uea (id_uea_grupo, dia_semana, hora_inicio, hora_fin) VALUES (:id_uea_grupo, :dia_semana, :hora_inicio, :hora_fin)");

    $successCount = 0;

    foreach ($ueas as $ueaObj) {
        $clave_uea = $ueaObj['clave'];
        
        foreach ($ueaObj['horarios'] as $horarioObj) {
            $nombre_grupo = $horarioObj['grupo'];
            $cupo = $horarioObj['cupo'];
            $dias = $horarioObj['dias'];

            // Resolver Grupo
            $stmtInsertGrupo->execute(['nombre' => $nombre_grupo]);
            $stmtSelectGrupo->execute(['nombre' => $nombre_grupo]);
            $idGrupo = $stmtSelectGrupo->fetchColumn();

            if (!$idGrupo) {
                throw new Exception("No se pudo obtener el ID para el grupo: $nombre_grupo");
            }

            // Insertar o Resolver UEA_Grupo
            $stmtInsertUeaGrupo->execute([
                'uea_clave' => $clave_uea,
                'idGrupo' => $idGrupo,
                'cupo' => $cupo
            ]);
            
            $stmtSelectUeaGrupo->execute([
                'uea_clave' => $clave_uea,
                'idGrupo' => $idGrupo
            ]);
            $id_uea_grupo = $stmtSelectUeaGrupo->fetchColumn();

            if (!$id_uea_grupo) {
                throw new Exception("No se pudo obtener el ID para uea_grupo clave: $clave_uea, grupo: $idGrupo");
            }

            // Insertar Horarios (Días)
            foreach ($dias as $diaLetra => $horas) {
                if (isset($mapaDias[$diaLetra])) {
                    $diaInt = $mapaDias[$diaLetra];
                    
                    // Mapeando las propiedades inicio y fin de JS
                    $horaInicio = $horas['inicio'];
                    $horaFin = $horas['fin'];
                    
                    if (strlen($horaInicio) == 5) $horaInicio .= ':00';
                    if (strlen($horaFin) == 5) $horaFin .= ':00';
                    
                    $stmtInsertHorario->execute([
                        'id_uea_grupo' => $id_uea_grupo,
                        'dia_semana' => $diaInt,
                        'hora_inicio' => $horaInicio,
                        'hora_fin' => $horaFin
                    ]);
                    $successCount++;
                }
            }
        }
    }

    $pdo->commit();
    echo json_encode([
        'status' => 'success', 
        'message' => 'Inserción down the tree completada con éxito.',
        'data' => [
            'total_horarios_insertados' => $successCount,
            'ueas_procesadas' => count($ueas)
        ]
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => 'Error de base de datos durante inserción.',
        'db_error' => $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
?>
