<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idProfesorContrato = isset($_POST['idProfesorContrato']) ? (int)$_POST['idProfesorContrato'] : 0;
    $idProfesorTipo = isset($_POST['idProfesorTipo']) ? (int)$_POST['idProfesorTipo'] : 0;
    $descripcion = isset($_POST['descripcion']) ? trim($_POST['descripcion']) : null;

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idProfesorContrato <= 0) throw new Exception('idProfesorContrato inválido');
    if ($idProfesorTipo <= 0) throw new Exception('Tipo de contrato inválido');

    $dao = new ProfesorDAO($pdo);
    $row = $dao->actualizarProfesorContrato($idProfesorContrato, $idProfesor, $idProfesorTipo, $descripcion);
    if ($row === null) throw new Exception('No se pudo actualizar el contrato');
    echo json_encode(['ok' => true, 'contrato' => $row], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
