<?php 
ini_set('display_errors', 1);
	//if(is_array($_FILES['archivoexcel']) && count($_FILES['archivoexcel'])>0){
	if( true){

		//Para los posibles registros dentro de la base de datos
		include_once "../modelo/pdo.php";

		$nombre = $_FILES['archivoexcel']['name'];
		$guardado = $_FILES['archivoexcel']['tmp_name'];
		$nombreGpr= $_POST['nombreGrupo'];
		//$nombre = "mensajeria, prueba 1.xlsx";

		//$nombreGpr= "x1";
		
		//revisar si el folder donde se va a guardar el archivo está vacío o no.
		$carpeta = @scandir('archivo_tmp/mensajeria');
		if(count($carpeta)>2){
		
			//una vez vaciadas las tablas en la base de datos, borrar el archivo que está
			//en archivo_tmp
			$borrado = unlink('archivo_tmp/mensajeria/'.$carpeta[2]);
			if(! $borrado){
				echo 'Error al borrar el archivo';
				die;
			}
		}
		//no hay archivo en la carpeta, por lo que no hay que vaciar la base de 
		//datos y se guarda el archivo directamente.
		if(move_uploaded_file($guardado, 'archivo_tmp/mensajeria/'.$nombre)){
			if(valida_excel('archivo_tmp/mensajeria/'.$nombre)){
				//echo "Sin problemas en el excel.";
				$res = cargar_archivo('archivo_tmp/mensajeria/'.$nombre, $nombreGpr);
				echo $res;
			} else {
				echo "Hay celdas vacias en un lugar invalido, revise su excel.";
				die();
			}
			
		} else echo "ERROR: no se pudo guardar el excel";
		/*if(valida_excel('archivo_tmp/mensajeria/'.$nombre)){
			//echo "Sin problemas en el excel.";
			$res = cargar_archivo('archivo_tmp/mensajeria/'.$nombre, $nombreGpr);
			//echo $res;
		} else {
			echo "Hay celdas vacias en un lugar invalido, revise su excel.";
			die();
		}*/
		
	}

	function valida_excel($nombre) {
		//llama a la librería PHPExcel y la conexión
		require_once 'phpexcel/Classes/PHPExcel.php';

		//Cargar archivo
		$leerfile = PHPExcel_IOFactory::load($nombre);

		//Cargar hoja a leer (0)
		$hoja = $leerfile->setActiveSheetIndex(0);
		$filas = $hoja->getHighestRow();
		$regreso= true;

		// fila 1 es para encabezados: nombre, email, saludo
		// saltamos a 2
		for($f = 2; $f <= $filas; $f++){
			$nombre = $hoja->getCell('A'.$f)->getCalculatedValue(); // nombre de la persona
			$email = $hoja->getCell('B'.$f)->getCalculatedValue(); // email
			$saludo = $hoja->getCell('C'.$f)->getCalculatedValue();// saludo personalizado
			if( $nombre == false || $email== false || $saludo== false){
				//echo "Hay una celda vacia en la fila: ". $f."\t";
				//echo $nombre.", ".$email.", ".$saludo."\n";
				$regreso= false;
			} 
			//echo $nombre.", ".$email.", ".$saludo."\n";

		}
		return $regreso;
	}

	function cargar_archivo($nombre, $nombreGpr) {
		//llama a la librería PHPExcel y la conexión
		require_once 'phpexcel/Classes/PHPExcel.php';
		global $pdo;

		//evitamos duplicados del nombre del grupo
		$existe_grupo= $pdo->prepare("SELECT * FROM `dbdocenciacb`.`Categoria` WHERE nomCategoria=:nomGpr");
		$existe_grupo->execute([':nomGpr'=>$nombreGpr]);
		$respuesta= $existe_grupo->fetchAll(PDO::FETCH_ASSOC);
		//var_dump($respuesta);
		foreach ($respuesta as $gpr) {
			if ( $gpr['nomCategoria']==$nombreGpr ) {
				return "Grupo duplicado";
			}
		} 
		
		// añadimos un grupo nuevo
		$insert_categoriaNom= $pdo->prepare("INSERT INTO `dbdocenciacb`.`Categoria` (`nomCategoria`) VALUES (:nomGpr)");
		$insert_categoriaNom->execute([':nomGpr'=>$nombreGpr]);

		// id del grupo agregado
		$idGpr;
		$id_grupo= $pdo->prepare("SELECT * FROM dbdocenciacb.Categoria ORDER BY idCategoria DESC LIMIT 1");
		$id_grupo->execute();
		$respuesta= $id_grupo->fetchAll(PDO::FETCH_ASSOC);   
		foreach ($respuesta as $gpr) {
			//echo "Grupo (".$gpr['idCategoria']."): ".$gpr['nomCategoria']."\n";
			$idGpr= $gpr['idCategoria'];
		}

		//query para insertar un integrante
		$insert_integrante = $pdo->prepare("INSERT INTO `dbdocenciacb`.`Integrante` (`saludo`, `nombre`, `email`) VALUES (:saludo, :nombre, :email);");
		//query para insertar en grupoHasIntegrante
		$insert_GrpInt= $pdo->prepare("INSERT INTO `dbdocenciacb`.`IntegranteHasCategoria` (`idIntegrante`, `idCategoria`) VALUES (:idInt, :idGrup);");
		//query para obetener el ultimo integrante agregado
		$ultimo_integrante= $pdo->prepare("SELECT * FROM dbdocenciacb.Integrante
			where saludo=:saludo && nombre=:nombre && email=:email
			ORDER BY idIntegrante DESC limit 1;");

		//Cargar archivo
		$leerfile = PHPExcel_IOFactory::load($nombre);

		//Cargar hoja a leer (0)
		$hoja = $leerfile->setActiveSheetIndex(0);
		$filas = $hoja->getHighestRow();

		for($i = 2; $i <= $filas; $i++){
			// 1 es el donde deben ir los titulos: nombre, email, saludo
			$nombre = $hoja->getCell('A'.$i)->getCalculatedValue(); // nombre de la persona
			$email = $hoja->getCell('B'.$i)->getCalculatedValue(); // email
			$saludo = $hoja->getCell('C'.$i)->getCalculatedValue();// saludo personalizado
			//echo "Integrante (".$nombre."): ".$email." ".$saludo." | \n";
			//insertar integrante
			$insert_integrante->execute([':saludo'=>$saludo, ':nombre'=>$nombre, ':email'=>$email]);
			//echo "insertado | \n";
			//objeter id del integrante insertado
			$ultimo_integrante->execute([":saludo"=>$saludo, ":nombre"=>$nombre, ":email"=>$email]);
			$respuesta= $ultimo_integrante->fetchAll(PDO::FETCH_ASSOC);   
			//var_dump($respuesta);
			foreach ($respuesta as $intgr) {
				//echo "ultimo Integrante: (".$intgr['idIntegrante']."): ".$intgr['nombre'].", ".$intgr['saludo']." | \n";
				$idIntgr= $intgr['idIntegrante'];
			}
			//echo "IDintegr: ".$idIntgr.", IDgpr: ".$idGpr." | ";
			//insertar integrante en el grupo registrado
			$insert_GrpInt->execute([':idInt'=>$idIntgr, ':idGrup'=>$idGpr]);
			//echo "registrado | \n";
		} 
		return "Grupo añadido de forma correcta";
	}
?>