<?php
header('Content-Type: application/json; charset=utf-8');
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Uso: POST');
    $filename = isset($_POST['filename']) ? trim($_POST['filename']) : '';
    if ($filename === '') throw new Exception('filename requerido');

    // proteger contra path traversal
    $base = basename($filename);
    $tempDir = __DIR__ . '/temporales/';
    $full = realpath($tempDir . $base);
    if ($full === false) {
        // file does not exist
        echo json_encode(['ok' => true, 'deleted' => false, 'message' => 'Archivo no encontrado', 'filename' => $base], JSON_UNESCAPED_UNICODE);
        exit;
    }
    // garantizar que el archivo esté dentro del directorio temporales
    $realTempDir = realpath($tempDir);
    if ($realTempDir === false || strpos($full, $realTempDir) !== 0) {
        throw new Exception('Ruta inválida');
    }

    if (!file_exists($full)) {
        echo json_encode(['ok' => true, 'deleted' => false, 'message' => 'Archivo no encontrado', 'filename' => $base], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $deleted = false;
    if (@unlink($full)) {
        $deleted = true;
    }

    echo json_encode(['ok' => true, 'deleted' => $deleted, 'filename' => $base], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
