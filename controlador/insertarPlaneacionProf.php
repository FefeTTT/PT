<?php
    ini_set('display_errors', 1);

// solo es para hacer pruebas con guaradr_planeacion.php
// sin terminar de desarrollar
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProgramacionVO.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/UEAVO.php";
	include_once "../modelo/GrupoVO.php";
	include_once "../modelo/HorarioVO.php";
	include_once "../modelo/PreferenciasDAO.php";
	
    $numEconomico= $_GET["numEco"];
    $claveUEA= $_GET["clvUEA"];
    $claveGrupo= $_GET["clvGrp"];

	$pDAO = new PreferenciasDAO($pdo);
    
    $pDAO->InsertarPlaneacionProfesor($numEconomico, $claveUEA, $claveGrupo);
?>