<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido');
    $id = isset($_POST['idProfesor']) ? (int)$_POST['idProfesor'] : 0;
    $numeroEconomico = isset($_POST['numeroEconomico']) ? trim($_POST['numeroEconomico']) : null;
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : null;
    $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : null;
    $correo_personal = isset($_POST['correo_personal']) ? trim($_POST['correo_personal']) : null;
    $gradoEstudios = isset($_POST['gradoEstudios']) ? trim($_POST['gradoEstudios']) : null;
    $celular = isset($_POST['celular']) ? trim($_POST['celular']) : null;

    if ($id <= 0) throw new Exception('idProfesor inválido');
    if (!$numeroEconomico || !$nombre || !$correo_uam) throw new Exception('Faltan campos obligatorios');
    // Validaciones adicionales
    // numeroEconomico numeric
    if (!preg_match('/^\d+$/', $numeroEconomico)) throw new Exception('Número económico inválido');
    // correo_uam debe terminar en @azc.uam.mx
    if (!preg_match('/@azc\.uam\.mx$/i', $correo_uam)) throw new Exception('El correo UAM debe tener dominio @azc.uam.mx');
    // correo_personal si viene debe contener un @ y un dominio (ej. dominio.tld)
    if ($correo_personal !== null && $correo_personal !== '' && !preg_match('/@[^@]+\.[^@]+/', $correo_personal)) throw new Exception('Correo personal inválido');
    // celular validation: if provided must be 10 digits
    if ($celular !== null && $celular !== ''){
        if (!preg_match('/^\d{10}$/', $celular)) throw new Exception('Celular debe tener exactamente 10 dígitos');
        // Keep as string to preserve leading zeros and avoid integer overflow
        $celular = trim($celular);
    } else {
        $celular = null;
    }

    $dao = new ProfesorDAO($pdo);
    // Remove old ID from constructor. Constructor expects: numEco, name, emailU, emailP, degree, cell
    $vo = new ProfesorVO((int)$numeroEconomico, $nombre, $correo_uam, $correo_personal, $gradoEstudios, $celular);
    
    // Pass $id (original ID) as second argument to support PK update if needed
    $updated = $dao->actualizarProfesor($vo, $id);
    if (!$updated) throw new Exception('No se pudo actualizar el profesor');

    $response = ['ok' => true, 'profesor' => $updated];

    // Si se envió idProfesorTipo en el formulario, intentar crear/actualizar el contrato asociado
    $idProfesorTipo = isset($_POST['idProfesorTipo']) ? (int)$_POST['idProfesorTipo'] : 0;
    if ($idProfesorTipo > 0) {
        // Verificar si ya existe un contrato para este profesor
        $existingContrato = $dao->obtenerProfesorContratoPorProfesorId($id);
        if ($existingContrato) {
            // actualizar el contrato existente
            $idProfesorContrato = (int)$existingContrato['idProfesorContrato'];
            $descripcion = isset($_POST['descripcion']) ? trim($_POST['descripcion']) : ($existingContrato['descripcion'] ?? null);
            $contratoRow = $dao->actualizarProfesorContrato($idProfesorContrato, $id, $idProfesorTipo, $descripcion);
            if ($contratoRow === null) {
                // no fatal: devolvemos la respuesta del profesor y un warning
                $response['contrato_warning'] = 'No se pudo actualizar el contrato';
            } else {
                $response['contrato'] = $contratoRow;
            }
        } else {
            // insertar nuevo contrato (descripcion opcional)
            $descripcion = isset($_POST['descripcion']) ? trim($_POST['descripcion']) : null;
            $contratoRow = $dao->insertarProfesorContrato($id, $idProfesorTipo, $descripcion);
            if ($contratoRow === null) {
                $response['contrato_warning'] = 'No se pudo insertar el contrato';
            } else {
                $response['contrato'] = $contratoRow;
            }
        }
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>