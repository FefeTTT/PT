<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';

try{
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    // Collect optional filters from query string
    $filters = [];
    if (isset($_GET['areaAcademica']) && $_GET['areaAcademica'] !== '') $filters['areaAcademica'] = (int)$_GET['areaAcademica'];
    if (isset($_GET['grupoTematico']) && $_GET['grupoTematico'] !== '') $filters['grupoTematico'] = (int)$_GET['grupoTematico'];
    // Filtro correcto: tipo de área del profesor (tabla profesorAreaTipo) en lugar de 'area'
    if (isset($_GET['profesorAreaTipo']) && $_GET['profesorAreaTipo'] !== '') $filters['profesorAreaTipo'] = (int)$_GET['profesorAreaTipo'];
    if (isset($_GET['profesorTipo']) && $_GET['profesorTipo'] !== '') $filters['profesorTipo'] = (int)$_GET['profesorTipo'];
    if (isset($_GET['trimestre']) && $_GET['trimestre'] !== '') $filters['trimestre'] = (int)$_GET['trimestre'];
    if (isset($_GET['sort']) && $_GET['sort'] !== '') $filters['sort'] = $_GET['sort'];
    if (isset($_GET['sortDir']) && in_array(strtoupper($_GET['sortDir']), ['ASC','DESC'])) $filters['sortDir'] = strtoupper($_GET['sortDir']);
    // Accept name-based filters (to group jefe + miembros under same area/grupo name)
    if (isset($_GET['areaAcademicaName']) && $_GET['areaAcademicaName'] !== '') $filters['areaAcademicaName'] = trim($_GET['areaAcademicaName']);
    if (isset($_GET['grupoTematicoName']) && $_GET['grupoTematicoName'] !== '') $filters['grupoTematicoName'] = trim($_GET['grupoTematicoName']);

    $dao = new ProfesorDAO($pdo);
    $rows = $dao->buscarProfesores($q, $filters);

    echo json_encode(['ok' => true, 'profesores' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Exception $e){
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}

?>
