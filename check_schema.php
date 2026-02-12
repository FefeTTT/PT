<?php
include_once "modelo/pdo.php";

try {
    $stmt = $pdo->query("DESCRIBE uea");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo $col['Field'] . "\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
