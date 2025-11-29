<?php
    class ProgramacionProfesorVO{
        private $profesor;
        private $grupo;

        function __construct($profesor, $grupo)
        {
            $this->profesor = new ProfesorVO(
                $profesor->getIdProfesor(),
                $profesor->getNoEconomico(),
                $profesor->getNombre(),
                $profesor->getCorreoUAM(),
                $profesor->getCorreoP()
            );
            $this->grupo= new GrupoVO(
                $grupo->getIdGrupo(),
                $grupo->getClaveGrupo(),
                $grupo->getCupo(),
                $grupo->getUEA(),
                $grupo->getHorario()
            );
        }

        function __destruct()
        {
        }

        function setProfesor($profesor)
        {
            $this->profesor = $profesor;
        }

        function setGrupo($grupo)
        {
            $this->grupo = $grupo;
        }

        function getProfesor(): ProfesorVO
        {
            return $this->profesor;
        }

        function getGrupo(): GrupoVO
        {
            return $this->grupo;
        }

        function toString(): string
        {
            return "[Profesor: " . $this->getProfesor()->toString() .
                ", Grupo: " . $this->getGrupo()->toString() .
                "]";
        }

        function toJSON(): array
        {
            return [
                "profesor" => $this->getProfesor()->toJSON(),
                "grupos" => $this->getGrupo()->toJSON(),
            ];
        }
    }
?>