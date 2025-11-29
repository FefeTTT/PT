<?php
require_once "../modelo/pdo.php";
require_once "../modelo/UsuarioDAO.php";
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Debug: log received POST data
    file_put_contents(__DIR__ . '/debug_login.txt', print_r($_POST, true));

        global $pdo;
        $usuario = $_POST['usuario'] ?? '';
        $pwd = $_POST['pwd'] ?? '';

        $usuarioDAO = new UsuarioDAO($pdo);
        $row = $usuarioDAO->obtenerUsuarioConFuncion($usuario);
    $result = ["success" => false, "funcion_id" => null, "funcion_name" => null];
    if ($row !== FALSE) {
        // Obtener intentos del usuario (campo 'intento' proviene de u.*)
        $intento = isset($row['intento']) ? (int)$row['intento'] : 0;

        // Si intentos >= 3 bloquear el login
        if ($intento >= 3) {
            http_response_code(403);
            $result = [
                "success" => false,
                "funcion_id" => $row['funcion_idFuncion'] ?? null,
                "funcion_name" => $row['funcion_name'] ?? null,
                "user_name" => $usuario,
                "intento" => $intento,
                "msg" => "Cuenta bloqueada por demasiados intentos."
            ];
        } else if (password_verify($pwd, $row['contraseña'])) {
            // Credenciales correctas y no está bloqueado
            $result = [
                "success" => true,
                "funcion_id" => $row['funcion_idFuncion'],
                "funcion_name" => $row['funcion_name'],
                "user_name" => $usuario,
                "intento" => $intento
            ];

            // Setear datos de sesión para uso de la aplicación tras login exitoso
            try {
                $_SESSION["success"] = "Logged in.";
                $_SESSION["funcion_id"] = $row['funcion_idFuncion'] ?? null;
                $_SESSION["funcion_name"] = $row['funcion_name'] ?? null;
                $_SESSION["user_name"] = $usuario;
            } catch (Exception $e) {
                // No detener el flujo por errores al setear la sesión, loguear si es necesario
                file_put_contents(__DIR__ . '/debug_login.txt', "Session write error: " . $e->getMessage() . "\n", FILE_APPEND);
            }

            // Reiniciar intento a 0 mediante UsuarioDAO (evitar llamadas HTTP internas)
            try {
                $okReset = $usuarioDAO->resetIntentoPorNombre($usuario);
                if ($okReset) {
                    $result['intento'] = 0;
                }
            } catch (Exception $e) {
                // Log y continuar; no exponer al cliente
                file_put_contents(__DIR__ . '/curl_error_login.txt', date('c') . " - Exception reset intento DAO: " . $e->getMessage() . "\n", FILE_APPEND);
            }
        } else {
            // Usuario existe pero contraseña incorrecta; incrementar intento mediante el endpoint local
            $result = [
                "success" => false,
                "funcion_id" => $row['funcion_idFuncion'] ?? null,
                "funcion_name" => $row['funcion_name'] ?? null,
                "user_name" => $usuario,
                "intento" => $intento,
                "msg" => "Credenciales inválidas."
            ];

            // Incrementar intento mediante UsuarioDAO (evitar llamadas HTTP internas)
            try {
                $newIntento = $usuarioDAO->incrementarIntentoPorNombre($usuario);
                if ($newIntento !== null) {
                    $result['intento'] = $newIntento;
                    // Si alcanzó el límite, ajustar mensaje
                    if ($newIntento >= 3) {
                        http_response_code(403);
                        $result['msg'] = 'Cuenta bloqueada por demasiados intentos.';
                    }
                }
            } catch (Exception $e) {
                file_put_contents(__DIR__ . '/curl_error_login.txt', date('c') . " - Exception incrementar intento DAO: " . $e->getMessage() . "\n", FILE_APPEND);
            }
        }
    }
    // Always return JSON for cURL or browser
    header('Content-Type: application/json');
    echo json_encode($result, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    exit;
}
