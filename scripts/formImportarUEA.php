<?php
// scripts/formImportarUEA.php - formulario para importar UEA desde CSV
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Importar UEA desde CSV</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;margin:18px}form{border:1px solid #ddd;padding:12px;border-radius:6px;background:#f9f9f9}</style>
</head>
<body>
  <div>
    <h2>Importar catálogo de UEA (CSV)</h2>
    <p>El CSV debe tener las columnas en este orden (sin cabecera obligatoria): <strong>claveUEA, nombreUEA, idArea</strong>.</p>
    <form id="formUpload" action="upload_uea_csv.php" method="post" enctype="multipart/form-data">
      <div>
        <label for="csvfile">Archivo CSV: <input type="file" id="csvfile" name="csvfile" accept="text/csv,.csv" required /></label>
      </div>
      <div style="margin-top:12px;">
        <button type="submit">Subir e importar</button>
      </div>
    </form>

    <div id="result" style="margin-top:18px; display:none;">
      <h3>Resultado</h3>
      <pre id="resultText"></pre>
    </div>

    <script>
    // Manejo simple para mostrar respuesta sin recargar (si el handler devuelve JSON)
    (function(){
      var form = document.getElementById('formUpload');
      var result = document.getElementById('result');
      var resultText = document.getElementById('resultText');
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var f = new FormData(form);
        var xhr = new XMLHttpRequest();
        xhr.open('POST', form.action, true);
        xhr.onload = function(){
          if (xhr.status === 200) {
            try {
              var j = JSON.parse(xhr.responseText);
              resultText.textContent = JSON.stringify(j, null, 2);
              result.style.display = 'block';
            } catch (e) {
              resultText.textContent = xhr.responseText;
              result.style.display = 'block';
            }
          } else {
            resultText.textContent = 'Error HTTP ' + xhr.status + '\n' + xhr.responseText;
            result.style.display = 'block';
          }
        };
        xhr.onerror = function(){
          resultText.textContent = 'Error de red al subir el archivo.';
          result.style.display = 'block';
        };
        xhr.send(f);
      });
    })();
    </script>
  </div>
</body>
</html>
