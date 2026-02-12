<?php
    include_once "Respuesta.php";


	class UEADAO{
		public $conexion;

		public function __construct($conexion){
			$this->conexion=$conexion;
		}

		public function __destruct(){ }

		public function ueas(): array{
			$ueas = array();
			// Adaptado a esquema dbappcb: elegir columnas y mapear area_idArea a idArea
			$sql = "SELECT idUEA, area_idArea as idArea, nombre, claveUEA FROM dbappcb.uea ORDER BY area_idArea, nombre, claveUEA";
			$result = $this->conexion->query($sql);
			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				// Construir VO con idUEA en la posición correcta (4o argumento)
				$uea = new UEAVO(
					$row['nombre'],       // nombreUEA
					$row['claveUEA'],     // claveUEA
					$row['idArea'],       // area
					isset($row['idUEA']) ? $row['idUEA'] : null // idUEA
				);
				array_push($ueas, $uea->toJSON());
			}
			return $ueas;
		}

		/**
		 * Resumen de UEAs para un trimestre: totales de grupos, programados y sin programar.
		 * Retorna arreglo: [{idUEA, claveUEA, nombre, areaNombre, totalGrupos, gruposProgramados, gruposSinProgramar}]
		 */
		public function resumenUEAsPorTrimestre(int $idTrimestre): array {
			try {
				$sql = "SELECT u.idUEA, u.claveUEA, u.nombre, a.nombre AS areaNombre,
					COUNT(g.idGrupo) AS totalGrupos,
					SUM(CASE WHEN pr.grupo_idGrupo IS NOT NULL THEN 1 ELSE 0 END) AS gruposProgramados
				FROM uea u
				LEFT JOIN area a ON a.idArea = u.area_idArea
				LEFT JOIN grupo g ON g.uea_idUEA = u.idUEA AND g.trimestre_idTrimestre = :idT
				LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = :idT
				GROUP BY u.idUEA, u.claveUEA, u.nombre, a.nombre
				ORDER BY a.nombre, u.nombre";
				$st = $this->conexion->prepare($sql);
				$st->execute([':idT' => $idTrimestre]);
				$rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
				$out = [];
				foreach ($rows as $r) {
					$total = (int)($r['totalGrupos'] ?? 0);
					$prog = (int)($r['gruposProgramados'] ?? 0);
					$out[] = [
						'idUEA' => (int)$r['idUEA'],
						'claveUEA' => $r['claveUEA'],
						'nombre' => $r['nombre'],
						'areaNombre' => $r['areaNombre'] ?? null,
						'totalGrupos' => $total,
						'gruposProgramados' => $prog,
						'gruposSinProgramar' => max(0, $total - $prog)
					];
				}
				return $out;
			} catch (Exception $e) { return []; }
		}

		/**
		 * Detalle de una UEA en un trimestre: datos base + grupos con horarios y profesor asignado + profesores que la solicitaron (por prioridad).
		 * Retorna array ['uea'=>{...}, 'grupos'=>[...], 'preferencias'=>{'0':[], '1':[], ...}]
		 */
		public function detalleUEAPorTrimestre(int $idTrimestre, int $idUEA): array {
			$out = ['uea'=>null, 'grupos'=>[], 'preferencias'=>[]];
			try {
				// UEA base con área y resumen de grupos
				$stB = $this->conexion->prepare("SELECT u.idUEA, u.claveUEA, u.nombre, a.nombre AS areaNombre,
					COUNT(g.idGrupo) AS totalGrupos,
					SUM(CASE WHEN pr.grupo_idGrupo IS NOT NULL THEN 1 ELSE 0 END) AS gruposProgramados
				FROM uea u
				LEFT JOIN area a ON a.idArea = u.area_idArea
				LEFT JOIN grupo g ON g.uea_idUEA = u.idUEA AND g.trimestre_idTrimestre = :idT
				LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = :idT
				WHERE u.idUEA = :idU GROUP BY u.idUEA, u.claveUEA, u.nombre, a.nombre LIMIT 1");
				$stB->execute([':idT'=>$idTrimestre, ':idU'=>$idUEA]);
				$b = $stB->fetch(PDO::FETCH_ASSOC);
				if ($b) {
					$total = (int)($b['totalGrupos'] ?? 0);
					$prog = (int)($b['gruposProgramados'] ?? 0);
					$out['uea'] = [
						'idUEA'=>(int)$b['idUEA'],
						'claveUEA'=>$b['claveUEA'],
						'nombre'=>$b['nombre'],
						'areaNombre'=>$b['areaNombre'] ?? null,
						'totalGrupos'=>$total,
						'gruposProgramados'=>$prog,
						'gruposSinProgramar'=>max(0,$total-$prog)
					];
				}

				// Grupos con horarios pivotados y profesor asignado
				$stG = $this->conexion->prepare("SELECT g.idGrupo, g.claveGrupo,
					GROUP_CONCAT(CASE WHEN h.dia='Lunes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS lunes,
					GROUP_CONCAT(CASE WHEN h.dia='Martes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS martes,
					GROUP_CONCAT(CASE WHEN h.dia='Miércoles' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS miercoles,
					GROUP_CONCAT(CASE WHEN h.dia='Jueves' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS jueves,
					GROUP_CONCAT(CASE WHEN h.dia='Viernes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS viernes,
					p.idProfesor, p.numeroEconomico, p.nombre AS profesor
				FROM grupo g
				LEFT JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				LEFT JOIN horario h ON h.idHorario = gh.horario_idHorario
				LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
				LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
				LEFT JOIN profesor p ON p.idProfesor = pd.profesor_idProfesor
				WHERE g.trimestre_idTrimestre = :idT AND g.uea_idUEA = :idU
				GROUP BY g.idGrupo, p.idProfesor, p.numeroEconomico, p.nombre
				ORDER BY g.claveGrupo ASC");
				$stG->execute([':idT'=>$idTrimestre, ':idU'=>$idUEA]);
				$grows = $stG->fetchAll(PDO::FETCH_ASSOC) ?: [];
				foreach ($grows as $gr) {
					$out['grupos'][] = [
						'idGrupo'=>(int)$gr['idGrupo'],
						'claveGrupo'=>$gr['claveGrupo'],
						'horarios'=>[
							'lunes'=>$gr['lunes'] ?: '',
							'martes'=>$gr['martes'] ?: '',
							'miercoles'=>$gr['miercoles'] ?: '',
							'jueves'=>$gr['jueves'] ?: '',
							'viernes'=>$gr['viernes'] ?: ''
						],
						'profesorAsignado' => ($gr['idProfesor'] ? [
							'idProfesor'=>(int)$gr['idProfesor'],
							'numeroEconomico'=>$gr['numeroEconomico'],
							'nombre'=>$gr['profesor']
						] : null)
					];
				}

				// Preferencias por prioridad
				$stP = $this->conexion->prepare("SELECT pu.prioridad, p.idProfesor, p.numeroEconomico, p.nombre
				FROM profesorpreferencia_has_uea pu
				INNER JOIN profesorpreferencias pp ON pp.idProfesorPreferencias = pu.profesorPreferencia_idProfesorPreferencias
				INNER JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
				WHERE pu.uea_idUEA = :idU AND pp.trimestre_idTrimestre = :idT
				ORDER BY pu.prioridad ASC, p.numeroEconomico ASC");
				$stP->execute([':idU'=>$idUEA, ':idT'=>$idTrimestre]);
				$prows = $stP->fetchAll(PDO::FETCH_ASSOC) ?: [];
				foreach ($prows as $pr) {
					$pri = (string)($pr['prioridad'] ?? '');
					if (!isset($out['preferencias'][$pri])) $out['preferencias'][$pri] = [];
					$out['preferencias'][$pri][] = [
						'idProfesor'=>(int)$pr['idProfesor'],
						'numeroEconomico'=>$pr['numeroEconomico'],
						'nombre'=>$pr['nombre']
					];
				}
				return $out;
			} catch (Exception $e) { return $out; }
		}

		public function ueaRegistrarUEALibre( $nEco, $clUEA): void{
			// por defecto la uea se guardara con maxima prioridad
			$idUEA = $this->conexion->query( "SELECT idUEA FROM dbappcb.uea where claveUEA= {$clUEA};")->fetch(PDO::FETCH_ASSOC)['idUEA'];
			$idProf = $this->conexion->query("SELECT idProfesor FROM dbappcb.profesor WHERE numeroEconomico= {$nEco};")->fetch(PDO::FETCH_ASSOC)['idProfesor'];

			if ( $this->conexion->query( "SELECT * FROM dbappcb.solicitud_uea WHERE idProfesor= '{$idProf}' AND idUEA= '{$idUEA}';")->fetch(PDO::FETCH_ASSOC) == '' )
			{
				$sql = "INSERT INTO dbappcb.solicitud_uea (`idProfesor`, `idUEA`, `prioridad`) VALUES ('{$idProf}', '{$idUEA}', '1');";
				$result = $this->conexion->query($sql);
				$row = $result->fetch(PDO::FETCH_ASSOC);
				if ($row != null){
					echo json_encode($row, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
				}
			} 
		}
		
		public function ueaRegistrarComentarioLibre( $nEco): void{
			$idProf = $this->conexion->query("SELECT idProfesor FROM dbappcb.profesor WHERE numeroEconomico= {$nEco};")->fetch(PDO::FETCH_ASSOC)['idProfesor'];
			if ($this->conexion->query("SELECT * FROM dbappcb.solicitud_profesor WHERE idProfesor= {$idProf};")->fetch(PDO::FETCH_ASSOC) == '') {
				$sql = "INSERT INTO dbappcb.solicitud_profesor (`idProfesor`, `noGrupos`, `observaciones`) VALUES ('{$idProf}', '5', 'Agregado de forma libre');";
	
				$result = $this->conexion->query($sql);
				$row = $result->fetch(PDO::FETCH_ASSOC);
				if ($row != null){
					echo json_encode($row, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
				}
			};
		}

		public function ueaRegistrarHorarioLibre( $nEco): void{
			// por defecto se agregaran todos los horarios posibles si el profesor no tiene horarios
			$idProf = $this->conexion->query("SELECT idProfesor FROM dbappcb.profesor WHERE numeroEconomico= {$nEco};")->fetch(PDO::FETCH_ASSOC)['idProfesor'];
			if ( $this->conexion->query( "SELECT * FROM dbappcb.solicitud_horario where idProfesor= {$idProf}")->fetch(PDO::FETCH_ASSOC) == null) {
				for ($i=1; $i < 230; $i++) { 
					$sql = "INSERT INTO dbappcb.solicitud_horario  (`idProfesor`, `idHorario`) VALUES ('{$idProf}', '{$i}');";
					$result = $this->conexion->query($sql);
					$row = $result->fetch(PDO::FETCH_ASSOC);
					if ($row != null){
						echo json_encode($row, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
					}
				}
			};
		}


		public function insertar(int $clave, string $nombre, int $areaId) {
			try {
				$sql = "INSERT INTO uea (clave, nombre, areaId) VALUES (:clave, :nombre, :areaId)";
				$stmt = $this->conexion->prepare($sql);
				if ($stmt->execute([':clave' => $clave, ':nombre' => $nombre, ':areaId' => $areaId])) {
					return Respuesta::make(true);
				} else {
					return Respuesta::make(false, 'Error al ejecutar inserción');
				}
			} catch (PDOException $e) {
				return Respuesta::make(false, $e->getMessage());
			}
		}


		public function getFromClave(int $clave): ?array {
			try {
				$sql = "SELECT clave FROM uea WHERE clave = :clave LIMIT 1";
				$stmt = $this->conexion->prepare($sql);
				$stmt->execute([':clave' => $clave]);
				$result = $stmt->fetch(PDO::FETCH_ASSOC);
				return $result ?: null; // Returns array with clave or null
			} catch (PDOException $e) {
				return null;
			}
		}

    }
?>
