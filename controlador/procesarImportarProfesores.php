<?php
// controlador/procesarImportarProfesores.php
// Importa un Excel con una columna "ECO." que contiene números económicos de profesores
// Objetivo: Para el trimestre indicado, activar (estado=1) en profesordisposicion a los profesores listados.
// Y poner en estado=0 a los que no estén en el archivo (sólo si ya tienen fila en profesordisposicion para ese trimestre).
// Si hay números económicos que no existen en la tabla profesor, devolver en missing_profesores para que el front permita registrarlos.

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido');
    }

    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0) throw new Exception('idTrimestre requerido');

    if (!isset($_FILES['excelFile']) || $_FILES['excelFile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No se recibió archivo o hubo error en la subida');
    }

    $tmpPath = $_FILES['excelFile']['tmp_name'];
    $spreadsheet = IOFactory::load($tmpPath);
    $sheet = $spreadsheet->getActiveSheet();
    $rows = $sheet->toArray(null, true, true, true);

    if (!$rows || count($rows) === 0) throw new Exception('El archivo está vacío');

    // Detectar encabezados en la primera fila
    $header = $rows[1];
    $colEco = null;
    foreach ($header as $col => $name) {
        $n = strtoupper(trim((string)$name));
        if ($n === 'ECO.' || $n === 'ECO' || $n === 'N.ECO' || $n === 'NUMERO ECONOMICO' || $n === 'NÚMERO ECONÓMICO') {
            $colEco = $col; break;
        }
    }
    if (!$colEco) throw new Exception('No se encontró la columna "ECO." en el encabezado');

    $profDao = new ProfesorDAO($pdo);
    $dispDao = new ProfesordisposicionDAO($pdo);

    $economicos = [];
    $missing_profesores = [];
    $line = 0;

    foreach ($rows as $idx => $r) {
        $line = $idx;
        if ($idx === 1) continue; // header
        $raw = isset($r[$colEco]) ? trim((string)$r[$colEco]) : '';
        if ($raw === '') continue; // saltar filas vacías
        // normalizar a sólo dígitos
        $eco = preg_replace('/\D+/', '', $raw);
        if ($eco === '') continue;
        $economicos[] = (int)$eco;
    }

    // Unificar y filtrar duplicados
    $economicos = array_values(array_unique(array_map('intval', $economicos)));
    $stats = [
        'total_rows' => max(0, count($rows) - 1),
        'ecos_detectados' => count($economicos),
        'existen_profesores' => 0,
        'faltantes' => 0,
        'inserted_disposicion' => 0,
        'updated_estado_1' => 0,
        'updated_estado_0' => 0
    ];

    // Mapear eco -> idProfesor (existentes) y recolectar faltantes
    $idsProfes = [];
    foreach ($economicos as $eco) {
        $p = $profDao->obtenerProfesorPorNumeroEconomico((int)$eco);
        if ($p && isset($p['idProfesor'])) {
            $idsProfes[] = (int)$p['idProfesor'];
            $stats['existen_profesores']++;
        } else {
            $missing_profesores[] = [
                'eco' => (int)$eco,
                // prefill correo sugerido: si viene uno institucional típico, sino vacío
                'correo_sugerido' => (string)$eco . '@azc.uam.mx'
            ];
        }
    }
    $stats['faltantes'] = count($missing_profesores);

    // Iniciar transacción para actualizar profesordisposicion
    $pdo->beginTransaction();
    try {
        // 1) Poner en estado=0 a todos los que no estén en la lista (sólo filas del mismo trimestre)
        // Hacemos UPDATE condicionado a NOT IN (si la lista está vacía, ponemos 0 a todos los que tienen fila)
        if (!empty($idsProfes)) {
            $placeholders = implode(',', array_fill(0, count($idsProfes), '?'));
            $params = $idsProfes;
            array_unshift($params, $idTrimestre);
            $sql0 = "UPDATE profesordisposicion SET estado = 0 WHERE trimestre_idTrimestre = ? AND profesor_idProfesor NOT IN ($placeholders)";
            $st0 = $pdo->prepare($sql0);
            $st0->execute($params);
            $stats['updated_estado_0'] = $st0->rowCount();
        } else {
            // lista vacía: nadie debe estar disponible en este trimestre
            $st0 = $pdo->prepare('UPDATE profesordisposicion SET estado = 0 WHERE trimestre_idTrimestre = ?');
            $st0->execute([$idTrimestre]);
            $stats['updated_estado_0'] = $st0->rowCount();
        }

        // 2) Activar/crear filas para todos los idsProfes detectados
        foreach ($idsProfes as $idProf) {
            // Intentar actualizar; si no existe, el DAO inserta
            $existed = $dispDao->buscarPorProfesorYTrimestre($idProf, $idTrimestre);
            if ($existed) {
                if ((int)$existed['estado'] !== 1) {
                    $ok = $dispDao->actualizarEstadoPorProfesorTrimestre($idProf, $idTrimestre, 1);
                    if ($ok) $stats['updated_estado_1']++;
                }
            } else {
                $newId = $dispDao->insertar($idTrimestre, $idProf, 1, 'Importación ECO.');
                if ($newId) $stats['inserted_disposicion']++;
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    echo json_encode([
        'ok' => true,
        'stats' => $stats,
        'missing_profesores' => $missing_profesores
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
