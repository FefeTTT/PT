<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try {
    $numeroEconomico = isset($_POST['numeroEconomico']) ? trim($_POST['numeroEconomico']) : null;
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : null;
    $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : null;

    if (!$numeroEconomico && !$nombre) {
        throw new Exception('Se requiere numeroEconomico o nombre para la comprobación');
    }

    $dao = new ProfesorDAO($pdo);
    $result = ['ok' => true, 'existsNumero' => false, 'existsNombre' => false, 'existsCorreo' => false, 'existingNumero' => null, 'existingNombre' => null, 'existingCorreo' => null];

    if ($numeroEconomico !== null && $numeroEconomico !== ''){
        if (!preg_match('/^\d+$/', $numeroEconomico)) throw new Exception('Número económico inválido');
        // Treat 0 as an exception: do not consider duplicates when numeroEconomico is 0
        if (intval($numeroEconomico) !== 0) {
            $found = $dao->obtenerProfesorPorNumeroEconomico((int)$numeroEconomico);
            if ($found){ $result['existsNumero'] = true; $result['existingNumero'] = $found; }
        }
    }

    if ($nombre !== null && $nombre !== ''){
        try {
            $foundByName = $dao->obtenerProfesorPorNombre($nombre);
            if ($foundByName){ $result['existsNombre'] = true; $result['existingNombre'] = $foundByName; }
        } catch (Exception $e) {
            // If multiple found, indicate name conflict
            if (strpos($e->getMessage(), 'Se encontraron múltiples profesores') !== false) {
                $result['existsNombre'] = true;
                $result['existingNombre'] = ['message' => 'Múltiples profesores con ese nombre'];
            } else {
                throw $e;
            }
        }
    }

    if ($correo_uam !== null && $correo_uam !== ''){
        // normalize to lower for comparison
        $correo_uam_l = strtolower($correo_uam);
        $foundCorreo = $dao->obtenerProfesorPorCorreoUAM($correo_uam_l);
        if ($foundCorreo){ $result['existsCorreo'] = true; $result['existingCorreo'] = $foundCorreo; }
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE);

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
