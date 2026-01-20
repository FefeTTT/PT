<?php
if (php_sapi_name() !== 'cli') {
    die("Solo se puede ejecutar desde la terminal.");
}

if ($argc < 3) {
    die("Parámetros necesarios: <path/to/script> <usuario> <contraseña>\n");
}

$inputUsername = $argv[1];
$inputPassword = $argv[2];

$baseDir = __DIR__ . '/../';
require_once $baseDir . "modelo/pdo.php";

try {

    $argon2Options = [
        'memory_cost' => 1048576, // 1 GiB of RAM
        'time_cost'   => 3,
        'threads'     => 1,
    ];

    echo "Verificando usuario: '$inputUsername'...\n";
    
    $userLookupStmt = $pdo->prepare("SELECT idUsuario, contraseña FROM usuario WHERE usuario = ?");
    $userLookupStmt->execute([$inputUsername]);
    $existingUserData = $userLookupStmt->fetch(PDO::FETCH_ASSOC);

    if ($existingUserData) {
        echo "El usuario '$inputUsername' existe. Se actualizará la contraseña:\n";
        
        $passwordHash = password_hash($inputPassword, PASSWORD_ARGON2ID, $argon2Options);
        
        if ($passwordHash === false) {
             die("Error: Falló la creación de la nueva contraseña.\n");
        }

        $updatePasswordStmt = $pdo->prepare("UPDATE usuario SET contraseña = ? WHERE idUsuario = ?");
        $updatePasswordStmt->execute([$passwordHash, $existingUserData['idUsuario']]);
        
        echo "Contraseña actualizada para el usuario '$inputUsername'.\n";
    } else {
        echo "El usuario no existe. Se creará uno nuevo.\n";

        $passwordHash = password_hash($inputPassword, PASSWORD_ARGON2ID, $argon2Options);
        
        if ($passwordHash === false) {
            die("Error: Falló la creación de la nueva contraseña.\n");
        }

        $insertUserStmt = $pdo->prepare("INSERT INTO usuario (usuario, contraseña, intento) VALUES (?, ?, 0)");
        $insertUserStmt->execute([$inputUsername, $passwordHash]);
        $newUserId = $pdo->lastInsertId();
        
        echo "Usuario creado con ID: $newUserId\n";
        echo "Asignando rol de administrador:\n";

        $adminRoleStmt = $pdo->prepare("SELECT idFuncion FROM funcion WHERE nombre = 'Administrador'");
        $adminRoleStmt->execute();
        $adminRoleId = $adminRoleStmt->fetchColumn();
        
        if ($adminRoleId) {
            $assignRoleStmt = $pdo->prepare("INSERT INTO usuario_has_funcion (usuario_idUsuario, funcion_idFuncion) VALUES (?, ?)");
            $assignRoleStmt->execute([$newUserId, $adminRoleId]);
        } else {
            echo "Error: error al asignar el rol de administrador.\n";
        }

        echo "Usuario (Administrador) creado exitosamente.\n";
    }

} catch (PDOException $e) {
    echo "Error de base de datos: " . $e->getMessage() . "\n";
}
?>