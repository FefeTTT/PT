<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/UEAVO.php";
	include_once "../modelo/UEADAO.php";

	$ueaDAO= new UEADAO($pdo);

	$ueas=$ueaDAO->ueas( );
	// Forzar cabecera JSON para evitar que el cliente reciba text/html y lo trate como error
	header('Content-Type: application/json; charset=UTF-8');
	echo json_encode($ueas, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>