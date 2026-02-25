<?php
include_once "../modelo/pdo.php";
include_once "../modelo/GrupoDAO.php";

header('Content-Type: application/json');

$response = ['isItOk' => false, 'error' => null, 'procesados' => 0, 'insertados' => 0, 'omitidos' => 0];

try {
    $data = file_get_contents("php://input");
    if (!$data) throw new Exception("No se pudieron cargar los datos.");
    
    $jsonData = json_decode($data, true);
    if (!is_array($jsonData)) throw new Exception("Formato de archivo JSON inválido.");
    
    global $pdo;
    $dao = new GrupoDAO($pdo);
    
    foreach ($jsonData as $nombre) {
        $response['procesados']++;
        if (!is_string($nombre) || trim($nombre) === '') continue;
        
        $nombreTrimmed = trim($nombre);
        
        if ($dao->existeNombreGrupo($nombreTrimmed)) {
            $response['omitidos']++;
        } else {
            $id = $dao->insertarNombreGrupo($nombreTrimmed);
            if ($id !== null) {
                $response['insertados']++;
            } else {
                throw new Exception("Error al insertar el nombre del grupo: $nombreTrimmed");
            }
        }
    }
    
    $response['isItOk'] = true;
    echo json_encode($response);
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    echo json_encode($response);
}
?>
