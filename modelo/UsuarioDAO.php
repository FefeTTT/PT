<?php
class UsuarioDAO {
    public $conexion;

    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    public function __destruct() { }

    // Obtener todos los usuarios
    public function obtenerTodosUsuarios(): array {
        $usuarios = array();
        $sql = "SELECT idUsuario, usuario, contraseña, intento FROM usuario";
        $result = $this->conexion->query($sql);
        while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
            $usuarioVO = new UsuarioVO($row['usuario'], $row['contraseña'], $row['intento'], $row['idUsuario']);
            array_push($usuarios, $usuarioVO->toJSON());
        }
        return $usuarios;
    }

    // Buscar usuario por nombre de usuario
    public function buscaUsuarioNombre($usuario): ?array {
        $sql = "SELECT idUsuario, usuario, contraseña, intento FROM usuario WHERE usuario = :usuario LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':usuario' => $usuario]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $usuarioVO = new UsuarioVO($row['usuario'], $row['contraseña'], $row['intento'], $row['idUsuario']);
            return $usuarioVO->toJSON();
        }
        return null;
    }

    // Insertar nuevo usuario
    public function insertarUsuario(UsuarioVO $usuarioVO): bool {
        // Hashear la contraseña antes de insertar
        $opciones = array('cost' => 12);
        $hash_password = password_hash($usuarioVO->getContraseña(), PASSWORD_BCRYPT, $opciones);
        // Use ASCII parameter names to avoid encoding issues in parameter keys
        $sql = "INSERT INTO usuario (usuario, contraseña, intento) VALUES (:usuario, :pwd, :intento)";
        $stmt = $this->conexion->prepare($sql);
        $resultado = $stmt->execute([
            ':usuario' => $usuarioVO->getUsuario(),
            ':pwd' => $hash_password,
            ':intento' => $usuarioVO->getIntento()
        ]);
        return $resultado;
    }

    // Actualizar solo el campo intento del usuario
    public function actualizarUsuarioIntento(UsuarioVO $usuarioVO): bool {
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 0;");
        $sql = "UPDATE usuario SET intento = :intento WHERE idUsuario = :idUsuario";
        $stmt = $this->conexion->prepare($sql);
        $resultado = $stmt->execute([
            ':intento' => $usuarioVO->getIntento(),
            ':idUsuario' => $usuarioVO->getIdUsuario()
        ]);
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 1;");
        return $resultado;
    }

    // Asignar función a usuario
    public function insertarUsuarioFuncion($nombreUsuario, $nombreFuncion): bool {
        // Obtener idUsuario
        $sqlUsuario = "SELECT idUsuario FROM usuario WHERE usuario = :usuario LIMIT 1";
        $stmtUsuario = $this->conexion->prepare($sqlUsuario);
        $stmtUsuario->execute([':usuario' => $nombreUsuario]);
        $rowUsuario = $stmtUsuario->fetch(PDO::FETCH_ASSOC);
        if (!$rowUsuario) return false;
        $idUsuario = $rowUsuario['idUsuario'];

        // Obtener idFuncion
        $sqlFuncion = "SELECT idFuncion FROM funcion WHERE nombre = :nombre LIMIT 1";
        $stmtFuncion = $this->conexion->prepare($sqlFuncion);
        $stmtFuncion->execute([':nombre' => $nombreFuncion]);
        $rowFuncion = $stmtFuncion->fetch(PDO::FETCH_ASSOC);
        if (!$rowFuncion) return false;
        $idFuncion = $rowFuncion['idFuncion'];

        // Insertar relación en usuario_has_funcion
        $sqlInsert = "INSERT INTO usuario_has_funcion (usuario_idUsuario, funcion_idFuncion) VALUES (:idUsuario, :idFuncion)";
        $stmtInsert = $this->conexion->prepare($sqlInsert);
        return $stmtInsert->execute([
            ':idUsuario' => $idUsuario,
            ':idFuncion' => $idFuncion
        ]);
    }

    // Eliminar usuario por id (y sus relaciones en usuario_has_funcion)
    public function eliminarUsuario($idUsuario): bool {
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 0;");
        // Eliminar relaciones en usuario_has_funcion
        $sqlRel = "DELETE FROM usuario_has_funcion WHERE usuario_idUsuario = :idUsuario";
        $stmtRel = $this->conexion->prepare($sqlRel);
        $stmtRel->execute([':idUsuario' => $idUsuario]);

        // Eliminar usuario
        $sql = "DELETE FROM usuario WHERE idUsuario = :idUsuario";
        $stmt = $this->conexion->prepare($sql);
        $resultado = $stmt->execute([':idUsuario' => $idUsuario]);
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 1;");
        return $resultado;
    }

    // Eliminar usuario por nombre (busca id y reutiliza eliminarUsuario)
    public function eliminarUsuarioNombre($nombreUsuario): bool {
        // Obtener idUsuario a partir del nombre
        $sql = "SELECT idUsuario FROM usuario WHERE usuario = :usuario LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':usuario' => $nombreUsuario]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !isset($row['idUsuario'])) return false;
        $id = $row['idUsuario'];

        // Reutilizar el método que elimina relaciones y el registro
        return $this->eliminarUsuario($id);
    }

    /**
     * Obtener usuario junto con función asociada (si existe)
     * Retorna arreglo asociativo con columnas de usuario + funcion_idFuncion + funcion_name, o null si no existe
     */
    public function obtenerUsuarioConFuncion($usuario): ?array {
        $sql = "SELECT u.*, uf.funcion_idFuncion, f.nombre AS funcion_name FROM usuario u
                LEFT JOIN usuario_has_funcion uf ON u.idUsuario = uf.usuario_idUsuario
                LEFT JOIN funcion f ON uf.funcion_idFuncion = f.idFuncion
                WHERE u.usuario = :usuario LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':usuario' => $usuario]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $row : null;
    }

    /**
     * Incrementa el contador intento del usuario identificado por nombre y devuelve el nuevo valor o null si falla
     */
    public function incrementarIntentoPorNombre(string $usuario): ?int {
        try {
            $st = $this->conexion->prepare("UPDATE usuario SET intento = intento + 1 WHERE usuario = :usuario");
            $st->execute([':usuario' => $usuario]);
            $st2 = $this->conexion->prepare("SELECT intento FROM usuario WHERE usuario = :usuario LIMIT 1");
            $st2->execute([':usuario' => $usuario]);
            $r = $st2->fetch(PDO::FETCH_ASSOC);
            if ($r && isset($r['intento'])) return (int)$r['intento'];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Resetea el contador intento a 0 para el usuario dado. Retorna true si se actualizó.
     */
    public function resetIntentoPorNombre(string $usuario): bool {
        try {
            $st = $this->conexion->prepare("UPDATE usuario SET intento = 0 WHERE usuario = :usuario");
            return $st->execute([':usuario' => $usuario]);
        } catch (Exception $e) {
            return false;
        }
    }

     // Cambiar la contraseña de un usuario
    public function actualizarUsuarioContraseña(UsuarioVO $usuarioVO): bool {
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 0;");
        // Hashear la nueva contraseña
        $opciones = array('cost' => 12);
        $hash_password = password_hash($usuarioVO->getContraseña(), PASSWORD_BCRYPT, $opciones);

        // Actualizar la contraseña en la base de datos
        $sql = "UPDATE usuario SET contraseña = :pwd WHERE idUsuario = :idUsuario";
        $stmt = $this->conexion->prepare($sql);
        $resultado = $stmt->execute([
            ':pwd' => $hash_password,
            ':idUsuario' => $usuarioVO->getIdUsuario()
        ]);
        $this->conexion->exec("SET FOREIGN_KEY_CHECKS = 1;");
        return $resultado;
    }
}
?>
