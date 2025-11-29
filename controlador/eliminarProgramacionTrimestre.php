<?php
header('Content-Type: application/json; charset=utf-8');
// Alias controller: forwards to ProgramacionDAO borrarPorTrimestre implementation
require_once __DIR__ . '/../modelo/pdo.php'; // provides $pdo
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/GrupoDAO.php';

$idTrimestre = isset($_POST['idTrimestre']) ? intval($_POST['idTrimestre']) : 0;
if ($idTrimestre <= 0) {
    echo json_encode(['ok' => false, 'error' => 'idTrimestre inválido o no proporcionado']);
    exit;
}

try {
    // Use transaction to ensure consistency
    $pdo->beginTransaction();
    $programacionDao = new ProgramacionDAO($pdo);
    $deleted = $programacionDao->borrarPorTrimestre($idTrimestre);
    // After deleting programacion rows, remove grupos and their horario links for the trimestre
    $grupoDao = new GrupoDAO($pdo);
    $grpCounts = $grupoDao->borrarPorTrimestre($idTrimestre);

    $pdo->commit();

    $totalDeleted = (int)$deleted + (int)$grpCounts['grupo_has_horario'] + (int)$grpCounts['grupos'];
    echo json_encode([
        'ok' => true,
        'deleted' => $totalDeleted,
        'deleted_breakdown' => [
            'programacion' => (int)$deleted,
            'grupo_has_horario' => (int)$grpCounts['grupo_has_horario'],
            'grupos' => (int)$grpCounts['grupos']
        ]
    ]);
} catch (Exception $e) {
    try { $pdo->rollBack(); } catch(Exception $e2) {}
    error_log('Error eliminarProgramacionTrimestre: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
