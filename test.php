<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$_GET['q'] = '';
$_GET['sort'] = 'nombre';
$_GET['sortDir'] = 'ASC';

try {
    require __DIR__ . '/controlador/recuperarProfesores.php';
} catch (Throwable $t) {
    echo "Caught: " . $t->getMessage() . "\n" . $t->getTraceAsString();
}
