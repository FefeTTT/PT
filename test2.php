<?php
try {
    require __DIR__ . '/modelo/pdo.php';
    $stmt = $pdo->query("DESCRIBE profesor");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach($columns as $col) {
        echo $col['Field'] . " - " . $col['Type'] . "\n";
    }
} catch (Throwable $t) {
    echo $t->getMessage();
}
