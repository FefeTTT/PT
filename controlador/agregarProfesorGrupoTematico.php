<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $grupoNombre = isset($_POST['grupoNombre']) ? trim($_POST['grupoNombre']) : '';
    $rol = isset($_POST['rol']) ? trim($_POST['rol']) : 'integrante'; // 'jefe' or 'integrante'
    $confirmReplace = isset($_POST['confirmReplace']) && ($_POST['confirmReplace'] == '1' || $_POST['confirmReplace'] === true);

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($grupoNombre === '') throw new Exception('grupoNombre requerido');

    $dao = new ProfesorDAO($pdo);

    if ($rol === 'jefe'){
        $jefeGrupoId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($grupoNombre, true);
        if ($jefeGrupoId === null) throw new Exception('No existe una entrada "jefe" para el grupo seleccionado');
        // check current jefe
        $current = $dao->obtenerProfesorVinculadoGrupoTematico($jefeGrupoId);
        if ($current && $current['idProfesor'] != $idProfesor){
            if (!$confirmReplace){
                echo json_encode(['ok' => false, 'conflict' => true, 'current' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            }
            // perform replacement transactionally
            $pdo->beginTransaction();
            try{
                $inteId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($grupoNombre, false);
                if ($inteId === null) throw new Exception('No existe una entrada "integrante" para el grupo (no se puede mover el jefe actual)');
                $dao->eliminarGrupoTematicoHasProfesor($jefeGrupoId, (int)$current['idProfesor']);
                $dao->insertarGrupoTematicoHasProfesor($inteId, (int)$current['idProfesor']);
                $dao->insertarGrupoTematicoHasProfesor($jefeGrupoId, $idProfesor);
                $pdo->commit();
                echo json_encode(['ok' => true, 'replaced' => true, 'previous' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            } catch (Exception $e){
                $pdo->rollBack();
                throw $e;
            }
        }
        $ok = $dao->insertarGrupoTematicoHasProfesor($jefeGrupoId, $idProfesor);
        echo json_encode(['ok' => (bool)$ok, 'conflict' => false], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        $inteId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($grupoNombre, false);
        if ($inteId === null) throw new Exception('No existe una entrada "integrante" para el grupo seleccionado');
        $ok = $dao->insertarGrupoTematicoHasProfesor($inteId, $idProfesor);
        echo json_encode(['ok' => (bool)$ok], JSON_UNESCAPED_UNICODE);
        exit;
    }

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
