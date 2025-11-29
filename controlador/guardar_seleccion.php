<?php 
include_once "../modelo/pdo.php";

$noGrupos = $_POST["noGrupos"];
$idGrupo = json_decode($_POST["idGrupo"]);
$idProf = json_decode($_POST["idProf"]);
$exito = 0;

$guardar_seleccion=$pdo->prepare("CALL PROGRAMAR(:idGrupo, :idProf)");
$crear_vista_actual=$pdo->prepare("CALL VISTA_PROGRAMACION_ACTUAL()");


for($i=1;$i<=$noGrupos;$i++){
	$guardar = $guardar_seleccion->execute([':idGrupo'=>$idGrupo[$i], ':idProf'=>$idProf[$i]]);
	if($guardar)
		$exito++;
}

if($exito == $noGrupos){
    $vista = $crear_vista_actual->execute();
    if($vista){
        $respuesta = array(
                    'respuesta' => 'correcto',
                    'mensaje' => 'Selección guardada exitosamente'
                );  
    } else {
        $respuesta = array(
                    'respuesta' => 'incorrecto',
                    'mensaje' => 'Selección guardada. Vista NO generada'
                );  
    }
}
else{
	$respuesta = array(
                    'respuesta' => 'incorrecto',
                    'mensaje' => 'Ocurrió un error, vuelva a intentarlo.'
                );  
}

echo json_encode($respuesta);


?>