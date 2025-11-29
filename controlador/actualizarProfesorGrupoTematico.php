<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idGrupoActual = isset($_POST['idGrupoActual']) ? (int)$_POST['idGrupoActual'] : 0;
    $grupoNombre = isset($_POST['grupoNombre']) ? trim($_POST['grupoNombre']) : '';
    $rolDeseado = isset($_POST['rol']) ? trim($_POST['rol']) : '';

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idGrupoActual <= 0) throw new Exception('idGrupoActual inválido');
    if ($grupoNombre === '') throw new Exception('grupoNombre requerido');
    if (!in_array($rolDeseado, ['jefe','integrante'])) throw new Exception('rol inválido');

    $dao = new ProfesorDAO($pdo);

    $pdo->beginTransaction();
    try{
        $esJefe = ($rolDeseado === 'jefe');
        $targetId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($grupoNombre, $esJefe);
        if ($targetId === null) throw new Exception('No existe una entrada con el rol solicitado para este grupo');

        if ($idGrupoActual == $targetId){
            $pdo->commit();
            echo json_encode(['ok' => true, 'changed' => false], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($esJefe){
            $current = $dao->obtenerProfesorVinculadoGrupoTematico($targetId);
            if ($current && (int)$current['idProfesor'] !== $idProfesor){
                $inteId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($grupoNombre, false);
                if ($inteId === null) throw new Exception('No existe entrada integrante para este grupo (no se puede demotar al jefe actual)');
                $dao->eliminarGrupoTematicoHasProfesor($targetId, (int)$current['idProfesor']);
                $dao->insertarGrupoTematicoHasProfesor($inteId, (int)$current['idProfesor']);
            }
        }

        $dao->eliminarGrupoTematicoHasProfesor($idGrupoActual, $idProfesor);
        $dao->insertarGrupoTematicoHasProfesor($targetId, $idProfesor);

        $pdo->commit();
        echo json_encode(['ok' => true, 'changed' => true], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e){
        $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
