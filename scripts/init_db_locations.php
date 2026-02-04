<?php
require_once __DIR__ . '/../modelo/pdo.php';

try {
    $sql = file_get_contents(__DIR__ . '/../bd/edificios.sql');
    $pdo->exec($sql);
    echo "Tables created successfully.\n";
    
    // Check if profesor_has_lugar exists, if not create it (guessing schema from DAO)
    $check = $pdo->query("SHOW TABLES LIKE 'profesor_has_lugar'");
    if($check->rowCount() == 0){
        echo "Creating profesor_has_lugar...\n";
        $sql2 = "CREATE TABLE IF NOT EXISTS profesor_has_lugar (
            profesor_numeroEconomico INT NOT NULL,
            lugar_idLugar INT NOT NULL,
            PRIMARY KEY (profesor_numeroEconomico, lugar_idLugar),
            FOREIGN KEY (lugar_idLugar) REFERENCES lugar(idLugar) ON DELETE CASCADE
            -- Assuming profesor table exists and PK is numeroEconomico, but foreign key might fail if table name differs
        );";
        // We'll try to execute it, if it fails due to FK, we'll strip FK to profesor.
        try {
            $pdo->exec($sql2);
             echo "profesor_has_lugar created.\n";
        } catch(Exception $e) {
             echo "Failed to create profesor_has_lugar with FK: " . $e->getMessage() . "\n";
             // Fallback without FK to profesor
             $sql3 = "CREATE TABLE IF NOT EXISTS profesor_has_lugar (
                profesor_numeroEconomico INT NOT NULL,
                lugar_idLugar INT NOT NULL,
                PRIMARY KEY (profesor_numeroEconomico, lugar_idLugar)
            );";
            $pdo->exec($sql3);
            echo "profesor_has_lugar created (no FK to profesor).\n";
        }
    } else {
        echo "profesor_has_lugar already exists.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
