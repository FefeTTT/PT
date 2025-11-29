<?php
require_once "plantilla.php";
session_start();
$failure = false;

if ( isset($_POST['usuario']) && isset($_POST['pwd']) ) {
    $usuario = $_POST['usuario'];
    $pwd = $_POST['pwd'];
    $postdata = http_build_query(['usuario' => $usuario, 'pwd' => $pwd]);
    $opts = [
        'http' => [
            'method' => 'POST',
            'header' => 'Content-type: application/x-www-form-urlencoded',
            'content' => $postdata
        ]
    ];
  // Se usa cURL en lugar de file_get_contents para mayor compatibilidad
  $url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") .
    "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . "/controlador/validarlogin.php";
  $ch = curl_init();
  curl_setopt($ch, CURLOPT_URL, $url);
  curl_setopt($ch, CURLOPT_POST, 1);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $postdata);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded'
  ]);
  $response = curl_exec($ch);
  if (curl_errno($ch)) {
    $_SESSION["error"] = "Error de conexión con el validador.";
    $failure = "No se pudo validar el usuario. Intente más tarde.";
  } else {
    $result = json_decode($response, true);
    // var_dump($response); // Debugging line to check the raw response
    if ($result === null) {
      $_SESSION["error"] = "Error de conexión con el validador.";
      $failure = "No se pudo validar el usuario. Intente más tarde.";
    } elseif (!$result["success"]) {
      $_SESSION["error"] = "Usuario o contraseña incorrecto.";
      $failure = "El usuario o contraseña es incorrecto";
    } else {
      $_SESSION["success"] = "Logged in.";
      $_SESSION["funcion_id"] = $result["funcion_id"];
      $_SESSION["funcion_name"] = $result["funcion_name"];
      $_SESSION["user_name"] = $result["user_name"];
      curl_close($ch);
      // Redirigir siempre a `index.php` y dejar que esa página muestre contenido según el id de función en sesión
      $destino = "index.php";
      header("Location: $destino?user=".urlencode($result["user_name"]));
      exit;
    }
  }
  curl_close($ch);
}
?>


<!DOCTYPE html>
<html>
<head>
  <title>Inicio</title>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/styles.css">
  <script src="js/login.js"></script>
</head>
<body>
  <div id="main-menu" class="container-fluid min-vh-100 d-flex flex-column justify-content-center align-items-center p-0">
    <div id="menu" class="card shadow-lg rounded-4 w-100 login-card">
      <div class="card-body px-4 py-5">
        <h3 id="inicio-sesion" class="card-title text-center mb-4 fw-bold">Iniciar sesión</h3>
        <?php
            if ( $failure != false ) {
                echo('<p class="text-danger text-center mb-3">'.htmlentities($failure)."</p>\n");
            }
        ?>
        <form id="login" method="post" autocomplete="off">
          <div class="mb-3">
            <label for="usuario" class="form-label">Usuario</label>
            <input type="text" id="usuario" class="form-control campo_login" name="usuario" required autofocus>
          </div>
          <div class="mb-3">
            <label for="passw" class="form-label">Contraseña</label>
            <input type="password" id="passw" class="form-control campo_login" name="pwd" required>
          </div>
          <div class="d-grid gap-2 mt-4">
            <button type="submit" class="btn btn-lg w-100 btn-login">Iniciar sesión</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <br>
  <footer><p id="creditos" class="text-center">&copy; 2021 Claudia Arellano Ruiz &copy; 2025 Fernando Jiménez Durán</p></footer>
</body>
</html>
