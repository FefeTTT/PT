<?php
include_once "../modelo/pdo.php";

// ver usuarios existentes, ID y nombre
try {
  $stmt = $pdo->prepare("SELECT * FROM usuario;");
  $stmt->execute();
  $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);
  echo "Usuarios existentes:<br/>";
  if (!$usuarios || count($usuarios) === 0) {
    echo "No hay usuarios registrados.<br/><br/>";
  } else {
    foreach ($usuarios as $usr) {
      echo "ID: " . htmlspecialchars($usr['idUsuario']) . ", usuario: " . htmlspecialchars($usr['usuario']) . ", intentos: " . htmlspecialchars($usr['intento']) . "<br/>";
    }
    echo "<br/>";
  }
} catch (Exception $e) {
  // Manejo de errores al ejecutar la consulta de usuarios
  echo "Error al obtener la lista de usuarios.<br/>";
  echo htmlspecialchars($e->getMessage()) . "<br/><br/>";
}
//Introducir los datos del usuario
// Nombre de usuario a crear (evita reusar la variable $usr usada arriba)
$usuarioNuevo = 'admin';
//password
$pwd = 'holaadmin';

// hashear contraseña
$opciones = array(
        'cost' => 12
);
$hash_password = password_hash($pwd, PASSWORD_BCRYPT, $opciones);

try {
  // iniciar transacción para insertar usuario y asignar rol
  $pdo->beginTransaction();

  // comprobar si ya existe un usuario con ese nombre
  $buscarUser = $pdo->prepare("SELECT idUsuario FROM usuario WHERE usuario = :usr LIMIT 1;");
  $buscarUser->execute([":usr" => $usuarioNuevo]);
  $existingId = $buscarUser->fetchColumn();
  $esNuevo = false;
  if ($existingId) {
    // usuario ya existe, usaremos su id y no lo insertamos de nuevo
    $nuevoId = $existingId;
  } else {
    // usar placeholders sin comillas y valor numérico sin comillas
    $guardar_usuario = $pdo->prepare("INSERT INTO `dbappcb`.`usuario` (`usuario`, `contraseña`, `intento`) VALUES (:usr, :pwd, 0);");
    $guardar_usuario->execute([":pwd" => $hash_password, ":usr" => $usuarioNuevo]);
    // obtener id del usuario creado
    $nuevoId = $pdo->lastInsertId();
    $esNuevo = true;
  }

  // obtener id de la función 'admin' si existe
  $buscarFunc = $pdo->prepare("SELECT idFuncion FROM funcion WHERE nombre = :fname LIMIT 1;");
  $fname = 'admin';
  $buscarFunc->execute([":fname" => $fname]);
  $idFuncion = $buscarFunc->fetchColumn();

  // si no existe la función, crearla
  if (!$idFuncion) {
    $crearFunc = $pdo->prepare("INSERT INTO funcion (nombre, descripcion) VALUES (:fname, :desc);");
    $crearFunc->execute([":fname" => $fname, ":desc" => 'Administrador']);
    $idFuncion = $pdo->lastInsertId();
  }

  // asignar la función al usuario si no está asignada
  $checkAsig = $pdo->prepare("SELECT COUNT(*) FROM usuario_has_funcion WHERE usuario_idUsuario = :uid AND funcion_idFuncion = :fid;");
  $checkAsig->execute([":uid" => $nuevoId, ":fid" => $idFuncion]);
  $existe = (int) $checkAsig->fetchColumn();
  if ($existe === 0) {
    $asignar = $pdo->prepare("INSERT INTO usuario_has_funcion (usuario_idUsuario, funcion_idFuncion) VALUES (:uid, :fid);");
    $asignar->execute([":uid" => $nuevoId, ":fid" => $idFuncion]);
  }

  $pdo->commit();
  if ($esNuevo) {
    echo "Usuario guardado (id={$nuevoId}) y rol 'admin' asignado (idFuncion={$idFuncion}).<br/>";
  } else {
    echo "Usuario ya existe (id={$nuevoId}). Se aseguró la asignación del rol 'admin' (idFuncion={$idFuncion}).<br/>";
  }

} catch ( Exception $e ) {
  // intentar rollback si la transacción está activa
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  echo "Error al guardar el usuario o asignar rol<br/>";
  echo htmlspecialchars($e->getMessage());
}
?>
