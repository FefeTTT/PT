<?php
// import_areas_profesores.php
// CSV columns expected (in order): nombre, email, puesto, area
// Behavior per user request:
// 1) Find professor by email (correo_uam or correo_personal) or by exact nombre.
// 2) Find rows in `areaacademica` with the given area name (may return multiple rows with different `puesto`).
// 3) Use CSV 'puesto' (jefe/miembro) to select the correct areaacademica row.
// 4) Insert into areaacademica_has_profesor (areaAcademica_idAreaAcademica, profesor_idProfesor).

// Locate CSV file
$fileParam = $_POST['file'] ?? $_GET['file'] ?? null;
if (!$fileParam) {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['ok' => false, 'msg' => "Missing 'file' parameter"]);
    exit(2);
}
$base = basename($fileParam);
$tmpDir = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'temporales');
if (!$tmpDir) {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['ok' => false, 'msg' => 'Temporary directory not found on server.']);
    exit(3);
}
$csvPath = $tmpDir . DIRECTORY_SEPARATOR . $base;
if (!is_readable($csvPath)) {
    header('HTTP/1.1 404 Not Found');
    echo json_encode(['ok' => false, 'msg' => "CSV file not found or not readable: {$base}"]);
    exit(4);
}

require_once __DIR__ . '/../modelo/pdo.php';

// Prepared statements
$selectProfesorByEmail = $pdo->prepare('SELECT idProfesor FROM profesor WHERE correo_uam = ? OR correo_personal = ? LIMIT 1');
$selectProfesorByName = $pdo->prepare('SELECT idProfesor FROM profesor WHERE nombre = ? LIMIT 1');
$selectAreaAcademicaRows = $pdo->prepare('SELECT idAreaAcademica, nombre, puesto FROM areaacademica WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(?))');
$checkAssocAcad = $pdo->prepare('SELECT 1 FROM areaacademica_has_profesor WHERE profesor_idProfesor = ? AND areaAcademica_idAreaAcademica = ? LIMIT 1');
$insertAssocAcad = $pdo->prepare('INSERT INTO areaacademica_has_profesor (areaAcademica_idAreaAcademica, profesor_idProfesor) VALUES (?, ?)');

$fh = fopen($csvPath, 'r');
if (!$fh) {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['ok' => false, 'msg' => 'Unable to open CSV file for reading']);
    exit(5);
}

$header = fgetcsv($fh);
if ($header === false) {
    echo json_encode(['ok' => false, 'msg' => 'Empty CSV']);
    exit(6);
}

$lineNo = 1;
$linked = 0; $skipped = 0; $missingProf = []; $missingArea = []; $ambiguousArea = [];

$pdo->beginTransaction();
try {
    while (($row = fgetcsv($fh)) !== false) {
        $lineNo++;
        // normalize and protect
        $cols = array_map(function($v){ return $v === null ? '' : $v; }, $row);
        $cols = array_map(function($v){ if ($v === '') return ''; $v = trim($v); if (mb_check_encoding($v, 'UTF-8')) return $v; $out = @iconv('CP1252', 'UTF-8//TRANSLIT', $v); if ($out === false) $out = @mb_convert_encoding($v, 'UTF-8', 'ISO-8859-1'); return $out !== false ? $out : $v; }, $cols);

        $nombre = isset($cols[0]) ? $cols[0] : '';
        $email = isset($cols[1]) ? $cols[1] : '';
        $puestoCsv = isset($cols[2]) ? strtolower($cols[2]) : '';
        $areaNombre = isset($cols[3]) ? $cols[3] : '';

        if ($nombre === '' && $email === '') {
            $skipped++;
            continue;
        }

        // Find professor: prefer email
        $profId = null;
        if ($email !== '') {
            $selectProfesorByEmail->execute([$email, $email]);
            $r = $selectProfesorByEmail->fetch(PDO::FETCH_ASSOC);
            if ($r) $profId = $r['idProfesor'];
        }
        if (!$profId && $nombre !== '') {
            $selectProfesorByName->execute([$nombre]);
            $r2 = $selectProfesorByName->fetch(PDO::FETCH_ASSOC);
            if ($r2) $profId = $r2['idProfesor'];
        }
        if (!$profId) {
            $missingProf[] = ['line' => $lineNo, 'nombre' => $nombre, 'email' => $email];
            $skipped++;
            continue;
        }

        if ($areaNombre === '') {
            $missingArea[] = ['line' => $lineNo, 'area' => $areaNombre];
            $skipped++;
            continue;
        }

        // Find areaacademica rows (may return multiple rows with different puesto)
        $selectAreaAcademicaRows->execute([$areaNombre]);
        $areaRows = $selectAreaAcademicaRows->fetchAll(PDO::FETCH_ASSOC);
        if (!$areaRows || count($areaRows) === 0) {
            $missingArea[] = ['line' => $lineNo, 'area' => $areaNombre];
            $skipped++;
            continue;
        }

        // If only one row, use it. If multiple, pick by puesto matching CSV puesto.
        $chosen = null;
        if (count($areaRows) === 1) {
            $chosen = $areaRows[0];
        } else {
            // try to match by puesto keywords
            $puestoKey = '';
            if (strpos($puestoCsv, 'jef') !== false || strpos($puestoCsv, 'jefe') !== false) $puestoKey = 'jef';
            elseif (strpos($puestoCsv, 'miem') !== false || strpos($puestoCsv, 'integ') !== false || strpos($puestoCsv, 'miembro') !== false) $puestoKey = 'miem';

            if ($puestoKey !== '') {
                foreach ($areaRows as $ar) {
                    $p = strtolower($ar['puesto'] ?? '');
                    if ($puestoKey === 'jef' && strpos($p, 'jef') !== false) { $chosen = $ar; break; }
                    if ($puestoKey === 'miem' && (strpos($p, 'miem') !== false || strpos($p, 'integ') !== false)) { $chosen = $ar; break; }
                }
            }
            // if still not chosen, mark ambiguous and skip
            if (!$chosen) {
                $ambiguousArea[] = ['line' => $lineNo, 'area' => $areaNombre, 'candidates' => $areaRows, 'puestoCsv' => $puestoCsv];
                $skipped++;
                continue;
            }
        }

        $idAreaAcademica = $chosen['idAreaAcademica'];

        // Avoid duplicate association
        $checkAssocAcad->execute([$profId, $idAreaAcademica]);
        $existsAcad = $checkAssocAcad->fetch(PDO::FETCH_ASSOC);
        if ($existsAcad) {
            $skipped++;
            continue;
        }

        $insertAssocAcad->execute([$idAreaAcademica, $profId]);
        $linked++;
    }

    $pdo->commit();
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['ok' => false, 'msg' => 'Import failed at line ' . $lineNo . ': ' . $e->getMessage()]);
    exit(7);
}

fclose($fh);

$result = ['ok' => true, 'linked' => $linked, 'skipped' => $skipped, 'missingProf' => $missingProf, 'missingArea' => $missingArea, 'ambiguousArea' => $ambiguousArea];
header('Content-Type: application/json; charset=utf-8');
echo json_encode($result, JSON_UNESCAPED_UNICODE);
exit(0);

