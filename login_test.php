<?php
// Mock POST request for CLI
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST['usuario'] = 'test_user';
$_POST['pwd'] = 'test_pass';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

// Output buffering to capture JSON
ob_start();
chdir('controlador');
include 'validarlogin.php';
$output = ob_get_clean();


echo "Output length: " . strlen($output) . "\n";
echo "Output content: " . $output . "\n";
?>
