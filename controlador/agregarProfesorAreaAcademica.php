<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $areaNombre = isset($_POST['areaNombre']) ? trim($_POST['areaNombre']) : '';
    $rol = isset($_POST['rol']) ? trim($_POST['rol']) : 'integrante'; // 'jefe' or 'integrante'
    $confirmReplace = isset($_POST['confirmReplace']) && ($_POST['confirmReplace'] == '1' || $_POST['confirmReplace'] === true);

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($areaNombre === '') throw new Exception('areaNombre requerido');

    $dao = new ProfesorDAO($pdo);

    if ($rol === 'jefe'){
        $jefeAreaId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($areaNombre, true);
        if ($jefeAreaId === null) throw new Exception('No existe una entrada "jefe" para el área seleccionada');
        // check current jefe
        $current = $dao->obtenerProfesorVinculadoAreaAcademica($jefeAreaId);
        if ($current && $current['idProfesor'] != $idProfesor){
            if (!$confirmReplace){
                // inform caller who is current jefe
                echo json_encode(['ok' => false, 'conflict' => true, 'current' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            }
            // perform replacement transactionally
            $pdo->beginTransaction();
            try{
                // find an integrante area id
                $inteId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($areaNombre, false);
                if ($inteId === null) throw new Exception('No existe una entrada "integrante" para el área (no se puede mover el jefe actual)');
                // remove current from jefe area
                $dao->eliminarAreaAcademicaHasProfesor($jefeAreaId, (int)$current['idProfesor']);
                // add current as integrante
                $dao->insertarAreaAcademicaHasProfesor($inteId, (int)$current['idProfesor']);
                // add new profesor as jefe
                $dao->insertarAreaAcademicaHasProfesor($jefeAreaId, $idProfesor);
                $pdo->commit();
                echo json_encode(['ok' => true, 'replaced' => true, 'previous' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            } catch (Exception $e){
                $pdo->rollBack();
                throw $e;
            }
        }
        // no current or same professor -> just insert mapping
        $ok = $dao->insertarAreaAcademicaHasProfesor($jefeAreaId, $idProfesor);
        echo json_encode(['ok' => (bool)$ok, 'conflict' => false], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        // integrante
        $inteId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($areaNombre, false);
        if ($inteId === null) throw new Exception('No existe una entrada "integrante" para el área seleccionada');
        $ok = $dao->insertarAreaAcademicaHasProfesor($inteId, $idProfesor);
        echo json_encode(['ok' => (bool)$ok], JSON_UNESCAPED_UNICODE);
        exit;
    }

} catch (Exception $e){
    error_log("agregarProfesorAreaAcademica error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
