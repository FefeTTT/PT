<?php
    ini_set('display_errors', 1);
    include_once "../modelo/pdo.php";
    include_once "../modelo/PreferenciasDAO.php";

    $nEconomico = isset($_GET['nEconomico']) ? $_GET['nEconomico'] : '';
    $clvUEA = isset($_GET['cUEA']) ? $_GET['cUEA'] : '';

	$pDAO= new PreferenciasDAO($pdo);

	$borrarPrefUEA=$pDAO->borrarPreferenciaUEA( $nEconomico, $clvUEA);

	echo json_encode( $borrarPrefUEA, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>