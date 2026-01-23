<?php
class ProfesordisposicionDAO {
    public $conexion;
    public function __construct($conexion){ $this->conexion = $conexion; }
    public function __destruct(){ }

    /**
     * Insertar una fila en profesordisposicion.
     * Retorna el id insertado o null si falla.
     */
    public function insertar(int $trimestreId, int $numeroEconomico, int $estado = 1, ?string $notas = null){
        $sql = "INSERT INTO profesordisposicion (trimestre_idTrimestre, profesor_numeroEconomico, estado, notas) VALUES (?, ?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([$trimestreId, $numeroEconomico, $estado, $notas]);
        if (!$ok) return null;
        $newId = (int)$this->conexion->lastInsertId();
        return $newId;
    }

    /**
     * Inserta disposiciones para una lista de profesores en una misma transacción.
     * $profesores es array de ids (int) o array de objetos que contienen idProfesor.
     * Retorna número de filas insertadas.
     */
    public function insertarMasivo(int $trimestreId, array $profesores, int $estado = 1, string $notasPrefix = ''): int {
        if (empty($profesores)) return 0;
        $count = 0;
        $stmt = $this->conexion->prepare("INSERT INTO profesordisposicion (trimestre_idTrimestre, profesor_numeroEconomico, estado, notas) VALUES (?, ?, ?, ?)");
        foreach ($profesores as $p) {
            $numEco = is_array($p) && isset($p['numeroEconomico']) ? (int)$p['numeroEconomico'] : (is_object($p) && isset($p->numeroEconomico) ? (int)$p->numeroEconomico : (int)$p);
            $notas = $notasPrefix;
            $ok = $stmt->execute([$trimestreId, $numEco, $estado, $notas]);
            if ($ok) $count++;
        }
        return $count;
    }

    /** Buscar por profesor y trimestre (opcional) */
    public function buscarPorProfesorYTrimestre(int $numeroEconomico, int $trimestreId): ?array {
        $st = $this->conexion->prepare("SELECT idProfesorDisposicion, trimestre_idTrimestre, profesor_numeroEconomico, estado, notas FROM profesordisposicion WHERE profesor_numeroEconomico = ? AND trimestre_idTrimestre = ? LIMIT 1");
        $st->execute([$numeroEconomico, $trimestreId]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        return $r ?: null;
    }

    /** Actualizar estado por profesor y trimestre. Retorna true si se actualizó. */
    public function actualizarEstadoPorProfesorTrimestre(int $numeroEconomico, int $trimestreId, int $estado): bool {
        // intentar actualizar si existe
        $st = $this->conexion->prepare("SELECT idProfesorDisposicion FROM profesordisposicion WHERE profesor_numeroEconomico = ? AND trimestre_idTrimestre = ? LIMIT 1");
        $st->execute([$numeroEconomico, $trimestreId]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if ($r && isset($r['idProfesorDisposicion'])){
            $id = (int)$r['idProfesorDisposicion'];
            $upd = $this->conexion->prepare("UPDATE profesordisposicion SET estado = ? WHERE idProfesorDisposicion = ?");
            return (bool)$upd->execute([$estado ? 1 : 0, $id]);
        }
        // si no existe, insertar
        $ins = $this->conexion->prepare("INSERT INTO profesordisposicion (trimestre_idTrimestre, profesor_numeroEconomico, estado, notas) VALUES (?, ?, ?, ?)");
        return (bool)$ins->execute([$trimestreId, $numeroEconomico, $estado ? 1 : 0, 'actualizado manualmente']);
    }

    /**
     * Listar profesores dados de alta como disponibles (estado=1) en un trimestre,
     * incluyendo un flag indicando si ya llenaron sus preferencias en profesorpreferencias.
     * Retorna array de filas: { idProfesor, numeroEconomico, nombre, filledPrefs }
     */
    public function listarDisponiblesConEstatusPreferencias(int $idTrimestre): array {
        $sql = "SELECT 
                    p.numeroEconomico AS numeroEconomico,
                    p.nombre AS nombre,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM profesorpreferencias pp 
                        WHERE pp.trimestre_idTrimestre = :idTr AND pp.profesor_numeroEconomico = p.numeroEconomico
                    ) THEN 1 ELSE 0 END AS filledPrefs
                FROM profesordisposicion pd
                INNER JOIN profesor p ON p.numeroEconomico = pd.profesor_numeroEconomico
                WHERE pd.trimestre_idTrimestre = :idTr AND pd.estado = 1
                ORDER BY p.nombre";
        $st = $this->conexion->prepare($sql);
        $st->execute([':idTr' => $idTrimestre]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return $rows ?: [];
    }

    /**
     * Listar TODOS los profesores registrados en profesordisposicion para un trimestre,
     * incluyendo su estado (0/1) y si ya llenaron sus preferencias (filledPrefs 0/1).
     * Retorna filas: { idProfesor, numeroEconomico, nombre, estado, filledPrefs }
     */
    public function listarProfesoresTrimestreConEstatusPreferencias(int $idTrimestre): array {
        $sql = "SELECT 
                    p.numeroEconomico AS numeroEconomico,
                    p.nombre AS nombre,
                    pd.estado AS estado,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM profesorpreferencias pp 
                        WHERE pp.trimestre_idTrimestre = :idTr AND pp.profesor_numeroEconomico = p.numeroEconomico
                    ) THEN 1 ELSE 0 END AS filledPrefs
                FROM profesordisposicion pd
                INNER JOIN profesor p ON p.numeroEconomico = pd.profesor_numeroEconomico
                WHERE pd.trimestre_idTrimestre = :idTr
                ORDER BY p.nombre";
        $st = $this->conexion->prepare($sql);
        $st->execute([':idTr' => $idTrimestre]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return $rows ?: [];
    }
}

?>
