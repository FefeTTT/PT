<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/FuncionVO.php';
require_once __DIR__ . '/../modelo/UsuarioVO.php';
require_once __DIR__ . '/../modelo/FuncionDAO.php';

$respuesta = ['ok' => false, 'funciones' => []];
try {
    $dao = new FuncionDAO($pdo);
    $funciones = $dao->obtenerTodasFunciones();
    $respuesta['ok'] = true;
    $respuesta['funciones'] = $funciones;
} catch (Exception $e) {
    $respuesta['ok'] = false;
    $respuesta['error'] = $e->getMessage();
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($respuesta, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

?>
