<?php
	include_once "../modelo/pdo.php";
    include_once "../modelo/PreferenciasDAO.php";

    $nEcoProf= $_GET["nEconomico"];
    $cUEA= $_GET["cUEA"];
    $cGpr= $_GET["cGrupo"];

	$pDAO= new PreferenciasDAO($pdo);

	$integrantes= $pDAO->borrarPreferenciasNEconomico( $nEcoProf, $cUEA, $cGpr);
?>