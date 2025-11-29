<?php
	class PreferenciasUEAVO{
		private $preferenciasProfesor;
		private $prioridad;
    	private $claveUEA;
    	private $uea;

		function __construct($preferenciasProfesor, $prioridad, $claveUEA, $uea){
				$this->preferenciasProfesor= new PreferenciasProfesorVO(
                    $preferenciasProfesor->getProfesor(),
                    $preferenciasProfesor->getNoGrupos(),
                    $preferenciasProfesor->getObservaciones()
                    );
				$this->prioridad= $prioridad;
				$this->claveUEA= $claveUEA;
				$this->uea= $uea;
		}

		function __destruct(){}

		function setPreferenciasProfesor($preferenciasProfesor){
			$this->preferenciasProfesor= $preferenciasProfesor;
		}

		function setPrioridad($prioridad){
			$this->prioridad= $prioridad;
		}

		function setClaveUEA($claveUEA){
			$this->claveUEA= $claveUEA;
		}

		function setUEA($uea){
			$this->uea= $uea;
		}

		function getPreferenciasProfesor():PreferenciasProfesorVO{
			return $this->preferenciasProfesor;
		}

		function getPrioridad():int{
			return $this->prioridad;
		}

		function getClaveUEA():int{
			return $this->claveUEA;
		}

		function getUEA():string{
			return $this->uea;
		}

		function toString():string{
			return "[Preferencias de Profesor: ".$this->getPreferenciasProfesor()->toString().
				", Prioridad: ".$this->getPrioridad().
				", Clave de UEA: ".$this->getClaveUEA().
				", UEA: ".$this->getUEA().
				"]";
		}

		function toJSON():array{
			return [
                "preferenciasP"=>$this->getPreferenciasProfesor()->toJSON(),
                "prioridad"=>$this->getPrioridad(),
                "claveUEA"=>$this->getClaveUEA(),
                "UEA"=>$this->getUEA(),
            ];
		}
	}
?>