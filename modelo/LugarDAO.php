<?php
class LugarDAO{
    public $conexion;

    public function __construct($conexion){
        $this->conexion = $conexion;
    }

    public function __destruct(){ }

    /**
     * Listar lugares asociados a un profesor por id.
     * Devuelve arreglo de LugarVO->toJSON()
     */
    public function listarPorProfesorId(int $idProfesor): array {
        $sql = "SELECT l.idLugar, l.edificio, l.piso, l.cubiculo, l.nombre, l.notas
                FROM profesor_has_lugar pl
                JOIN lugar l ON pl.lugar_idLugar = l.idLugar
                WHERE pl.profesor_idProfesor = ?
                ORDER BY l.edificio, l.piso, l.nombre";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$idProfesor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result = [];
        foreach ($rows as $r){
            $vo = new LugarVO((int)$r['idLugar'], $r['edificio'], (int)$r['piso'], $r['cubiculo'], $r['nombre'], $r['notas'] ?? null, null);
            $result[] = $vo->toJSON();
        }
        return $result;
    }

    /**
     * Inserta un lugar y lo asocia a un profesor (profesor_has_lugar)
     * Retorna el lugar insertado como arreglo (toJSON)
     */
    public function insertarYAsociar(LugarVO $lugar, int $idProfesor): ?array {
        $this->conexion->beginTransaction();
        try{
            $sql = "INSERT INTO lugar (edificio, piso, cubiculo, nombre, notas) VALUES (?, ?, ?, ?, ?)";
            $stmt = $this->conexion->prepare($sql);
            $ok = $stmt->execute([
                $lugar->getEdificio(),
                (int)$lugar->getPiso(),
                $lugar->getCubiculo(),
                $lugar->getNombre(),
                $lugar->getNotas()
            ]);
            if (!$ok){ $this->conexion->rollBack(); return null; }
            $idLugar = (int)$this->conexion->lastInsertId();

            $stmt2 = $this->conexion->prepare('INSERT IGNORE INTO profesor_has_lugar (profesor_idProfesor, lugar_idLugar) VALUES (?, ?)');
            $stmt2->execute([$idProfesor, $idLugar]);

            $this->conexion->commit();
            $vo = new LugarVO($idLugar, $lugar->getEdificio(), (int)$lugar->getPiso(), $lugar->getCubiculo(), $lugar->getNombre(), $lugar->getNotas(), null);
            return $vo->toJSON();
        } catch (Exception $e){
            $this->conexion->rollBack();
            throw $e;
        }
    }

    /**
     * Actualiza los datos de un lugar existente.
     */
    public function actualizarLugar(LugarVO $lugar): bool {
        $sql = "UPDATE lugar SET edificio = ?, piso = ?, cubiculo = ?, nombre = ?, notas = ? WHERE idLugar = ?";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([
            $lugar->getEdificio(),
            (int)$lugar->getPiso(),
            $lugar->getCubiculo(),
            $lugar->getNombre(),
            $lugar->getNotas(),
            (int)$lugar->getIdLugar()
        ]);
    }

    /**
     * Desasocia un lugar de un profesor (elimina fila profesor_has_lugar)
     */
    public function desasociarLugar(int $idProfesor, int $idLugar): bool {
        $sql = "DELETE FROM profesor_has_lugar WHERE profesor_idProfesor = ? AND lugar_idLugar = ?";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([$idProfesor, $idLugar]);
    }

    /**
     * Elimina un lugar por id (usa LugarVO)
     */
    public function eliminarLugar(LugarVO $lugar): bool {
        $sql = "DELETE FROM lugar WHERE idLugar = ?";
        $stmt = $this->conexion->prepare($sql);
        return $stmt->execute([(int)$lugar->getIdLugar()]);
    }
}
