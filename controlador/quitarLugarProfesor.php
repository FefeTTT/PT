<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/LugarVO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/LugarDAO.php';

try{
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idLugar = isset($_POST['idLugar']) ? (int)$_POST['idLugar'] : 0;
    if ($idProfesor <= 0 || $idLugar <= 0){ http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parámetros inválidos']); exit; }

    $dao = new LugarDAO($pdo);
    // Usar VO antes de invocar métodos del DAO (regla de la arquitectura)
    $lugarVO = new LugarVO($idLugar, '', null, '', '', null, null);

    // Ejecutar dentro de transacción: desasociar, luego eliminar lugar
    $pdo->beginTransaction();
    try{
        $ok1 = $dao->desasociarLugar($idProfesor, $idLugar);
        if (!$ok1){ $pdo->rollBack(); http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo quitar la asociación']); exit; }
        $ok2 = $dao->eliminarLugar($lugarVO);
        if (!$ok2){ $pdo->rollBack(); http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo eliminar el lugar']); exit; }
        $pdo->commit();
        echo json_encode(['ok'=>true]);
    } catch (Throwable $e){
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
    }
} catch (Throwable $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}
