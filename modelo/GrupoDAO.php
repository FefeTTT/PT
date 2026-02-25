<?php

class GrupoDAO {
    private $conexion;
    public function __construct($conexion) { $this->conexion = $conexion; }

    /**
     * Insertar un grupo en un trimestre y retornar el idGrupo insertado (int) o null en error
     */
    public function insertarGrupo(int $idTrimestre, int $idUEA, string $claveGrupo, ?int $cupo = null, ?int $inscritos = null, ?string $salon = null): ?int {
        $sql = "INSERT INTO grupo (trimestre_idTrimestre, uea_idUEA, claveGrupo, cupo, inscritos, salon) VALUES (?, ?, ?, ?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([$idTrimestre, $idUEA, $claveGrupo, $cupo, $inscritos, $salon]);
        if (!$ok) return null;
        return (int)$this->conexion->lastInsertId();
    }

    public function buscarPorClaveYTrimestre(string $claveGrupo, int $idTrimestre): ?array {
        $st = $this->conexion->prepare("SELECT idGrupo, trimestre_idTrimestre, uea_idUEA, claveGrupo, cupo, inscritos, salon FROM grupo WHERE claveGrupo = ? AND trimestre_idTrimestre = ? LIMIT 1");
        $st->execute([$claveGrupo, $idTrimestre]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        return $r ?: null;
    }

    /**
     * Delete grupo_has_horario rows and grupo rows for a given trimestre.
     * Returns an associative array with counts: ['grupo_has_horario' => n, 'grupos' => m]
     */
    public function borrarPorTrimestre(int $idTrimestre): array {
        $counts = ['grupo_has_horario' => 0, 'grupos' => 0];
        // delete grupo_has_horario entries referencing grupos of the trimestre
        $sql1 = "DELETE gh FROM grupo_has_horario gh JOIN grupo g ON gh.grupo_idGrupo = g.idGrupo WHERE g.trimestre_idTrimestre = ?";
        $stmt1 = $this->conexion->prepare($sql1);
        if ($stmt1->execute([$idTrimestre])) {
            $counts['grupo_has_horario'] = (int)$stmt1->rowCount();
        }

        // delete grupos for the trimestre
        $sql2 = "DELETE FROM grupo WHERE trimestre_idTrimestre = ?";
        $stmt2 = $this->conexion->prepare($sql2);
        if ($stmt2->execute([$idTrimestre])) {
            $counts['grupos'] = (int)$stmt2->rowCount();
        }

        return $counts;
    }

    public function existeNombreGrupo(string $nombre): bool {
        $st = $this->conexion->prepare("SELECT id FROM grupo WHERE nombre = ? LIMIT 1");
        $st->execute([$nombre]);
        return $st->fetch(PDO::FETCH_ASSOC) !== false;
    }

    public function insertarNombreGrupo(string $nombre): ?int {
        if ($this->existeNombreGrupo($nombre)) {
            return null; // Already exists
        }
        $sql = "INSERT INTO grupo (nombre) VALUES (?)";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([$nombre]);
        if (!$ok) return null;
        return (int)$this->conexion->lastInsertId();
    }
}

?>
