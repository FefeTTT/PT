<?php 
  require_once '../modelo/pdo.php';

  // Read expected POST params with safe defaults
  $noEco = isset($_POST['noEco']) ? trim($_POST['noEco']) : '';
  $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
  $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : '';
  $correo_per = isset($_POST['correo_per']) ? trim($_POST['correo_per']) : '';

  //query para insertar docentes
  $carga_prof = $pdo->prepare("
    INSERT INTO Profesor VALUES (
      null,:noEco,:nombre,:correo_uam,:correo_per
    );
  ");

  $carga_prof->execute([
    ':noEco'=>$noEco, 
    ':nombre'=>$nombre, 
    ':correo_uam'=>$correo_uam, 
    ':correo_per'=>$correo_per
  ]);
  echo $noEco." ".$nombre;
?>