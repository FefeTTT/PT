<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $id = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($id <= 0) throw new Exception('Id de trimestre inválido');

    $dao = new TrimDAO($pdo);
    try {
        // Contar filas dependientes antes de borrar (informativo)
        $stCount = $pdo->prepare('SELECT COUNT(*) AS c FROM profesordisposicion WHERE trimestre_idTrimestre = ?');
        $stCount->execute([$id]);
        $cnt_dispos = (int)$stCount->fetchColumn();

        $stGroups = $pdo->prepare('SELECT COUNT(*) AS c FROM grupo WHERE trimestre_idTrimestre = ?');
        $stGroups->execute([$id]);
        $cnt_groups = (int)$stGroups->fetchColumn();

        $stProg = $pdo->prepare('SELECT COUNT(*) AS c FROM programacion WHERE grupo_trimestre_idTrimestre = ?');
        $stProg->execute([$id]);
        $cnt_programacion = (int)$stProg->fetchColumn();

        $stPref = $pdo->prepare('SELECT COUNT(*) AS c FROM profesorpreferencias WHERE trimestre_idTrimestre = ?');
        $stPref->execute([$id]);
        $cnt_preferencias = (int)$stPref->fetchColumn();

        $ok = $dao->eliminarTrimestre($id);
    } catch (Exception $e) {
        // Pasar detalle de error al cliente (por ejemplo qué paso falló)
        throw new Exception('Error al eliminar trimestre: ' . $e->getMessage());
    }
    if (!$ok) throw new Exception('No se pudo eliminar el trimestre (posiblemente no existe)');
    // Responder con detalle: cuántas filas dependientes existían y (deberían) haberse borrado
    echo json_encode([
        'ok' => true,
        'msg' => 'Trimestre eliminado',
        'disposiciones_eliminadas' => $cnt_dispos,
        'grupos_eliminados' => $cnt_groups,
        'programacion_eliminada' => $cnt_programacion,
        'preferencias_eliminadas' => $cnt_preferencias
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch(Exception $e){
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
