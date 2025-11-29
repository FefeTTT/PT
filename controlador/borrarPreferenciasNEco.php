<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/ProfesorVO.php";
	echo $_GET["nE"];
	$nE= $_GET['nE'];

	$pDAO= new ProfesorDAO( $pdo);

	$pDAO->borrarPreferenciasNEconomico( $nE);
?>