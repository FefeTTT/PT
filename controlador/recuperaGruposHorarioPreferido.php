<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProgramacionVO.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/UEAVO.php";
	include_once "../modelo/GrupoVO.php";
	include_once "../modelo/HorarioVO.php";
	include_once "../modelo/PreferenciasDAO.php";
	
	$nEco= $_GET["nEconomico"];
	$cUEA= $_GET["cUEA"];
	
	$pDAO= new PreferenciasDAO($pdo);
	
	$grupos=$pDAO->HorarioGruposPrefernciasNEyUEA( $nEco, $cUEA);

	echo json_encode($grupos, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>