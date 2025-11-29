<?php
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProgramacionDAO.php';
header('Content-Type: application/json; charset=utf-8');

// Leer posible entrada JSON cruda (si la petición usa Content-Type: application/json)
$rawInputContent = @file_get_contents('php://input');

try {
    // Espera POST con arrays (pueden venir como JSON string o como campos múltiples)
    $raw = $_POST;
    // Permitir también entrada JSON cruda. Usamos la lectura previa de php://input
    if (empty($raw)) {
        $jsonInput = $rawInputContent ?? '';
        $decoded = json_decode($jsonInput, true);
        if (is_array($decoded)) { $raw = $decoded; }
    }
    $arrTrimestres = [];
    $arrUEAs = [];
    $arrProfesores = [];

    // Preferir 'trimestresIds' si viene; si no, intentar con 'trimestres'
    if (isset($raw['trimestresIds'])) {
        if (is_string($raw['trimestresIds'])) {
            $tmp = json_decode($raw['trimestresIds'], true);
            if (is_array($tmp)) $arrTrimestres = $tmp; else $arrTrimestres = [$raw['trimestresIds']];
        } elseif (is_array($raw['trimestresIds'])) { $arrTrimestres = $raw['trimestresIds']; }
    } elseif (isset($raw['trimestres'])) {
        // Si 'trimestres' llega como array de objetos { anio, periodo }, el mapeo a int los descartará
        if (is_string($raw['trimestres'])) {
            $tmp = json_decode($raw['trimestres'], true);
            if (is_array($tmp)) $arrTrimestres = $tmp; else $arrTrimestres = [$raw['trimestres']];
        } elseif (is_array($raw['trimestres'])) { $arrTrimestres = $raw['trimestres']; }
    }
    if (isset($raw['ueas'])) {
        if (is_string($raw['ueas'])) {
            $tmp = json_decode($raw['ueas'], true);
            if (is_array($tmp)) $arrUEAs = $tmp; else $arrUEAs = [$raw['ueas']];
        } elseif (is_array($raw['ueas'])) { $arrUEAs = $raw['ueas']; }
    }
    if (isset($raw['profesores'])) {
        if (is_string($raw['profesores'])) {
            $tmp = json_decode($raw['profesores'], true);
            if (is_array($tmp)) $arrProfesores = $tmp; else $arrProfesores = [$raw['profesores']];
        } elseif (is_array($raw['profesores'])) { $arrProfesores = $raw['profesores']; }
    }

    $dao = new ProgramacionDAO($pdo);

    // Limpiar y mapear a IDs verdaderos según tipo de entrada
    // Trimestres: intentar convertir números directamente y descartar objetos
    $arrTrimestres = array_values(array_unique(array_filter(array_map(function($v){ return is_numeric($v) ? (int)$v : 0; }, $arrTrimestres), fn($v)=> $v>0)));

    // UEA: si llega claveUEA (string no numérico), mapear a idUEA
    // Mapear UEAs: intentar primero por clave (incluso si es numérica), luego por id numérico si no hay coincidencia
    $arrUEAs = array_values(array_unique(array_filter(array_map(function($v) use ($dao){
        if (is_string($v) && $v !== '') {
            // intentar mapear por claveUEA (la clave puede ser numérica como '1112005')
            $id = $dao->obtenerIdUEAPorClave($v);
            if ($id) return (int)$id;
        }
        // fallback: si es numérico, usar como id directo
        if (is_numeric($v)) return (int)$v;
        return 0;
    }, $arrUEAs), fn($v)=> $v>0)));

    // Profesores: si llega número económico (string no numérico de id), mapear a idProfesor por numeroEconomico
    // Mapear profesores: intentar primero por número económico (puede ser numérico), luego por idProfesor
    $arrProfesores = array_values(array_unique(array_filter(array_map(function($v) use ($dao){
        if (is_string($v) && $v !== '') {
            $id = $dao->obtenerIdProfesorPorEconomico($v);
            if ($id) return (int)$id;
        }
        if (is_numeric($v)) return (int)$v;
        return 0;
    }, $arrProfesores), fn($v)=> $v>0)));

    // arrays mapeados listos para consulta (no se escribe debug en producción)
    $data = $dao->obtenerProgramacionMulti($arrTrimestres, $arrUEAs, $arrProfesores);

    echo json_encode([
        'ok' => true,
        'filtros' => [
            'trimestres' => $arrTrimestres,
            'ueas' => $arrUEAs,
            'profesores' => $arrProfesores
        ],
        'total' => count($data),
        'programacion' => $data
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
