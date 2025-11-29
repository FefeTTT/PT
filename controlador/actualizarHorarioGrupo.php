<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']); exit;
    }
    $idGrupo = isset($_POST['idGrupo']) ? (int)$_POST['idGrupo'] : null;
    $dia = isset($_POST['dia']) ? trim((string)$_POST['dia']) : null;
    $idHorario = isset($_POST['idHorario']) && $_POST['idHorario'] !== '' ? (int)$_POST['idHorario'] : null;
    if ($idGrupo === null || $dia === null) { http_response_code(400); echo json_encode(['ok'=>false,'msg'=>'Parametros idGrupo y dia requeridos']); exit; }

    $dao = new TrimDAO($pdo);
    $ok = $dao->setHorarioGrupoDia($idGrupo, $dia, $idHorario);
    if ($ok) echo json_encode(['ok'=>true]); else { http_response_code(500); echo json_encode(['ok'=>false,'msg'=>'No se pudo actualizar']); }
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
    exit;
}

