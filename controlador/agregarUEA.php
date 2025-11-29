<?php
    include_once "../modelo/pdo.php";
	include_once "../modelo/UEAVO.php";
	include_once "../modelo/UEADAO.php";

    $nEco= $_GET['nEconomico'];
    $clUEA= $_GET['cUEA'];

    $ueaDAO= new UEADAO($pdo);

    $ueaDAO->ueaRegistrarUEALibre( $nEco, $clUEA );
    $ueaDAO->ueaRegistrarComentarioLibre( $nEco );
    $ueaDAO->ueaRegistrarHorarioLibre( $nEco );
?>