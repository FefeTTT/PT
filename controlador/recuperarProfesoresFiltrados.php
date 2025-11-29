<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../modelo/pdo.php';
require_once __DIR__ . '/../modelo/ProfesorVO.php';
require_once __DIR__ . '/../modelo/ProfesorDAO.php';
require_once __DIR__ . '/../modelo/ProfesordisposicionDAO.php';

try {
    $idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
    $q = isset($_POST['q']) ? trim($_POST['q']) : '';
    // now support profesorAreaTipo filter (idProfesorAreaTipo)
    $profesorAreaTipo = isset($_POST['profesorAreaTipo']) && $_POST['profesorAreaTipo'] !== '' ? (int)$_POST['profesorAreaTipo'] : null;
    $profesorTipo = isset($_POST['profesorTipo']) && $_POST['profesorTipo'] !== '' ? (int)$_POST['profesorTipo'] : null;
    $tienePref = isset($_POST['tienePreferencias']) ? $_POST['tienePreferencias'] : 'todos'; // 'si'|'no'|'todos'
    $tieneProg = isset($_POST['tieneProgramacion']) ? $_POST['tieneProgramacion'] : 'todos'; // 'si'|'no'|'todos'
    $disponibilidad = isset($_POST['disponibilidadTrimestre']) ? $_POST['disponibilidadTrimestre'] : 'todos'; // 'si'|'no'|'todos'

    $dao = new ProfesorDAO($pdo);
    $filters = [];
    if ($profesorAreaTipo) $filters['profesorAreaTipo'] = $profesorAreaTipo;
    if ($profesorTipo) $filters['profesorTipo'] = $profesorTipo;

    // buscar base usando DAO (busca por q y por filtros aplicables)
    $profes = $dao->buscarProfesores($q === '' ? null : $q, $filters);
    $ids = array_map(function($p){ return (int)$p['idProfesor']; }, $profes ?: []);

    $tienePrefSet = [];
    $tieneProgSet = [];

    if (!empty($ids) && $idTrimestre > 0) {
        // Usar el DAO para obtener que profesores tienen preferencias / programación en el trimestre
        $profIds = array_values($ids);
        $conPrefs = $dao->obtenerProfesConPreferenciasEnTrimestre($profIds, $idTrimestre);
        foreach ($conPrefs as $pid) $tienePrefSet[(int)$pid] = true;

        $conProg = $dao->obtenerProfesConProgramacionEnTrimestre($profIds, $idTrimestre);
        foreach ($conProg as $pid) $tieneProgSet[(int)$pid] = true;
        // disponibilidad/enTrimestre: consultar tabla profesordisposicion para el trimestre
        $dispoMap = []; // idProfesor => estado (0/1)
        $enSet = [];
        try{
            $pdDao = new ProfesordisposicionDAO($pdo);
            $rows = $pdDao->listarProfesoresTrimestreConEstatusPreferencias($idTrimestre);
            foreach ($rows as $r){
                $pid = isset($r['idProfesor']) ? (int)$r['idProfesor'] : (isset($r['profesor_idProfesor']) ? (int)$r['profesor_idProfesor'] : 0);
                if ($pid>0){
                    $estado = isset($r['estado']) ? (int)$r['estado'] : 0;
                    $dispoMap[$pid] = $estado;
                    if ($estado === 1) $enSet[$pid] = true;
                }
            }
        } catch (Throwable $e){
            // si falla la consulta, dejar mapas vacíos
            $dispoMap = [];
            $enSet = [];
        }
    }

    // construir salida aplicando filtros 'si'/'no' si se especificaron
    $out = [];
    foreach ($profes as $p) {
        $id = (int)$p['idProfesor'];
        $hasPref = isset($tienePrefSet[$id]);
        $hasProg = isset($tieneProgSet[$id]);

        // aplicar filtro de disponibilidad: solo incluir profesores que estén registrados en
        // profesordisposicion para el trimestre y que tengan estado 1 (si='si') o 0 (si='no').
        if ($disponibilidad === 'si'){
            if (!isset($dispoMap[$id]) || (int)$dispoMap[$id] !== 1) continue;
        }
        if ($disponibilidad === 'no'){
            if (!isset($dispoMap[$id]) || (int)$dispoMap[$id] !== 0) continue;
        }

        if ($tienePref === 'si' && !$hasPref) continue;
        if ($tienePref === 'no' && $hasPref) continue;
        if ($tieneProg === 'si' && !$hasProg) continue;
        if ($tieneProg === 'no' && $hasProg) continue;

        // anexar flags
        $p['tienePreferencias'] = $hasPref ? 1 : 0;
        $p['tieneProgramacion'] = $hasProg ? 1 : 0;
        // indicar si el profesor está marcado en profesordisposicion como disponible (estado=1)
        $p['enTrimestre'] = isset($enSet[$id]) ? 1 : 0;
        $out[] = $p;
    }

    echo json_encode([ 'ok' => true, 'profesores' => $out ]);
} catch (Throwable $e) {
    echo json_encode([ 'ok' => false, 'msg' => $e->getMessage() ]);
}
