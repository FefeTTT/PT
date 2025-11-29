<?php
	class TrimDAO{
		public $conexion;

		public function __construct($conexion){
			$this->conexion=$conexion;
		}

		public function __destruct(){ }

		// Obtener periodos de trimestre (tabla trimestreperiodo)
		public function listarPeriodos(): array {
			$periodos = [];
			$sql = "SELECT idTrimestrePeriodo, nombre, sigla FROM trimestreperiodo ORDER BY idTrimestrePeriodo";
			$stmt = $this->conexion->query($sql);
			while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
				// lazy require VO if exists
				if (file_exists(__DIR__ . '/TrimestrePeriodoVO.php')) require_once __DIR__ . '/TrimestrePeriodoVO.php';
				$vo = new TrimestrePeriodoVO($row['idTrimestrePeriodo'], $row['nombre'], $row['sigla']);
				$periodos[] = $vo->toJSON();
			}
			return $periodos;
		}

		// Listar los posibles estados de trimestre (tabla trimestreestado)
		public function listarEstados(): array {
			$rows = [];
			$sql = "SELECT idTrimestreEstado, estado FROM trimestreestado ORDER BY idTrimestreEstado";
			$stmt = $this->conexion->query($sql);
			while ($row = $stmt->fetch(PDO::FETCH_ASSOC)){
				$rows[] = $row;
			}
			return $rows;
		}

		// Obtener trimestres ya creados para un año específico
		public function obtenerTrimestresPorAnio(int $anio): array {
			$rows = [];
			$sql = "SELECT t.idTrimestre, t.trimestreperiodo_idTrimestrePeriodo, tp.nombre AS periodoNombre, tp.sigla, t.año, t.fechaLimite,
					 t.trimestreestado_idTrimestreEstado, te.estado AS trimestreEstado
					FROM trimestre t
					JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					LEFT JOIN trimestreestado te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
					WHERE t.año = :anio";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([':anio' => $anio]);
			while ($row = $stmt->fetch(PDO::FETCH_ASSOC)){
				$rows[] = $row;
			}
			return $rows;
		}

		/**
		 * Obtener todos los trimestres existentes, ordenados por año descendente.
		 */
		public function obtenerTodosTrimestres(): array {
			$rows = [];
			$sql = "SELECT t.idTrimestre, t.trimestreperiodo_idTrimestrePeriodo, tp.nombre AS periodoNombre, tp.sigla, t.año, t.fechaLimite, t.trimestreestado_idTrimestreEstado, te.estado AS trimestreEstado
				FROM trimestre t
				JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
				LEFT JOIN trimestreestado te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
				ORDER BY t.año DESC, tp.nombre DESC";
			$stmt = $this->conexion->query($sql);
			while ($row = $stmt->fetch(PDO::FETCH_ASSOC)){
				$rows[] = $row;
			}
			return $rows;
		}

		/**
		 * Obtener un trimestre por su id (idTrimestre). Retorna la fila asociativa o null.
		 */
		public function obtenerPorId(int $idTrimestre) {
			$st = $this->conexion->prepare("SELECT t.idTrimestre AS idTrimestre, t.trimestreperiodo_idTrimestrePeriodo, tp.nombre AS periodoNombre, tp.sigla, t.año, t.fechaLimite, t.trimestreestado_idTrimestreEstado, te.estado AS trimestreEstado
					 FROM trimestre t
					 JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					 LEFT JOIN trimestreestado te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
					 WHERE t.idTrimestre = :id LIMIT 1");
			$st->execute([':id' => $idTrimestre]);
			$row = $st->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		// Insertar nuevo trimestre (trimestreperiodo_id, año, fechaLimite)
		// Ahora acepta un parámetro opcional $estadoId proporcionado por el caller.
		public function insertarTrimestre(int $idPeriodo, int $anio, string $fechaLimite, ?int $estadoId = null){
			// Si el caller no proporcionó un estado, intentar resolver 'Activo'
			if ($estadoId === null) {
				try {
					$st = $this->conexion->prepare("SELECT idTrimestreEstado FROM trimestreestado WHERE estado = 'Activo' LIMIT 1");
					$st->execute();
					$r = $st->fetch(PDO::FETCH_ASSOC);
					if ($r && isset($r['idTrimestreEstado'])) $estadoId = (int)$r['idTrimestreEstado'];
				} catch (Exception $e) {
					// continuar y tratar de fallback abajo
				}
			}

			// Si aún no hay estadoId, intentar tomar el primer id disponible en la tabla
			if ($estadoId === null) {
				try {
					$st2 = $this->conexion->query("SELECT idTrimestreEstado FROM trimestreestado ORDER BY idTrimestreEstado LIMIT 1");
					$r2 = $st2->fetch(PDO::FETCH_ASSOC);
					if ($r2 && isset($r2['idTrimestreEstado'])) $estadoId = (int)$r2['idTrimestreEstado'];
				} catch (Exception $e) {
					// fallthrough
				}
			}

			if ($estadoId === null) {
				// No hay estados definidos en la base, lanzar excepción para que el caller lo maneje
				throw new Exception('No hay estados de trimestre definidos en la base de datos');
			}

			$sql = "INSERT INTO trimestre (trimestreperiodo_idTrimestrePeriodo, trimestreestado_idTrimestreEstado, año, fechaLimite) VALUES (:idPeriodo, :estadoId, :anio, :fechaLimite)";
			$stmt = $this->conexion->prepare($sql);
			$ok = $stmt->execute([':idPeriodo' => $idPeriodo, ':estadoId' => $estadoId, ':anio' => $anio, ':fechaLimite' => $fechaLimite]);
			if (!$ok) return null;
			$newId = (int)$this->conexion->lastInsertId();
			$sql2 = "SELECT t.idTrimestre AS idTrimestre, t.trimestreperiodo_idTrimestrePeriodo, tp.nombre AS periodoNombre, tp.sigla, t.año, t.fechaLimite, t.trimestreestado_idTrimestreEstado, te.estado AS trimestreEstado
					 FROM trimestre t JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					 LEFT JOIN trimestreestado te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
					 WHERE t.idTrimestre = :id LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([':id' => $newId]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		public function buscaUltimoTrim():array{
			$trimArray= array();
			$sql="SELECT * FROM dbappcb.trimestre
						ORDER BY idTrimestre DESC";
			$result=$this->conexion->query($sql);
			while($row=$result->fetch(PDO::FETCH_ASSOC)){
				$trim= new TrimVO($row['idTrimestre'],$row['nombre'],
					$row['fechaLim']);
				array_push($trimArray,$trim->toJSON());
			}
			//$this->conexion->close();
			return $trimArray;
		}
		
		public function buscaUltimo():TrimVO{
			$sql="SELECT * FROM dbappcb.trimestre
					ORDER BY idTrimestre DESC";
			$result=$this->conexion->query($sql);
			$row=$result->fetch(PDO::FETCH_ASSOC);
			// bdnew.sql uses 'fechaLimite' (DATE) instead of old 'fechaLim'
			$fecha = isset($row['fechaLimite']) ? $row['fechaLimite'] : (isset($row['fechaLim']) ? $row['fechaLim'] : null);
			$nombre = isset($row['nombre']) ? $row['nombre'] : (isset($row['año']) ? $row['año'] : null);
			$trim= new TrimVO($row['idTrimestre'],$nombre,
						$fecha);
			//$this->conexion->close();
			return $trim;
		}

		/**
		 * Contar cuántas programaciones hay (grupos programados) en un trimestre
		 */
		public function contarProgramacionPorTrimestre(int $idTrimestre): int {
			$st = $this->conexion->prepare("SELECT COUNT(DISTINCT pr.grupo_idGrupo) AS c FROM programacion pr INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo WHERE g.trimestre_idTrimestre = :id");
			$st->execute([':id' => $idTrimestre]);
			$r = $st->fetch(PDO::FETCH_ASSOC);
			if ($r && isset($r['c'])) return (int)$r['c'];
			return 0;
		}

		/**
		 * Obtener la programación detallada de un trimestre.
		 * Retorna un array de filas con: claveUEA, nombreUEA, claveGrupo, cupo, inscritos, salon, dia, horaInicio, horaFin, numeroEconomico, nombreProfesor
		 */
		public function obtenerProgramacionPorTrimestre(int $idTrimestre): array {
			$rows = [];
			$sql = "SELECT u.claveUEA, u.nombre AS nombreUEA, g.claveGrupo, g.cupo, g.inscritos, g.salon, h.dia, h.horaInicio, h.horaFin, p.numeroEconomico, p.nombre AS nombreProfesor
				FROM programacion pr
				INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = :idTr
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA
				INNER JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				INNER JOIN horario h ON gh.horario_idHorario = h.idHorario
				LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
				LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
				ORDER BY u.claveUEA, g.claveGrupo, h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$rows[] = $row;
			}
			return $rows;
		}

		/**
		 * Obtener horarios de grupos para un trimestre (incluso si no hay programacion).
		 * Retorna un array de filas con: claveUEA, nombreUEA, claveGrupo, cupo, dia, horaInicio, horaFin
		 * Si un grupo no tiene horarios, las columnas de dia/hora serán NULL/[''] según PDO.
		 */
		public function obtenerHorariosPorTrimestre(int $idTrimestre): array {
			$rows = [];
			$sql = "SELECT u.claveUEA, u.nombre AS nombreUEA, g.claveGrupo, g.cupo, h.dia, h.horaInicio, h.horaFin
				FROM grupo g
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA
				LEFT JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				LEFT JOIN horario h ON gh.horario_idHorario = h.idHorario
				WHERE g.trimestre_idTrimestre = :idTr
				ORDER BY u.claveUEA, g.claveGrupo, h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$rows[] = $row;
			}
			return $rows;
		}

		/**
		 * Listar todos los horarios disponibles
		 */
		public function listarHorarios(): array {
			$rows = [];
			$sql = "SELECT idHorario, dia, horaInicio, horaFin FROM horario ORDER BY FIELD(LOWER(dia),'lunes','martes','miercoles','jueves','viernes'), horaInicio";
			$st = $this->conexion->prepare($sql);
			$st->execute();
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$rows[] = $row;
			}
			return $rows;
		}

		/**
		 * Obtener mapa de profesor asignado por grupo para un trimestre.
		 * Retorna array asociativo: idGrupo => [ idProfesor, numeroEconomico, nombreProfesor ]
		 */
		public function obtenerProfesorAsignadoPorGrupoEnTrimestre(int $idTrimestre): array {
			$map = [];
			$sql = "SELECT g.idGrupo, p.idProfesor, p.numeroEconomico, p.nombre AS nombreProfesor
				FROM programacion pr
				INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = :idTr
				LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
				LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
				ORDER BY g.idGrupo, p.nombre";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$gid = (int)$row['idGrupo'];
				if (!isset($map[$gid])) {
					$map[$gid] = [
						'idProfesor' => isset($row['idProfesor']) ? (int)$row['idProfesor'] : null,
						'numeroEconomico' => $row['numeroEconomico'] ?? null,
						'nombreProfesor' => $row['nombreProfesor'] ?? null,
					];
				}
			}
			return $map;
		}

		/**
		 * Obtener grupos y sus horarios (anidado) para un trimestre.
		 * Retorna array de grupos, cada grupo tiene campos idGrupo, claveGrupo, cupo, salon, uea (claveUEA,nombreUEA) y horarios => array of horario rows
		 */
		public function obtenerGruposConHorariosPorTrimestre(int $idTrimestre): array {
			$groups = [];
			$sql = "SELECT g.idGrupo, g.claveGrupo, g.cupo, g.salon, u.idUEA, u.claveUEA, u.nombre AS nombreUEA, h.idHorario, h.dia, h.horaInicio, h.horaFin
				FROM grupo g
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA
				LEFT JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				LEFT JOIN horario h ON gh.horario_idHorario = h.idHorario
				WHERE g.trimestre_idTrimestre = :idTr
				ORDER BY u.claveUEA, g.claveGrupo, h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$key = $row['idGrupo'];
				if (!isset($groups[$key])) {
					$groups[$key] = [
						'idGrupo' => (int)$row['idGrupo'],
						'claveGrupo' => $row['claveGrupo'],
						'cupo' => $row['cupo'],
						'salon' => $row['salon'],
						'uea' => [ 'idUEA' => (int)$row['idUEA'], 'claveUEA' => $row['claveUEA'], 'nombreUEA' => $row['nombreUEA'] ],
						'horarios' => []
					];
				}
				if (isset($row['idHorario']) && $row['idHorario'] !== null) {
					$groups[$key]['horarios'][] = [ 'idHorario' => (int)$row['idHorario'], 'dia' => $row['dia'], 'horaInicio' => $row['horaInicio'], 'horaFin' => $row['horaFin'] ];
				}
			}
			// reindex
			return array_values($groups);
		}

		/**
		 * Obtener un grupo por id con su UEA y horarios.
		 * Estructura: [ idGrupo, claveGrupo, cupo, inscritos?, salon, uea: {idUEA, claveUEA, nombreUEA}, horarios: [{idHorario,dia,horaInicio,horaFin}] ] o null si no existe
		 */
		public function obtenerGrupoConHorariosPorId(int $idGrupo) {
			$groups = [];
			$sql = "SELECT g.idGrupo, g.claveGrupo, g.cupo, g.inscritos, g.salon, u.idUEA, u.claveUEA, u.nombre AS nombreUEA, h.idHorario, h.dia, h.horaInicio, h.horaFin
				FROM grupo g
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA
				LEFT JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				LEFT JOIN horario h ON gh.horario_idHorario = h.idHorario
				WHERE g.idGrupo = :id
				ORDER BY h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':id' => $idGrupo]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$key = $row['idGrupo'];
				if (!isset($groups[$key])) {
					$groups[$key] = [
						'idGrupo' => (int)$row['idGrupo'],
						'claveGrupo' => $row['claveGrupo'],
						'cupo' => $row['cupo'],
						'inscritos' => $row['inscritos'] ?? null,
						'salon' => $row['salon'],
						'uea' => [ 'idUEA' => (int)$row['idUEA'], 'claveUEA' => $row['claveUEA'], 'nombreUEA' => $row['nombreUEA'] ],
						'horarios' => []
					];
				}
				if (isset($row['idHorario']) && $row['idHorario'] !== null) {
					$groups[$key]['horarios'][] = [ 'idHorario' => (int)$row['idHorario'], 'dia' => $row['dia'], 'horaInicio' => $row['horaInicio'], 'horaFin' => $row['horaFin'] ];
				}
			}
			if (empty($groups)) return null;
			return array_values($groups)[0];
		}

		/**
		 * Obtener la programación (con horarios) de un profesor en un trimestre.
		 * Retorna filas: claveUEA, nombreUEA, claveGrupo, salon, dia, horaInicio, horaFin
		 */
		public function obtenerProgramacionProfesorConHorarios(int $idTrimestre, int $idProfesor): array {
			$rows = [];
			$sql = "SELECT u.claveUEA, u.nombre AS nombreUEA, g.claveGrupo, g.salon, h.dia, h.horaInicio, h.horaFin
				FROM programacion pr
				INNER JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = :idTr
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA
				INNER JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				INNER JOIN horario h ON gh.horario_idHorario = h.idHorario
				LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
				WHERE pd.profesor_idProfesor = :idProf
				ORDER BY u.claveUEA, g.claveGrupo, h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre, ':idProf' => $idProfesor]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) { $rows[] = $row; }
			return $rows;
		}

		/**
		 * Obtener grupos de una UEA (por claveUEA) con sus horarios para un trimestre.
		 * Estructura: [{ idGrupo, claveGrupo, cupo, inscritos, salon, uea: {idUEA, claveUEA, nombreUEA}, horarios: [{idHorario,dia,horaInicio,horaFin}] }]
		 */
		public function obtenerGruposDeUEAConHorarios(int $idTrimestre, string $claveUEA): array {
			$groups = [];
			$sql = "SELECT g.idGrupo, g.claveGrupo, g.cupo, g.inscritos, g.salon, u.idUEA, u.claveUEA, u.nombre AS nombreUEA, h.idHorario, h.dia, h.horaInicio, h.horaFin
				FROM grupo g
				INNER JOIN uea u ON g.uea_idUEA = u.idUEA AND u.claveUEA = :clave
				LEFT JOIN grupo_has_horario gh ON gh.grupo_idGrupo = g.idGrupo
				LEFT JOIN horario h ON gh.horario_idHorario = h.idHorario
				WHERE g.trimestre_idTrimestre = :idTr
				ORDER BY g.claveGrupo, h.idHorario";
			$st = $this->conexion->prepare($sql);
			$st->execute([':idTr' => $idTrimestre, ':clave' => $claveUEA]);
			while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
				$key = $row['idGrupo'];
				if (!isset($groups[$key])) {
					$groups[$key] = [
						'idGrupo' => (int)$row['idGrupo'],
						'claveGrupo' => $row['claveGrupo'],
						'cupo' => $row['cupo'],
						'inscritos' => $row['inscritos'],
						'salon' => $row['salon'],
						'uea' => [ 'idUEA' => (int)$row['idUEA'], 'claveUEA' => $row['claveUEA'], 'nombreUEA' => $row['nombreUEA'] ],
						'horarios' => []
					];
				}
				if (isset($row['idHorario']) && $row['idHorario'] !== null) {
					$groups[$key]['horarios'][] = [ 'idHorario' => (int)$row['idHorario'], 'dia' => $row['dia'], 'horaInicio' => $row['horaInicio'], 'horaFin' => $row['horaFin'] ];
				}
			}
			return array_values($groups);
		}

		/**
		 * Establecer (reemplazar) el horario de un grupo para un día concreto.
		 * Si $idHorario es null o 0 borra la asignación; si tiene valor inserta el vínculo.
		 */
		public function setHorarioGrupoDia(int $idGrupo, string $dia, ?int $idHorario): bool {
			try {
				$this->conexion->beginTransaction();
				// Eliminar cualquier vínculo existente del grupo con horarios cuya columna dia coincida
				$stDel = $this->conexion->prepare("DELETE gh FROM grupo_has_horario gh INNER JOIN horario h ON gh.horario_idHorario = h.idHorario WHERE gh.grupo_idGrupo = :idGrupo AND LOWER(h.dia) LIKE :diaPrefix");
				$diaPref = mb_strtolower($dia) . '%';
				$stDel->execute([':idGrupo' => $idGrupo, ':diaPrefix' => $diaPref]);
				// Si idHorario proporcionado, insertar vínculo
				if ($idHorario && $idHorario > 0) {
					$stIns = $this->conexion->prepare("INSERT IGNORE INTO grupo_has_horario (grupo_idGrupo, horario_idHorario) VALUES (:idGrupo, :idHorario)");
					$stIns->execute([':idGrupo' => $idGrupo, ':idHorario' => $idHorario]);
				}
				$this->conexion->commit();
				return true;
			} catch (Exception $e) {
				try { if ($this->conexion->inTransaction()) $this->conexion->rollBack(); } catch(Exception $__){}
				return false;
			}
		}

			/**
			 * Eliminar un trimestre por id. Intentará ejecutar el DELETE y retornará true si tuvo éxito.
			 * Devuelve false si ocurrió un error (por ejemplo restricción de integridad).
			 */
			public function eliminarTrimestre(int $idTrimestre): bool {
				try {
					// Borrado seguro en transacción: eliminar dependencias en el orden correcto
					$this->conexion->beginTransaction();

					// 1) Eliminar programacion asociada al trimestre (referencia directa)
					$stProg = $this->conexion->prepare("DELETE FROM programacion WHERE grupo_trimestre_idTrimestre = :id");
					$stProg->execute([':id' => $idTrimestre]);

					// 2) Eliminar programacion redundante por otras referencias (defensivo)
					// (already handled above)

					// 3) Obtener grupos del trimestre y borrar horarios de grupos
					$stG = $this->conexion->prepare("SELECT idGrupo FROM grupo WHERE trimestre_idTrimestre = :id");
					$stG->execute([':id' => $idTrimestre]);
					$grupos = $stG->fetchAll(PDO::FETCH_COLUMN, 0);
					if (!empty($grupos)){
						$placeholders = implode(',', array_fill(0, count($grupos), '?'));
						$stGh = $this->conexion->prepare("DELETE FROM grupo_has_horario WHERE grupo_idGrupo IN ($placeholders)");
						$stGh->execute($grupos);
						// Borrar programacion que referencie esos grupos (defensivo)
						$stProg2 = $this->conexion->prepare("DELETE FROM programacion WHERE grupo_idGrupo IN ($placeholders) AND grupo_trimestre_idTrimestre = ?");
						$progParams = array_merge($grupos, [$idTrimestre]);
						$stProg2->execute($progParams);
						// Borrar grupos
						$stDelG = $this->conexion->prepare("DELETE FROM grupo WHERE trimestre_idTrimestre = ?");
						$stDelG->execute([$idTrimestre]);
					}

					// 4) Eliminar preferencias de profesores y sus relaciones
					$stPref = $this->conexion->prepare("SELECT idProfesorPreferencias FROM profesorpreferencias WHERE trimestre_idTrimestre = :id");
					$stPref->execute([':id' => $idTrimestre]);
					$prefs = $stPref->fetchAll(PDO::FETCH_COLUMN, 0);
					if (!empty($prefs)){
						$ph = implode(',', array_fill(0, count($prefs), '?'));
						$stPUEA = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias IN ($ph)");
						$stPH = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias IN ($ph)");
						$stPUEA->execute($prefs);
						$stPH->execute($prefs);
						$stDelPref = $this->conexion->prepare("DELETE FROM profesorpreferencias WHERE trimestre_idTrimestre = ?");
						$stDelPref->execute([$idTrimestre]);
					}

					// 5) Eliminar disposiciones de profesores (profesordisposicion)
					$stDisp = $this->conexion->prepare("DELETE FROM profesordisposicion WHERE trimestre_idTrimestre = :id");
					$stDisp->execute([':id' => $idTrimestre]);
					// Verificar que no queden disposiciones para este trimestre (validación adicional)
					$stCheck = $this->conexion->prepare("SELECT COUNT(*) AS c FROM profesordisposicion WHERE trimestre_idTrimestre = :id");
					$stCheck->execute([':id' => $idTrimestre]);
					$cntRow = $stCheck->fetch(PDO::FETCH_ASSOC);
					if ($cntRow && isset($cntRow['c']) && (int)$cntRow['c'] > 0) {
						$this->conexion->rollBack();
						throw new Exception('No se pudieron eliminar algunas disposiciones de profesores para el trimestre');
					}

					// 6) Finalmente eliminar el trimestre
					$st = $this->conexion->prepare("DELETE FROM trimestre WHERE idTrimestre = :id");
					$st->execute([':id' => $idTrimestre]);
					if ($st->rowCount() === 0) {
						$this->conexion->rollBack();
						throw new Exception('No se encontró el trimestre o no se pudo eliminar');
					}

					$this->conexion->commit();
					return true;
				} catch (Exception $e) {
					try { if ($this->conexion->inTransaction()) $this->conexion->rollBack(); } catch(Exception $__){}
					// Propagar la excepción con mensaje detallado para que el controlador lo muestre
					throw new Exception('Error eliminando trimestre: ' . $e->getMessage());
				}
			}

			/**
			 * Cambiar el estado de un trimestre y retornar la fila actualizada (con joins) o null si falla
			 */
			public function cambiarEstadoTrimestre(int $idTrimestre, int $nuevoEstadoId){
				try{
					$st = $this->conexion->prepare("UPDATE trimestre SET trimestreestado_idTrimestreEstado = :estado WHERE idTrimestre = :id");
					$ok = $st->execute([':estado' => $nuevoEstadoId, ':id' => $idTrimestre]);
					if (!$ok) return null;
					$sql = "SELECT t.idTrimestre AS idTrimestre, t.trimestreperiodo_idTrimestrePeriodo, tp.nombre AS periodoNombre, tp.sigla, t.año, t.fechaLimite, t.trimestreestado_idTrimestreEstado, te.estado AS trimestreEstado
						 FROM trimestre t JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
						 LEFT JOIN trimestreestado te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
						 WHERE t.idTrimestre = :id LIMIT 1";
					$s2 = $this->conexion->prepare($sql);
					$s2->execute([':id' => $idTrimestre]);
					$row = $s2->fetch(PDO::FETCH_ASSOC);
					return $row ?: null;
				} catch(Exception $e){
					return null;
				}
			}
	}
?>
