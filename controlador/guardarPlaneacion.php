<?php
header('Content-Type: application/json; charset=utf-8');
// Secure upload handler: saves uploaded files into controlador/temporales/ with a unique name.
try {
    if (!isset($_FILES['archivo'])) throw new Exception('No file uploaded');
    $file = $_FILES['archivo'];
    if ($file['error'] !== UPLOAD_ERR_OK) throw new Exception('Upload error code: ' . $file['error']);

    // Basic validations
    $allowedExt = ['xlsx','xls','csv'];
    $maxSize = 10 * 1024 * 1024; // 10 MB

    $origName = $file['name'];
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) throw new Exception('Extensión no permitida');
    if ($file['size'] > $maxSize) throw new Exception('Archivo excede el tamaño máximo permitido (10 MB)');

    // MIME check (best-effort)
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? finfo_file($finfo, $file['tmp_name']) : null;
    if ($finfo) finfo_close($finfo);
    $allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'application/csv',
        'text/plain'
    ];
    if ($mime && !in_array($mime, $allowedMimes, true)) {
        // don't fail hard on mime mismatch — log as warning but allow common plain/text csv
        if ($ext !== 'csv') throw new Exception('Tipo MIME no permitido: ' . $mime);
    }

    $uploadsDir = __DIR__ . '/temporales/';
    if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0777, true)) throw new Exception('No se pudo crear directorio de temporales');

    // generate unique filename
    $unique = time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    $target = $uploadsDir . $unique;

    if (!move_uploaded_file($file['tmp_name'], $target)) throw new Exception('No se pudo mover el archivo');

    // Restrict permissions
    @chmod($target, 0640);

    echo json_encode(['ok' => true, 'filename' => $unique, 'original' => $origName], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
