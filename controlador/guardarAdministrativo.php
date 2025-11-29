<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoVO.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';
// Include Profesor VO/DAO to perform cross-table duplicate checks
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    $numeroEconomico = isset($_POST['numeroEconomico']) ? trim($_POST['numeroEconomico']) : null;
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : null;
    $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : null;
    $correo_personal = isset($_POST['correo_personal']) ? trim($_POST['correo_personal']) : null;
    $gradoEstudios = isset($_POST['gradoEstudios']) ? trim($_POST['gradoEstudios']) : null;
    $celular = isset($_POST['celular']) ? trim($_POST['celular']) : null;
    $lugar = isset($_POST['lugar']) ? trim($_POST['lugar']) : null;
    $extension = isset($_POST['extension']) ? trim($_POST['extension']) : null;
    $idAdministrativoTipo = isset($_POST['idAdministrativoTipo']) ? trim($_POST['idAdministrativoTipo']) : null;

    if (!$numeroEconomico || !$nombre || !$correo_uam) throw new Exception('Faltan campos obligatorios (numeroEconomico, nombre, correo_uam)');
    if (!$idAdministrativoTipo || !preg_match('/^\d+$/', (string)$idAdministrativoTipo)) throw new Exception('El campo "Tipo de contrato" es obligatorio');

    if (!preg_match('/^\d+$/', $numeroEconomico)) throw new Exception('Número económico inválido');
    if (!preg_match('/@azc\.uam\.mx$/i', $correo_uam)) throw new Exception('El correo UAM debe tener dominio @azc.uam.mx');
    if ($correo_personal !== null && $correo_personal !== '' && !preg_match('/@[^@]+\.[^@]+/', $correo_personal)) throw new Exception('Correo personal inválido');
    if ($celular !== null && $celular !== '' && !preg_match('/^\d{10}$/', $celular)) throw new Exception('Celular debe tener exactamente 10 dígitos');

    $dao = new AdministrativoDAO($pdo);
    // evitar duplicados por numeroEconomico
    if ((int)$numeroEconomico !== 0){
        $existing = $dao->obtenerAdministrativoPorNumeroEconomico((int)$numeroEconomico);
        if ($existing) throw new Exception('Ya existe un administrativo con ese número económico');
    }
    // por nombre
    try{
        $existingByName = $dao->obtenerAdministrativoPorNombre($nombre);
        if ($existingByName) throw new Exception('Ya existe un administrativo con ese nombre');
    } catch (Exception $e){
        if (strpos($e->getMessage(), 'múltiples administrativos') !== false) throw new Exception('Existe al menos un administrativo con ese nombre');
    }
    // por correo
    $correo_l = strtolower($correo_uam);
    $existingCorreo = $dao->obtenerAdministrativoPorCorreoUAM($correo_l);
    if ($existingCorreo) throw new Exception('Ya existe un administrativo con ese correo UAM');

    // --- Cross-table checks against profesor table ---
    $profDao = new ProfesorDAO($pdo);
    // numeroEconomico en profesor
    if ((int)$numeroEconomico !== 0){
        $existingProfNo = $profDao->obtenerProfesorPorNumeroEconomico((int)$numeroEconomico);
        if ($existingProfNo) throw new Exception('Ya existe un profesor con ese número económico');
    }
    // nombre en profesor (manejar multiples)
    try{
        $existingProfByName = $profDao->obtenerProfesorPorNombre($nombre);
        if ($existingProfByName) throw new Exception('Ya existe un profesor con ese nombre');
    } catch (Exception $e){
        if (strpos($e->getMessage(), 'múltiples profesores') !== false) throw new Exception('Existe al menos un profesor con ese nombre');
    }
    // correo_uam en profesor
    $existingProfCorreo = $profDao->obtenerProfesorPorCorreoUAM($correo_l);
    if ($existingProfCorreo) throw new Exception('Ya existe un profesor con ese correo UAM');

    // correo_personal (opcional): verificar tanto en tabla profesor como administrativo usando DAO
    if ($correo_personal !== null && $correo_personal !== ''){
        $existingProfCorreoP = $profDao->obtenerProfesorPorCorreoPersonal($correo_personal);
        if ($existingProfCorreoP) throw new Exception('Ya existe un profesor con ese correo personal');
        $existingAdminCorreoP = $dao->obtenerAdministrativoPorCorreoPersonal($correo_personal);
        if ($existingAdminCorreoP) throw new Exception('Ya existe un administrativo con ese correo personal');
    }

    $vo = new AdministrativoVO(null, (int)$numeroEconomico, $nombre, $correo_uam, $correo_personal, $gradoEstudios, $celular, $lugar, $extension);
    $pdo->beginTransaction();
    $inserted = $dao->insertarAdministrativo($vo, (int)$idAdministrativoTipo);
    if (!$inserted) { if ($pdo->inTransaction()) $pdo->rollBack(); throw new Exception('Error al insertar administrativo'); }
    $pdo->commit();
    echo json_encode(['ok' => true, 'administrativo' => $inserted], JSON_UNESCAPED_UNICODE);

} catch (Exception $e){
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
