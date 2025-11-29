<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/ProfesorVO.php";

	$pDAO= new ProfesorDAO($pdo);

	$profesores=$pDAO->buscaProfesoresSP();
	echo json_encode($profesores, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>
