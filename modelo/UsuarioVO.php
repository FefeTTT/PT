<?php
class UsuarioVO {
    private $idUsuario;
    private $usuario;
    private $contraseña;
    private $intento;

    function __construct($usuario, $contraseña, $intento, $idUsuario = null) {
        $this->idUsuario = $idUsuario;
        $this->usuario = $usuario;
        $this->contraseña = $contraseña;
        $this->intento = $intento;
    }

    function __destruct() {}

    function setIdUsuario($idUsuario) {
        $this->idUsuario = $idUsuario;
    }
    function setUsuario($usuario) {
        $this->usuario = $usuario;
    }
    function setContraseña($contraseña) {
        $this->contraseña = $contraseña;
    }
    function setIntento($intento) {
        $this->intento = $intento;
    }

    function getIdUsuario(): ?int {
        return $this->idUsuario;
    }
    function getUsuario(): string {
        return $this->usuario;
    }
    function getContraseña(): string {
        return $this->contraseña;
    }
    function getIntento(): int {
        return $this->intento;
    }

    function toString(): string {
        return "[Id usuario: " . $this->getIdUsuario() .
            ", Usuario: " . $this->getUsuario() .
            ", Contraseña: " . $this->getContraseña() .
            ", Intento: " . $this->getIntento() .
            "]";
    }

    function toJSON(): array {
        return [
            "idUsuario" => $this->getIdUsuario(),
            "usuario" => $this->getUsuario(),
            "contraseña" => $this->getContraseña(),
            "intento" => $this->getIntento()
        ];
    }
}
?>
