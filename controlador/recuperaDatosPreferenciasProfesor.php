<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/PreferenciasVO.php";
	include_once "../modelo/PreferenciasUeaVO.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/PreferenciasDAO.php";

    	$nEco= $_GET["nEconomico"];
    	
	$pDAO= new PreferenciasDAO($pdo);

	$preferencias=$pDAO->preferenciasProfesorNE($nEco);
	echo json_encode($preferencias, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>