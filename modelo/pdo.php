<?php
$host = '127.0.0.1';
$dbname = 'dbappcb';
$username = 'root'; // Standard XAMPP default
$password = '';     // Standard XAMPP default


$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    if (defined('JSON_RESPONSE') && JSON_RESPONSE === true) {
        // Return 200 so the frontend parses the JSON msg
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => false, "msg" => "Connection failed: " . $e->getMessage()]);
        exit;
    }
    die("Connection failed: " . $e->getMessage());
}
?>