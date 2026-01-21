<?php
class FuncionVO {
    private $idFuncion;
    private $nombre;
    private $descripcion;
    // Opcional: VO de usuario asociado (puede ser null)
    private $usuarioVO;

    public function __construct($nombre, $descripcion, UsuarioVO $usuarioVO, $idFuncion = null) {
        $this->idFuncion = $idFuncion;
        $this->nombre = $nombre;
        $this->descripcion = $descripcion;
        $this->usuarioVO = $usuarioVO;
    }

    public function __destruct() {}

    // setters
    public function setIdFuncion($id) { $this->idFuncion = $id; }
    public function setNombre($n) { $this->nombre = $n; }
    public function setDescripcion($d) { $this->descripcion = $d; }

    // getters
    public function getIdFuncion(): ?int { return $this->idFuncion; }
    public function getNombre(): string { return $this->nombre; }
    public function getDescripcion(): ?string { return $this->descripcion; }
    public function getUsuarioVO(): UsuarioVO { return $this->usuarioVO; }

    public function toString(): string {
        $usuarioStr = $this->usuarioVO->toString();
        return "[idFuncion: {$this->getIdFuncion()}, nombre: {$this->getNombre()}, descripcion: {$this->getDescripcion()}, usuario: {$usuarioStr}]";
    }

    public function toJSON(): array {
        return [
            'idFuncion' => $this->getIdFuncion(),
            'nombre' => $this->getNombre(),
            'descripcion' => $this->getDescripcion(),
            'usuario' => $this->usuarioVO->toJSON()
        ];
    }
}

?>
