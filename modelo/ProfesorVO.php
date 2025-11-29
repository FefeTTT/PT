<?php
	class ProfesorVO{
		private $idProfesor;
		private $numeroEconomico;
		private $nombre;
		private $gradoEstudios;
		private $celular;
		private $correo_uam;
		private $correo_personal;
		private $disponibilidad;

		function __construct($idProfesor, $numeroEconomico, $nombre, $correo_uam,
					$correo_personal = null, $gradoEstudios = null, $celular = null, $disponibilidad = null){
					$this->idProfesor=$idProfesor;
					$this->numeroEconomico=$numeroEconomico;
					$this->nombre=$nombre;
					$this->correo_uam=$correo_uam;
					$this->correo_personal=$correo_personal;
					$this->gradoEstudios = $gradoEstudios;
					// Keep celular as string (may contain leading zeros or exceed 32-bit int)
					$this->celular = $celular;
						$this->disponibilidad = $disponibilidad;
		}

		function __destruct(){}

		function setNumeroEconomico($numeroEconomico){
				$this->numeroEconomico=$numeroEconomico;
		}

		function setNombre($nombre){
			$this->nombre=$nombre;
		}

		function setCorreoUAM($correo_uam){
			$this->correo_uam=$correo_uam;
		}

		function setCorreoP($correo_personal){
			$this->correo_personal=$correo_personal;
		}

		function setGradoEstudios($gradoEstudios){
			$this->gradoEstudios = $gradoEstudios;
		}

		function setCelular($celular){
			// store as string to avoid integer overflow on 32-bit PHP builds
			$this->celular = $celular;
		}

		function setDisponibilidad($disponibilidad){
			$this->disponibilidad = $disponibilidad;
		}

		function getIdProfesor():int{
			return $this->idProfesor;
		}

		function getNumeroEconomico():int{
			return $this->numeroEconomico;
		}

		function getNombre():string{
			return $this->nombre;
		}

		function getCorreoUAM(): ?string{
			return $this->correo_uam;
		}

		function getCorreoP(): ?string{
			return $this->correo_personal;
		}

		function getGradoEstudios(): ?string{
			return $this->gradoEstudios;
		}

		// Return celular as string (nullable). Phone numbers shouldn't be treated as integers.
		function getCelular(): ?string{
			return $this->celular;
		}

		function getDisponibilidad(){
			return $this->disponibilidad;
		}

		function toString():string{
			return "[Id profesor: ".$this->getIdProfesor().
				", Numero economico: ".$this->getNumeroEconomico().
				", Nombre: ".$this->getNombre().
				", Correo UAM: ".$this->getCorreoUAM().
				", Correo personal: ".$this->getCorreoP().
				", Grado estudios: ".$this->getGradoEstudios().
				", Celular: ".$this->getCelular().
				", Disponibilidad: ".$this->getDisponibilidad().
			"]";
		}

		function toJSON():array{
			return [
					"idProfesor"=>$this->getIdProfesor(),
					"numeroEconomico"=>$this->getNumeroEconomico(),
					"nombre"=>$this->getNombre(),
					"gradoEstudios"=>$this->getGradoEstudios(),
					"celular"=>$this->getCelular(),
					"disponibilidad"=>$this->getDisponibilidad(),
					"correo_uam"=>$this->getCorreoUAM(),
					"correo_personal"=>$this->getCorreoP(),
				];
		}
	}
?>
