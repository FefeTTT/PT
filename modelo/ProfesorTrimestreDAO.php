<?php

class ProfesorTrimestreDAO {
    private $conexion;

    public function __construct($conexion){
        $this->conexion = $conexion;
    }

    /**
     * Excluir a un profesor de un trimestre de forma atómica:
     * - Borrar preferencias (ueas + horarios + preferencia)
     * - Borrar programación del profesor en ese trimestre
     * - Actualizar/insertar disposición (estado=0)
     * Retorna arreglo con contadores y ok=true/false.
     */
    public function excluirProfesorDelTrimestreAtomic(int $idTrimestre, int $idProfesor): array {
        $deleted_uea = 0; $deleted_horario = 0; $deleted_pref = 0; $deleted_prog = 0; $updated_dis = false;
        try {
            $this->conexion->beginTransaction();

            // 1) Borrar preferencias del profesor para el trimestre
            $st = $this->conexion->prepare("SELECT idProfesorPreferencias FROM profesorpreferencias WHERE profesor_idProfesor = :idP AND trimestre_idTrimestre = :idTr");
            $st->execute([':idP' => $idProfesor, ':idTr' => $idTrimestre]);
            $ids = $st->fetchAll(PDO::FETCH_COLUMN, 0);
            if ($ids && count($ids) > 0){
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                // UEAs vinculadas
                $st1 = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias IN ($placeholders)");
                $st1->execute($ids);
                $deleted_uea = (int)$st1->rowCount();
                // Horarios vinculados
                $st2 = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias IN ($placeholders)");
                $st2->execute($ids);
                $deleted_horario = (int)$st2->rowCount();
                // Preferencia(s)
                $st3 = $this->conexion->prepare("DELETE FROM profesorpreferencias WHERE idProfesorPreferencias IN ($placeholders)");
                $st3->execute($ids);
                $deleted_pref = (int)$st3->rowCount();
            }

            // 2) Borrar programación del profesor en el trimestre
            $sqlProg = "DELETE pr FROM programacion pr
                INNER JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
                WHERE pd.profesor_idProfesor = ?
                  AND pr.grupo_trimestre_idTrimestre = ?";
            $stProg = $this->conexion->prepare($sqlProg);
            $stProg->execute([$idProfesor, $idTrimestre]);
            $deleted_prog = (int)$stProg->rowCount();

            // 3) Actualizar disposición a estado=0 (si no existe, insertar)
            $selDis = $this->conexion->prepare("SELECT idProfesorDisposicion FROM profesordisposicion WHERE profesor_idProfesor = ? AND trimestre_idTrimestre = ? LIMIT 1");
            $selDis->execute([$idProfesor, $idTrimestre]);
            $row = $selDis->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['idProfesorDisposicion'])){
                $upd = $this->conexion->prepare("UPDATE profesordisposicion SET estado = 0 WHERE idProfesorDisposicion = ?");
                $updated_dis = (bool)$upd->execute([(int)$row['idProfesorDisposicion']]);
            } else {
                $ins = $this->conexion->prepare("INSERT INTO profesordisposicion (trimestre_idTrimestre, profesor_idProfesor, estado, notas) VALUES (?, ?, 0, ?)");
                $updated_dis = (bool)$ins->execute([$idTrimestre, $idProfesor, 'excluido automáticamente']);
            }

            $this->conexion->commit();
            return [
                'ok' => true,
                'deleted_uea' => $deleted_uea,
                'deleted_horario' => $deleted_horario,
                'deleted_preferencias' => $deleted_pref,
                'deleted_programacion' => $deleted_prog,
                'disposicion_actualizada' => $updated_dis
            ];
        } catch (Exception $e) {
            try { if ($this->conexion->inTransaction()) $this->conexion->rollBack(); } catch(Exception $_) {}
            return [ 'ok' => false, 'error' => $e->getMessage() ];
        }
    }
}

?>
