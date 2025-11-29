<?php
    class HorarioVO{
        private $idHorario;
        private $dia;
        private $horaI;
        private $horaF;

        function __construct($idHorario, $dia, $horaI, $horaF)
        {
            $this->idHorario = $idHorario;
            $this->dia = $dia;
            $this->horaI = $horaI;
            $this->horaF = $horaF;
        }

        function __destruct(){
        }

        function setIdHorario($idHorario){
            $this->idHorario = $idHorario;
        }
        function setDia($dia){
            $this->dia = $dia;
        }
        function setHoraInicial($horaI){
            $this->horaI = $horaI;
        }
        function setHoraFinal($horaF){
            $this->horaF = $horaF;
        }

        function getIdHorario(): int{
            return $this->idHorario;
        }
        function getDia(): string{
            return $this->dia;
        }
        function getHoraInicial(): string{
            return $this->horaI;
        }
        function getHoraFinal(): string{
            return $this->horaF;
        }

        function toString(): string
        {
            return "[ Id horario: " . $this->getIdHorario().
                ", Dia: " . $this->getDia().
                ", Hora inicial: " . $this->getHoraInicial() .
                ", Hora final: " . $this->getHoraFinal().
                "]"
            ;
        }

        function toJSON(): array
        {
            return [
                "idHora" => $this->getIdHorario(),
                "dia" => $this->getDia(),
                "horaI" => $this->getHoraInicial(),
                "horaF" => $this->getHoraFinal()
            ];
        }
    }
?>