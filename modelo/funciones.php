<?php 

/* ------------------------------------------------------------------------------ */
/* ---------------- AQUI SE DEFINEN TODAS LAS FUNCIONES ------------------------- */
/* ----------------------- EMPLEADAS EN UEA.PHP --------------------------------- */

//obtener idUEA y nombre de la UEA a partir de su clave
function obtener_uea($claveUEA){
	require "pdo.php";
	$obtener_uea = $pdo->prepare("SELECT idUEA, nombre FROM UEA WHERE claveUEA=:claveUEA");
	$obtener_uea->execute([':claveUEA'=>$claveUEA]);

	return $obtener_uea->fetch(PDO::FETCH_OBJ);
}

//sentencia para obtener los horarios que los profes interesados solicitaron
function obtener_total_hor($dia,$idProf){
 	require "pdo.php";

	$obtener_total_hor = $pdo->prepare("SELECT solicitud_horario.idHorario,horaInicio,horaFin FROM (Horario INNER JOIN solicitud_horario ON Horario.idHorario = solicitud_horario.idHorario) WHERE dia=:dia AND idProf=:idProf");
	$obtener_total_hor->execute([':dia'=>$dia, ':idProf'=>$idProf]);

	return $obtener_total_hor;
}


//función que obtendrá un arreglo con idProf, nombre de profesor, no. de grupos y observaciones de aquellos profesores que coinciden con el horario y prioridad que le pasemos en los parámetros.
function obtenerProfesores($preferencia,$grupo,$profesores,$idHorario){
require "pdo.php";

  $count = 0;
  $nombre_id_prof=[];
  //obtener los horarios que eligió el profesor
  $obtener_hor_prof = $pdo->prepare("SELECT idHorario FROM solicitud_horario WHERE idProf = :idProf");
  // sentencia para obtener el nombre del profesor a partir de idProf
  $obtener_nom_prof = $pdo->prepare("SELECT nombre FROM Profesor WHERE idProf = :idProf");
  //sentencia para obtener el noGrupos y observaciones de un profesor
  $obtener_datos_prof = $pdo->prepare("SELECT * FROM solicitud_profesor WHERE idProf = :idProf");
  $obtener_uea_prof = $pdo->prepare("SELECT nombre FROM (UEA INNER JOIN solicitud_uea ON 
UEA.idUEA = solicitud_uea.idUEA) WHERE solicitud_uea.idProf = :idProf");
    for($k=0;$k<count($profesores[$preferencia]);$k++){
      $flag = 0;
      $obtener_hor_prof->execute([':idProf'=>$profesores[$preferencia][$k]]);
      $hor = $obtener_hor_prof->fetchAll(PDO::FETCH_COLUMN);
      //hacer comparación
      for($n=0;$n<count($idHorario[$grupo]);$n++){
        $clave = array_search($idHorario[$grupo][$n], $hor); 
        if($clave!==false) $flag++;
      }
      if($flag == count($idHorario[$grupo])){
        $obtener_nom_prof->execute([':idProf'=>$profesores[$preferencia][$k]]);
        $nombre_id_prof[$count]["id"]=$profesores[$preferencia][$k];
        $nombre_id_prof[$count]["nombre"]=$obtener_nom_prof->fetchColumn();
        $obtener_datos_prof->execute([':idProf'=>$profesores[$preferencia][$k]]);
        $datos = $obtener_datos_prof->fetch(PDO::FETCH_ASSOC);
        $nombre_id_prof[$count]["noGrupos"]=$datos["noGrupos"];
        $nombre_id_prof[$count]["obs"]=$datos["observaciones"];
        $obtener_uea_prof->execute([':idProf'=>$profesores[$preferencia][$k]]);
        $ueas = $obtener_uea_prof->fetchAll(PDO::FETCH_COLUMN);
        $nombre_id_prof[$count]["uea"]=$ueas;
        $count++;
      }
    }
    return $nombre_id_prof;
}

//crear vista horario_uea que junta los grupos con sus horarios según la UEA y nos
//permite organizar y crear la tabla de horarios que se desplegará
function vista_horario_uea($idUEA){
	require "pdo.php";

	$crea_view = $pdo->prepare("CREATE OR REPLACE VIEW horario_uea AS SELECT Grupo.idGrupo,Grupo.claveGrupo,Horario.idHorario,Horario.dia,Horario.horaInicio,Horario.horaFin 
	        FROM (((Grupo INNER JOIN UEA ON Grupo.idUEA=UEA.idUEA) 
	        INNER JOIN Grupo_Horario ON Grupo.idGrupo=Grupo_Horario.idGrupo)
	        INNER JOIN Horario ON Grupo_Horario.idHorario=Horario.idHorario)
	        WHERE UEA.idUEA= :idUEA");
	$crea_view->execute([':idUEA'=>$idUEA]);
}

//Para obtener profesores (idProf) interesados en la UEA y la prioridad en que la pusieron 
function obtener_profesor($idUEA){
	require "pdo.php";

	$obtener_profesor = $pdo->prepare("SELECT prioridad,idProf FROM solicitud_uea WHERE solicitud_uea.idUEA = :idUEA");
	$obtener_profesor->execute([':idUEA'=>$idUEA]);
	//organizar a los profesores por la prioridad en que pusieron la materia
	$profesores = $obtener_profesor->fetchAll(PDO::FETCH_GROUP|PDO::FETCH_COLUMN);

	return $profesores;
}

function obtener_programacion($idGrupo){
	require "pdo.php";

	$obtener_programacion = $pdo->prepare("SELECT idProf FROM Programacion WHERE idGrupo = :idGrupo");
	$obtener_programacion->execute([':idGrupo'=>$idGrupo]);
	$prog = $obtener_programacion->fetchAll(PDO::FETCH_COLUMN); 

	return $prog;
}

//una vez recuperados a los profesores compatibles con la UEA y cada grupo (en 
// array $profesores), se crea el arreglo $prof_hor para verificar si el docente 
//ya se encuentra programado en algún grupo de otra UEA. 
function profesor_uea($profesores){
	require "pdo.php";
	$prof_uea=[];
	//sentencia para averiguar si el profesor seleccionado ya fue asignado a determinado 
	//horario aunque sea en otra uea
	$obtener_horario_programado = $pdo->prepare("SELECT idHorario FROM Programacion_actual WHERE idProf = :idProf");

	//sentencia para descubrir a qué UEA ha sido programado determinado profesor
	$obtener_uea_programada = $pdo->prepare("SELECT DISTINCT nombre FROM Programacion_actual WHERE idProf = :idProf");

	for($s = 1;$s <= 5;$s++){
		if(isset($profesores[$s])){
			for($x = 0;$x < count($profesores[$s]);$x++){
				//obtener las UEA en las que cada profesor ha sido programado
				$obtener_uea_programada->execute([':idProf'=>$profesores[$s][$x]]);
				$uea_prof_prog = $obtener_uea_programada->fetchAll(PDO::FETCH_COLUMN);
				for($z=0;$z<count($uea_prof_prog);$z++) {
							$prof_uea[$profesores[$s][$x]][$z]=$uea_prof_prog[$z];
				}

			}
		}
	}
	
	return $prof_uea;	
}

function profesor_traslape($profesores){
	require "pdo.php";
	$prof_traslape=[];
	//sentencia para averiguar si el profesor seleccionado ya fue asignado a determinado 
	//horario aunque sea en otra uea
	$obtener_horario_programado = $pdo->prepare("SELECT idHorario FROM Programacion_actual WHERE idProf = :idProf");
	//query para obtener todos los horarios en los que el docente no podría dar clases
	//por ya estar programado en algún horario
	$obtener_traslapes = $pdo->prepare("SELECT idHorario FROM Horario WHERE dia = (SELECT dia FROM Horario WHERE idHorario = :idHor) AND horaInicio = (SELECT horaInicio FROM Horario WHERE idHorario = :idHor)");
	$obtener_tras = $pdo->prepare("SELECT idHorario FROM Horario WHERE dia = (SELECT dia FROM Horario WHERE idHorario = :idHor) AND horaFin = (SELECT horaFin FROM Horario WHERE idHorario = :idHor)");

	for($s = 1;$s <= 5;$s++){
		if(isset($profesores[$s])){
			for($x = 0;$x < count($profesores[$s]);$x++){
				//obtener los horarios en los que cada profesor ha sido 
				//programado
				$obtener_horario_programado->execute([':idProf'=>$profesores[$s][$x]]);
				$hor_prof_prog = $obtener_horario_programado->fetchAll(PDO::FETCH_COLUMN);
				$count = count($hor_prof_prog);
				for($z=0;$z<count($hor_prof_prog);$z++) {
					//$prof_hor[$profesores[$s][$x]][$z]=$hor_prof_prog[$z];
					//encontrar traslapes
					
					$obtener_traslapes->execute([':idHor'=>$hor_prof_prog[$z]]);
					$traslape = $obtener_traslapes->fetchAll(PDO::FETCH_COLUMN);
					$obtener_tras->execute([':idHor'=>$hor_prof_prog[$z]]);
					$tras = $obtener_tras->fetchAll(PDO::FETCH_COLUMN);
					//if($traslape!=$tras){
						$prof_traslape[$profesores[$s][$x]][$z]=$traslape;
						$prof_traslape[$profesores[$s][$x]][$count]=$tras;
						$count++;
					//} else {
					//	$prof_traslape[$profesores[$s][$x]][$z]=$traslape;
					//}
				}
			}
		}
	}
	
	return $prof_traslape;	
}

//función para obtener todos los profesores interesados en la UEA
function obtener_total_prof($idUEA){
	require "pdo.php";

	$obtener_total_prof = $pdo->prepare("SELECT DISTINCT Profesor.idProf,Profesor.noEconomico,Profesor.nombre FROM (Profesor INNER JOIN solicitud_uea ON Profesor.idProf = solicitud_uea.idProf) WHERE idUEA = :idUEA");
	$obtener_total_prof->execute([':idUEA'=>$idUEA]);

	return $obtener_total_prof;
}

 ?>