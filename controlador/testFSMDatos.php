<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../modelo/pdo.php';

try {
    $numeroEconomico = $_GET['numeroEconomico'] ?? null;
    $idGrupo = $_GET['idUeaGrupo'] ?? null;

    if (!$numeroEconomico || !$idGrupo) {
        throw new Exception("Faltan params numeroEconomico o idUeaGrupo");
    }

    $numeroEconomico = (int)$numeroEconomico;
    $idGrupo = (int)$idGrupo;


    try {
        $stProf = $pdo->prepare("SELECT numeroEconomico, idArea FROM profesor WHERE numeroEconomico = ?");
        $stProf->execute([$numeroEconomico]);
        $profesorRow = $stProf->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $profesorRow = null;
    }

    if (!$profesorRow) {
        $stProfAlt = $pdo->prepare("SELECT p.numeroEconomico, pha.area_idArea as idArea FROM profesor p LEFT JOIN profesor_has_area pha ON p.numeroEconomico = pha.profesor_numeroEconomico WHERE p.numeroEconomico = ? LIMIT 1");
        $stProfAlt->execute([$numeroEconomico]);
        $profesorRow = $stProfAlt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$profesorRow) throw new Exception("Profesor no encontrado: " . $numeroEconomico);

    $stHorarios = $pdo->prepare("
        SELECT dt.codigo_dias as idDiasDeTrabajo, hc.horaInicio, hc.horaFin 
        FROM profesor_has_horario_contratacion phc
        JOIN horarios_contratacion hc ON hc.idHorario = phc.idHorario
        JOIN dias_de_trabajo dt ON hc.idDiasDeTrabajo = dt.idDiasDeTrabajo
        WHERE phc.numeroEconomico = ?
    ");
    $stHorarios->execute([$numeroEconomico]);
    $horariosProf = $stHorarios->fetchAll(PDO::FETCH_ASSOC);

    $profesorDTO = [
        'numeroEconomico' => (int)$profesorRow['numeroEconomico'],
        'idArea' => (int)($profesorRow['idArea'] ?? 1),
        'horariosContratacion' => $horariosProf
    ];

    // 2. Grupo
    $stGrupo = $pdo->prepare("
        SELECT ug.id as idUeaGrupo, g.id as idGrupo, g.nombre as claveGrupo, u.areaId as area_idArea, u.clave as claveUEA 
        FROM uea_grupo ug 
        JOIN grupo g ON ug.idGrupo = g.id
        JOIN uea u ON ug.uea_clave = u.clave 
        WHERE ug.id = ?
    ");
    $stGrupo->execute([$idGrupo]);
    $grupoRow = $stGrupo->fetch(PDO::FETCH_ASSOC);

    if (!$grupoRow) throw new Exception("Grupo no encontrado: " . $idGrupo);

    $stHorariosGrupo = $pdo->prepare("
        SELECT h.dia_semana as dia, h.hora_inicio, h.hora_fin 
        FROM horario_grupo_uea h
        WHERE h.id_uea_grupo = ?
    ");
    $stHorariosGrupo->execute([$idGrupo]);
    $horariosGrupoRows = $stHorariosGrupo->fetchAll(PDO::FETCH_ASSOC);

    $horariosGrupo = [];
    foreach($horariosGrupoRows as $hg) {
        $diaInt = (int)$hg['dia'];

        $iParts = explode(':', $hg['hora_inicio']);
        $fParts = explode(':', $hg['hora_fin']);
        
        $hInit = (float)$iParts[0] + ((float)$iParts[1] / 60);
        $hFin = (float)$fParts[0] + ((float)$fParts[1] / 60);

        $horariosGrupo[] = [
            'dia' => $diaInt,
            'horaInicio' => $hInit,
            'horaFin' => $hFin
        ];
    }

    $grupoDTO = [
        'idUeaGrupo' => (int)$grupoRow['idUeaGrupo'],
        'idGrupo' => (int)$grupoRow['idGrupo'],
        'claveGrupo' => $grupoRow['claveGrupo'],
        'idArea' => (int)$grupoRow['area_idArea'],
        'ueaClave' => (int)$grupoRow['claveUEA'],
        'horarios' => $horariosGrupo
    ];

    echo json_encode([
        'ok' => true,
        'profesor' => $profesorDTO,
        'grupo' => $grupoDTO
    ]);

} catch (Exception $e) {
    echo json_encode(['ok'=>false, 'error'=>$e->getMessage()]);
}
