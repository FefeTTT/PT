<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../modelo/pdo.php';

try {
    $claveArea = $_GET['claveArea'] ?? null;

    if (!$claveArea) {
        throw new Exception("Falta el parámetro claveArea");
    }

    $claveArea = (int)$claveArea;
    $areasValidas = [1100, 1111, 1112, 1113];

    if (!in_array($claveArea, $areasValidas, true)) {
        throw new Exception("Clave de área inválida: $claveArea. Válidas: " . implode(', ', $areasValidas));
    }

    $stProfs = $pdo->prepare("
        SELECT p.numeroEconomico, p.idArea, p.nombre as nombreProfesor
        FROM profesor p
        WHERE p.idArea = ?
    ");
    $stProfs->execute([$claveArea]);
    $profesoresRows = $stProfs->fetchAll(PDO::FETCH_ASSOC);

    $profesores = [];
    foreach ($profesoresRows as $profRow) {
        $numEco = (int)$profRow['numeroEconomico'];

        $stHorarios = $pdo->prepare("
            SELECT dt.codigo_dias as idDiasDeTrabajo, hc.horaInicio, hc.horaFin
            FROM profesor_has_horario_contratacion phc
            JOIN horarios_contratacion hc ON hc.idHorario = phc.idHorario
            JOIN dias_de_trabajo dt ON hc.idDiasDeTrabajo = dt.idDiasDeTrabajo
            WHERE phc.numeroEconomico = ?
        ");
        $stHorarios->execute([$numEco]);
        $horariosProf = $stHorarios->fetchAll(PDO::FETCH_ASSOC);

        $profesores[] = [
            'numeroEconomico' => $numEco,
            'idArea' => (int)$profRow['idArea'],
            'nombre' => $profRow['nombreProfesor'],
            'horariosContratacion' => $horariosProf
        ];
    }

    $stGrupos = $pdo->prepare("
        SELECT ug.id as idUeaGrupo, g.id as idGrupo, g.nombre as claveGrupo,
               u.clave as claveUEA, u.areaId as idArea, u.nombre as nombreUEA
        FROM uea_grupo ug
        JOIN grupo g ON ug.idGrupo = g.id
        JOIN uea u ON ug.uea_clave = u.clave
        WHERE u.areaId = ?
    ");
    $stGrupos->execute([$claveArea]);
    $gruposRows = $stGrupos->fetchAll(PDO::FETCH_ASSOC);

    $grupos = [];
    $candidatos = [];

    foreach ($gruposRows as $grupoRow) {
        $idUeaGrupo = (int)$grupoRow['idUeaGrupo'];

        $stHorariosGrupo = $pdo->prepare("
            SELECT h.dia_semana as dia, h.hora_inicio, h.hora_fin
            FROM horario_grupo_uea h
            WHERE h.id_uea_grupo = ?
        ");
        $stHorariosGrupo->execute([$idUeaGrupo]);
        $horariosGrupoRows = $stHorariosGrupo->fetchAll(PDO::FETCH_ASSOC);

        $horariosGrupo = [];
        $primeraInicio = null;
        $primeraFin = null;

        foreach ($horariosGrupoRows as $hg) {
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

            if ($primeraInicio === null) {
                $primeraInicio = $hInit;
                $primeraFin = $hFin;
            }
        }

        $grupoDTO = [
            'idUeaGrupo' => $idUeaGrupo,
            'idGrupo' => (int)$grupoRow['idGrupo'],
            'claveGrupo' => $grupoRow['claveGrupo'],
            'idArea' => (int)$grupoRow['idArea'],
            'ueaClave' => (int)$grupoRow['claveUEA'],
            'nombreUEA' => $grupoRow['nombreUEA'],
            'horarios' => $horariosGrupo
        ];
        $grupos[] = $grupoDTO;


        foreach ($profesores as $prof) {// producto cartesiano
            $candidatos[] = [
                'eco' => $prof['numeroEconomico'],
                'uea' => (int)$grupoRow['claveUEA'],
                'clave_grupo' => [
                    'idUeaGrupo' => $idUeaGrupo,
                    'claveGrupo' => $grupoRow['claveGrupo'],
                    'inicio' => $primeraInicio,
                    'fin' => $primeraFin
                ]
            ];
        }
    }

    echo json_encode([
        'ok' => true,
        'claveArea' => $claveArea,
        'totalProfesores' => count($profesores),
        'totalGrupos' => count($grupos),
        'totalCandidatos' => count($candidatos),
        'profesores' => $profesores,
        'grupos' => $grupos,
        'candidatos' => $candidatos
    ]);

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
