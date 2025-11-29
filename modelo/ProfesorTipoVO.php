<?php

class ProfesorTipoVO {
    private $idProfesorTipo;
    private $nombre;

    public function __construct($idProfesorTipo, $nombre) {
        $this->idProfesorTipo = $idProfesorTipo;
        $this->nombre = $nombre;
    }

    public function getIdProfesorTipo() {
        return $this->idProfesorTipo;
    }

    public function getNombre() {
        return $this->nombre;
    }

    public function setNombre($nombre) {
        $this->nombre = $nombre;
    }

    public function __toString() {
        return $this->toString();
    }

    public function toString() {
        return "ProfesorTipoVO[idProfesorTipo=" . $this->idProfesorTipo . ", nombre=" . $this->nombre . "]";
    }

    public function toJSON() {
        return [
            'idProfesorTipo' => $this->idProfesorTipo,
            'nombre' => $this->nombre
        ];
    }
}
