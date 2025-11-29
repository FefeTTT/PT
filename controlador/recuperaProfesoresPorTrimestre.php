<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try{
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    if ($idTrimestre <= 0) throw new Exception('idTrimestre inválido');

    $profDao = new ProfesorDAO($pdo);
    $pdDao = new ProfesordisposicionDAO($pdo);

    // Usar el DAO para obtener la lista de profesores (puede aceptar filtros, pero usamos la lista completa)
    $profes = $profDao->buscarProfesores(null, ['trimestre' => $idTrimestre]);
    $out = [];
    foreach ($profes as $p) {
        $idP = isset($p['idProfesor']) ? (int)$p['idProfesor'] : (isset($p['id']) ? (int)$p['id'] : 0);
        $disp = $pdDao->buscarPorProfesorYTrimestre($idP, $idTrimestre);
        $available = 0;
        if ($disp && isset($disp['estado'])) $available = ((int)$disp['estado']) ? 1 : 0;
        $out[] = [
            'idProfesor' => $idP,
            'economico' => $p['numeroEconomico'] ?? ($p['numeroeconomico'] ?? null),
            'nombre' => $p['nombre'] ?? $p['nombreCompleto'] ?? null,
            'tipoProfesor' => $p['tipoProfesor'] ?? $p['tipo'] ?? null,
            'disponible' => $available
        ];
    }

    echo json_encode(['ok' => true, 'profesores' => $out], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
