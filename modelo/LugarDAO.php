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
        $sql = "SELECT l.idLugar, e.nombreEdificio as edificio, p.nombrePiso as piso, l.nombre
                FROM profesor_has_lugar pl
                JOIN lugar l ON pl.lugar_idLugar = l.idLugar
                JOIN pisos p ON l.idPiso = p.idPiso
                JOIN edificios e ON p.idEdificio = e.idEdificio
                WHERE pl.profesor_numeroEconomico = ?
                ORDER BY e.nombreEdificio, p.nombrePiso, l.nombre";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$idProfesor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $result = [];
        foreach ($rows as $r){
            $vo = new LugarVO(
                (int)$r['idLugar'], 
                $r['edificio'], 
                $r['piso'], 
                '', 
                $r['nombre'], 
                '', 
                null
            );
            $result[] = $vo->toJSON();
        }
        return $result;
    }

    /**
     * Inserta un lugar y lo asocia a un profesor (profesor_has_lugar).
     * Creates Edificio and Piso if they don't exist (Find or Create).
     */
    public function insertarYAsociar(LugarVO $lugar, int $idProfesor): ?array {
        $this->conexion->beginTransaction();
        try{
            // 1. Handle Edificio
            $nombreEdificio = trim($lugar->getEdificio());
            $stmt = $this->conexion->prepare("SELECT idEdificio FROM edificios WHERE nombreEdificio = ?");
            $stmt->execute([$nombreEdificio]);
            $idEdificio = $stmt->fetchColumn();

            if (!$idEdificio) {
                // Check if empty, maybe error? Assuming valid input or allowing creation of "empty" name?
                // Ideally we shouldn't allow empty, but let's handle it gracefully or let DB error
                $stmtIns = $this->conexion->prepare("INSERT INTO edificios (nombreEdificio) VALUES (?)");
                $stmtIns->execute([$nombreEdificio]);
                $idEdificio = $this->conexion->lastInsertId();
            }

            // 2. Handle Piso
            $nombrePiso = trim((string)$lugar->getPiso()); 
            $stmt = $this->conexion->prepare("SELECT idPiso FROM pisos WHERE nombrePiso = ? AND idEdificio = ?");
            $stmt->execute([$nombrePiso, $idEdificio]);
            $idPiso = $stmt->fetchColumn();

            if (!$idPiso) {
                $stmtIns = $this->conexion->prepare("INSERT INTO pisos (nombrePiso, idEdificio) VALUES (?, ?)");
                $stmtIns->execute([$nombrePiso, $idEdificio]);
                $idPiso = $this->conexion->lastInsertId();
            }

            // 3. Handle Lugar
            $nombreLugar = trim($lugar->getNombre());
            if ($nombreLugar === '' && $lugar->getCubiculo()) {
                 $nombreLugar = $lugar->getCubiculo(); 
            }

            $stmt = $this->conexion->prepare("SELECT idLugar FROM lugar WHERE nombre = ? AND idPiso = ?");
            $stmt->execute([$nombreLugar, $idPiso]);
            $idLugar = $stmt->fetchColumn();

            if (!$idLugar) {
                $stmtIns = $this->conexion->prepare("INSERT INTO lugar (nombre, idPiso) VALUES (?, ?)");
                $stmtIns->execute([$nombreLugar, $idPiso]);
                $idLugar = $this->conexion->lastInsertId();
            }

            // 4. Associate
            $stmt = $this->conexion->prepare("SELECT count(*) FROM profesor_has_lugar WHERE profesor_numeroEconomico = ? AND lugar_idLugar = ?");
            $stmt->execute([$idProfesor, $idLugar]);
            if ($stmt->fetchColumn() == 0) {
                $stmt2 = $this->conexion->prepare('INSERT INTO profesor_has_lugar (profesor_numeroEconomico, lugar_idLugar) VALUES (?, ?)');
                $stmt2->execute([$idProfesor, $idLugar]);
            }

            $this->conexion->commit();
            
            $vo = new LugarVO((int)$idLugar, $nombreEdificio, $nombrePiso, '', $nombreLugar, '', null);
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
        $this->conexion->beginTransaction();
        try {
            // 1. Edificio
            $nombreEdificio = trim($lugar->getEdificio());
            $stmt = $this->conexion->prepare("SELECT idEdificio FROM edificios WHERE nombreEdificio = ?");
            $stmt->execute([$nombreEdificio]);
            $idEdificio = $stmt->fetchColumn();
            if (!$idEdificio) {
                $stmtIns = $this->conexion->prepare("INSERT INTO edificios (nombreEdificio) VALUES (?)");
                $stmtIns->execute([$nombreEdificio]);
                $idEdificio = $this->conexion->lastInsertId();
            }

            // 2. Piso
            $nombrePiso = trim((string)$lugar->getPiso());
            $stmt = $this->conexion->prepare("SELECT idPiso FROM pisos WHERE nombrePiso = ? AND idEdificio = ?");
            $stmt->execute([$nombrePiso, $idEdificio]);
            $idPiso = $stmt->fetchColumn();
            if (!$idPiso) {
                $stmtIns = $this->conexion->prepare("INSERT INTO pisos (nombrePiso, idEdificio) VALUES (?, ?)");
                $stmtIns->execute([$nombrePiso, $idEdificio]);
                $idPiso = $this->conexion->lastInsertId();
            }

            // 3. Update Lugar
            $nombreLugar = trim($lugar->getNombre());
             if ($nombreLugar === '' && $lugar->getCubiculo()) $nombreLugar = $lugar->getCubiculo();

            $sql = "UPDATE lugar SET nombre = ?, idPiso = ? WHERE idLugar = ?";
            $stmt = $this->conexion->prepare($sql);
            $res = $stmt->execute([$nombreLugar, $idPiso, $lugar->getIdLugar()]);

            $this->conexion->commit();
            return $res;
        } catch (Exception $e) {
            $this->conexion->rollBack();
            throw $e;
        }
    }

    /**
     * Desasocia un lugar de un profesor (elimina fila profesor_has_lugar)
     */
    public function desasociarLugar(int $idProfesor, int $idLugar): bool {
        $sql = "DELETE FROM profesor_has_lugar WHERE profesor_numeroEconomico = ? AND lugar_idLugar = ?";
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
