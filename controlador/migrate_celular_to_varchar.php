<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
try{
    // Caution: this alters table columns. Run once.
    $pdo->beginTransaction();
    $pdo->exec("ALTER TABLE profesor MODIFY celular VARCHAR(15) NULL");
    $pdo->exec("ALTER TABLE profesoremergencia MODIFY celular VARCHAR(15) NULL");
    $pdo->commit();
    echo json_encode(['ok' => true, 'message' => 'Columnas modificadas a VARCHAR(15)'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
