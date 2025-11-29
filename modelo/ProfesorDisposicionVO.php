<?php
class ProfesorDisposicionVO {
    private $idProfesorDisposicion;
    private $trimestre_idTrimestre;
    private $profesor_idProfesor;
    private $estado;
    private $notas;

    public function __construct($idProfesorDisposicion = null, $trimestre_idTrimestre = null, $profesor_idProfesor = null, $estado = 1, $notas = null) {
        $this->idProfesorDisposicion = $idProfesorDisposicion;
        $this->trimestre_idTrimestre = $trimestre_idTrimestre;
        $this->profesor_idProfesor = $profesor_idProfesor;
        $this->estado = $estado;
        $this->notas = $notas;
    }

    public function getId(): ?int { return $this->idProfesorDisposicion !== null ? (int)$this->idProfesorDisposicion : null; }
    public function getTrimestreId(): ?int { return $this->trimestre_idTrimestre !== null ? (int)$this->trimestre_idTrimestre : null; }
    public function getProfesorId(): ?int { return $this->profesor_idProfesor !== null ? (int)$this->profesor_idProfesor : null; }
    public function getEstado(): int { return (int)$this->estado; }
    public function getNotas(): ?string { return $this->notas; }

    public function toJSON(): array {
        return [
            'idProfesorDisposicion' => $this->getId(),
            'trimestre_idTrimestre' => $this->getTrimestreId(),
            'profesor_idProfesor' => $this->getProfesorId(),
            'estado' => $this->getEstado(),
            'notas' => $this->getNotas()
        ];
    }
}

?>
