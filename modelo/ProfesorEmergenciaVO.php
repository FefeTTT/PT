<?php
require_once __DIR__ . '/ProfesorVO.php';

class ProfesorEmergenciaVO{
	private $idProfesorEmergencia;
	private $profesor; // ProfesorVO
	private $nombre;
	private $parentesco;
	private $celular;

	function __construct($idProfesorEmergencia, ProfesorVO $profesor = null, $nombre, $parentesco, $celular = null){
		$this->idProfesorEmergencia = $idProfesorEmergencia;
		$this->profesor = $profesor;
		$this->nombre = $nombre;
		$this->parentesco = $parentesco;
		$this->celular = $celular;
	}

	function __destruct(){ }

	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }
	function setNombre($v){ $this->nombre = $v; }
	function setParentesco($v){ $this->parentesco = $v; }
	function setCelular($v){ $this->celular = $v; }

	function getIdProfesorEmergencia(){ return $this->idProfesorEmergencia; }
	function getProfesor(){ return $this->profesor; }
	function getNombre(){ return $this->nombre; }
	function getParentesco(){ return $this->parentesco; }
	function getCelular(){ return $this->celular; }

	function toString(): string{
		return "[ProfesorEmergencia: id=".$this->idProfesorEmergencia.
			", nombre=".$this->nombre.
			", parentesco=".$this->parentesco.
			", celular=".$this->celular.
			"]";
	}

	function toJSON(): array{
		return [
			"idProfesorEmergencia" => $this->getIdProfesorEmergencia(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
			"nombre" => $this->getNombre(),
			"parentesco" => $this->getParentesco(),
			"celular" => $this->getCelular(),
		];
	}
}
?>