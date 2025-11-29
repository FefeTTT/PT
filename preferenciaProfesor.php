<?php
// Adaptación: recibir por POST el id del trimestre y del profesor y delegar el render al JS
require_once "plantilla.php";

// Obtener parámetros (POST preferido); fallback mínimo a GET si alguien navega manualmente
$idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : (isset($_GET['idTrimestre']) ? (int)$_GET['idTrimestre'] : 0);
$idProfesor  = isset($_POST['idProfesor'])  ? (int)$_POST['idProfesor']  : (isset($_GET['idProfesor'])  ? (int)$_GET['idProfesor']  : 0);
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <title>Preferencia Docente</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
    <div id="contenedor-docente" class="container py-3">
        <div id="app-preferencias-profesor" data-trimestre="<?php echo htmlspecialchars($idTrimestre, ENT_QUOTES, 'UTF-8'); ?>" data-profesor="<?php echo htmlspecialchars($idProfesor, ENT_QUOTES, 'UTF-8'); ?>">
            <!-- El contenido se construirá con JS -->
            <div class="text-muted">Cargando preferencias del profesor...</div>
        </div>
    </div>

    <script src="js/preferenciasProfesor.js"></script>
</body>
</html>
