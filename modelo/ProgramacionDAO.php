<?php

class ProgramacionDAO {
    private $conexion;

    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    /**
     * Obtener la programación detallada (por día y horas) de los profesores en un trimestre.
     * Devuelve filas: { idProfesor, numeroEconomico, idGrupo, claveGrupo, dia, horaInicio, horaFin }
     */
    public function obtenerProgramacionDetalladaPorTrimestre(int $idTrimestre): array {
        try {
            $sql = "SELECT 
                p.idProfesor,
                p.numeroEconomico,
                g.idGrupo,
                g.claveGrupo,
                LOWER(h.dia) AS dia,
                DATE_FORMAT(h.horaInicio,'%H:%i') AS horaInicio,
                DATE_FORMAT(h.horaFin,'%H:%i') AS horaFin
            FROM programacion pr
            INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
            INNER JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
            INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
            INNER JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
            INNER JOIN horario h ON gh.horario_idHorario = h.idHorario
            WHERE pr.grupo_trimestre_idTrimestre = ?
            ORDER BY p.idProfesor, g.idGrupo, h.dia, h.horaInicio";
            $st = $this->conexion->prepare($sql);
            $st->execute([(int)$idTrimestre]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out = [];
            foreach ($rows as $r){
                $out[] = [
                    'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
                    'numeroEconomico' => $r['numeroEconomico'] ?? '',
                    'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                    'claveGrupo' => $r['claveGrupo'] ?? '',
                    'dia' => strtolower($r['dia'] ?? ''),
                    'horaInicio' => $r['horaInicio'] ?? '',
                    'horaFin' => $r['horaFin'] ?? ''
                ];
            }
            return $out;
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Obtener la programación detallada de un profesor específico en un trimestre.
     * Devuelve filas: { idProfesor, numeroEconomico, idGrupo, claveGrupo, dia, horaInicio, horaFin, idUEA, claveUEA, UEA }
     */
    public function obtenerProgramacionDetalladaPorTrimestreYProfesor(int $idTrimestre, int $idProfesor): array {
        try {
            $sql = "SELECT 
                p.idProfesor,
                p.numeroEconomico,
                g.idGrupo,
                g.claveGrupo,
                u.idUEA,
                u.claveUEA,
                u.nombre AS UEA,
                LOWER(h.dia) AS dia,
                DATE_FORMAT(h.horaInicio,'%H:%i') AS horaInicio,
                DATE_FORMAT(h.horaFin,'%H:%i') AS horaFin
            FROM programacion pr
            INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
            INNER JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
            INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
            INNER JOIN uea u ON g.uea_idUEA = u.idUEA
            INNER JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
            INNER JOIN horario h ON gh.horario_idHorario = h.idHorario
            WHERE pr.grupo_trimestre_idTrimestre = ? AND p.idProfesor = ?
            ORDER BY g.idGrupo, h.dia, h.horaInicio";

            $st = $this->conexion->prepare($sql);
            $st->execute([(int)$idTrimestre, (int)$idProfesor]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out = [];
            foreach ($rows as $r){
                $out[] = [
                    'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
                    'numeroEconomico' => $r['numeroEconomico'] ?? '',
                    'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                    'claveGrupo' => $r['claveGrupo'] ?? '',
                    'idUEA' => isset($r['idUEA']) ? (int)$r['idUEA'] : null,
                    'claveUEA' => $r['claveUEA'] ?? '',
                    'UEA' => $r['UEA'] ?? '',
                    'nombreUEA' => $r['UEA'] ?? '',
                    'dia' => strtolower($r['dia'] ?? ''),
                    'horaInicio' => $r['horaInicio'] ?? '',
                    'horaFin' => $r['horaFin'] ?? ''
                ];
            }
            return $out;
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Insert a programacion row linking grupo + trimestre + profesordisposicion
     */
    public function insertarProgramacion(int $idTrimestre, int $idGrupo, int $idProfesorDisposicion): bool {
        $sql = "INSERT INTO programacion (grupo_trimestre_idTrimestre, grupo_idGrupo, profesordisposicion_idProfesorDisposicion) VALUES (?, ?, ?)";
        $stmt = $this->conexion->prepare($sql);
        return (bool)$stmt->execute([$idTrimestre, $idGrupo, $idProfesorDisposicion]);
    }

    /**
     * Obtener asignación (profesor) por grupo para un trimestre dado.
     * Retorna filas: { idGrupo, claveGrupo, idProfesor, numeroEconomico, profesor }
     */
    public function obtenerAsignacionPorTrimestre(int $idTrimestre): array {
        try {
            $sql = "SELECT g.idGrupo, g.claveGrupo, p.idProfesor, p.numeroEconomico, p.nombre AS profesor
                FROM grupo g
                LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
                LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
                WHERE g.trimestre_idTrimestre = ?";
            $st = $this->conexion->prepare($sql);
            $st->execute([(int)$idTrimestre]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out = [];
            foreach ($rows as $r) {
                $out[] = [
                    'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                    'claveGrupo' => $r['claveGrupo'] ?? '',
                    'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
                    'numeroEconomico' => $r['numeroEconomico'] ?? '',
                    'profesor' => $r['profesor'] ?? ''
                ];
            }
            return $out;
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Delete all programacion rows for a given trimestre.
     * Returns the number of deleted rows.
     */
    public function borrarPorTrimestre(int $idTrimestre): int {
        $sql = "DELETE FROM programacion WHERE grupo_trimestre_idTrimestre = ?";
        $stmt = $this->conexion->prepare($sql);
        $stmt->execute([$idTrimestre]);
        return (int)$stmt->rowCount();
    }

    /**
     * Borrar programaciones de un profesor para una UEA específica en un trimestre.
     * Retorna el número de filas eliminadas.
     */
    public function borrarProgramacionProfesorUEA(int $idTrimestre, int $idProfesor, int $idUEA): int {
        try {
            $sql = "DELETE pr FROM programacion pr
                INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo
                WHERE pd.profesor_idProfesor = ?
                  AND g.uea_idUEA = ?
                  AND g.trimestre_idTrimestre = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$idProfesor, $idUEA, $idTrimestre]);
            return (int)$stmt->rowCount();
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Borrar todas las programaciones asociadas a un profesor para un trimestre dado.
     * Retorna el número de filas eliminadas.
     */
    public function borrarProgramacionProfesorPorTrimestre(int $idTrimestre, int $idProfesor): int {
        try {
            $sql = "DELETE pr FROM programacion pr
                INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                WHERE pd.profesor_idProfesor = ?
                  AND pr.grupo_trimestre_idTrimestre = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$idProfesor, $idTrimestre]);
            return (int)$stmt->rowCount();
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Borrar la(s) programacion(es) asociadas a un profesor para un grupo identificado por su claveGrupo
     * Retorna el número de filas eliminadas.
     */
    public function borrarProgramacionProfesorPorClaveGrupo(int $idTrimestre, int $idProfesor, string $claveGrupo): int {
        try {
            $sql = "DELETE pr FROM programacion pr
                INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo
                WHERE pd.profesor_idProfesor = ?
                  AND g.claveGrupo = ?
                  AND pr.grupo_trimestre_idTrimestre = ?";
            $stmt = $this->conexion->prepare($sql);
            $stmt->execute([$idProfesor, $claveGrupo, $idTrimestre]);
            return (int)$stmt->rowCount();
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Obtener asignación (profesor) para un grupo específico en un trimestre
     * Retorna fila o null: { idGrupo, claveGrupo, idProfesor, numeroEconomico, profesor }
     */
    public function obtenerAsignacionPorGrupo(int $idTrimestre, int $idGrupo): ?array {
        try {
            $sql = "SELECT g.idGrupo, g.claveGrupo, p.idProfesor, p.numeroEconomico, p.nombre AS profesor
                FROM grupo g
                LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
                LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
                WHERE g.trimestre_idTrimestre = ? AND g.idGrupo = ? LIMIT 1";
            $st = $this->conexion->prepare($sql);
            $st->execute([(int)$idTrimestre, (int)$idGrupo]);
            $r = $st->fetch(PDO::FETCH_ASSOC);
            if (!$r) return null;
            return [
                'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                'claveGrupo' => $r['claveGrupo'] ?? '',
                'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
                'numeroEconomico' => $r['numeroEconomico'] ?? '',
                'profesor' => $r['profesor'] ?? ''
            ];
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Borrar programacion para un grupo específico en un trimestre (independientemente del profesor)
     * Retorna número de filas borradas
     */
    public function borrarProgramacionPorGrupo(int $idTrimestre, int $idGrupo): int {
        try {
            $sql = "DELETE FROM programacion WHERE grupo_trimestre_idTrimestre = ? AND grupo_idGrupo = ?";
            $st = $this->conexion->prepare($sql);
            $st->execute([(int)$idTrimestre, (int)$idGrupo]);
            return (int)$st->rowCount();
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Obtener idUEA por su clave (claveUEA). Retorna int idUEA o null si no existe.
     */
    public function obtenerIdUEAPorClave(string $claveUEA): ?int {
        try {
            $st = $this->conexion->prepare("SELECT idUEA FROM uea WHERE claveUEA = :c LIMIT 1");
            $st->execute([':c' => $claveUEA]);
            $r = $st->fetch(PDO::FETCH_ASSOC);
            if ($r && isset($r['idUEA'])) return (int)$r['idUEA'];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Obtener idProfesor por su número económico. Retorna int idProfesor o null si no existe.
     */
    public function obtenerIdProfesorPorEconomico(string $numeroEconomico): ?int {
        try {
            $st = $this->conexion->prepare("SELECT idProfesor FROM profesor WHERE numeroEconomico = :ne LIMIT 1");
            $st->execute([':ne' => $numeroEconomico]);
            $r = $st->fetch(PDO::FETCH_ASSOC);
            if ($r && isset($r['idProfesor'])) return (int)$r['idProfesor'];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Obtener programación agregada para múltiples trimestres con filtros opcionales.
     * - $trimestres: array de idTrimestre (si vacío => todos los trimestres)
     * - $ueas: array de idUEA (si vacío => todas)
     * - $profesores: array de idProfesor (si vacío => todos)
     * Devuelve un arreglo de filas con días pivotados.
     */
    public function obtenerProgramacionMulti(array $trimestres = [], array $ueas = [], array $profesores = []): array {
        $params = [];
        $where = [];

        if (!empty($trimestres)) {
            $place = implode(',', array_fill(0, count($trimestres), '?'));
            $where[] = "t.idTrimestre IN ($place)";
            foreach ($trimestres as $idT) { $params[] = (int)$idT; }
        }

        if (!empty($ueas)) {
            $place = implode(',', array_fill(0, count($ueas), '?'));
            $where[] = "u.idUEA IN ($place)";
            foreach ($ueas as $idU) { $params[] = (int)$idU; }
        }

        if (!empty($profesores)) {
            $place = implode(',', array_fill(0, count($profesores), '?'));
            $where[] = "p.idProfesor IN ($place)";
            foreach ($profesores as $idP) { $params[] = (int)$idP; }
        }

        $whereSql = '';
        if (!empty($where)) {
            $whereSql = 'WHERE ' . implode(' AND ', $where);
        }

        $sql = "SELECT 
            t.idTrimestre,
            CONCAT(t.año, ' - ', tp.sigla) AS trimestre,
            u.idUEA,
            u.claveUEA,
            u.nombre AS UEA,
            g.idGrupo,
            g.claveGrupo AS grupo,
            g.cupo AS CM,
            g.salon AS salon,
            p.numeroEconomico,
            p.nombre AS profesor,
            GROUP_CONCAT(CASE WHEN h.dia='Lunes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS lunes_raw,
            GROUP_CONCAT(CASE WHEN h.dia='Martes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS martes_raw,
            GROUP_CONCAT(CASE WHEN h.dia='Miércoles' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS miercoles_raw,
            GROUP_CONCAT(CASE WHEN h.dia='Jueves' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS jueves_raw,
            GROUP_CONCAT(CASE WHEN h.dia='Viernes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS viernes_raw
        FROM grupo g
        JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
        JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
        JOIN uea u ON g.uea_idUEA = u.idUEA
        JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
        JOIN horario h ON gh.horario_idHorario = h.idHorario
        LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
        LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
        LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
        $whereSql
        GROUP BY g.idGrupo, p.idProfesor";

        try {
            $st = $this->conexion->prepare($sql);
            $st->execute($params);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out = [];
            foreach ($rows as $r) {
                $out[] = [
                    'idTrimestre' => isset($r['idTrimestre']) ? (int)$r['idTrimestre'] : null,
                    'trimestre' => $r['trimestre'] ?? '',
                    'idUEA' => isset($r['idUEA']) ? (int)$r['idUEA'] : null,
                    'claveUEA' => $r['claveUEA'] ?? '',
                    'UEA' => $r['UEA'] ?? '',
                    'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                    'grupo' => $r['grupo'] ?? '',
                    'CM' => $r['CM'] ?? '',
                    'salon' => $r['salon'] ?? '',
                    'numeroEconomico' => $r['numeroEconomico'] ?? '',
                    'profesor' => $r['profesor'] ?? '',
                    'lunes' => $r['lunes_raw'] ?? '',
                    'martes' => $r['martes_raw'] ?? '',
                    'miercoles' => $r['miercoles_raw'] ?? '',
                    'jueves' => $r['jueves_raw'] ?? '',
                    'viernes' => $r['viernes_raw'] ?? ''
                ];
            }
            return $out;
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Obtener programación (grupos + profesor + horarios agregados) de una UEA por su claveUEA
     * abarcando todos los trimestres donde existan grupos de esa UEA.
     * Devuelve filas: { idTrimestre, trimestre, idUEA, claveUEA, UEA, idGrupo, grupo, salon, cupo, idProfesor, numeroEconomico, profesor,
     * lunes, martes, miercoles, jueves, viernes }
     */
    public function obtenerProgramacionPorClaveUEA(string $claveUEA): array {
        try {
            $sql = "SELECT 
                t.idTrimestre,
                CONCAT(t.año, ' - ', tp.sigla) AS trimestre,
                u.idUEA,
                u.claveUEA,
                u.nombre AS UEA,
                g.idGrupo,
                g.claveGrupo AS grupo,
                g.cupo AS cupo,
                g.salon AS salon,
                p.idProfesor,
                p.numeroEconomico,
                p.nombre AS profesor,
                GROUP_CONCAT(CASE WHEN h.dia='Lunes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS lunes_raw,
                GROUP_CONCAT(CASE WHEN h.dia='Martes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS martes_raw,
                GROUP_CONCAT(CASE WHEN h.dia='Miércoles' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS miercoles_raw,
                GROUP_CONCAT(CASE WHEN h.dia='Jueves' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS jueves_raw,
                GROUP_CONCAT(CASE WHEN h.dia='Viernes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS viernes_raw
            FROM grupo g
            JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
            JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
            JOIN uea u ON g.uea_idUEA = u.idUEA
            JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
            JOIN horario h ON gh.horario_idHorario = h.idHorario
            LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
            LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
            LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
            WHERE u.claveUEA = ?
            GROUP BY g.idGrupo, p.idProfesor";
            $st = $this->conexion->prepare($sql);
            $st->execute([$claveUEA]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $out = [];
            foreach ($rows as $r) {
                $out[] = [
                    'idTrimestre' => isset($r['idTrimestre']) ? (int)$r['idTrimestre'] : null,
                    'trimestre' => $r['trimestre'] ?? '',
                    'idUEA' => isset($r['idUEA']) ? (int)$r['idUEA'] : null,
                    'claveUEA' => $r['claveUEA'] ?? '',
                    'UEA' => $r['UEA'] ?? '',
                    'idGrupo' => isset($r['idGrupo']) ? (int)$r['idGrupo'] : null,
                    'grupo' => $r['grupo'] ?? '',
                    'cupo' => $r['cupo'] ?? '',
                    'salon' => $r['salon'] ?? '',
                    'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
                    'numeroEconomico' => $r['numeroEconomico'] ?? '',
                    'profesor' => $r['profesor'] ?? '',
                    'lunes' => $r['lunes_raw'] ?? '',
                    'martes' => $r['martes_raw'] ?? '',
                    'miercoles' => $r['miercoles_raw'] ?? '',
                    'jueves' => $r['jueves_raw'] ?? '',
                    'viernes' => $r['viernes_raw'] ?? ''
                ];
            }
            return $out;
        } catch (Exception $e) {
            return [];
        }
    }

}

?>
