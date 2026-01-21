<?php
require_once "../modelo/pdo.php";
require_once "../modelo/UsuarioDAO.php";
require_once "RateLimiter.php";
session_start();
// Prevent HTML errors from breaking JSON response
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    global $pdo;
    $usuario = $_POST['usuario'] ?? '';
    $pwd = $_POST['pwd'] ?? '';

    // Rate Limiting Check
    $limiter = new RateLimiter();
    $clientIp = $_SERVER['REMOTE_ADDR'];

    if (!$limiter->check($clientIp)) {
        http_response_code(429); // Too Many Requests
        echo json_encode([
            "success" => false,
            "msg" => "Demasiados intentos incorrectos. Por favor intente en 10 minutos."
        ], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        exit;
    }

    $usuarioDAO = new UsuarioDAO($pdo);
    $row = $usuarioDAO->obtenerUsuarioConFuncion($usuario);
    $result = ["success" => false, "funcion_id" => null, "funcion_name" => null];

    $logFailedAttempt = function($u, $p, $reason) {
        $file = __DIR__ . '/debug_login.txt';
        $content = @file_get_contents($file);
        $data = $content ? json_decode($content, true) : [];
        if (!is_array($data)) $data = [];

        $kSorteableId = date('YmdHis') . '_' . str_replace([' ', '.'], '', microtime());
        
        $data[$kSorteableId] = [
            'timestamp' => date('c'),
            'usuario' => $u,
            'pwd' => substr($p, 0, 3) . "...",
            'reason' => $reason
        ];
        
        ksort($data);
        @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    };

    if ($row && is_array($row)) {

        if (isset($row['contraseña']) && password_verify($pwd, $row['contraseña'])) {
            $result = [
                "success" => true,
                "funcion_id" => $row['funcion_idFuncion'],
                "funcion_name" => $row['funcion_name'],
                "user_name" => $usuario
            ];

            try {
                $_SESSION["success"] = "Logged in.";
                $_SESSION["funcion_id"] = $row['funcion_idFuncion'] ?? null;
                $_SESSION["funcion_name"] = $row['funcion_name'] ?? null;
                $_SESSION["user_name"] = $usuario;
            } catch (Exception $e) {
                // Log session error if needed
            }

        } else {
            // Password incorrect
            $result['msg'] = "Credenciales inválidas.";
            $logFailedAttempt($usuario, $pwd, "Contraseña inválida.");
            $limiter->recordFailure($clientIp);
        }
    } else {
        // User not found
        //$result['msg'] = "Credenciales inválidas."; // Generic message
        $logFailedAttempt($usuario, $pwd, "Usuario no encontrado.");
        $limiter->recordFailure($clientIp);
    }

    // Always output a generic failure message if not success (unless 429 above)
    if (!$result['success'] && !isset($result['msg'])) {
         $result['msg'] = "Credenciales inválidas.";
    }

    header('Content-Type: application/json');
    echo json_encode($result, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    exit;
}
