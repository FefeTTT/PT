<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idAreaAcademica = isset($_POST['idAreaAcademica']) ? (int)$_POST['idAreaAcademica'] : 0; // current mapping id
    $nuevoRol = isset($_POST['nuevoRol']) ? trim($_POST['nuevoRol']) : '';
    $confirmReplace = isset($_POST['confirmReplace']) && ($_POST['confirmReplace'] == '1' || $_POST['confirmReplace'] === true);

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idAreaAcademica <= 0) throw new Exception('idAreaAcademica inválido');
    if ($nuevoRol === '') throw new Exception('nuevoRol requerido');
    if (!in_array($nuevoRol, ['integrante','jefe'])) throw new Exception('nuevoRol inválido');

    $dao = new ProfesorDAO($pdo);
    $area = $dao->obtenerAreaAcademicaPorId($idAreaAcademica);
    if (!$area) throw new Exception('Área académica no encontrada');
    $nombre = $area['nombre'];
    // determine current puesto for this specific area id
    $currentPuesto = $area['puesto'] ?? '';

    // If desired role matches current puesto semantics, nothing to do
    $isCurrentlyJefe = stripos($currentPuesto, 'jef') !== false;
    $wantJefe = ($nuevoRol === 'jefe');
    if ($isCurrentlyJefe === $wantJefe){
        echo json_encode(['ok' => true, 'changed' => false], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Lookup target area id for desired role
    $targetAreaId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($nombre, $wantJefe);
    if ($targetAreaId === null) throw new Exception('No existe una entrada para el rol seleccionado en el área');

    if ($wantJefe){
        // If making this professor jefe, check current jefe
        $current = $dao->obtenerProfesorVinculadoAreaAcademica($targetAreaId);
        if ($current && $current['idProfesor'] != $idProfesor){
            if (!$confirmReplace){
                echo json_encode(['ok' => false, 'conflict' => true, 'current' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            }
            // perform replacement transactionally: demote current to integrante, and promote this professor to jefe
            $pdo->beginTransaction();
            try{
                $inteId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($nombre, false);
                if ($inteId === null) throw new Exception('No existe entrada "integrante" para el área (no se puede mover jefe actual)');
                // remove current from jefe area
                $dao->eliminarAreaAcademicaHasProfesor($targetAreaId, (int)$current['idProfesor']);
                // add current as integrante
                $dao->insertarAreaAcademicaHasProfesor($inteId, (int)$current['idProfesor']);
                // remove this professor's current mapping
                $dao->eliminarAreaAcademicaHasProfesor($idAreaAcademica, $idProfesor);
                // add this professor as jefe
                $dao->insertarAreaAcademicaHasProfesor($targetAreaId, $idProfesor);
                $pdo->commit();
                echo json_encode(['ok' => true, 'replaced' => true, 'previous' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            } catch (Exception $e){
                $pdo->rollBack();
                throw $e;
            }
        }
        // No conflict or same professor -> simple move
        $pdo->beginTransaction();
        try{
            $dao->eliminarAreaAcademicaHasProfesor($idAreaAcademica, $idProfesor);
            $dao->insertarAreaAcademicaHasProfesor($targetAreaId, $idProfesor);
            $pdo->commit();
            echo json_encode(['ok' => true, 'changed' => true], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e){
            $pdo->rollBack(); throw $e;
        }
    } else {
        // want integrante: move mapping to integrante entry
        $inteId = $dao->obtenerAreaAcademicaIdPorNombreYPuesto($nombre, false);
        if ($inteId === null) throw new Exception('No existe entrada "integrante" para el área');
        $pdo->beginTransaction();
        try{
            $dao->eliminarAreaAcademicaHasProfesor($idAreaAcademica, $idProfesor);
            $dao->insertarAreaAcademicaHasProfesor($inteId, $idProfesor);
            $pdo->commit();
            echo json_encode(['ok' => true, 'changed' => true], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e){
            $pdo->rollBack(); throw $e;
        }
    }

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
