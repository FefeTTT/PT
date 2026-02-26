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

try {
    $body = getJsonBody();

    if (empty($body)) {
        respond(400, [
            'isItOk' => false,
            'message' => 'Cuerpo JSON vacío o inválido.'
        ]);
    }

    $logsDir = __DIR__ . '/../frontend-react/logs';
    
    if (!is_dir($logsDir)) {
        if (!mkdir($logsDir, 0755, true)) {
            respond(500, [
                'isItOk' => false,
                'message' => 'No se pudo crear el directorio de logs.'
            ]);
        }
    }

    $timestamp = date('Ymd_His_v');
    $filename = "sin_programacion_{$timestamp}.json";
    $filepath = $logsDir . DIRECTORY_SEPARATOR . $filename;

    $jsonStr = json_encode($body, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if (file_put_contents($filepath, $jsonStr) === false) {
        respond(500, [
            'isItOk' => false,
            'message' => 'Error al escribir el archivo de log en el disco.'
        ]);
    }

    respond(200, [
        'isItOk' => true,
        'message' => "Log guardado exitosamente como {$filename}"
    ]);

} catch (Throwable $e) {
    respond(500, [
        'isItOk' => false,
        'message' => 'Error interno del servidor',
        'error' => $e->getMessage()
    ]);
}
