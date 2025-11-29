<?php
	class PreferenciasProfesorVO{
		private $profesor;
    	private $noGrupos;
		private $observaciones;

		function __construct( $profesor, $noGrupos, $observaciones){
				$this->profesor= new ProfesorVO($profesor->getIdProfesor(),
                    $profesor->getNumeroEconomico(),
                    $profesor->getNombre(),
                    $profesor->getCorreoUAM(),
                    $profesor->getCorreoP());
				$this->noGrupos= $noGrupos;
				$this->observaciones= $observaciones;
		}

		function __destruct(){}

		function setProfesor($profesor){
			$this->profesor= $profesor;
		}

		function setNoGrupos($noGrupos){
			$this->noGrupos= $noGrupos;
		}

		function setObservaciones($observaciones){
			$this->observaciones= $observaciones;
		}

		function getProfesor():ProfesorVO{
			return $this->profesor;
		}

		function getNoGrupos():int{
			return $this->noGrupos;
		}

		function getObservaciones():string{
			return $this->observaciones;
		}

		function toString():string{
			return "[Profesor: ".$this->getProfesor()->toString().
				", Numero de grupos: ".$this->getNoGrupos().
				", Observaciones: ".$this->getObservaciones().
				"]";
		}

		function toJSON():array{
			return [
                "profesor"=>$this->getProfesor()->toJSON(),
                "noGrupos"=>$this->getNoGrupos(),
                "observaciones"=>$this->getObservaciones(),
            ];
		}
	}
?>