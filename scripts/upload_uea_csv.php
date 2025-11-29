<?php
// scripts/upload_uea_csv.php
// Recibe un CSV (campo csvfile), lo mueve a scripts/temporales y procesa filas: claveUEA,nombreUEA,idArea

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

if (!isset($_FILES['csvfile']) || $_FILES['csvfile']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No se recibió archivo o hubo error en la subida']);
    exit;
}

// Directorio de temporales dentro de /scripts
$uploadDir = __DIR__ . DIRECTORY_SEPARATOR . 'temporales';
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'No se pudo crear el directorio de temporales']);
        exit;
    }
}

$originalName = basename($_FILES['csvfile']['name']);
// generar nombre seguro
$targetName = time() . '_' . preg_replace('/[^a-zA-Z0-9_\-.]/', '_', $originalName);
$targetPath = $uploadDir . DIRECTORY_SEPARATOR . $targetName;

if (!move_uploaded_file($_FILES['csvfile']['tmp_name'], $targetPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo mover el archivo al directorio temporal']);
    exit;
}

// Procesar CSV
$handle = fopen($targetPath, 'r');
if ($handle === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo abrir el archivo subido']);
    exit;
}


require_once __DIR__ . '/../modelo/pdo.php'; // debe proveer $pdo

// Ajustado al esquema de la BD (tabla `uea`, columna foreign key `area_idArea`)
$insert = $pdo->prepare('INSERT INTO uea (claveUEA, nombre, area_idArea) VALUES (:clave, :nombre, :idArea)');
$update = $pdo->prepare('UPDATE uea SET nombre=:nombre, area_idArea=:idArea WHERE claveUEA=:clave');
$select = $pdo->prepare('SELECT idUEA FROM uea WHERE claveUEA = :clave LIMIT 1');
// Prepared statement para verificar existencia de area
$selectArea = $pdo->prepare('SELECT idArea FROM area WHERE idArea = ? LIMIT 1');

// Usar transacción para mayor consistencia
$pdo->beginTransaction();

$line = 0;
$processed = 0;
$inserted = 0;
$updated = 0;
$errors = [];

// Detect BOM and handle different encodings: intentar UTF-8
// No asumimos cabecera; si detectamos que la primera fila tiene texto no numérico en idArea, intentamos usar como cabecera y saltarla
$maybeHeader = false;

while (($data = fgetcsv($handle, 0, ',')) !== false) {
    $line++;
    // Normalizar: eliminar BOM en primer campo
    if ($line === 1) {
        $data[0] = preg_replace('/^\xEF\xBB\xBF/', '', $data[0]);
    }
    // Ignorar filas totalmente vacías
    $allEmpty = true;
    foreach ($data as $c) { if (trim((string)$c) !== '') { $allEmpty = false; break; } }
    if ($allEmpty) continue;

    // Si la fila tiene menos de 3 columnas, registrar error
    if (count($data) < 3) {
        // intentar rellenar con valores vacíos
        for ($i = count($data); $i < 3; $i++) $data[$i] = '';
    }

    $clave = trim($data[0]);
    $nombre = trim($data[1]);
    $idArea = trim($data[2]);

    // Si la primera fila parece cabecera (ej. 'clave' o 'nombre' o 'idarea'), saltarla
    if ($line === 1) {
        $h0 = strtolower($clave);
        $h1 = strtolower($nombre);
        $h2 = strtolower($idArea);
        if (strpos($h0, 'clave') !== false || strpos($h1, 'nombre') !== false || strpos($h2, 'id') !== false) {
            $maybeHeader = true;
            continue; // saltar cabecera
        }
    }

    $processed++;

    // Validaciones mínimas
    if ($clave === '') {
        $errors[] = ['line' => $line, 'error' => 'Clave vacía'];
        continue;
    }
    if ($nombre === '') {
        $errors[] = ['line' => $line, 'error' => 'Nombre vacío'];
        continue;
    }
    if ($idArea === '') {
        $errors[] = ['line' => $line, 'error' => 'idArea vacío'];
        continue;
    }
    // Forzar idArea como entero
    $idAreaInt = intval(preg_replace('/\D/', '', $idArea));

    // Comprobar si existe
    try {
        // Verificar que el area exista
        $selectArea->execute([$idAreaInt]);
        $areaRow = $selectArea->fetch(PDO::FETCH_ASSOC);
        if (!$areaRow) {
            $errors[] = ['line' => $line, 'error' => 'Area no encontrada: ' . $idAreaInt];
            continue;
        }
        $select->execute([':clave' => $clave]);
        $row = $select->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            // actualizar
            $update->execute([':nombre' => $nombre, ':idArea' => $idAreaInt, ':clave' => $clave]);
            $updated++;
        } else {
            // insertar
            $insert->execute([':clave' => $clave, ':nombre' => $nombre, ':idArea' => $idAreaInt]);
            $inserted++;
        }
    } catch (Exception $e) {
        $errors[] = ['line' => $line, 'error' => 'DB: ' . $e->getMessage()];
        continue;
    }
}

fclose($handle);

// Commit de la transacción
try {
    if ($pdo->inTransaction()) $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error en DB al completar la transacción: ' . $e->getMessage()]);
    exit;
}

$response = [
    'ok' => true,
    'file' => 'scripts/temporales/' . $targetName,
    'processed' => $processed,
    'inserted' => $inserted,
    'updated' => $updated,
    'errors' => $errors
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

?>
