<?php
// Formulario para subir CSV con columnas: nombre, email, puesto, area
// Guarda el CSV en scripts/temporales y llama a import_areas_profesores.php vía HTTP POST

$messages = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        $messages[] = ['type' => 'error', 'text' => 'Error uploading file.'];
    } else {
        $uploaded = $_FILES['csv'];
        $name = basename($uploaded['name']);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($ext !== 'csv') {
            $messages[] = ['type' => 'error', 'text' => 'Only CSV files are allowed.'];
        } else {
            $tmpDir = __DIR__ . DIRECTORY_SEPARATOR . 'temporales';
            if (!is_dir($tmpDir)) {
                if (!mkdir($tmpDir, 0775, true)) {
                    $messages[] = ['type' => 'error', 'text' => 'Failed to create temporales directory.'];
                }
            }
            if (empty($messages)) {
                $dest = $tmpDir . DIRECTORY_SEPARATOR . $name;
                if (!move_uploaded_file($uploaded['tmp_name'], $dest)) {
                    $messages[] = ['type' => 'error', 'text' => 'Failed to move uploaded file.'];
                } else {
                    // call import script via HTTP POST with 'file' param
                    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                    $host = $_SERVER['HTTP_HOST'];
                    $base = rtrim(dirname($_SERVER['REQUEST_URI']), '\/');
                    $url = $scheme . '://' . $host . $base . '/import_areas_profesores.php';

                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $url);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $name]);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 120);

                    $response = curl_exec($ch);
                    $err = curl_error($ch);
                    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    if ($err) {
                        $messages[] = ['type' => 'error', 'text' => 'Curl error: ' . $err];
                    } else {
                        $messages[] = ['type' => 'success', 'text' => "Import completed (HTTP {$code}). Response:\n" . $response];
                    }
                }
            }
        }
    }
}

?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Importar profesores - áreas (CSV)</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px}
form{border:1px solid #ddd;padding:16px;border-radius:6px;background:#f9f9f9}
.messages{margin:12px 0}
.message{padding:8px;border-radius:4px;margin-bottom:8px}
.message.success{background:#e6ffed;border:1px solid #b6f0c6}
.message.error{background:#ffe6e6;border:1px solid #f0b6b6}
</style>
</head>
<body>
<h2>Importar profesores → áreas (CSV)</h2>
<p>CSV columns: <strong>nombre, email, puesto, area</strong>. El proceso encontrará al profesor por email o nombre y asociará al área indicada.</p>
<div class="messages">
<?php foreach ($messages as $m): ?>
    <div class="message <?php echo htmlspecialchars($m['type']); ?>"><?php echo nl2br(htmlspecialchars($m['text'])); ?></div>
<?php endforeach; ?>
</div>
<form method="post" enctype="multipart/form-data">
    <label>Archivo CSV: <input type="file" name="csv" accept=".csv" required></label>
    <div style="margin-top:12px"><button type="submit">Subir y procesar</button></div>
</form>
</body>
</html>
