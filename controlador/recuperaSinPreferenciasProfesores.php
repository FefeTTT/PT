<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/PreferenciasVO.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/PreferenciasDAO.php";

	$pDAO= new PreferenciasDAO($pdo);

	$sinPreferencias=$pDAO->profesoresSP();
	echo json_encode($sinPreferencias, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>