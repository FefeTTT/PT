<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/FuncionVO.php';
require_once __DIR__ . '/../modelo/UsuarioVO.php';
require_once __DIR__ . '/../modelo/FuncionDAO.php';

header('Content-Type: application/json; charset=utf-8');

$usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : '';
$funcion_old = isset($_POST['funcion_old']) ? trim($_POST['funcion_old']) : '';
$funcion_new = isset($_POST['funcion_new']) ? trim($_POST['funcion_new']) : '';

if ($usuario === '' || $funcion_new === '') {
    echo json_encode(['ok' => false, 'msg' => 'usuario y funcion_new son requeridos']);
    exit;
}

try {
    $dao = new FuncionDAO($pdo);
    // Si existe función antigua, eliminarla
    if ($funcion_old !== '') {
        $dao->eliminarFuncionUsuarioNombre($usuario, $funcion_old);
    }
    // Asignar la nueva función (si no existe, el DAO puede crearla o fallar)
    $ok = $dao->asignarFuncionUsuarioNombre($usuario, $funcion_new);
    if ($ok) {
        echo json_encode(['ok' => true, 'msg' => 'Función actualizada']);
    } else {
        echo json_encode(['ok' => false, 'msg' => 'No se pudo asignar la nueva función']);
    }
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
}

?>
