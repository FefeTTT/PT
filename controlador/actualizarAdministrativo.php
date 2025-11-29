<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/AdministrativoVO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/AdministrativoDAO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    // Expect POST
    $id = isset($_POST['idAdministrativo']) ? (int)$_POST['idAdministrativo'] : 0;
    if ($id <= 0) throw new Exception('Id de administrativo faltante o inválido');

    $numeroEconomico = isset($_POST['numeroEconomico']) ? trim($_POST['numeroEconomico']) : '';
    $nombre = isset($_POST['nombre']) ? trim($_POST['nombre']) : '';
    $correo_uam = isset($_POST['correo_uam']) ? trim($_POST['correo_uam']) : '';
    $correo_personal = isset($_POST['correo_personal']) ? trim($_POST['correo_personal']) : null;
    $gradoEstudios = isset($_POST['gradoEstudios']) ? trim($_POST['gradoEstudios']) : null;
    $celular = isset($_POST['celular']) ? trim($_POST['celular']) : null;
    $lugar = isset($_POST['lugar']) ? trim($_POST['lugar']) : null;
    $extension = isset($_POST['extension']) ? trim($_POST['extension']) : null;
    $idAdministrativoTipo = isset($_POST['idAdministrativoTipo']) ? (int)$_POST['idAdministrativoTipo'] : 0;

    // basic validations
    if ($numeroEconomico === '' || !preg_match('/^\d+$/', $numeroEconomico)) throw new Exception('Número económico inválido');
    if ($nombre === '') throw new Exception('Nombre es obligatorio');
    // Use preg_match for compatibility with PHP versions that don't have str_ends_with
    if ($correo_uam === '' || !preg_match('/@azc\.uam\.mx$/i', $correo_uam)) throw new Exception('Correo UAM inválido');
    if ($correo_personal !== null && $correo_personal !== '' && !filter_var($correo_personal, FILTER_VALIDATE_EMAIL)) throw new Exception('Correo personal inválido');
    if ($celular !== null && $celular !== '' && !preg_match('/^\d{10}$/', $celular)) throw new Exception('Celular inválido');
    if ($idAdministrativoTipo <= 0) throw new Exception('Tipo administrativo inválido');

    // Cross-table duplicate checks
    $profDao = new ProfesorDAO($pdo);
    // numeroEconomico in profesor?
    $profByNo = $profDao->obtenerProfesorPorNumeroEconomico((int)$numeroEconomico);
    if ($profByNo) throw new Exception('Ya existe un profesor con ese número económico');
    // correo UAM in profesor?
    $profByCorreo = $profDao->obtenerProfesorPorCorreoUAM($correo_uam);
    if ($profByCorreo) throw new Exception('Ya existe un profesor con ese correo UAM');
    if ($correo_personal){
        $profByCorreoP = $profDao->obtenerProfesorPorCorreoPersonal($correo_personal);
        if ($profByCorreoP) throw new Exception('Ya existe un profesor con ese correo personal');
    }

    // nombre en profesor (manejar multiples)
    try{
        $profByName = $profDao->obtenerProfesorPorNombre($nombre);
        if ($profByName) throw new Exception('Ya existe un profesor con ese nombre');
    } catch (Exception $e){
        if (strpos($e->getMessage(), 'múltiples profesores') !== false) throw new Exception('Existe al menos un profesor con ese nombre');
    }

    // Intra-table duplicates: ensure not colliding with other administrativos
    $admDao = new AdministrativoDAO($pdo);
    $existingNo = $admDao->obtenerAdministrativoPorNumeroEconomico((int)$numeroEconomico);
    if ($existingNo && (int)$existingNo['idAdministrativo'] !== $id) throw new Exception('Otro administrativo ya usa ese número económico');
    $existingCorreo = $admDao->obtenerAdministrativoPorCorreoUAM($correo_uam);
    if ($existingCorreo && (int)$existingCorreo['idAdministrativo'] !== $id) throw new Exception('Otro administrativo ya usa ese correo UAM');
    if ($correo_personal){
        $existingCorreoP = $admDao->obtenerAdministrativoPorCorreoPersonal($correo_personal);
        if ($existingCorreoP && (int)$existingCorreoP['idAdministrativo'] !== $id) throw new Exception('Otro administrativo ya usa ese correo personal');
    }

    // nombre en administrativos (asegurar no colisionar con otro registro)
    try{
        $existingByName = $admDao->obtenerAdministrativoPorNombre($nombre);
        if ($existingByName && (int)$existingByName['idAdministrativo'] !== $id) throw new Exception('Otro administrativo ya usa ese nombre');
    } catch (Exception $e){
        if (strpos($e->getMessage(), 'múltiples administrativos') !== false) throw new Exception('Existe al menos un administrativo con ese nombre');
    }

    // Build VO and update
    $vo = new AdministrativoVO($id, (int)$numeroEconomico, $nombre, $correo_uam, $correo_personal, $gradoEstudios, $celular, $lugar, $extension);
    $updated = $admDao->actualizarAdministrativo($id, $vo, $idAdministrativoTipo);
    if (!$updated) throw new Exception('Error actualizando administrativo');

    echo json_encode(['ok' => true, 'administrativo' => $updated], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
