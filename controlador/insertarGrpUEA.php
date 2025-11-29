<?php
ini_set('display_errors', 1);
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProgramacionVO.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/UEAVO.php";
	include_once "../modelo/GrupoVO.php";
	include_once "../modelo/HorarioVO.php";
	include_once "../modelo/PreferenciasDAO.php";
	
	$idPrf= $_GET["idProf"];
	$idGrp= $_GET["idGrp"];

	$pDAO= new PreferenciasDAO($pdo);
	
	$msg=$pDAO->InsertarGrupoProgramacion($idPrf, $idGrp);

	echo json_encode($msg, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>