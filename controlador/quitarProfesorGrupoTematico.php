<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idGrupo = isset($_POST['idGrupoTematico']) ? (int)$_POST['idGrupoTematico'] : 0;
    if ($idProfesor <= 0 || $idGrupo <= 0) throw new Exception('Parametros invalidos');

    $dao = new ProfesorDAO($pdo);
    $ok = $dao->eliminarGrupoTematicoHasProfesor($idGrupo, $idProfesor);
    if ($ok) echo json_encode(['ok' => true]); else throw new Exception('No se pudo quitar la asociación');

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
