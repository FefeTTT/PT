<?php
class AdministrativoVO{
    private $idAdministrativo;
    private $numeroEconomico;
    private $nombre;
    private $gradoEstudios;
    private $celular;
    private $correo_uam;
    private $correo_personal;
    private $lugar;
    private $extension;

    public function __construct($idAdministrativo, $numeroEconomico, $nombre, $correo_uam, $correo_personal = null, $gradoEstudios = null, $celular = null, $lugar = null, $extension = null){
        $this->idAdministrativo = $idAdministrativo;
        $this->numeroEconomico = $numeroEconomico;
        $this->nombre = $nombre;
        $this->correo_uam = $correo_uam;
        $this->correo_personal = $correo_personal;
        $this->gradoEstudios = $gradoEstudios;
        $this->celular = $celular;
        $this->lugar = $lugar;
        $this->extension = $extension;
    }

    public function getIdAdministrativo(): ?int{ return $this->idAdministrativo; }
    public function getNumeroEconomico(): ?int{ return $this->numeroEconomico; }
    public function getNombre(): ?string{ return $this->nombre; }
    public function getCorreoUAM(): ?string{ return $this->correo_uam; }
    public function getCorreoP(): ?string{ return $this->correo_personal; }
    public function getGradoEstudios(): ?string{ return $this->gradoEstudios; }
    public function getCelular(): ?string{ return $this->celular; }
    public function getLugar(): ?string{ return $this->lugar; }
    public function getExtension(): ?string{
        // The extension is stored and used as a string (DB varchar).
        // Normalize empty strings to null, otherwise return trimmed string.
        if ($this->extension === null) return null;
        $ext = trim((string)$this->extension);
        if ($ext === '') return null;
        return $ext;
    }

    public function toJSON(): array{
        return [
            'idAdministrativo' => $this->getIdAdministrativo(),
            'numeroEconomico' => $this->getNumeroEconomico(),
            'nombre' => $this->getNombre(),
            'gradoEstudios' => $this->getGradoEstudios(),
            'celular' => $this->getCelular(),
            'lugar' => $this->getLugar(),
            'extension' => $this->getExtension(),
            'correo_uam' => $this->getCorreoUAM(),
            'correo_personal' => $this->getCorreoP()
        ];
    }
}

?>
