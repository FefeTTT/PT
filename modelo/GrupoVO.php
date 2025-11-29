<?php
    class GrupoVO{
        private $idGrupo;
        private $claveGrupo;
        private $cupo;
        private $uea;
        private $horario;

        function __construct($idGrupo, $claveGrupo, $cupo, $uea, $horario)
        {
            $this->idGrupo = $idGrupo;
            $this->claveGrupo = $claveGrupo;
            $this->cupo = $cupo;
            $this->uea = new ueaVO(
                $uea->getNombreUEA(),
                $uea->getClaveUEA(),
                $uea->getArea()
            );
            $this->horario = new HorarioVO(
                $horario->getIdHorario(),
                $horario->getDia(),
                $horario->getHoraInicial(),
                $horario->getHoraFinal()
            );
        }

        function __destruct(){
        }

        function setClaveGrupo($claveGrupo)
        {
            $this->claveGrupo = $claveGrupo;
        }

        function setIdGrupo($idGrupo)
        {
            $this->idGrupo = $idGrupo;
        }

        function setCupo($cupo)
        {
            $this->cupo = $cupo;
        }

        function setUEA($uea)
        {
            $this->uea = $uea;
        }

        function setHorario($horario)
        {
            $this->horario = $horario;
        }

        function getClaveGrupo(): string
        {
            return $this->claveGrupo;
        }

        function getIdGrupo(): string
        {
            return $this->idGrupo;
        }

        function getCupo(): int
        {
            return $this->cupo;
        }

        function getUEA(): UEAVO
        {
            return $this->uea;
        
        }
        function getHorario(): HorarioVO
        {
            return $this->horario;
        }

        function toString(): string
        {
            return "[ Id Grupo: " . $this->getIdGrupo().
                "claveGrupo: " . $this->getClaveGrupo().
                ", Cupo: " . $this->getCupo().
                ", UEA: " . $this->getUEA()->toString().
                ", Horario: " . $this->getHorario()->toString().
                "]";
        }

        function toJSON(): array
        {
            return [
                "idGrupo" => $this->getIdGrupo(),
                "clGrupo" => $this->getClaveGrupo(),
                "cupo" => $this->getCupo(),
                "UEA" => $this->getUEA()->toJSON(),
                "Horario" => $this->getHorario()->toJSON()
            ];
        }
    }
?>