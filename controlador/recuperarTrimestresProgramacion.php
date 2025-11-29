<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php'; // for listarTrimestres method lives here (or TrimDAO?)
require_once __DIR__ . '/../modelo/TrimDAO.php'; // fallback
header('Content-Type: application/json; charset=utf-8');
try {
    // Listar trimestres: año + sigla
    // Preferir ProfesorDAO::listarTrimestres si existe; si no, usar consulta directa.
    $trims = [];
    // Preferir el DAO de Profesor si tiene listarTrimestres, sino usar TrimDAO si existe.
    try {
        $daoProf = new ProfesorDAO($pdo);
        if (method_exists($daoProf, 'listarTrimestres')) {
            $trims = $daoProf->listarTrimestres();
        }
    } catch (Exception $e) {
        // ignore and try TrimDAO next
    }

    if (empty($trims)) {
        try {
            $daoTrim = new TrimDAO($pdo);
            if (method_exists($daoTrim, 'obtenerTodosTrimestres')) {
                $trims = $daoTrim->obtenerTodosTrimestres();
            } elseif (method_exists($daoTrim, 'obtenerTrimestresPorAnio')) {
                // no hay año especificado aquí; obtener todos trimestres a falta de un método más simple
                $trims = $daoTrim->obtenerTodosTrimestres();
            }
        } catch (Exception $e) {
            // si no hay DAO disponible, dejar trimestres vacío (no ejecutar queries directos desde el controlador)
            $trims = [];
        }
    }
    $out = [];
    foreach ($trims as $t) {
        $out[] = [
            'idTrimestre' => (int)$t['idTrimestre'],
            'anio' => (int)$t['año'],
            'sigla' => $t['sigla'],
            'label' => $t['año'] . ' - ' . $t['sigla']
        ];
    }
    echo json_encode(['ok' => true, 'trimestres' => $out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
