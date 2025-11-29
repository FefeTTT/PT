<?php
require_once __DIR__ . '/ProfesorVO.php';

class AreaAcademicaVO{
	private $idAreaAcademica;
	private $nombre;
	private $puesto;
	private $profesor; // ProfesorVO (optional)

	function __construct($idAreaAcademica, $nombre, $puesto, ProfesorVO $profesor = null){
		$this->idAreaAcademica = $idAreaAcademica;
		$this->nombre = $nombre;
		$this->puesto = $puesto;
		$this->profesor = $profesor;
	}

	function __destruct(){ }

	function setNombre($v){ $this->nombre = $v; }
	function setPuesto($v){ $this->puesto = $v; }
	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }

	function getIdAreaAcademica(){ return $this->idAreaAcademica; }
	function getNombre(){ return $this->nombre; }
	function getPuesto(){ return $this->puesto; }
	function getProfesor(){ return $this->profesor; }

	function toString(): string{
		return "[AreaAcademica: id=".$this->idAreaAcademica.
			", nombre=".$this->nombre.
			", puesto=".$this->puesto.
			"]";
	}

	function toJSON(): array{
		return [
			"idAreaAcademica" => $this->getIdAreaAcademica(),
			"nombre" => $this->getNombre(),
			"puesto" => $this->getPuesto(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
		];
	}
}
?>