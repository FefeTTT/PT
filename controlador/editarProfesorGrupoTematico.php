<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $idProfesor = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $idGrupoTematico = isset($_POST['idGrupoTematico']) ? (int)$_POST['idGrupoTematico'] : 0; // current mapping id
    $nuevoRol = isset($_POST['nuevoRol']) ? trim($_POST['nuevoRol']) : '';
    $confirmReplace = isset($_POST['confirmReplace']) && ($_POST['confirmReplace'] == '1' || $_POST['confirmReplace'] === true);

    if ($idProfesor <= 0) throw new Exception('idProfesor inválido');
    if ($idGrupoTematico <= 0) throw new Exception('idGrupoTematico inválido');
    if ($nuevoRol === '') throw new Exception('nuevoRol requerido');
    if (!in_array($nuevoRol, ['integrante','jefe'])) throw new Exception('nuevoRol inválido');

    $dao = new ProfesorDAO($pdo);
    $grupo = $dao->obtenerGrupoTematicoPorId($idGrupoTematico);
    if (!$grupo) throw new Exception('Grupo temático no encontrado');
    $nombre = $grupo['nombre'];
    $currentPuesto = $grupo['puesto'] ?? '';

    $isCurrentlyJefe = stripos($currentPuesto, 'jef') !== false;
    $wantJefe = ($nuevoRol === 'jefe');
    if ($isCurrentlyJefe === $wantJefe){
        echo json_encode(['ok' => true, 'changed' => false], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $targetGrupoId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($nombre, $wantJefe);
    if ($targetGrupoId === null) throw new Exception('No existe una entrada para el rol seleccionado en el grupo');

    if ($wantJefe){
        $current = $dao->obtenerProfesorVinculadoGrupoTematico($targetGrupoId);
        if ($current && $current['idProfesor'] != $idProfesor){
            if (!$confirmReplace){
                echo json_encode(['ok' => false, 'conflict' => true, 'current' => $current], JSON_UNESCAPED_UNICODE);
                exit;
            }
            // perform replacement transactionally: demote current to integrante, and promote this professor to jefe
            $pdo->beginTransaction();
            try{
                $inteId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($nombre, false);
                if ($inteId === null) throw new Exception('No existe entrada "integrante" para el grupo (no se puede mover jefe actual)');
                $dao->eliminarGrupoTematicoHasProfesor($targetGrupoId, (int)$current['idProfesor']);
                $dao->insertarGrupoTematicoHasProfesor($inteId, (int)$current['idProfesor']);
                $dao->eliminarGrupoTematicoHasProfesor($idGrupoTematico, $idProfesor);
                $dao->insertarGrupoTematicoHasProfesor($targetGrupoId, $idProfesor);
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
            $dao->eliminarGrupoTematicoHasProfesor($idGrupoTematico, $idProfesor);
            $dao->insertarGrupoTematicoHasProfesor($targetGrupoId, $idProfesor);
            $pdo->commit();
            echo json_encode(['ok' => true, 'changed' => true], JSON_UNESCAPED_UNICODE);
            exit;
        } catch (Exception $e){
            $pdo->rollBack(); throw $e;
        }
    } else {
        // want integrante: move mapping to integrante entry
        $inteId = $dao->obtenerGrupoTematicoIdPorNombreYPuesto($nombre, false);
        if ($inteId === null) throw new Exception('No existe entrada "integrante" para el grupo');
        $pdo->beginTransaction();
        try{
            $dao->eliminarGrupoTematicoHasProfesor($idGrupoTematico, $idProfesor);
            $dao->insertarGrupoTematicoHasProfesor($inteId, $idProfesor);
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
