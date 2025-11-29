<?php
require_once __DIR__ . '/ProfesorVO.php';

class LugarVO{
	private $idLugar;
	private $edificio;
	private $piso;
	private $cubiculo;
	private $nombre;
	private $notas;
	private $profesor; // ProfesorVO

	function __construct($idLugar, $edificio, $piso, $cubiculo, $nombre, $notas = null, ProfesorVO $profesor = null){
		$this->idLugar = $idLugar;
		$this->edificio = $edificio;
		$this->piso = $piso;
		$this->cubiculo = $cubiculo;
		$this->nombre = $nombre;
		$this->notas = $notas;
		$this->profesor = $profesor;
	}

	function __destruct(){ }

	function setEdificio($v){ $this->edificio = $v; }
	function setPiso($v){ $this->piso = $v; }
	function setCubiculo($v){ $this->cubiculo = $v; }
	function setNombre($v){ $this->nombre = $v; }
	function setNotas($v){ $this->notas = $v; }
	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }

	function getIdLugar(){ return $this->idLugar; }
	function getEdificio(){ return $this->edificio; }
	function getPiso(){ return $this->piso; }
	function getCubiculo(){ return $this->cubiculo; }
	function getNombre(){ return $this->nombre; }
	function getNotas(){ return $this->notas; }
	function getProfesor(){ return $this->profesor; }

	function toString(): string{
		return "[Lugar: id=".$this->idLugar.
			", edificio=".$this->edificio.
			", piso=".$this->piso.
			", cubiculo=".$this->cubiculo.
			", nombre=".$this->nombre.
			", notas=".$this->notas.
			"]";
	}

	function toJSON(): array{
		return [
			"idLugar" => $this->getIdLugar(),
			"edificio" => $this->getEdificio(),
			"piso" => $this->getPiso(),
			"cubiculo" => $this->getCubiculo(),
			"nombre" => $this->getNombre(),
			"notas" => $this->getNotas(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
		];
	}
}
?>