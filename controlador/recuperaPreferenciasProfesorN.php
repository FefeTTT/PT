<?php
ini_set('display_errors', 1);
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/PreferenciasVO.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/PreferenciasDAO.php";

	$nombre = $_GET["nomb"];
	// echo $nombre.'<br/>';

	$pDAO= new PreferenciasDAO($pdo);

	$preferencias=$pDAO->profesoresPreferenciasNomb( $nombre);
	echo json_encode($preferencias, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>