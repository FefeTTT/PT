<?php
require_once __DIR__ . '/ProfesorVO.php';

class GrupoTematicoVO{
	private $idGrupoTematico;
	private $nombreGrupo;
	private $puesto;
	private $profesor; // ProfesorVO (optional)

	function __construct($idGrupoTematico, $nombreGrupo, $puesto = null, ProfesorVO $profesor = null){
		$this->idGrupoTematico = $idGrupoTematico;
		$this->nombreGrupo = $nombreGrupo;
		$this->puesto = $puesto;
		$this->profesor = $profesor;
	}

	function __destruct(){ }

	function setNombreGrupo($v){ $this->nombreGrupo = $v; }
	function setPuesto($v){ $this->puesto = $v; }
	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }

	function getIdGrupoTematico(){ return $this->idGrupoTematico; }
	function getNombreGrupo(){ return $this->nombreGrupo; }
	function getPuesto(){ return $this->puesto; }
	function getProfesor(){ return $this->profesor; }

	function toString(): string{
		return "[GrupoTematico: id=".$this->idGrupoTematico.
			", nombreGrupo=".$this->nombreGrupo.
			", puesto=".$this->puesto.
			"]";
	}

	function toJSON(): array{
		return [
			"idGrupoTematico" => $this->getIdGrupoTematico(),
			"nombreGrupo" => $this->getNombreGrupo(),
			"puesto" => $this->getPuesto(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
		];
	}
}
?>