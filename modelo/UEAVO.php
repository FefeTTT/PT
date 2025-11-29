<?php
    class UEAVO{
        private $idUEA;
        private $nombreUEA;
        private $claveUEA;
        private $area;

        function __construct( $nombreUEA, $claveUEA, $area, $idUEA = null)
        {
            $this->idUEA = $idUEA;
            $this->nombreUEA = $nombreUEA;
            $this->claveUEA = $claveUEA;
            $this->area = $area;
        }

        function __destruct(){
        }

        function setNombreUEA($nombreUEA)
        {
            $this->nombreUEA = $nombreUEA;
        }

        function setClaveUEA($claveUEA)
        {
            $this->claveUEA = $claveUEA;
        }

        function setArea($area)
        {
            $this->area = $area;
        }

        function setIdUEA($idUEA){
            $this->idUEA = $idUEA;
        }

        function getNombreUEA(): string
        {
            return $this->nombreUEA;
        }

        function getClaveUEA(): int
        {
            return $this->claveUEA;
        }

        function getArea(): int
        {
            return $this->area;
        }

        function getIdUEA(): ?int
        {
            return $this->idUEA;
        }

        function toString(): string
        {
            return "[Nombre de UEA: " . $this->getNombreUEA().
                ", Clave de UEA: " . $this->getClaveUEA() .
                ", UEA: " . $this->getArea() .
                "]";
        }

        function toJSON(): array
        {
            return [
                "idUEA" => $this->getIdUEA(),
                "nUEA" => $this->getNombreUEA(),
                "cUEA" => $this->getClaveUEA(),
                "area" => $this->getArea(),
            ];
        }
    }
?>