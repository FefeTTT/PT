<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, array $payload): void {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

require_once '../modelo/Conexion.php';

try {
    $body = getJsonBody();
    
    $listaNumerosEconomicos = $body['listaNumerosEconomicos'] ?? [];

    if (!is_array($listaNumerosEconomicos) || empty($listaNumerosEconomicos)) {
        respond(400, [
            'isItOk' => false,
            'message' => 'Se requiere una listaNumerosEconomicos válida.',
            'data' => []
        ]);
    }

    $cleanIds = array_filter(array_map('intval', $listaNumerosEconomicos), function($id) { return $id > 0; });

    if (empty($cleanIds)) {
        respond(400, [
            'isItOk' => false,
            'message' => 'La lista no contiene números económicos válidos.',
            'data' => []
        ]);
    }

    $inPlaceholders = implode(',', array_fill(0, count($cleanIds), '?'));

    $conexion = new Conexion();
    $pdo = $conexion->getConexion();

    $sqlProfesores = "
        SELECT 
            numeroEconomico, 
            idArea 
        FROM profesor 
        WHERE numeroEconomico IN ($inPlaceholders)
    ";
    
    $stmt = $pdo->prepare($sqlProfesores);
    $stmt->execute(array_values($cleanIds));
    $profesoresRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sqlHorarios = "
        SELECT 
            phc.numeroEconomico,
            dt.codigo_dias as idDiasDeTrabajo,
            hc.horaInicio,
            hc.horaFin
        FROM profesor_has_horario_contratacion phc
        INNER JOIN horarios_contratacion hc ON hc.idHorario = phc.idHorario
        INNER JOIN dias_de_trabajo dt ON dt.idDiasDeTrabajo = hc.idDiasDeTrabajo
        WHERE phc.numeroEconomico IN ($inPlaceholders)
    ";

    $stmt2 = $pdo->prepare($sqlHorarios);
    $stmt2->execute(array_values($cleanIds));
    $horariosRows = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    $horariosMapping = [];
    foreach ($horariosRows as $h) {
        $ne = (int)$h['numeroEconomico'];
        if (!isset($horariosMapping[$ne])) {
            $horariosMapping[$ne] = [];
        }
        $horariosMapping[$ne][] = [
            'idDiasDeTrabajo' => $h['idDiasDeTrabajo'],
            'horaInicio'      => $h['horaInicio'],
            'horaFin'         => $h['horaFin']
        ];
    }

    $resultData = [];
    foreach ($profesoresRows as $prof) {
        $ne = (int)$prof['numeroEconomico'];
        $resultData[] = [
            'numeroEconomico' => $ne,
            'idArea' => (int)$prof['idArea'],
            'horariosContratacion' => $horariosMapping[$ne] ?? []
        ];
    }

    respond(200, [
        'isItOk' => true,
        'message' => 'Horarios recuperados con éxito',
        'data' => $resultData
    ]);

} catch (PDOException $e) {
    respond(500, [
        'isItOk' => false,
        'message' => 'Error de base de datos',
        'error' => $e->getMessage()
    ]);
} catch (Throwable $e) {
    respond(500, [
        'isItOk' => false,
        'message' => 'Error interno del servidor',
        'error' => $e->getMessage()
    ]);
}
