<?php
// import_profesores.php
// Usage: php import_profesores.php "C:\path\to\profesores.csv"
// Defaults assume local XAMPP MySQL with user 'usrdoccb' and password 'password'.

// Determine CSV path: support CLI and HTTP (POST/GET with 'file' param)
if (php_sapi_name() === 'cli') {
    $csvPath = $argv[1] ?? __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'profesores.csv';
    $csvPath = realpath($csvPath);
    if (!$csvPath || !is_readable($csvPath)) {
        fwrite(STDERR, "CSV file not found or not readable: {$argv[1]}\n");
        exit(2);
    }
} else {
    // Expect a filename (basename) in POST/GET that lives under scripts/temporales
    $fileParam = $_POST['file'] ?? $_GET['file'] ?? null;
    if (!$fileParam) {
        header('HTTP/1.1 400 Bad Request');
        echo "Missing 'file' parameter.";
        exit(2);
    }
    $base = basename($fileParam); // prevent directory traversal
    $tmpDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'temporales');
    if (!$tmpDir) {
        header('HTTP/1.1 500 Internal Server Error');
        echo "Temporary directory not found on server.";
        exit(3);
    }
    $csvPath = $tmpDir . DIRECTORY_SEPARATOR . $base;
    if (!is_readable($csvPath)) {
        header('HTTP/1.1 404 Not Found');
        echo "CSV file not found or not readable: {$base}";
        exit(4);
    }
}

// Use existing PDO from modelo/pdo.php
$pdoFile = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'modelo' . DIRECTORY_SEPARATOR . 'pdo.php');
if (!$pdoFile || !is_readable($pdoFile)) {
    if (php_sapi_name() === 'cli') fwrite(STDERR, "Missing modelo/pdo.php for DB connection\n");
    else echo "Missing modelo/pdo.php for DB connection";
    exit(5);
}
require_once $pdoFile; // this should provide $pdo
if (!isset($pdo) || !$pdo instanceof PDO) {
    if (php_sapi_name() === 'cli') fwrite(STDERR, "modelo/pdo.php did not provide a valid PDO instance\n");
    else echo "modelo/pdo.php did not provide a valid PDO instance";
    exit(6);
}

// Ensure the 'celular' column can hold phone numbers safely. If it's INT/BIGINT, ALTER to VARCHAR(15).
try {
    $sth = $pdo->prepare("SELECT DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profesor' AND COLUMN_NAME = 'celular' LIMIT 1");
    $sth->execute();
    $col = $sth->fetch(PDO::FETCH_ASSOC);
    if ($col && isset($col['DATA_TYPE'])) {
        $type = strtolower($col['DATA_TYPE']);
        if ($type !== 'varchar' && strpos(strtolower($col['COLUMN_TYPE'] ?? ''),'varchar') === false) {
            // attempt to alter to VARCHAR(15) NULL (preserve existing values). This avoids integer truncation and keeps formatting.
            try {
                $pdo->exec("ALTER TABLE profesor MODIFY celular VARCHAR(15) NULL;");
                // optionally, you could log this change
            } catch (Exception $e) {
                // ignore but notify in CLI
                if (php_sapi_name() === 'cli') fwrite(STDERR, "Warning: could not alter 'celular' column to VARCHAR(15): " . $e->getMessage() . "\n");
            }
        }
    }
} catch (Exception $e) {
    if (php_sapi_name() === 'cli') fwrite(STDERR, "Warning: could not check/alter celular column: " . $e->getMessage() . "\n");
}

// Prepared statements
$selectByNumero = $pdo->prepare('SELECT idProfesor FROM profesor WHERE numeroEconomico = ? LIMIT 1');
$selectByNombre = $pdo->prepare('SELECT idProfesor FROM profesor WHERE nombre = ? LIMIT 1');
$insertProfesor  = $pdo->prepare('INSERT INTO profesor (numeroEconomico, nombre, gradoEstudios, correo_uam, correo_personal, celular) VALUES (?, ?, ?, ?, ?, ?)');
$selectTipo      = $pdo->prepare('SELECT idProfesorTipo FROM profesortipo WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1');
$insertContrato  = $pdo->prepare('INSERT INTO profesorcontrato (profesor_idProfesor, profesortipo_idProfesorTipo, descripcion) VALUES (?, ?, ?)');

$fh = fopen($csvPath, 'r');
if (!$fh) {
    fwrite(STDERR, "Unable to open CSV file for reading\n");
    exit(4);
}

// Read header and map columns (CSV with header: ECONOMICO,NOMBRE,GRADO ACADEMICO,CORREO,EXT.,CEL,Tipo de contratacion)
$header = fgetcsv($fh);
if ($header === false) {
    fwrite(STDERR, "Empty CSV\n");
    exit(5);
}

$lineNo = 1;
$inserted = $skipped = $updated = 0;
$contratosInserted = 0;
$contratosMissing = [];
$pdo->beginTransaction();
try {
    while (($row = fgetcsv($fh)) !== false) {
        $lineNo++;
        // Normalize columns (some rows may have fewer columns)
        // Fix encoding issues: many CSVs from Windows use CP1252/ISO-8859-1; convert to UTF-8
        $cols = array_map(function($v){ return $v === null ? '' : $v; }, $row);
        $cols = array_map(function($v){
            // try to convert from CP1252 to UTF-8; if iconv fails, fallback to mb_convert_encoding
            if ($v === '') return '';
            // Trim first to avoid matching issues
            $v = trim($v);
            // If it's already valid UTF-8, keep it
            if (mb_check_encoding($v, 'UTF-8')) return $v;
            $out = @iconv('CP1252', 'UTF-8//TRANSLIT', $v);
            if ($out === false) {
                $out = @mb_convert_encoding($v, 'UTF-8', 'ISO-8859-1');
            }
            // As a last resort, return original
            return $out !== false ? $out : $v;
        }, $cols);
        // Map by positions according to header
        $numeroEconomico = isset($cols[0]) ? trim($cols[0]) : '';
        $nombre = isset($cols[1]) ? trim($cols[1]) : '';
        $grado = isset($cols[2]) ? trim($cols[2]) : '';
        $correo = isset($cols[3]) ? trim($cols[3]) : '';
        // ext is cols[4] ignored
        $cel = isset($cols[5]) ? trim($cols[5]) : '';
        $tipo = isset($cols[6]) ? trim($cols[6]) : '';

        if ($nombre === '') {
            // skip rows without name
            $skipped++;
            continue;
        }

        // Apply rules
        $numEco = ($numeroEconomico === '' ? 0 : (int) preg_replace('/[^0-9]/', '', $numeroEconomico));
        $gradoOk = ($grado === '' || strtoupper($grado) === '#N/D') ? 'por definir' : $grado;

        $correo_uam = 'ficticio@azc.uam.mx';
        $correo_personal = null;
        if ($correo !== '') {
            if (stripos($correo, '@azc.uam.mx') !== false) {
                $correo_uam = $correo;
            } else {
                $correo_personal = $correo;
                $correo_uam = 'ficticio@azc.uam.mx';
            }
        } else {
            // no correo -> keep correo_uam ficticio, correo_personal null
        }

        // Clean celular
        $celClean = preg_replace('/[^0-9]/', '', $cel);
        if ($celClean === '') $celClean = null;

        // See if professor already exists (prefer numeroEconomico match if non-zero)
        $profId = null;
        if ($numEco !== 0) {
            $selectByNumero->execute([$numEco]);
            $r = $selectByNumero->fetch();
            if ($r) $profId = $r['idProfesor'];
        }
        if (!$profId) {
            $selectByNombre->execute([$nombre]);
            $r2 = $selectByNombre->fetch();
            if ($r2) $profId = $r2['idProfesor'];
        }

        if ($profId) {
            // exists — skip inserting a duplicate. Optionally, you could update fields here.
            $skipped++;
        } else {
            // Insert
            $insertProfesor->execute([
                $numEco,
                $nombre,
                $gradoOk,
                $correo_uam,
                $correo_personal,
                $celClean
            ]);
            $profId = (int)$pdo->lastInsertId();
            $inserted++;
        }

        // If tipo de contrato presente, look up id and insert relation
        if ($tipo !== '') {
            $selectTipo->execute([$tipo]);
            $t = $selectTipo->fetch();
            if ($t) {
                $idTipo = $t['idProfesorTipo'];
                // Insert contrato relation (descripcion NULL). Avoid duplicates by checking if exists.
                // Simple approach: try insert and ignore duplicate PK if any.
                try {
                    $insertContrato->execute([$profId, $idTipo, null]);
                    $contratosInserted++;
                } catch (Exception $e) {
                    // Could be duplicate primary key; ignore and continue
                }
            } else {
                $contratosMissing[] = [
                    'line' => $lineNo,
                    'numeroEconomico' => $numeroEconomico,
                    'nombre' => $nombre,
                    'tipo' => $tipo
                ];
            }
        }
    }
    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    fwrite(STDERR, "Import failed at line {$lineNo}: " . $e->getMessage() . "\n");
    exit(6);
}

fclose($fh);

echo "Import finished\n";
echo "Inserted profesores: {$inserted}\n";
echo "Skipped (existing / invalid): {$skipped}\n";
echo "Profesor-contrato inserted: {$contratosInserted}\n";
if (count($contratosMissing) > 0) {
    echo "\nTipos de contrato no encontrados (revisar y crear en 'profesortipo' si corresponde):\n";
    foreach ($contratosMissing as $m) {
        echo "  line {$m['line']} - numeroEconomico='{$m['numeroEconomico']}' nombre='{$m['nombre']}' tipo='{$m['tipo']}'\n";
    }
}

exit(0);
