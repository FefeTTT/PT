<?php
require_once "plantilla.php";
session_start();
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Carga Docente</title>
  <script defer src="js/docentesFormulario.js"></script>
    <!-- Styles for this view were moved to css/styles.css -->
</head>
<body>

  <div class="container">
    <div id="resp-warning" class="alert alert-primary text-center d-none" role="alert"></div>
    <div id="resp-success" class="alert alert-success text-center d-none" role="alert"></div>

    <div id="contenedor-docente" class="container">
      <div class="p-5 mb-4 bg-light rounded-3" id="docentes">
        <div class="container-fluid py-2">
          <h2 id="titulo-trimestre" class="display-6 text-center">Programación Docente</h2>
          <p class="h5 text-center">Profesoras y profesores del Departamento de Ciencias Básicas.</p>
          <p class="text-center">Con el propósito de asignar la carga docente para el trimestre <span id="texto-trimestre"></span>, les solicito atentamente contestar el siguiente formulario antes del <strong id="fecha-limite"></strong>.</p>
        </div>

      <!-- El formulario se construye dinámicamente por JS en #form-root -->
  <div id="form-root"></div>
  <script src="js/buildFormDocentes.js"></script>
      </div>
    </div>
  </div>

</body>
</html>
