<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try{
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $disponible = isset($_POST['disponible']) ? (int)$_POST['disponible'] : null;

    if ($idProfesor <= 0 || $idTrimestre <= 0) throw new Exception('Parametros invalidos');
    if ($disponible === null) throw new Exception('Falta parametro disponible');

    $pdDao = new ProfesordisposicionDAO($pdo);
    $ok = $pdDao->actualizarEstadoPorProfesorTrimestre($idProfesor, $idTrimestre, $disponible ? 1 : 0);
    if (!$ok) throw new Exception('No se pudo actualizar disponibilidad');

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
