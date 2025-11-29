<?php
ini_set('display_errors', 1);
    include_once "../modelo/pdo.php";
    include_once "../modelo/ProgramacionVO.php";
    include_once "../modelo/ProfesorVO.php";
    include_once "../modelo/UEAVO.php";
    include_once "../modelo/GrupoVO.php";
    include_once "../modelo/HorarioVO.php";
    include_once "../modelo/PreferenciasDAO.php";

	$pDAO= new PreferenciasDAO($pdo);

	$programacionCompleta=$pDAO->mostrarProgramacion();

    $profesores = array();
    foreach ($programacionCompleta as $value) {
        if (!in_array($value['profesor'], $profesores, true)) {
            array_push($profesores, $value['profesor']);
        }
    }

    // foreach ($profesores as $value) {
    //     var_dump($value);
    //     echo "<br/>";
    // }
	echo json_encode($profesores, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
?>