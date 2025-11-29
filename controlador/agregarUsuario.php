<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/UsuarioVO.php';
require_once __DIR__ . '/../modelo/UsuarioDAO.php';

header('Content-Type: application/json; charset=utf-8');

$usuario = isset($_POST['usuario']) ? trim($_POST['usuario']) : '';
$contraseña = isset($_POST['contraseña']) ? $_POST['contraseña'] : '';
$funcion = isset($_POST['funcion']) ? trim($_POST['funcion']) : '';

if ($usuario === '' || $contraseña === '') {
    echo json_encode(['ok' => false, 'msg' => 'usuario y contraseña son requeridos']);
    exit;
}

try {
    $dao = new UsuarioDAO($pdo);
    // Comprobar si usuario ya existe (verificación directa en BD para evitar condiciones de carrera)
    $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM usuario WHERE usuario = :usuario LIMIT 1");
    $stmtCheck->execute([':usuario' => $usuario]);
    $count = (int) $stmtCheck->fetchColumn();
    if ($count > 0) {
        echo json_encode(['ok' => false, 'msg' => 'El nombre de usuario ya está en uso']);
        exit;
    }

    // Crear VO y usar DAO para insertar
    $vo = new UsuarioVO($usuario, $contraseña, 0, null);

    $pdo->beginTransaction();
    $ok = $dao->insertarUsuario($vo);
    if (!$ok) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'msg' => 'No se pudo insertar el usuario']);
        exit;
    }

    // Si se especificó función, asegurarse de que exista y asignarla
    if ($funcion !== '') {
        // Buscar idFuncion
        $stmt = $pdo->prepare("SELECT idFuncion FROM funcion WHERE nombre = :nombre LIMIT 1");
        $stmt->execute([':nombre' => $funcion]);
        $idF = $stmt->fetchColumn();
        if (!$idF) {
            // Crear función
            $ins = $pdo->prepare("INSERT INTO funcion (nombre, descripcion) VALUES (:nombre, :desc)");
            $ins->execute([':nombre' => $funcion, ':desc' => '']);
            $idF = $pdo->lastInsertId();
        }
        // Asignar usando DAO helper
        $dao->insertarUsuarioFuncion($usuario, $funcion);
    }

    $pdo->commit();
    echo json_encode(['ok' => true, 'msg' => 'Usuario agregado correctamente']);
    exit;
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['ok' => false, 'msg' => $e->getMessage()]);
    exit;
}

?>
