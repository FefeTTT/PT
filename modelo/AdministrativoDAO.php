<?php
require_once __DIR__ . '/ProfesorDAO.php'; // reuse patterns

class AdministrativoDAO{
    private $conexion;
    public function __construct($conexion){ $this->conexion = $conexion; }

    public function listarAdministrativoTipos(): array{
        $sql = "SELECT idAdministrativoTipo AS idAdministrativoTipo, nombre, descripcion FROM administrativotipo ORDER BY nombre";
        $stmt = $this->conexion->query($sql);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return $rows ?: [];
    }

    /**
     * Listar administrativos con búsqueda opcional por nombre o número económico.
     * Filtros soportados: q (string), sort ('nombre'|'numeroEconomico'), sortDir ('ASC'|'DESC')
     */
    public function listarAdministrativos(array $filters = []): array{
        $sql = "SELECT idAdministrativo, numeroEconomico, nombre FROM administrativo WHERE 1=1";
        $params = [];
        // Búsqueda por texto (nombre o número económico)
        if (isset($filters['q']) && $filters['q'] !== ''){
            $q = '%' . $filters['q'] . '%';
            $sql .= " AND (nombre LIKE ? OR CAST(numeroEconomico AS CHAR) LIKE ? )";
            $params[] = $q; $params[] = $q;
        }
        // Filtro por tipo de administrativo (idAdministrativoTipo)
        if (isset($filters['idAdministrativoTipo']) && $filters['idAdministrativoTipo'] !== '' && $filters['idAdministrativoTipo'] !== null){
            // asegurar entero
            $idTipo = (int)$filters['idAdministrativoTipo'];
            $sql .= " AND administrativotipo_idAdministrativoTipo = ?";
            $params[] = $idTipo;
        }
        $allowedSort = ['nombre','numeroEconomico'];
        $sort = (isset($filters['sort']) && in_array($filters['sort'], $allowedSort, true)) ? $filters['sort'] : 'nombre';
        $dir = strtoupper($filters['sortDir'] ?? 'ASC');
        $dir = ($dir === 'DESC') ? 'DESC' : 'ASC';
        $sql .= " ORDER BY $sort $dir";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return $rows ?: [];
    }

    /** Obtener administrativo por ID (con nombre del tipo si existe) */
    public function obtenerAdministrativoPorId(int $id){
        $sql = "SELECT a.idAdministrativo, a.numeroEconomico, a.nombre, a.gradoEstudios, a.celular, a.correo_uam, a.correo_personal, a.lugar, a.extension, a.administrativotipo_idAdministrativoTipo AS idAdministrativoTipo, t.nombre AS tipoNombre, t.descripcion AS tipoDescripcion FROM administrativo a LEFT JOIN administrativotipo t ON t.idAdministrativoTipo = a.administrativotipo_idAdministrativoTipo WHERE a.idAdministrativo = ? LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function insertarAdministrativo($vo, int $idAdministrativoTipo){
        $sql = "INSERT INTO administrativo (administrativotipo_idAdministrativoTipo, numeroEconomico, nombre, gradoEstudios, celular, correo_uam, correo_personal, lugar, extension) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([
            $idAdministrativoTipo,
            (int)$vo->getNumeroEconomico(),
            $vo->getNombre(),
            $vo->getGradoEstudios(),
            $vo->getCelular(),
            $vo->getCorreoUAM(),
            $vo->getCorreoP(),
            $vo->getLugar(),
            $vo->getExtension()
        ]);
        if (!$ok) return null;
        $newId = (int)$this->conexion->lastInsertId();
        $s2 = $this->conexion->prepare('SELECT idAdministrativo, administrativotipo_idAdministrativoTipo, numeroEconomico, nombre, gradoEstudios, celular, correo_uam, correo_personal, lugar, extension FROM administrativo WHERE idAdministrativo = ? LIMIT 1');
        $s2->execute([$newId]);
        $row = $s2->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function obtenerAdministrativoPorNumeroEconomico(int $numeroEconomico){
        $sql = "SELECT idAdministrativo, numeroEconomico, nombre FROM administrativo WHERE numeroEconomico = ? LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$numeroEconomico]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function obtenerAdministrativoPorCorreoUAM(string $correo){
        $sql = "SELECT idAdministrativo, numeroEconomico, nombre FROM administrativo WHERE correo_uam = ? LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$correo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Obtener administrativo por correo personal (opcional)
     * Retorna fila asociativa o null si no existe
     */
    public function obtenerAdministrativoPorCorreoPersonal(string $correo){
        $sql = "SELECT idAdministrativo, numeroEconomico, nombre FROM administrativo WHERE correo_personal = ? LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$correo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function obtenerAdministrativoPorNombre(string $nombre){
        $sql = "SELECT idAdministrativo, numeroEconomico, nombre FROM administrativo WHERE nombre = ?";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$nombre]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) === 0) return null;
        if (count($rows) > 1) throw new Exception('Se encontraron múltiples administrativos con el mismo nombre');
        return $rows[0];
    }

    /**
     * Actualizar administrativo por id.
     * Recibe los valores y actualiza la fila; retorna la fila actualizada o null
     */
    public function actualizarAdministrativo(int $idAdministrativo, $vo, int $idAdministrativoTipo){
        $sql = "UPDATE administrativo SET administrativotipo_idAdministrativoTipo = ?, numeroEconomico = ?, nombre = ?, gradoEstudios = ?, celular = ?, correo_uam = ?, correo_personal = ?, lugar = ?, extension = ? WHERE idAdministrativo = ?";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([
            $idAdministrativoTipo,
            (int)$vo->getNumeroEconomico(),
            $vo->getNombre(),
            $vo->getGradoEstudios(),
            $vo->getCelular(),
            $vo->getCorreoUAM(),
            $vo->getCorreoP(),
            $vo->getLugar(),
            $vo->getExtension(),
            $idAdministrativo
        ]);
        if (!$ok) return null;
        $s2 = $this->conexion->prepare('SELECT idAdministrativo, administrativotipo_idAdministrativoTipo, numeroEconomico, nombre, gradoEstudios, celular, correo_uam, correo_personal, lugar, extension FROM administrativo WHERE idAdministrativo = ? LIMIT 1');
        $s2->execute([$idAdministrativo]);
        $row = $s2->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Eliminar un administrativo y sus referencias mínimas en una transacción.
     * Retorna true si la eliminación fue exitosa.
     */
    public function eliminarAdministrativoCompleto(int $idAdministrativo): bool {
        $this->conexion->beginTransaction();
        try {
            // Aquí se pueden añadir otras eliminaciones relacionadas si la base de datos
            // contiene asociaciones con la tabla `administrativo`. Por ahora eliminamos
            // entradas que referencien al administrativo y finalmente el registro.

            // ejemplo: si existieran tablas como `administrativo_has_x` borraríamos primero
            // $stmt = $this->conexion->prepare('DELETE FROM administrativo_has_x WHERE administrativo_idAdministrativo = ?');
            // $stmt->execute([$idAdministrativo]);

            // Finalmente eliminar el administrativo
            $stmt = $this->conexion->prepare('DELETE FROM administrativo WHERE idAdministrativo = ?');
            $stmt->execute([$idAdministrativo]);

            $this->conexion->commit();
            return true;
        } catch (Exception $e) {
            $this->conexion->rollBack();
            throw $e;
        }
    }
}

?>
