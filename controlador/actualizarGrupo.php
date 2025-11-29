<?php
header('Content-Type: application/json; charset=utf-8');
try {
    include_once "../modelo/pdo.php"; // proporciona $pdo
    $idGrupo = isset($_POST['idGrupo']) ? (int)$_POST['idGrupo'] : 0;
    $clave = isset($_POST['claveGrupo']) ? trim($_POST['claveGrupo']) : null;
    if ($idGrupo <= 0 || $clave === null) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'msg' => 'Parámetros idGrupo y claveGrupo requeridos']);
        exit;
    }
    $st = $pdo->prepare('UPDATE grupo SET claveGrupo = :clave WHERE idGrupo = :id');
    $ok = $st->execute([':clave' => $clave, ':id' => $idGrupo]);
    if ($ok) {
        echo json_encode(['ok' => true, 'msg' => 'Grupo actualizado']);
    } else {
        echo json_encode(['ok' => false, 'msg' => 'No se pudo actualizar en la base de datos']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => 'Error interno: ' . $e->getMessage()]);
}
?>