<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idProfesorContrato = isset($_POST['idProfesorContrato']) ? (int)$_POST['idProfesorContrato'] : 0;

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idProfesorContrato <= 0) throw new Exception('idProfesorContrato inválido');

    $dao = new ProfesorDAO($pdo);
    $ok = $dao->eliminarProfesorContrato($idProfesorContrato, $idProfesor);
    if (!$ok) throw new Exception('No se pudo eliminar el contrato');
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
