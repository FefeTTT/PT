<?php
require_once __DIR__ . '/ProfesorVO.php';

class ContratoVO{
	private $idProfesorContrato;
	private $profesor; // ProfesorVO
	private $profesorTipo;
	private $descripcion;

	function __construct($idProfesorContrato, ProfesorVO $profesor = null, $profesorTipo = null, $descripcion = null){
		$this->idProfesorContrato = $idProfesorContrato;
		$this->profesor = $profesor;
		$this->profesorTipo = $profesorTipo;
		$this->descripcion = $descripcion;
	}

	function __destruct(){ }

	function setIdProfesorContrato($v){ $this->idProfesorContrato = $v; }
	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }
	function setProfesorTipo($v){ $this->profesorTipo = $v; }
	function setDescripcion($v){ $this->descripcion = $v; }

	function getIdProfesorContrato(){ return $this->idProfesorContrato; }
	function getProfesor(){ return $this->profesor; }
	function getProfesorTipo(){ return $this->profesorTipo; }
	function getDescripcion(){ return $this->descripcion; }

	function toString(): string{
		return "[Contrato: id=".$this->idProfesorContrato.
			", profesorTipo=".$this->profesorTipo.
			", descripcion=".$this->descripcion.
			"]";
	}

	function toJSON(): array{
		return [
			"idProfesorContrato" => $this->getIdProfesorContrato(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
			"profesorTipo" => $this->getProfesorTipo(),
			"descripcion" => $this->getDescripcion(),
		];
	}
}
?>