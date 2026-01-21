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
    $startTime = microtime(true);
    
    global $pdo;
    $usuario = $_POST['usuario'] ?? '';
    $pwd = $_POST['pwd'] ?? '';

    $limiter = new RateLimiter();
    $clientIp = $_SERVER['REMOTE_ADDR'];

    if (!$limiter->check($clientIp)) {
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "msg" => "Demasiados intentos incorrectos. Por favor intente en 10 minutos."
        ], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        exit;
    }

    $usuarioDAO = new UsuarioDAO($pdo);
    $row = $usuarioDAO->obtenerUsuarioConFuncion($usuario);
    $result = ["success" => false, "funcion_id" => null, "funcion_name" => null];

    $dummyHash = '$argon2id$v=19$m=1048576,t=3,p=1$S3lUMFhLUFdZdzNGYkVPeg$O7clIKPgdh3+WO9vxk0jQ3Df3mxpX2NJpwjLE/LZ26o';
    
    $checkPassword = false;
    $userHash = $dummyHash; 
    if ($row && is_array($row) && isset($row['contraseña'])) {
        $userHash = $row['contraseña'];
    }

    if (password_verify($pwd, $userHash)) {
        if ($row && is_array($row)) {

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
            } catch (Exception $e) { }
        } else {

             $limiter->recordFailure($clientIp);
        }
    } else {

        $limiter->recordFailure($clientIp);
        
        $reason = ($row && is_array($row)) ? "Contraseña inválida." : "Usuario no encontrado.";
        
        $file = __DIR__ . '/debug_login.txt';
        $content = @file_get_contents($file);
        $data = $content ? json_decode($content, true) : [];
        if (!is_array($data)) $data = [];

        $kSorteableId = date('YmdHis') . '_' . str_replace([' ', '.'], '', microtime());
        $data[$kSorteableId] = [
            'timestamp' => date('c'),
            'usuario' => $usuario,
            'pwd' => substr($pwd, 0, 3) . "...",
            'reason' => $reason
        ];
        ksort($data);
        @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }


    if (!$result['success']) {
        $result['msg'] = "Credenciales inválidas.";
    }

    $paddingValidationTimeSeconds = 1.5;
    $elapsed = microtime(true) - $startTime;
    $remaining = $paddingValidationTimeSeconds - $elapsed;
    if ($remaining > 0) {
        usleep((int)($remaining * 1000000));
    }

    header('Content-Type: application/json');
    echo json_encode($result, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    exit;
}
