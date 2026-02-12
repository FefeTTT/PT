<?php
	class ProfesorVO{

		private $numeroEconomico;
		private $nombre;
		private $gradoEstudios;
		private $celular;
		private $correo_uam;
		private $correo_personal;
		private $idArea;
		private $idGrado;

		function __construct(
			$numeroEconomico, 
			$nombre, 
			$correo_uam,
			$correo_personal = null, 
			$gradoEstudios = null, 
			$celular = null,
			$idArea = null, 
			$idGrado = null)
		{
			$this->numeroEconomico=$numeroEconomico;
			$this->nombre=$nombre;
			$this->correo_uam=$correo_uam;
			$this->correo_personal=$correo_personal;
			$this->gradoEstudios = $gradoEstudios;
			$this->celular = $celular;
			$this->idArea = $idArea;
			$this->idGrado = $idGrado;
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
			$this->celular = $celular;
		}

		function setIdArea($idArea){
			$this->idArea = $idArea;
		}

		function setIdGrado($idGrado){
			$this->idGrado = $idGrado;
		}

		function getIdProfesor():int{
			return $this->numeroEconomico;
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

		function getCelular(): ?string{
			return $this->celular;
		}

		function getIdArea(): ?int {
			return $this->idArea;
		}

		function getIdGrado(): ?int {
			return $this->idGrado;
		}

		function toString():string{
			return "[Numero economico: ".$this->getNumeroEconomico().
				", Nombre: ".$this->getNombre().
				", Correo UAM: ".$this->getCorreoUAM().
				", Correo personal: ".$this->getCorreoP().
				", Grado estudios: ".$this->getGradoEstudios().
				", Celular: ".$this->getCelular().
				", idArea: ".$this->getIdArea().
				", idGrado: ".$this->getIdGrado().
			"]";
		}

		function toJSON():array{
			return [
					"idProfesor"=>$this->getNumeroEconomico(),
					"numeroEconomico"=>$this->getNumeroEconomico(),
					"nombre"=>$this->getNombre(),
					"gradoEstudios"=>$this->getGradoEstudios(),
					"celular"=>$this->getCelular(),
					"correo_uam"=>$this->getCorreoUAM(),
					"correo_personal"=>$this->getCorreoP(),
					"idArea"=>$this->getIdArea(),
					"idGrado"=>$this->getIdGrado()
				];
		}
	}
?>
