<?php 
/*
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
*/

//UEA
if($_POST['tipo']=='1'){

	if(is_array($_FILES['archivoexcel']) && count($_FILES['archivoexcel'])>0){
		require_once 'phpexcel/Classes/PHPExcel.php';
		require_once '../modelo/pdo.php';

		//query para insertar UEA.
		$pdo->query('SET foreign_key_checks = 0');
		$carga_uea = $pdo->prepare("INSERT INTO UEA VALUES (null,:clave,:nombre,:idArea)");
		//query para insertar UEA.
		$obtener_idArea = $pdo->prepare("SELECT idAreaUEA FROM AreaUEA WHERE idAreaUEA = :n");
		//$filas sabrá cuántos regustros se guardaron
		$filas=0;

		//vaciar tablas ligadas a UEA
		$vacia_prog = $pdo->prepare("TRUNCATE TABLE Programacion");
		$vacia_prog->execute();
		if($vacia_prog){
			$vacia_sol_uea = $pdo->prepare("TRUNCATE TABLE solicitud_uea");
			$vacia_sol_uea->execute();
			if($vacia_sol_uea){
				$vacia_grupo_hor = $pdo->prepare("TRUNCATE TABLE Grupo_Horario");
				$vacia_grupo_hor->execute();
				if($vacia_grupo_hor){
					$vacia_grupo = $pdo->prepare("DELETE FROM Grupo WHERE idGrupo>=1");
					$vacia_grupo->execute();
					if($vacia_grupo){
						$vacia_uea = $pdo->prepare("DELETE FROM UEA WHERE idUEA>=1");
						$vacia_uea->execute();
					if($vacia_uea){
						$tmpfname = $_FILES['archivoexcel']['tmp_name'];
						$leerfile = PHPExcel_IOFactory::createReaderForFile($tmpfname);

						//Cargar archivo
						$objFile = $leerfile->load($tmpfname);
						$filas_total = 0;	
						for($n = 0; $n < 4; $n++){
							//Cargar hoja a leer (0 - 3)
							$hoja = $objFile->getSheet($n);
							$filas = $hoja->getHighestRow();
							$obtener_idArea->execute([':n'=>($n+1)]);
							$idArea = $obtener_idArea->fetchAll(PDO::FETCH_COLUMN);
							for($i = 2; $i <= $filas; $i++) {
								$claveUEA = $hoja->getCell('A'.$i)->getCalculatedValue();
								if($claveUEA!=0){
									$nombreUEA = $hoja->getCell('B'.$i)->getCalculatedValue();
									$carga_uea->execute([':clave'=>$claveUEA, ':nombre'=>$nombreUEA, ':idArea'=>$idArea[0]]);
									$filas_total++;
								} 
							}
						}
						echo 'Catálogo UEA actualizado. '.$filas_total.' filas leídas';
					} else {
						echo 'Error al vaciar tabla UEA.';
					}
				} else {
					echo 'Error al vaciar tabla Grupo.';
				}
			} else {
				echo 'Error al vaciar tabla Grupo_Horario.';
			}
			} else {
				echo 'Error al vaciar tabla Solicitud_uea.';
			}
			$pdo->query('SET foreign_key_checks = 1');
		} else {
			echo 'Error al vaciar tabla Programacion.';
		}
		$pdo->query('SET foreign_key_checks = 1');
	}

} else { //docentes

	if(is_array($_FILES['archivoexcel']) && count($_FILES['archivoexcel'])>0){
		require_once 'phpexcel/Classes/PHPExcel.php';
		require_once '../modelo/pdo.php';

		//query para insertar docentes
		$pdo->query('SET foreign_key_checks = 0');
		$carga_prof = $pdo->prepare("INSERT INTO Profesor VALUES (null,:noEco,:nombre,:correo_uam,:correo_per);
		");
		$vacia_sol_hor = $pdo->prepare("TRUNCATE TABLE solicitud_horario;
		");
		$vacia_sol_hor->execute();
		if($vacia_sol_hor){
			$vacia_sol_uea = $pdo->prepare("TRUNCATE TABLE solicitud_uea;
			");
			$vacia_sol_uea->execute();
			if($vacia_sol_uea){
				$vacia_sol_prof = $pdo->prepare("TRUNCATE TABLE solicitud_profesor;
				");
				$vacia_sol_prof->execute();
				if($vacia_sol_prof){
					$vacia_prog = $pdo->prepare("TRUNCATE TABLE Programacion;
					");
					$vacia_prog->execute();
					if($vacia_prog){
						$vacia_prof = $pdo->prepare("TRUNCATE TABLE Profesor");
						$vacia_prof->execute();
						if($vacia_prof){
							$tmpfname = $_FILES['archivoexcel']['tmp_name'];
							$leerfile = PHPExcel_IOFactory::createReaderForFile($tmpfname);
							//Cargar archivo
							$objFile = $leerfile->load($tmpfname);
							//Cargar hoja a leer (0)
							$hoja = $objFile->getSheet(0);
							$filas = $hoja->getHighestRow();
							$prof_count = 0;	
							for($i = 2; $i <= $filas; $i++) {
								$noEco = $hoja->getCell('A'.$i)->getCalculatedValue();
								if($noEco!=0){
									$nombre = $hoja->getCell('B'.$i)->getCalculatedValue();
									$correo_uam = trim( $hoja->getCell('C'.$i)->getCalculatedValue() ); 
									$correo_per = trim( $hoja->getCell('D'.$i)->getCalculatedValue() );

									$carga_prof->execute([':noEco'=>$noEco, ':nombre'=>$nombre, ':correo_uam'=>$correo_uam, ':correo_per'=>$correo_per]);
									$prof_count++;
								}
							}
							echo 'Catálogo de Docentes actualizado.';
		             		
						} else {
							echo 'Error al vaciar la tabla Profesor.';
						}
					} else {
						echo 'Error al vaciar la tabla Programacion.';
					}
				} else {
					echo 'Error al vaciar la tabla Solicitud_profesor.';
				}
			} else {
				echo 'Error al vaciar la tabla Solicitud_UEA.';
			}
		} else {
			echo 'Error al vaciar la tabla Solocitud_Horario.';
		}
		$pdo->query('SET foreign_key_checks = 1');
	}
	
}

?>