<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $anio = isset($_POST['anio']) ? (int)$_POST['anio'] : 0;
    $idPeriodo = isset($_POST['idPeriodo']) ? (int)$_POST['idPeriodo'] : 0;
    $fechaLimite = isset($_POST['fechaLimite']) ? trim($_POST['fechaLimite']) : '';

    if ($anio <= 0) throw new Exception('Año inválido');
    if ($idPeriodo <= 0) throw new Exception('Periodo inválido');
    if ($fechaLimite === '') throw new Exception('Fecha límite requerida');

    // fechaLimite must be > today
    $today = new DateTime('today');
    $f = DateTime::createFromFormat('Y-m-d', $fechaLimite);
    if (!$f) throw new Exception('Formato de fecha inválido, use YYYY-MM-DD');
    if ($f <= $today) throw new Exception('Fecha límite debe ser posterior a hoy');

    $dao = new TrimDAO($pdo);
    // check if same periodo already exists for that year
    $existing = $dao->obtenerTrimestresPorAnio($anio);
    foreach($existing as $e){
        if ((int)$e['trimestreperiodo_idTrimestrePeriodo'] === $idPeriodo) throw new Exception('El periodo ya existe para ese año');
    }

    // aceptar estadoId opcional (viene desde el modal)
    $estadoId = isset($_POST['estadoId']) && $_POST['estadoId'] !== '' ? (int)$_POST['estadoId'] : null;

    // Iniciar transaccion para insertar trimestre y disposiciones de profesores en bloque
    try {
        $pdo->beginTransaction();
        $row = $dao->insertarTrimestre($idPeriodo, $anio, $fechaLimite, $estadoId);
        if ($row === null) throw new Exception('No se pudo insertar trimestre');

        // Insertar en profesordisposicion para todos los profesores como disponibles (estado = 1)
        $profDao = new ProfesorDAO($pdo);
        $profes = $profDao->obtenerProfesoresTodosSimple(); // devuelve array de toJSON() con idProfesor

        $dispDao = new ProfesordisposicionDAO($pdo);
        // Construir nota con datos del trimestre (periodo nombre + año + fechaLimite)
        $periodoNombre = isset($row['periodoNombre']) ? $row['periodoNombre'] : (isset($row['sigla']) ? $row['sigla'] : '');
        $nota = 'Agregado automáticamente al crear el trimestre';
        $nota .= ' - Periodo: ' . $periodoNombre . ' Año: ' . $anio . ' FechaLimite: ' . $fechaLimite;

        // Insertar masivamente
        $insertedCount = 0;
        if (!empty($profes)) {
            // algunos entries en $profes pueden ser arrays con clave idProfesor
            $insertedCount = $dispDao->insertarMasivo((int)$row['idTrimestre'], $profes, 1, $nota);
        }

        $pdo->commit();

        // Devolver info del trimestre y cuántos dispos fueron creadas (informativo)
        echo json_encode(['ok'=>true,'trimestre'=>$row,'disposiciones_agregadas'=>$insertedCount], JSON_UNESCAPED_UNICODE);
        exit;
    } catch(Exception $e) {
        try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch(Exception $__){}
        throw $e; // será atrapado por el outer catch
    }
    exit;

} catch(Exception $e){
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
