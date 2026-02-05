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
     * - Eliminar registro de disposición
     * Retorna arreglo con contadores y ok=true/false.
     */
    public function excluirProfesorDelTrimestreAtomic(int $idTrimestre, int $idProfesor): array {
        $deleted_uea = 0; $deleted_horario = 0; $deleted_pref = 0; $deleted_prog = 0; $updated_dis = false;
        try {
            $this->conexion->beginTransaction();

            // 1) Borrar preferencias del profesor para el trimestre
            $st = $this->conexion->prepare("SELECT idProfesorPreferencias FROM profesorpreferencias WHERE profesor_numeroEconomico = :idP AND trimestre_idTrimestre = :idTr");
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
                WHERE pd.profesor_numeroEconomico = ?
                  AND pr.grupo_trimestre_idTrimestre = ?";
            $stProg = $this->conexion->prepare($sqlProg);
            $stProg->execute([$idProfesor, $idTrimestre]);
            $deleted_prog = (int)$stProg->rowCount();

            // 3) Eliminar disposición
            $delDis = $this->conexion->prepare("DELETE FROM profesordisposicion WHERE profesor_numeroEconomico = ? AND trimestre_idTrimestre = ?");
            $updated_dis = (bool)$delDis->execute([$idProfesor, $idTrimestre]);

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
