<?php
require_once "ReactLoader.php";
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION["success"])) {
    header('Location: login.php');
    exit;
}

// Security Check
$funcion_id = isset($_SESSION['funcion_id']) ? intval($_SESSION['funcion_id']) : null;
if (!in_array($funcion_id, [1,4], true)) {
    // If included from index.php, we might be stuck? 
    // But index.php already checks this before requiring.
    if (!headers_sent()) header('Location: index.php'); 
    return;
}
?>

<!-- React Assets -->
<?php
$loader = new ReactLoader(__DIR__ . '/js/react_build/manifest.json', 'js/react_build');
echo $loader->getAssets('src/main.tsx');
?>

<script>
    // Global variables passed from PHP
    window.FUNCION_ID = <?php echo json_encode($funcion_id); ?>;
    window.USER_NAME = <?php echo json_encode($_SESSION['user_name'] ?? ''); ?>;
</script>

<!-- Main Content -->
<div class="container pb-5">
    <!-- React Mount Point -->
    <div id="root">
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-2 text-muted">Cargando aplicación...</p>
        </div>
    </div>
</div>
