<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/LugarVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/LugarDAO.php';

try{
    if (!isset($_GET['id'])){
        throw new Exception('Falta parámetro id');
    }
    $id = (int)$_GET['id'];
    $dao = new ProfesorDAO($pdo);
    $prof = $dao->obtenerProfesorPorId($id);
    if (!$prof){
        echo json_encode(['ok'=>false, 'error'=>'Profesor no encontrado']);
        exit;
    }

    $areas = $dao->obtenerAreaAcademicaPorProfesorId($id);
    $grupos = $dao->obtenerGrupoTematicoPorProfesorId($id);
    $contrato = $dao->obtenerProfesorContratoPorProfesorId($id);
    $contactos = $dao->obtenerContactosEmergenciaPorProfesorId($id);
    // Lugares asociados
    $lugarDao = new LugarDAO($pdo);
    $lugares = $lugarDao->listarPorProfesorId($id);

    echo json_encode([
        'ok' => true,
        'profesor' => $prof,
        'areas' => $areas,
        'grupos' => $grupos,
        'contrato' => $contrato,
    'contactos' => $contactos,
    'lugares' => $lugares
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
