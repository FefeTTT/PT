<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/TrimDAO.php';

try{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST'){
        http_response_code(405);
        echo json_encode(['ok'=>false,'msg'=>'Use POST']);
        exit;
    }
    $id = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $estadoId = isset($_POST['estadoId']) ? (int)$_POST['estadoId'] : 0;
    $estadoName = isset($_POST['estadoName']) ? trim($_POST['estadoName']) : '';
    $accion = isset($_POST['accion']) ? trim($_POST['accion']) : '';

    if ($id <= 0) throw new Exception('Id de trimestre inválido');

    $dao = new TrimDAO($pdo);

    // Resolver estado por prioridad: estadoId -> accion -> estadoName
    if ($estadoId > 0) {
        $targetEstadoId = $estadoId;
    } else {
        $targetName = '';
        if ($accion !== '') {
            // Mapear acciones conocidas a nombres de estados
            $a = strtolower($accion);
            if ($a === 'terminar' || $a === 'finalizar') $targetName = 'Terminado';
            elseif ($a === 'enproceso' || $a === 'iniciar' || $a === 'programar' || $a === 'iniciarproceso') $targetName = 'En proceso';
            elseif ($a === 'aprogramar' || $a === 'a_programar') $targetName = 'A programar';
        }
        if ($estadoName !== '') $targetName = $estadoName;

        if ($targetName === '') throw new Exception('Se requiere estadoId, estadoName o accion');

        // Buscar id por nombre (case-insensitive) con tolerancia a variantes/acentos.
        // Construir lista de nombres candidatos (incluye el nombre proporcionado y alias comunes para algunas acciones)
        $candidates = [];
        if (!empty($targetName)) $candidates[] = $targetName;
        // añadir aliases basados en la accion cuando aplique
        if (isset($a)) {
            $aa = strtolower($a);
            if ($aa === 'terminar' || $aa === 'finalizar') {
                $candidates = array_merge($candidates, ['Terminado', 'Finalizado']);
            } elseif ($aa === 'enproceso' || $aa === 'iniciar' || $aa === 'programar' || $aa === 'iniciarproceso') {
                // algunos entornos renombraron 'En proceso' a 'Programacion de horarios' (sin tilde)
                $candidates = array_merge($candidates, ['En proceso', 'Programacion de horarios', 'Programación de horarios']);
            } elseif ($aa === 'aprogramar' || $aa === 'a_programar') {
                $candidates = array_merge($candidates, ['A programar', 'A programar']);
            }
        }

        // Normalizar helper: quitar diacríticos y espacios, luego comparar en minúsculas
        function _norm($s){
            if ($s === null) return '';
            $s = (string)$s;
            // intentar iconv para transliterar
            $norm = $s;
            try { $norm = iconv('UTF-8', 'ASCII//TRANSLIT', $s); } catch(Exception $e) { $norm = $s; }
            $norm = strtolower($norm);
            // remover caracteres no alfanuméricos (conservar espacios)
            $norm = preg_replace('/[^a-z0-9\s]/i', '', $norm);
            $norm = preg_replace('/\s+/', ' ', trim($norm));
            return $norm;
        }

        // Normalizar candidatos
        $candNorm = array_map(function($c){ return _norm($c); }, $candidates);

        // Obtener todos los estados de la tabla y comparar normalizados
        $foundId = null;
        $stAll = $pdo->query("SELECT idTrimestreEstado, estado FROM trimestreestado");
        $all = $stAll->fetchAll(PDO::FETCH_ASSOC);
        foreach ($all as $rowState) {
            $rowName = isset($rowState['estado']) ? $rowState['estado'] : '';
            $rowNorm = _norm($rowName);
            // comparaciones exactas con cualquiera de los candidatos
            foreach ($candNorm as $cn) {
                if ($cn === '') continue;
                if ($rowNorm === $cn) { $foundId = (int)$rowState['idTrimestreEstado']; break 2; }
            }
        }
        if ($foundId === null) {
            // intentar coincidencia por tokens: buscar candidato cuyos tokens estén contenidos en rowNorm
            foreach ($all as $rowState) {
                $rowNorm = _norm($rowState['estado']);
                foreach ($candNorm as $cn) {
                    if ($cn === '') continue;
                    $tokens = preg_split('/\s+/', $cn);
                    $allMatch = true;
                    foreach ($tokens as $t) { if ($t === '') continue; if (strpos($rowNorm, $t) === false) { $allMatch = false; break; } }
                    if ($allMatch) { $foundId = (int)$rowState['idTrimestreEstado']; break 2; }
                }
            }
        }
        if ($foundId === null) throw new Exception('No se encontró el id de estado para "' . $targetName . '"');
        $targetEstadoId = $foundId;
    }

    $row = $dao->cambiarEstadoTrimestre($id, $targetEstadoId);
    if ($row === null) throw new Exception('No se pudo cambiar el estado del trimestre');
    echo json_encode(['ok'=>true,'trimestre'=>$row], JSON_UNESCAPED_UNICODE);
    exit;
} catch(Exception $e){
    http_response_code(400);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}

?>
