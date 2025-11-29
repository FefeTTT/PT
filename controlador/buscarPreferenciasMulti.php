<?php
require_once __DIR__ . '/../modelo/pdo.php';
// Para mapear claves UEA y números económicos a IDs internos reutilizamos ProgramacionDAO helpers
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
require_once __DIR__ . '/../modelo/PreferenciasDAO.php';
header('Content-Type: application/json; charset=utf-8');

try {
    // Leer entrada (permite JSON application/json o formulario)
    $raw = $_POST;
    if (empty($raw)) {
        $jsonInput = @file_get_contents('php://input');
        $decoded = json_decode($jsonInput, true);
        if (is_array($decoded)) { $raw = $decoded; }
    }

    $arrTrimestres = [];
    $arrUEAs = [];
    $arrProfesores = [];

    // trimestresIds preferidos; si no, usar 'trimestres'
    if (isset($raw['trimestresIds'])) {
        if (is_string($raw['trimestresIds'])) {
            $tmp = json_decode($raw['trimestresIds'], true);
            $arrTrimestres = is_array($tmp) ? $tmp : [$raw['trimestresIds']];
        } elseif (is_array($raw['trimestresIds'])) { $arrTrimestres = $raw['trimestresIds']; }
    } elseif (isset($raw['trimestres'])) {
        if (is_string($raw['trimestres'])) {
            $tmp = json_decode($raw['trimestres'], true);
            $arrTrimestres = is_array($tmp) ? $tmp : [$raw['trimestres']];
        } elseif (is_array($raw['trimestres'])) { $arrTrimestres = $raw['trimestres']; }
    }

    if (isset($raw['ueas'])) {
        if (is_string($raw['ueas'])) {
            $tmp = json_decode($raw['ueas'], true);
            $arrUEAs = is_array($tmp) ? $tmp : [$raw['ueas']];
        } elseif (is_array($raw['ueas'])) { $arrUEAs = $raw['ueas']; }
    }
    if (isset($raw['profesores'])) {
        if (is_string($raw['profesores'])) {
            $tmp = json_decode($raw['profesores'], true);
            $arrProfesores = is_array($tmp) ? $tmp : [$raw['profesores']];
        } elseif (is_array($raw['profesores'])) { $arrProfesores = $raw['profesores']; }
    }

    // Si el cliente envió un token que significa "todos" (por ejemplo 'ALL' o 'todos'),
    // interpretarlo como "sin filtro de profesores" (array vacío) para evitar
    // que se convierta accidentalmente en un id real si existe un número económico igual.
    if (!empty($arrProfesores)) {
        foreach ($arrProfesores as $v) {
            if (is_string($v) && in_array(strtolower(trim($v)), ['all', 'todos', 'todo'])) {
                $arrProfesores = [];
                break;
            }
        }
    }

    $progDao = new ProgramacionDAO($pdo);
    $prefDao = new PreferenciasDAO($pdo);

    // Normalizar trimestres a enteros > 0
    $arrTrimestres = array_values(array_unique(array_filter(array_map(function($v){ return is_numeric($v) ? (int)$v : 0; }, $arrTrimestres), fn($v)=> $v>0)));

    // Mapear UEAs: intentar por claveUEA (aunque sea numérica), sino usar como id si es numérico
    $arrUEAs = array_values(array_unique(array_filter(array_map(function($v) use ($progDao){
        if (is_string($v) && $v !== '') { $id = $progDao->obtenerIdUEAPorClave($v); if ($id) return (int)$id; }
        if (is_numeric($v)) return (int)$v; return 0;
    }, $arrUEAs), fn($v)=> $v>0)));

    // Mapear profesores: intentar por número económico primero; sino usar como id si es numérico
    $arrProfesores = array_values(array_unique(array_filter(array_map(function($v) use ($progDao){
        if (is_string($v) && $v !== '') { $id = $progDao->obtenerIdProfesorPorEconomico($v); if ($id) return (int)$id; }
        if (is_numeric($v)) return (int)$v; return 0;
    }, $arrProfesores), fn($v)=> $v>0)));

    $data = $prefDao->obtenerPreferenciasMulti($arrTrimestres, $arrUEAs, $arrProfesores);

    echo json_encode([
        'ok' => true,
        'filtros' => [ 'trimestres' => $arrTrimestres, 'ueas' => $arrUEAs, 'profesores' => $arrProfesores ],
        'total' => count($data),
        'preferencias' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

?>