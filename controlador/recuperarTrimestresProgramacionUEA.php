<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
header('Content-Type: application/json; charset=utf-8');

$rawInputContent = @file_get_contents('php://input');

try {
    $raw = $_POST;
    if (empty($raw)) {
        $decoded = json_decode($rawInputContent ?: '', true);
        if (is_array($decoded)) { $raw = $decoded; }
    }

    // admitir varios nombres de campo para clave
    $claveUEA = '';
    foreach (['claveUEA','uea','clave'] as $k) {
        if (isset($raw[$k]) && is_string($raw[$k]) && trim($raw[$k]) !== '') { $claveUEA = trim($raw[$k]); break; }
    }

    if ($claveUEA === '') {
        echo json_encode(['ok'=>false,'error'=>'Falta parametro claveUEA'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);return;
    }

    $dao = new ProgramacionDAO($pdo);
    $rows = $dao->obtenerProgramacionPorClaveUEA($claveUEA);

    if (empty($rows)) {
        echo json_encode(['ok'=>true,'claveUEA'=>$claveUEA,'trimestres'=>[],'totalTrimestres'=>0,'totalGrupos'=>0], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);return;
    }

    // Agrupar por trimestre
    $map = [];
    foreach ($rows as $r) {
        $idT = $r['idTrimestre'];
        if (!isset($map[$idT])) {
            $map[$idT] = [
                'idTrimestre' => $idT,
                'trimestre' => $r['trimestre'],
                'grupos' => []
            ];
        }
        $map[$idT]['grupos'][] = [
            'idGrupo' => $r['idGrupo'],
            'claveGrupo' => $r['grupo'],
            'salon' => $r['salon'],
            'cupo' => $r['cupo'],
            'profesor' => [
                'idProfesor' => $r['idProfesor'],
                'numeroEconomico' => $r['numeroEconomico'],
                'nombre' => $r['profesor']
            ],
            'horario' => [
                'lunes' => $r['lunes'],
                'martes' => $r['martes'],
                'miercoles' => $r['miercoles'],
                'jueves' => $r['jueves'],
                'viernes' => $r['viernes']
            ]
        ];
    }

    // Construir salida ordenada por idTrimestre asc
    ksort($map, SORT_NUMERIC);
    $trimestres = array_values($map);
    $totalGrupos = array_sum(array_map(fn($t)=> count($t['grupos']), $trimestres));

    echo json_encode([
        'ok' => true,
        'claveUEA' => $claveUEA,
        'trimestres' => $trimestres,
        'totalTrimestres' => count($trimestres),
        'totalGrupos' => $totalGrupos
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
