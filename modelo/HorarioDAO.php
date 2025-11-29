<?php

class HorarioDAO {
    private $conexion;
    public function __construct($conexion) { $this->conexion = $conexion; }

    /** Insert horario and return idHorario or null */
    public function insertarHorario(string $dia, string $horaInicio, string $horaFin): ?int {
        $sql = "INSERT INTO horario (dia, horaInicio, horaFin) VALUES (?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        $ok = $stmt->execute([$dia, $horaInicio, $horaFin]);
        if (!$ok) return null;
        return (int)$this->conexion->lastInsertId();
    }

    /** Link horario to grupo (grupo_has_horario) */
    public function vincularGrupoHorario(int $idGrupo, int $idHorario): bool {
        $sql = "INSERT INTO grupo_has_horario (grupo_idGrupo, horario_idHorario) VALUES (?, ?)";
        $stmt = $this->conexion->prepare($sql);
        return (bool)$stmt->execute([$idGrupo, $idHorario]);
    }

    /**
     * Buscar un horario existente por dia, horaInicio y horaFin. Retorna idHorario o null si no existe.
     */
    public function buscarHorarioPorDiaYHoras(string $dia, string $horaInicio, string $horaFin): ?int {
        $sql = "SELECT idHorario FROM horario WHERE dia = ? AND horaInicio = ? AND horaFin = ? LIMIT 1";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$dia, $horaInicio, $horaFin]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        return $r ? (int)$r['idHorario'] : null;
    }

    /** Obtener todos los horarios ordenados por día (lunes..viernes) y horaInicio */
    public function obtenerTodos(): array {
        $sql = "SELECT idHorario, dia, horaInicio, horaFin FROM horario ORDER BY FIELD(LOWER(dia),'lunes','martes','miercoles','jueves','viernes'), horaInicio";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $r) {
            $out[] = [
                'idHorario' => (int)$r['idHorario'],
                'dia' => $r['dia'],
                'horaInicio' => $r['horaInicio'],
                'horaFin' => $r['horaFin']
            ];
        }
        return $out;
    }
}

?>
