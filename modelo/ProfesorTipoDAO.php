<?php

class ProfesorTipoDAO {
    private $conexion;

    public function __construct($conexion) {
        $this->conexion = $conexion;
    }

    /**
     * @return ProfesorTipoVO[]
     */
    public function obtenerTodos() {
        $lista = array();
        $sql = "SELECT idProfesorTipo, nombre FROM dbappcb.profesortipo ORDER BY idProfesorTipo";
        $stmt = $this->conexion->query($sql);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $profesorTipo = new ProfesorTipoVO($row['idProfesorTipo'], $row['nombre']);
            array_push($lista, $profesorTipo->toJSON());
        }
        return $lista;
    }
}
