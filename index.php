<?php
require_once "plantilla.php";

session_start();
// Requerir sólo la sesión activa; no depender de ?user en la URL
if (!isset($_SESSION["success"])) {
	header('Location: login.php');
	return;
}

// Determinar rol/función del usuario desde la sesión
$funcion_id = isset($_SESSION['funcion_id']) ? intval($_SESSION['funcion_id']) : null;
$user_name = isset($_SESSION['user_name']) ? $_SESSION['user_name'] : '';

// Si se solicitó una sección específica, redirigir a la página correspondiente
if (isset($_GET['section'])) {
	$sec = $_GET['section'];
	// Validar permisos antes de redirigir
	if ($sec === 'directorio' && in_array($funcion_id, [1,2,3,4], true)) {
		header('Location: index_administrador.php');
		exit;
	}
	if ($sec === 'trimestres' && in_array($funcion_id, [1,4], true)) {
		require 'trimestreM.php';
		exit;
	}
	if ($sec === 'reserva' && in_array($funcion_id, [1,3], true)) {
		header('Location: mensajeriaM.php');
		exit;
	}
	if ($sec === 'usuarios' && $funcion_id === 1) {
		header('Location: index_administrador.php?section=usuarios');
		exit;
	}
	// Si no tiene permiso, volver al inicio (usamos sesión para identificar)
	header('Location: index.php');
	exit;
}

?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Inicio</title>
	<script>
		// Exponer función/rol al cliente para filtrado UI
		window.FUNCION_ID = <?php echo json_encode($funcion_id); ?>;
		window.USER_NAME = <?php echo json_encode($user_name); ?>;
	</script>
	<link rel="stylesheet" href="css/style_ndex.css">
	<script src="js/services/apiService.js"></script>
	<script src="js/components/userTable.js"></script>
	<script src="js/components/userModal.js"></script>
	<script src="js/menuPrincipalAdmin.js"></script>
	<script type="module" src="js/modules/trimestres/index.js"></script>
	<script src="js/menuUsuarios.js"></script>
	<script src="js/menuDirectorio.js"></script>
</head>
<body>

<a class="volver btn" href="controlador/logout.php">Cerrar sesión</a><br>
	<div id="main-menu" class="container">
		<p id="bienvenido" class="text-center h2"></p><br>
        <!-- Opciones específicas para administrador -->
        <div class="row" id="admin-menu"> </div>
	</div>
	<br>
</body>
</html>