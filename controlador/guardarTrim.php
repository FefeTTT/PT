<?php
	include_once "../modelo/pdo.php";

	if($_POST["trim"] || $_POST["fecha"]){
		// guardar el trimestre mandado en datos.php, guardarTrim()
		$trim= $_POST["trim"];
		$fechLim= $_POST["fecha"];
		
		$sql= "INSERT INTO `dbdocenciacb`.`trimestre` (`nombre`, `fechaLim`) VALUES ('".$trim."', '".$fechLim."');";
		
		$guardar = $pdo->prepare($sql);
		$guardar ->execute();
	} else {
		echo 'No se estableció previamente el trimestre o la fecha a programar.';
	}
?>
