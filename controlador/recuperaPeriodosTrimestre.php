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
    $anio = isset($_POST['anio']) ? (int)$_POST['anio'] : null;
    $dao = new TrimDAO($pdo);
    $periodos = $dao->listarPeriodos();
    $used = [];
    if ($anio !== null){
        $trims = $dao->obtenerTrimestresPorAnio($anio);
        foreach($trims as $t){
            $used[] = (int)$t['trimestreperiodo_idTrimestrePeriodo'];
        }
    }
    echo json_encode(['ok'=>true,'periodos'=>$periodos,'used'=>$used], JSON_UNESCAPED_UNICODE);
    exit;
} catch(Exception $e){
    http_response_code(500);
    echo json_encode(['ok'=>false,'msg'=>$e->getMessage()]);
}

?>
