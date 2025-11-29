<?php
	include_once "../modelo/pdo.php";
	include_once "../modelo/ProfesorVO.php";
	include_once "../modelo/PreferenciasVO.php";
	include_once "../modelo/ProfesorDAO.php";
	include_once "../modelo/PreferenciasDAO.php";

    $nEconomico = $_GET["nEcon"];

    $pDAO = new PreferenciasDAO($pdo);

    $preferencias = $pDAO->profesoresPreferenciasNum($nEconomico);
    echo json_encode($preferencias, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
?>