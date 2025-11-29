<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idProfesorEmergencia = isset($_POST['idProfesorEmergencia']) ? (int)$_POST['idProfesorEmergencia'] : 0;
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
    $parentesco = isset($_POST['parentesco']) ? trim($_POST['parentesco']) : '';
    $celular = isset($_POST['celular']) ? trim($_POST['celular']) : '';

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idProfesorEmergencia <= 0) throw new Exception('idProfesorEmergencia inválido');
    if ($nombre === '') throw new Exception('nombre requerido');
    if ($parentesco === '') throw new Exception('parentesco requerido');
    if ($celular === '') throw new Exception('celular requerido');
    if (!preg_match('/^\d{10}$/', $celular)) throw new Exception('celular debe tener 10 dígitos');

    $dao = new ProfesorDAO($pdo);
    $row = $dao->actualizarProfesorEmergencia($idProfesorEmergencia, $idProfesor, $nombre, $parentesco, $celular);
    if ($row === null) throw new Exception('No se pudo actualizar el contacto (no encontrado o error)');
    echo json_encode(['ok' => true, 'contacto' => $row], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
