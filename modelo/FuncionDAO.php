<?php
class FuncionDAO {
    private $conexion;

    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    // Obtener todas las funciones (sin usuario asociado)
    public function obtenerTodasFunciones(): array {
        $funciones = [];
        $sql = "SELECT idFuncion, nombre, descripcion FROM funcion";
        $stmt = $this->conexion->query($sql);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Crear un usuario ficticio para evitar pasar null
            $fakeUserName = 'fict_user_' . $row['idFuncion'] . '_' . substr(uniqid(), -6);
            $fakeUser = new UsuarioVO($fakeUserName, '', 0, null);
            $f = new FuncionVO($row['nombre'], $row['descripcion'], $fakeUser, $row['idFuncion']);
            $funciones[] = $f->toJSON();
        }
        return $funciones;
    }

    // Obtener funciones asignadas a un usuario (devuelve array de FuncionVO con usuario VO incluido)
    public function obtenerFuncionUsuarioId(int $idUsuario): array {
        $funciones = [];
        $sql = "SELECT f.idFuncion, f.nombre, f.descripcion, u.idUsuario AS uid, u.usuario AS uname, u.contraseña AS upwd, u.intento AS uintento
                FROM funcion f
                JOIN usuario_has_funcion uf ON f.idFuncion = uf.funcion_idFuncion
                JOIN usuario u ON uf.usuario_idUsuario = u.idUsuario
                WHERE u.idUsuario = :id";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':id' => $idUsuario]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $usuarioVO = new UsuarioVO($row['uname'], $row['upwd'], $row['uintento'], $row['uid']);
            $f = new FuncionVO($row['nombre'], $row['descripcion'], $usuarioVO, $row['idFuncion']);
            $funciones[] = $f->toJSON();
        }
        return $funciones;
    }

    // Obtener función por id
    public function obtenerFuncionId(int $id): ?FuncionVO {
        $sql = "SELECT idFuncion, nombre, descripcion FROM funcion WHERE idFuncion = :id LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $fakeUserName = 'fict_user_' . $row['idFuncion'] . '_' . substr(uniqid(), -6);
            $fakeUser = new UsuarioVO($fakeUserName, '', 0, null);
            return new FuncionVO($row['nombre'], $row['descripcion'], $fakeUser, $row['idFuncion']);
        }
        return null;
    }

    // Insertar nueva función
    public function insertarFuncion(FuncionVO $fvo): bool {
        $sql = "INSERT INTO funcion (nombre, descripcion) VALUES (:nombre, :descripcion)";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([
            ':nombre' => $fvo->getNombre(),
            ':descripcion' => $fvo->getDescripcion()
        ]);
    }

    // Asignar función a un usuario (inserta en usuario_has_funcion)
    public function asignarFuncionUsuarioID(int $idUsuario, int $idFuncion): bool {
        $sql = "INSERT INTO usuario_has_funcion (usuario_idUsuario, funcion_idFuncion) VALUES (:idUsuario, :idFuncion)";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([':idUsuario' => $idUsuario, ':idFuncion' => $idFuncion]);
    }

    // Eliminar asignación
    public function eliminarFuncionUsuarioID(int $idUsuario, int $idFuncion): bool {
        $sql = "DELETE FROM usuario_has_funcion WHERE usuario_idUsuario = :idUsuario AND funcion_idFuncion = :idFuncion";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([':idUsuario' => $idUsuario, ':idFuncion' => $idFuncion]);
    }

    // Asignar función a un usuario por nombres (usuario y función)
    public function asignarFuncionUsuarioNombre(string $nombreUsuario, string $nombreFuncion): bool {
        // Obtener idUsuario
        $sqlU = "SELECT idUsuario FROM usuario WHERE usuario = :usuario LIMIT 1";
        $stmtU = $this->conexion->prepare($sqlU);
        $stmtU->execute([':usuario' => $nombreUsuario]);
        $rowU = $stmtU->fetch(PDO::FETCH_ASSOC);
        if (!$rowU) return false;
        $idUsuario = (int)$rowU['idUsuario'];

        // Obtener idFuncion
        $sqlF = "SELECT idFuncion FROM funcion WHERE nombre = :nombre LIMIT 1";
        $stmtF = $this->conexion->prepare($sqlF);
        $stmtF->execute([':nombre' => $nombreFuncion]);
        $rowF = $stmtF->fetch(PDO::FETCH_ASSOC);
        if (!$rowF) return false;
        $idFuncion = (int)$rowF['idFuncion'];

        return $this->asignarFuncionUsuarioID($idUsuario, $idFuncion);
    }

    // Eliminar asignación por nombres de usuario y función
    public function eliminarFuncionUsuarioNombre(string $nombreUsuario, string $nombreFuncion): bool {
        // Obtener idUsuario
        $sqlU = "SELECT idUsuario FROM usuario WHERE usuario = :usuario LIMIT 1";
        $stmtU = $this->conexion->prepare($sqlU);
        $stmtU->execute([':usuario' => $nombreUsuario]);
        $rowU = $stmtU->fetch(PDO::FETCH_ASSOC);
        if (!$rowU) return false;
        $idUsuario = (int)$rowU['idUsuario'];

        // Obtener idFuncion
        $sqlF = "SELECT idFuncion FROM funcion WHERE nombre = :nombre LIMIT 1";
        $stmtF = $this->conexion->prepare($sqlF);
        $stmtF->execute([':nombre' => $nombreFuncion]);
        $rowF = $stmtF->fetch(PDO::FETCH_ASSOC);
        if (!$rowF) return false;
        $idFuncion = (int)$rowF['idFuncion'];

        return $this->eliminarFuncionUsuarioID($idUsuario, $idFuncion);
    }

    // Obtener funciones asignadas a un usuario por nombre de usuario
    public function obtenerFuncionesPorNombreUsuario(string $nombreUsuario): array {
        $funciones = [];
        $sql = "SELECT f.idFuncion, f.nombre, f.descripcion, u.idUsuario AS uid, u.usuario AS uname, u.contraseña AS upwd, u.intento AS uintento
                FROM funcion f
                JOIN usuario_has_funcion uf ON f.idFuncion = uf.funcion_idFuncion
                JOIN usuario u ON uf.usuario_idUsuario = u.idUsuario
                WHERE u.usuario = :usuario";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([':usuario' => $nombreUsuario]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $usuarioVO = new UsuarioVO($row['uname'], $row['upwd'], $row['uintento'], $row['uid']);
            $f = new FuncionVO($row['nombre'], $row['descripcion'], $usuarioVO, $row['idFuncion']);
            $funciones[] = $f->toJSON();
        }
        return $funciones;
    }
}

?>
