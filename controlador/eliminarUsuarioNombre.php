<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/UsuarioVO.php';
require_once __DIR__ . '/../modelo/UsuarioDAO.php';

header('Content-Type: application/json; charset=utf-8');

// Start session to check user role
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : '';

// Authorization: only allow users with an administrative function to delete
// Assumption: login sets $_SESSION['funcion_name'] (e.g. 'admin' or 'Administrador') and $_SESSION['user_name']
// We perform a case-insensitive substring check for 'admin' or exact 'administrador'. Adjust if your roles differ.
$roleName = isset($_SESSION['funcion_name']) ? trim($_SESSION['funcion_name']) : '';
$loggedUser = isset($_SESSION['user_name']) ? trim($_SESSION['user_name']) : '';
if ($loggedUser === '' || $roleName === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'msg' => 'No autenticado']);
    exit;
}
$roleLower = mb_strtolower($roleName, 'UTF-8');
if (stripos($roleLower, 'admin') === false && $roleLower !== 'administrador') {
    // Not an admin
    http_response_code(403);
    echo json_encode(['ok' => false, 'msg' => 'No autorizado']);
    exit;
}

if ($usuario === '') {
    echo json_encode(['ok' => false, 'msg' => 'Parametro usuario requerido']);
    exit;
}

try {
    $dao = new UsuarioDAO($pdo);

    // Intentar eliminar por nombre usando el DAO
    $pdo->beginTransaction();
    $ok = $dao->eliminarUsuarioNombre($usuario);
    if (!$ok) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'msg' => 'Usuario no encontrado o no se pudo eliminar']);
        exit;
    }
    $pdo->commit();

    echo json_encode(['ok' => true, 'msg' => 'Usuario eliminado correctamente']);
    exit;
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
    exit;
}

?>
