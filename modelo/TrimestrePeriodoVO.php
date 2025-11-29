<?php
class TrimestrePeriodoVO {
    private $id;
    private $nombre;
    private $sigla;

    public function __construct($id, $nombre, $sigla){
        $this->id = $id;
        $this->nombre = $nombre;
        $this->sigla = $sigla;
    }

    public function getId(){ return $this->id; }
    public function getNombre(){ return $this->nombre; }
    public function getSigla(){ return $this->sigla; }

    public function toJSON(): array {
        return ['idTrimestrePeriodo' => $this->id, 'nombre' => $this->nombre, 'sigla' => $this->sigla];
    }
}

?>
