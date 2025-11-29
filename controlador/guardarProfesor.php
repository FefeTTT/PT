<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    $numeroEconomico = isset($_POST['numeroEconomico']) ? trim($_POST['numeroEconomico']) : null;
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : null;
    $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : null;
    $correo_personal = isset($_POST['correo_personal']) ? trim($_POST['correo_personal']) : null;
    $gradoEstudios = isset($_POST['gradoEstudios']) ? trim($_POST['gradoEstudios']) : null;
    $celular = isset($_POST['celular']) ? trim($_POST['celular']) : null;
    $idProfesorTipo = isset($_POST['idProfesorTipo']) ? trim($_POST['idProfesorTipo']) : null;

    if (!$numeroEconomico || !$nombre || !$correo_uam){
        throw new Exception('Faltan campos obligatorios (numeroEconomico, nombre, correo_uam)');
    }

    // El tipo de contrato es obligatorio al crear el profesor desde el modal
    if (!$idProfesorTipo || !preg_match('/^\d+$/', (string)$idProfesorTipo)){
        throw new Exception('El campo "Tipo de contrato" es obligatorio');
    }

    // Validaciones adicionales
    if (!preg_match('/^\d+$/', $numeroEconomico)) throw new Exception('Número económico inválido');
    if (!preg_match('/@azc\.uam\.mx$/i', $correo_uam)) throw new Exception('El correo UAM debe tener dominio @azc.uam.mx');
    if ($correo_personal !== null && $correo_personal !== '' && !preg_match('/@[^@]+\.[^@]+/', $correo_personal)) throw new Exception('Correo personal inválido');
    if ($celular !== null && $celular !== '' && !preg_match('/^\d{10}$/', $celular)) throw new Exception('Celular debe tener exactamente 10 dígitos');

    $dao = new ProfesorDAO($pdo);
    // evitar duplicados por numeroEconomico usando el DAO
    // Treat numeroEconomico == 0 as an exception (allow multiple zeros)
    if ((int)$numeroEconomico !== 0) {
        $existing = $dao->obtenerProfesorPorNumeroEconomico((int)$numeroEconomico);
        if ($existing) {
            throw new Exception('Ya existe un profesor con ese número económico');
        }
    }

    // evitar duplicados por nombre usando el DAO
    try {
        $existingByName = $dao->obtenerProfesorPorNombre($nombre);
        if ($existingByName) {
            throw new Exception('Ya existe un profesor con ese nombre');
        }
    } catch (Exception $e) {
        // If obtenerProfesorPorNombre throws because multiple rows exist, treat as conflict
        if (strpos($e->getMessage(), 'Se encontraron múltiples profesores') !== false) {
            throw new Exception('Existe al menos un profesor con ese nombre (nombre no único)');
        }
        throw $e;
    }
    // evitar duplicados por correo UAM
    $correo_uam_l = strtolower($correo_uam);
    $existingCorreo = $dao->obtenerProfesorPorCorreoUAM($correo_uam_l);
    if ($existingCorreo) {
        throw new Exception('Ya existe un profesor con ese correo UAM');
    }

    // crear VO y delegar inserción al DAO dentro de una transacción para
    // insertar también la fila en profesorcontrato de forma atómica.
    $celularVal = ($celular !== null && $celular !== '') ? (int)$celular : null;
    $vo = new ProfesorVO(null, (int)$numeroEconomico, $nombre, $correo_uam, $correo_personal, $gradoEstudios, $celularVal);

    try {
        $pdo->beginTransaction();
        $inserted = $dao->insertarProfesor($vo);
        if (!$inserted || !isset($inserted['idProfesor'])) throw new Exception('Error al insertar el profesor');
        $idProfesor = (int)$inserted['idProfesor'];

        // insertar contrato automáticamente
        $contrato = $dao->insertarProfesorContrato($idProfesor, (int)$idProfesorTipo, 'Generado automáticamente');
        if (!$contrato) {
            // algo falló al crear contrato -> rollback
            $pdo->rollBack();
            throw new Exception('Profesor creado pero no se pudo crear el contrato');
        }

        $pdo->commit();
        echo json_encode(['ok' => true, 'profesor' => $inserted, 'contrato' => $contrato], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
