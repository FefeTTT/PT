<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/TrimVO.php";
	include_once "../modelo/TrimDAO.php";

	$tDAO= new TrimDAO($pdo);

	$trim=$tDAO->buscaUltimoTrim();
	echo json_encode($trim, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>
