<?php
	class TrimVO{
		private $idTrim; // maps to idTrimestre
		private $nombre; // legacy/name or año
		private $fechaLim; // legacy name
		private $anio; // año (dbappcb.trimestre.año)
		private $fechaLimite; // fechaLimite (dbappcb.trimestre.fechaLimite)
		private $trimestreEstadoId;
		private $trimestreEstado; // texto del estado (ej. 'Activo')


		function __construct( $idTrim, $nombre, $fechaLim){
				$this->idTrim=$idTrim;
				$this->nombre=$nombre;
				$this->fechaLim=$fechaLim;
				// keep new-named aliases for compatibility with bdnew.sql
				$this->anio = is_numeric($nombre) ? (int)$nombre : null;
				$this->fechaLimite = $fechaLim;
		}

		function setTrimestreEstadoId($id){ $this->trimestreEstadoId = $id; }
		function setTrimestreEstado($estado){ $this->trimestreEstado = $estado; }

		function __destruct(){}

		function setIdTrim($idTrim){
			$this->idTrim=$idTrim;
		}

		function setNombre($nombre){
			$this->nombre=$nombre;
		}

		function setFechaLim($fechaLim){
			$this->fechaLim=$fechaLim;
			$this->fechaLimite = $fechaLim;
		}

		function setAnio($anio){
			$this->anio = $anio;
		}

		function setFechaLimite($fecha){
			$this->fechaLimite = $fecha;
		}

		function getIdTrim():int{
			return $this->idTrim;
		}

		function getNombre():string{
			return $this->nombre;
		}

		function getFechaLim():string{
			return $this->fechaLim;
		}

		function getAnio(): ?int{
			return $this->anio;
		}

		function getFechaLimite(): ?string{
			return $this->fechaLimite;
		}

		function toString():string{
			return "[Id trim: ".$this->getIdTrim().
				", Nombre: ".$this->getNombre().
				", Fecha limite: ".$this->getFechaLim().
				"]";
		}

		function toJSON():array{
			return [
					"idTrimestre"=>$this->getIdTrim(),
					"idTrim"=>$this->getIdTrim(),
					"nombre"=>$this->getNombre(),
					"año"=>$this->getAnio(),
					"fechaLim"=>$this->getFechaLim(),
					"fechaLimite"=>$this->getFechaLimite(),
					"trimestreestado_idTrimestreEstado"=>isset($this->trimestreEstadoId) ? $this->trimestreEstadoId : null,
					"trimestreEstado"=>isset($this->trimestreEstado) ? $this->trimestreEstado : null,
						];
		}
	}
?>
