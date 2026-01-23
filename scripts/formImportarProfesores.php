<?php
// Simple upload form that saves CSV to scripts/temporales and triggers import via HTTP POST to import_profesores.php

$messages = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        $messages[] = ['type' => 'error', 'text' => 'Error uploading file.'];
    } else {
        $uploaded = $_FILES['csv'];
        $name = basename($uploaded['name']);
// simple extension check
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
                    // call import script directly
                    echo "<div class='message success' style='white-space: pre-wrap;'><strong>Iniciando importación...</strong><br>";
                    echo "<div id='progress'></div>";
                    flush();
                    
                    // Asegurar que el path sea correcto (mismo directorio)
                    require_once __DIR__ . '/import_profesores.php';
                    
                     // Existing PDO connection from import_profesores.php logic (it handles its own pdo require if not present, 
                     // but since we are including it, we should ensure pdo is available or let it handle it.
                     // The refactored import_profesores.php requires pdo.php inside the function if passed, or globally if CLI.
                     // Let's rely on the function signature: importarProfesores($csvPath, $pdo, $isCli)
                     
                     // We need to provide $pdo here.
                     $pdoFile = __DIR__ . '/../modelo/pdo.php';
                     if (file_exists($pdoFile)) {
                         require_once $pdoFile;
                         if (isset($pdo)) {
                             importarProfesores($dest, $pdo, false);
                         } else {
                             echo "<br><strong style='color:red'>Error: No se pudo conectar a la base de datos (pdo).</strong>";
                         }
                     } else {
                         echo "<br><strong style='color:red'>Error: Archivo de conexión no encontrado.</strong>";
                     }

                    echo "</div>";
                }
            }
        }
    }
}

?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Importar profesores (CSV)</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:24px}
form{border:1px solid #ddd;padding:16px;border-radius:6px;background:#f9f9f9}
.messages{margin:12px 0}
.message{padding:8px;border-radius:4px;margin-bottom:8px}
.message.success{background:#e6ffed;border:1px solid #b6f0c6; white-space: pre-wrap;}
.message.error{background:#ffe6e6;border:1px solid #f0b6b6; white-space: pre-wrap;}
</style>
</head>
<body>
<h2>Importar profesores desde CSV</h2>
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
