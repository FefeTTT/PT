<?php
require_once __DIR__ . '/ProfesorVO.php';

class PrestamoVO{
	private $idPrestamo;
	private $profesor; // ProfesorVO
	private $horaInicio;
	private $horaFin;
	private $dia;
	private $detalle;

	function __construct($idPrestamo, ProfesorVO $profesor = null, $horaInicio = null, $horaFin = null, $dia = null, $detalle = null){
		$this->idPrestamo = $idPrestamo;
		$this->profesor = $profesor;
		$this->horaInicio = $horaInicio;
		$this->horaFin = $horaFin;
		$this->dia = $dia;
		$this->detalle = $detalle;
	}

	function __destruct(){ }

	function setProfesor(ProfesorVO $p = null){ $this->profesor = $p; }
	function setHoraInicio($v){ $this->horaInicio = $v; }
	function setHoraFin($v){ $this->horaFin = $v; }
	function setDia($v){ $this->dia = $v; }
	function setDetalle($v){ $this->detalle = $v; }

	function getIdPrestamo(){ return $this->idPrestamo; }
	function getProfesor(){ return $this->profesor; }
	function getHoraInicio(){ return $this->horaInicio; }
	function getHoraFin(){ return $this->horaFin; }
	function getDia(){ return $this->dia; }
	function getDetalle(){ return $this->detalle; }

	function toString(): string{
		return "[Prestamo: id=".$this->idPrestamo.
			", horaInicio=".$this->horaInicio.
			", horaFin=".$this->horaFin.
			", dia=".$this->dia.
			", detalle=".$this->detalle.
			"]";
	}

	function toJSON(): array{
		return [
			"idPrestamo" => $this->getIdPrestamo(),
			"profesor" => $this->profesor ? $this->profesor->toJSON() : null,
			"horaInicio" => $this->getHoraInicio(),
			"horaFin" => $this->getHoraFin(),
			"dia" => $this->getDia(),
			"detalle" => $this->getDetalle(),
		];
	}
}
?>