<?php
include_once "../modelo/pdo.php";

// ver usuarios existentes, ID y nombre
$usuarios= $pdo->prepare("SELECT * FROM usuario;");
$usuarios->execute();
foreach ( $usuarios as $usr){
  echo "ID: ".$usr['idUsuario'].", "."ID: ".$usr['nombre']."<br/>";
}

//Introducir los datos del usuario
//Id de usuario
$idUsuario = '';

// se verifica $idUsuario que no este vacio
if ( empty($idUsuario)) {
  echo 'id vacio~';
  die ('oops!');
}
// hashear contraseña
$opciones = array(
        'cost' => 12
);
$hash_password = password_hash($pwd, PASSWORD_BCRYPT, $opciones);

$eliminar_usuario = $pdo->prepare("DELETE FROM `dbdocenciacb`.`usuario`
  WHERE (`idUsuario` = :idUsr);");
$eliminar_usuario->execute([":idUsr"=>$idUsuario]);

if($eliminar_usuario)
	echo "Usuario eliminado"."<br/>";
else
	echo "Error al eliminar el usuario"."<br/>";

  $usuarios= $pdo->prepare("SELECT * FROM usuario;");
  $usuarios->execute();
  foreach ( $usuarios as $usr){
    echo "ID: ".$usr['idUsuario'].", "."ID: ".$usr['nombre']."<br/>";
  }

 ?>
