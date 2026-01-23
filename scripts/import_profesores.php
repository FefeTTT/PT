<?php
// import_profesores.php
// Usage: php import_profesores.php "C:\path\to\profesores.csv"
// Or include and call consultarProfesores($csvPath, $pdo, $isCli)

if (basename(__FILE__) == basename($_SERVER['SCRIPT_FILENAME'])) {
    // Determine CSV path: support CLI and HTTP (POST/GET with 'file' param)
    if (php_sapi_name() === 'cli') {
        $csvPath = $argv[1] ?? __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'profesores.csv';
        $csvPath = realpath($csvPath);
        if (!$csvPath || !is_readable($csvPath)) {
            fwrite(STDERR, "CSV file not found or not readable: {$argv[1]}\n");
            exit(2);
        }

        // Use existing PDO from modelo/pdo.php
        $pdoFile = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'modelo' . DIRECTORY_SEPARATOR . 'pdo.php');
        if (!$pdoFile || !is_readable($pdoFile)) {
            fwrite(STDERR, "Missing modelo/pdo.php for DB connection\n");
            exit(5);
        }
        require_once $pdoFile; // this should provide $pdo
        if (!isset($pdo) || !$pdo instanceof PDO) {
            fwrite(STDERR, "modelo/pdo.php did not provide a valid PDO instance\n");
            exit(6);
        }

        importarProfesores($csvPath, $pdo, true);

    } else {
        // Direct web access (legacy or accidental) - prevent or handle if needed
        // For now, mirroring original behavior but cleaner
        $fileParam = $_POST['file'] ?? $_GET['file'] ?? null;
        if (!$fileParam) {
            header('HTTP/1.1 400 Bad Request');
            echo "Missing 'file' parameter.";
            exit(2);
        }
        $base = basename($fileParam); 
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

        $pdoFile = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'modelo' . DIRECTORY_SEPARATOR . 'pdo.php');
        require_once $pdoFile;
        
        importarProfesores($csvPath, $pdo, false);
    }
}

/**
 * Main import function
 */
function importarProfesores($csvPath, PDO $pdo, $isCli = false) {
    // Ensure the 'celular' column can hold phone numbers safely.
    try {
        $sth = $pdo->prepare("SELECT DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profesor' AND COLUMN_NAME = 'celular' LIMIT 1");
        $sth->execute();
        $col = $sth->fetch(PDO::FETCH_ASSOC);
        if ($col && isset($col['DATA_TYPE'])) {
            $type = strtolower($col['DATA_TYPE']);
            if ($type !== 'varchar' && strpos(strtolower($col['COLUMN_TYPE'] ?? ''),'varchar') === false) {
                try {
                    $pdo->exec("ALTER TABLE profesor MODIFY celular VARCHAR(15) NULL;");
                } catch (Exception $e) {
                    if ($isCli) fwrite(STDERR, "Warning: could not alter 'celular' column to VARCHAR(15): " . $e->getMessage() . "\n");
                }
            }
        }
    } catch (Exception $e) {
        if ($isCli) fwrite(STDERR, "Warning: could not check/alter celular column: " . $e->getMessage() . "\n");
    }

    // Prepared statements
    $selectByNumero = $pdo->prepare('SELECT numeroEconomico FROM profesor WHERE numeroEconomico = ? LIMIT 1');
    $selectByNombre = $pdo->prepare('SELECT numeroEconomico FROM profesor WHERE nombre = ? LIMIT 1');
    $insertProfesor  = $pdo->prepare('INSERT INTO profesor (numeroEconomico, nombre, gradoEstudios, correo_uam, correo_personal, celular) VALUES (?, ?, ?, ?, ?, ?)');
    $selectTipo      = $pdo->prepare('SELECT idProfesorTipo FROM profesortipo WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1');
    $insertContrato  = $pdo->prepare('INSERT INTO profesorcontrato (profesor_numeroEconomico, profesortipo_idProfesorTipo, descripcion) VALUES (?, ?, ?)');

    $fh = fopen($csvPath, 'r');
    if (!$fh) {
        if ($isCli) fwrite(STDERR, "Unable to open CSV file for reading\n");
        else echo "Unable to open CSV file for reading<br>";
        return;
    }

    $header = fgetcsv($fh);
    if ($header === false) {
        if ($isCli) fwrite(STDERR, "Empty CSV\n");
        else echo "Empty CSV<br>";
        return;
    }

    $lineNo = 1;
    $inserted = $skipped = $updated = 0;
    $contratosInserted = 0;
    $contratosMissing = [];
    $pdo->beginTransaction();
    
    // Output buffer flush for web
    if (!$isCli) {
        // Force header to text/html if not already
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
        }
        // Disable implicit buffering
        if (function_exists('apache_setenv')) {
            @apache_setenv('no-gzip', 1);
        }
        @ini_set('output_buffering', 0);
        @ini_set('zlib.output_compression', 0);
        @ini_set('implicit_flush', 1);
        for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
        ob_implicit_flush(1);
    }

    try {
        while (($row = fgetcsv($fh)) !== false) {
            $lineNo++;
            
            // Progress update every 20 rows
            if (!$isCli && $lineNo % 20 === 0) {
                echo "<script>document.getElementById('progress').innerText = 'Procesando línea {$lineNo}...';</script>";
                echo str_repeat(' ', 1024); // padding to force flush
                flush();
            }

            // ... normalization and imports ...
            $cols = array_map(function($v){ return $v === null ? '' : $v; }, $row);
            $cols = array_map(function($v){
                if ($v === '') return '';
                $v = trim($v);
                if (mb_check_encoding($v, 'UTF-8')) return $v;
                $out = @iconv('CP1252', 'UTF-8//TRANSLIT', $v);
                if ($out === false) {
                    $out = @mb_convert_encoding($v, 'UTF-8', 'ISO-8859-1');
                }
                return $out !== false ? $out : $v;
            }, $cols);

            $numeroEconomico = isset($cols[0]) ? trim($cols[0]) : '';
            $nombre = isset($cols[1]) ? trim($cols[1]) : '';
            $grado = isset($cols[2]) ? trim($cols[2]) : '';
            $correo = isset($cols[3]) ? trim($cols[3]) : '';
            $cel = isset($cols[5]) ? trim($cols[5]) : '';
            $tipo = isset($cols[6]) ? trim($cols[6]) : '';

            if ($nombre === '') {
                $skipped++;
                continue;
            }

            $numEco = ($numeroEconomico === '' ? 0 : (int) preg_replace('/[^0-9]/', '', $numeroEconomico));
            $gradoOk = ($grado === '' || strtoupper($grado) === '#N/D') ? 'por definir' : $grado;

            $correo_uam = 'ficticio@azc.uam.mx';
            $correo_personal = null;
            if ($correo !== '') {
                if (stripos($correo, '@azc.uam.mx') !== false) {
                    $correo_uam = $correo;
                } else {
                    $correo_personal = $correo;
                    $correo_uam = 'ficticio@azc.uam.mx'; // Default UAM if not provided
                }
            }

            $celClean = preg_replace('/[^0-9]/', '', $cel);
            if ($celClean === '') $celClean = null;

            $profId = null;
            if ($numEco !== 0) {
                $selectByNumero->execute([$numEco]);
                $r = $selectByNumero->fetch();
                if ($r) $profId = $r['numeroEconomico'];
            }
            if (!$profId) {
                $selectByNombre->execute([$nombre]);
                $r2 = $selectByNombre->fetch();
                if ($r2) $profId = $r2['numeroEconomico'];
            }

            if ($profId) {
                $skipped++;
            } else {
                $insertProfesor->execute([
                    $numEco,
                    $nombre,
                    $gradoOk,
                    $correo_uam,
                    $correo_personal,
                    $celClean
                ]);
                $profId = $numEco;
                $inserted++;
            }

            if ($tipo !== '') {
                $selectTipo->execute([$tipo]);
                $t = $selectTipo->fetch();
                if ($t) {
                    $idTipo = $t['idProfesorTipo'];
                    try {
                        $insertContrato->execute([$profId, $idTipo, null]);
                        $contratosInserted++;
                    } catch (Exception $e) { }
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
        if ($isCli) fwrite(STDERR, "Import failed at line {$lineNo}: " . $e->getMessage() . "\n");
        else echo "<br><strong style='color:red'>Import failed at line {$lineNo}: " . $e->getMessage() . "</strong>";
        return;
    }

    fclose($fh);

    if ($isCli) {
        echo "Import finished\n";
        echo "Inserted profesores: {$inserted}\n";
        echo "Skipped (existing / invalid): {$skipped}\n";
        echo "Profesor-contrato inserted: {$contratosInserted}\n";
        if (count($contratosMissing) > 0) {
            echo "\nTipos de contrato no encontrados:\n";
            foreach ($contratosMissing as $m) {
                echo "  line {$m['line']} - eco='{$m['numeroEconomico']}' nombre='{$m['nombre']}' tipo='{$m['tipo']}'\n";
            }
        }
    } else {
        echo "<br><strong>Import finished</strong><br>";
        echo "Inserted profesores: {$inserted}<br>";
        echo "Skipped (existing / invalid): {$skipped}<br>";
        echo "Profesor-contrato inserted: {$contratosInserted}<br>";
        if (count($contratosMissing) > 0) {
            echo "<br>Tipos de contrato no encontrados:<br><ul>";
            foreach ($contratosMissing as $m) {
                echo "<li>Line {$m['line']} - Eco: {$m['numeroEconomico']}, Nombre: {$m['nombre']}, Tipo: {$m['tipo']}</li>";
            }
            echo "</ul>";
        }
        echo "<script>document.getElementById('progress').innerText = 'Completo.';</script>";
        echo str_repeat(' ', 1024);
        flush();
    }
}
