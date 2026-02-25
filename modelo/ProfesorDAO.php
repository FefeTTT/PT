<?php
	class ProfesorDAO{
		public $conexion;

		public function __construct($conexion){
			$this->conexion=$conexion;
		}

		public function __destruct(){ }

	public function obtenerProfesoresTodosSimple(): array{
			$profesores = array();
			$sql = "SELECT * FROM profesor;";
			$result = $this->conexion->query($sql);
			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				$profesorVO = new ProfesorVO(
					$row['numeroEconomico'],
					$row['nombre'],
					$row['correo_uam'],
					$row['correo_personal'],
					null,
					$row['celular'],
					$row['idArea'],
					$row['idGrado']
				);
				array_push($profesores, $profesorVO->toJSON());
			}
			return $profesores;
		}

		/**
		 * Helper privado: construir un ProfesorVO a partir de una fila asociativa
		 */
		private function buildProfesorVOFromRow(array $row): ProfesorVO {
			return new ProfesorVO(
				$row['numeroEconomico'],
				$row['nombre'],
				$row['correo_uam'],
				$row['correo_personal'],
				null,
				$row['celular'],
				$row['idArea'] ?? null,
				$row['idGrado'] ?? null
			);
		}

		/**
		 * Obtener un profesor por su numeroEconomico.
		 * Devuelve array JSON (como toJSON) o null si no existe.
		 */
		public function obtenerProfesorPorNumeroEconomico(int $numeroEconomico): ?array {
			$sql = "SELECT nombre, celular, correo_uam, correo_personal, idArea, idGrado FROM profesor WHERE numeroEconomico = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$numeroEconomico]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			if (!$row) return null;
			$row['numeroEconomico'] = $numeroEconomico;
			$vo = $this->buildProfesorVOFromRow($row);
			return $vo->toJSON();
		}

		/**
		 * Obtener un profesor por su correo uam.
		 * Devuelve array JSON (como toJSON) o null si no existe.
		 */
		public function obtenerProfesorPorCorreoUAM(string $correoUAM): ?array {
			$sql = "SELECT numeroEconomico, nombre, correo_personal FROM profesor WHERE correo_uam = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$correoUAM]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			if (!$row) return null;
			$row['numeroEconomico'] = $row['numeroEconomico'];
			$vo = $this->buildProfesorVOFromRow($row);
			return $vo->toJSON();
		}

		/**
		 * Obtener un profesor por su correo personal.
		 * Devuelve array JSON (como toJSON) o null si no existe.
		 */
		public function obtenerProfesorPorCorreoPersonal(string $correoPersonal): ?array {
			$sql = "SELECT numeroEconomico, nombre, correo_uam FROM profesor WHERE correo_personal = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$correoPersonal]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			if (!$row) return null;
			$row['numeroEconomico'] = $row['numeroEconomico'];
			$vo = $this->buildProfesorVOFromRow($row);
			return $vo->toJSON();
		}

		/**
		 * Obtener un profesor por su nombre (primer match).
		 * Devuelve array JSON (como toJSON) o null si no existe.
		 */
		public function obtenerProfesorPorNombre(string $nombre): ?array {
			// Ensure uniqueness: there should not be more than one professor with the same name
			$sql = "SELECT numeroEconomico, celular, correo_uam, correo_personal, idArea, idGrado FROM profesor WHERE nombre = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombre]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			$count = count($rows);
			if ($count === 0) return null;
			if ($count > 1) {
				throw new Exception("Se encontraron múltiples profesores con el mismo nombre: '{$nombre}'. Se esperaba un nombre único.");
			}
			$row = $rows[0];
			$row['numeroEconomico'] = $row['numeroEconomico'];
			$vo = $this->buildProfesorVOFromRow($row);
			return $vo->toJSON();
		}

		/**
		 * Obtener un profesor por su id (ahora numeroEconomico).
		 * Mantenido por compatibilidad pero redirige a buscar por numeroEconomico.
		 */
		public function obtenerProfesorPorId(int $idProfesor): ?array {
            // idProfesor ya no existe, usamos numeroEconomico
			return $this->obtenerProfesorPorNumeroEconomico($idProfesor);
		}

		/**
		 * Obtener area academica por nombre.
		 * Devuelve array asociativo o null.
		 */
		/**
		 * Obtener el área académica en la que está el profesor.
		 * Recibe nombre del profesor y devuelve la fila de `areaacademica` o null.
		 */
		/**
		 * Obtener las áreas académicas en las que está ligado el profesor.
		 * Recibe nombre del profesor y devuelve un arreglo (posiblemente vacío) de filas de `areaacademica`.
		 */
		public function obtenerAreaAcademicaPorProfesorNombre(string $nombreProfesor): array {
			// Use schema names: areaacademica.idAreaAcademica and areaacademica_has_profesor.areaAcademica_idAreaAcademica
			$sql = "SELECT a.idAreaAcademica AS idAreaAcademica, a.nombre
				FROM areaacademica a
				JOIN areaacademica_has_profesor ap ON a.idAreaAcademica = ap.areaAcademica_idAreaAcademica
				JOIN profesor p ON ap.profesor_numeroEconomico = p.numeroEconomico
				WHERE p.nombre = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombreProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Alterna: Obtener las áreas académicas por id de profesor.
		 * Devuelve un arreglo (posiblemente vacío) de filas de `areaacademica`.
		 */
		public function obtenerAreaAcademicaPorProfesorId(int $idProfesor): array {
			// Use schema names: areaacademica.idAreaAcademica and areaacademica_has_profesor.areaAcademica_idAreaAcademica
			$sql = "SELECT a.idAreaAcademica AS idAreaAcademica, a.nombre
				FROM areaacademica a
				JOIN areaacademica_has_profesor ap ON a.idAreaAcademica = ap.areaAcademica_idAreaAcademica
				WHERE ap.profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Obtener grupo tematico por nombreGrupo.
		 */
		/**
		 * Obtener el grupo temático asociado al profesor.
		 * Recibe nombre del profesor y devuelve la fila de `grupotematico` o null.
		 */
		/**
		 * Obtener los grupos temáticos asociados al profesor.
		 * Recibe nombre del profesor y devuelve un arreglo (posiblemente vacío) de filas de `grupotematico`.
		 */
		public function obtenerGrupoTematicoPorProfesorNombre(string $nombreProfesor): array {
			$sql = "SELECT g.idGrupoTematico, g.nombreGrupo, g.puesto
				FROM grupotematico g
				JOIN grupotematico_has_profesor gp ON g.idGrupoTematico = gp.grupoTematico_idGrupoTematico
				JOIN profesor p ON gp.profesor_numeroEconomico = p.numeroEconomico
				WHERE p.nombre = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombreProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Alterna: Obtener los grupos temáticos por id de profesor.
		 * Devuelve un arreglo (posiblemente vacío) de filas de `grupotematico`.
		 */
		public function obtenerGrupoTematicoPorProfesorId(int $idProfesor): array {
			$sql = "SELECT g.idGrupoTematico, g.nombreGrupo, g.puesto
				FROM grupotematico g
				JOIN grupotematico_has_profesor gp ON g.idGrupoTematico = gp.grupoTematico_idGrupoTematico
				WHERE gp.profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Obtener contratos asociados a un profesor (por nombre de profesor).
		 * Devuelve arreglo de contratos con datos del tipo.
		 */
		/**
		 * Obtener el contrato del profesor (único). Devuelve la fila o null.
		 * Si hay más de un contrato para el profesor lanzará una excepción.
		 */
		public function obtenerProfesorContratoPorProfesorNombre(string $nombre): ?array {
			$sql = "SELECT pc.idProfesorContrato, pc.descripcion, pt.idProfesorTipo, pt.nombre AS tipoNombre
				FROM profesorcontrato pc
				JOIN profesortipo pt ON pc.profesortipo_idProfesorTipo = pt.idProfesorTipo
				JOIN profesor p ON pc.profesor_numeroEconomico = p.numeroEconomico
				WHERE p.nombre = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombre]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			$count = count($rows);
			if ($count === 0) return null;
			if ($count > 1) {
				throw new Exception("Se encontraron múltiples contratos para el profesor '{$nombre}'. Se esperaba como máximo uno.");
			}
			return $rows[0];
		}

		/**
		 * Alterna: Obtener el contrato de un profesor por su id (único).
		 * Devuelve la fila o null. Lanza excepción si hay más de uno.
		 */
		public function obtenerProfesorContratoPorProfesorId(int $idProfesor): ?array {
			$sql = "SELECT pc.idProfesorContrato, pc.descripcion, pt.idProfesorTipo, pt.nombre AS tipoNombre
				FROM profesorcontrato pc
				JOIN profesortipo pt ON pc.profesortipo_idProfesorTipo = pt.idProfesorTipo
				WHERE pc.profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			$count = count($rows);
			if ($count === 0) return null;
			if ($count > 1) {
				throw new Exception("Se encontraron múltiples contratos para el profesor con id '{$idProfesor}'. Se esperaba como máximo uno.");
			}
			return $rows[0];
		}

		/**
		 * Insertar un contrato para un profesor.
		 * Retorna la fila insertada como arreglo asociativo o null en caso de error.
		 */
		public function insertarProfesorContrato(int $idProfesor, int $idProfesorTipo, ?string $descripcion){
			$sql = "INSERT INTO profesorcontrato (profesor_numeroEconomico, profesortipo_idProfesorTipo, descripcion) VALUES (?, ?, ?)";
			$stmt = $this->conexion->prepare($sql);
			$ok = $stmt->execute([$idProfesor, $idProfesorTipo, $descripcion]);
			if (!$ok) return null;
			$newId = (int)$this->conexion->lastInsertId();
			// retrieve inserted row
			$sql2 = "SELECT idProfesorContrato, profesor_numeroEconomico, profesortipo_idProfesorTipo, descripcion FROM profesorcontrato WHERE idProfesorContrato = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([$newId]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Eliminar contrato de un profesor por idContrato y idProfesor.
		 * Retorna true si se eliminó alguna fila.
		 */
		public function eliminarProfesorContrato(int $idProfesorContrato, int $idProfesor): bool {
			$stmt = $this->conexion->prepare('DELETE FROM profesorcontrato WHERE idProfesorContrato = ? AND profesor_numeroEconomico = ?');
			return $stmt->execute([$idProfesorContrato, $idProfesor]);
		}

		/**
		 * Actualizar un contrato existente (tipo + descripcion).
		 * Retorna la fila actualizada como arreglo asociativo o null si no existe/ocurre error.
		 */
		public function actualizarProfesorContrato(int $idProfesorContrato, int $idProfesor, int $idProfesorTipo, ?string $descripcion): ?array {
			$sql = "UPDATE profesorcontrato SET profesortipo_idProfesorTipo = ?, descripcion = ? WHERE idProfesorContrato = ? AND profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$ok = $stmt->execute([$idProfesorTipo, $descripcion, $idProfesorContrato, $idProfesor]);
			if (!$ok) return null;
			$sql2 = "SELECT idProfesorContrato, profesor_numeroEconomico, profesortipo_idProfesorTipo, descripcion FROM profesorcontrato WHERE idProfesorContrato = ? AND profesor_numeroEconomico = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([$idProfesorContrato, $idProfesor]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Obtener todos los contactos de emergencia ligados a un profesor (por nombre).
		 */
		public function obtenerContactosEmergenciaPorProfesorNombre(string $nombre): array {
			$sql = "SELECT pe.idProfesorEmergencia, pe.nombre, pe.parentesco, pe.celular
				FROM profesoremergencia pe
				JOIN profesor p ON pe.profesor_numeroEconomico = p.numeroEconomico
				WHERE p.nombre = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombre]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Alterna: Obtener contactos de emergencia por id de profesor.
		 */
		public function obtenerContactosEmergenciaPorProfesorId(int $idProfesor): array {
			$sql = "SELECT idProfesorEmergencia, nombre, parentesco, celular
				FROM profesoremergencia
				WHERE profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Insertar un contacto de emergencia para un profesor.
		 * Retorna la fila insertada como arreglo asociativo o null en caso de error.
		 */
		public function insertarProfesorEmergencia(int $idProfesor, string $nombre, string $parentesco, string $celular){
			$sql = "INSERT INTO profesoremergencia (profesor_numeroEconomico, nombre, parentesco, celular) VALUES (?, ?, ?, ?)";
			$stmt = $this->conexion->prepare($sql);
			$ok = $stmt->execute([$idProfesor, $nombre, $parentesco, $celular]);
			if (!$ok) return null;
			$newId = (int)$this->conexion->lastInsertId();
			// retrieve inserted row (safest using both keys)
			$sql2 = "SELECT idProfesorEmergencia, profesor_numeroEconomico, nombre, parentesco, celular FROM profesoremergencia WHERE idProfesorEmergencia = ? AND profesor_numeroEconomico = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([$newId, $idProfesor]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Insertar una fila en profesordisposicion usando el nombre del profesor y id del trimestre.
		 * Retorna el id insertado o null si falló.
		 */
		/**
		 * Buscar los datos de profesordisposicion para un profesor en un trimestre.
		 * Devuelve la fila encontrada o null si no existe.
		 */
		public function buscarProfesordisposicionPorNombreYTrimestre(string $nombreProfesor, int $idTrimestre): ?array {
			$sql = "SELECT pd.idProfesorDisposicion, pd.trimestre_idTrimestre, pd.profesor_numeroEconomico, pd.estado, pd.notas
				FROM profesordisposicion pd
				JOIN profesor p ON pd.profesor_numeroEconomico = p.numeroEconomico
				WHERE p.nombre = ? AND pd.trimestre_idTrimestre = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombreProfesor, $idTrimestre]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Alterna: Buscar profesordisposicion por id de profesor y trimestre.
		 */
		public function buscarProfesordisposicionPorProfesorIdYTrimestre(int $idProfesor, int $idTrimestre): ?array {
			$sql = "SELECT idProfesorDisposicion, trimestre_idTrimestre, profesor_numeroEconomico, estado, notas
				FROM profesordisposicion
				WHERE profesor_numeroEconomico = ? AND trimestre_idTrimestre = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor, $idTrimestre]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Buscar profesores según query. Si $q es vacío devuelve todos.
		 * Si $q es numérico busca por numeroEconomico exacto.
		 * Si no, busca por nombre LIKE %q%.
		 * Devuelve arreglo de objetos JSON (resultado de ProfesorVO->toJSON()).
		 */
		/**
		 * Buscar profesores con soporte opcional de filtros y orden.
		 * $filters puede contener las claves: areaAcademica, grupoTematico, area, profesorTipo, trimestre, sort, sortDir
		 */
		public function buscarProfesores(?string $q = null, array $filters = []): array {
			$q = ($q === null) ? '' : trim($q);

			// If no filter and no query, return simple all list
			$hasFilters = !empty($filters);
			if ($q === '' && !$hasFilters) {
				return $this->obtenerProfesoresTodosSimple();
			}

			$params = [];
			// Base SELECT with LEFT JOINs to allow filtering by related tables
			// include flags isJefeArea / isJefeGrupo when name-filters are present; placeholders will be added conditionally
			$selectExtra = " , 0 AS isJefeArea, 0 AS isJefeGrupo ";
			if (isset($filters['areaAcademicaName']) || isset($filters['grupoTematicoName'])){
				// We'll compute flags later by replacing this placeholder if needed
				$selectExtra = '';
			}

			$sql = "SELECT DISTINCT p.numeroEconomico, p.nombre, p.celular, p.correo_uam, p.correo_personal, p.idArea, p.idGrado" . $selectExtra . "
				FROM profesor p
				LEFT JOIN areaacademica_has_profesor aap ON p.numeroEconomico = aap.profesor_numeroEconomico
				LEFT JOIN areaacademica aa ON aap.areaAcademica_idAreaAcademica = aa.idAreaAcademica
				LEFT JOIN grupotematico_has_profesor gtp ON p.numeroEconomico = gtp.profesor_numeroEconomico
				LEFT JOIN grupotematico gt ON gtp.grupoTematico_idGrupoTematico = gt.idGrupoTematico
				LEFT JOIN profesor_has_area pha ON p.numeroEconomico = pha.profesor_numeroEconomico
				LEFT JOIN area ar ON pha.area_idArea = ar.idArea
				LEFT JOIN profesorcontrato pc ON p.numeroEconomico = pc.profesor_numeroEconomico
				LEFT JOIN profesortipo pt ON pc.profesortipo_idProfesorTipo = pt.idProfesorTipo
				LEFT JOIN profesordisposicion pd ON p.numeroEconomico = pd.profesor_numeroEconomico
				WHERE 1=1";

			// Search q
			if ($q !== '') {
				if (is_numeric($q)) {
					$sql .= " AND p.numeroEconomico = ?";
					$params[] = (int)$q;
				} else {
					$sql .= " AND p.nombre LIKE ?";
					$params[] = '%'.$q.'%';
				}
			}

			// Filters by IDs
			if (isset($filters['areaAcademica']) && $filters['areaAcademica'] !== '') {
				$sql .= " AND aa.idAreaAcademica = ?";
				$params[] = (int)$filters['areaAcademica'];
			}
			if (isset($filters['grupoTematico']) && $filters['grupoTematico'] !== '') {
				$sql .= " AND gt.idGrupoTematico = ?";
				$params[] = (int)$filters['grupoTematico'];
			}
			if (isset($filters['area']) && $filters['area'] !== '') {
				$sql .= " AND ar.idArea = ?";
				$params[] = (int)$filters['area'];
			}
			// filtro por tipo de área del profesor (tabla profesor_has_area.profesorAreaTipo_idProfesorAreaTipo)
			if (isset($filters['profesorAreaTipo']) && $filters['profesorAreaTipo'] !== '') {
				$sql .= " AND pha.profesorAreaTipo_idProfesorAreaTipo = ?";
				$params[] = (int)$filters['profesorAreaTipo'];
			}
			if (isset($filters['profesorTipo']) && $filters['profesorTipo'] !== '') {
				$sql .= " AND pt.idProfesorTipo = ?";
				$params[] = (int)$filters['profesorTipo'];
			}
			if (isset($filters['trimestre']) && $filters['trimestre'] !== '') {
				// Filtrar por trimestre y considerar sólo disposiciones con estado = 1
				$sql .= " AND pd.trimestre_idTrimestre = ? AND pd.estado = 1";
				$params[] = (int)$filters['trimestre'];
			}

			// Name-based filters: match any areaacademica rows with the same nombre (groups jefe + miembros)
			if (isset($filters['areaAcademicaName']) && $filters['areaAcademicaName'] !== ''){
				$sql .= " AND aa.nombre = ?";
				$params[] = $filters['areaAcademicaName'];
			}
			if (isset($filters['grupoTematicoName']) && $filters['grupoTematicoName'] !== ''){
				$sql .= " AND gt.nombreGrupo = ?";
				$params[] = $filters['grupoTematicoName'];
			}

			// Order
			$allowedSort = ['nombre' => 'p.nombre', 'numeroEconomico' => 'p.numeroEconomico'];
			$order = 'p.nombre';
			$dir = 'ASC';
			if (isset($filters['sort']) && array_key_exists($filters['sort'], $allowedSort)) {
				$order = $allowedSort[$filters['sort']];
			}
			if (isset($filters['sortDir']) && in_array(strtoupper($filters['sortDir']), ['ASC','DESC'])) {
				$dir = strtoupper($filters['sortDir']);
			}

			$sql .= " ORDER BY " . $order . " " . $dir;

			$stmt = $this->conexion->prepare($sql);
			$stmt->execute($params);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

			// If name-filters present, fetch the profesor ids that are 'jefes' for that name
			$jefeAreaIds = [];
			$jefeGrupoIds = [];
			if (isset($filters['areaAcademicaName']) && $filters['areaAcademicaName'] !== ''){
				// Puesto column removed from areaacademica. Cannot determine jefe from this table anymore.
				// $sqlJ = "SELECT ap.profesor_numeroEconomico FROM areaacademica aax JOIN areaacademica_has_profesor ap ON aax.idAreaAcademica = ap.areaAcademica_idAreaAcademica WHERE aax.nombre = ? AND aax.puesto LIKE '%jef%'";
				// $stj = $this->conexion->prepare($sqlJ);
				// $stj->execute([$filters['areaAcademicaName']]);
				// $jrows = $stj->fetchAll(PDO::FETCH_COLUMN, 0);
				$jefeAreaIds = []; // array_map('intval', $jrows ?: []);
			}
			if (isset($filters['grupoTematicoName']) && $filters['grupoTematicoName'] !== ''){
				$sqlG = "SELECT gp.profesor_numeroEconomico FROM grupotematico gx JOIN grupotematico_has_profesor gp ON gx.idGrupoTematico = gp.grupoTematico_idGrupoTematico WHERE gx.nombreGrupo = ? AND gx.puesto LIKE '%jef%'";
				$stg = $this->conexion->prepare($sqlG);
				$stg->execute([$filters['grupoTematicoName']]);
				$grows = $stg->fetchAll(PDO::FETCH_COLUMN, 0);
				$jefeGrupoIds = array_map('intval', $grows ?: []);
			}

			$profes = [];
			foreach ($rows as $row) {
				$vo = new ProfesorVO(
					$row['numeroEconomico'],
					$row['nombre'],
					$row['correo_uam'],
					$row['correo_personal'],
					null,
					$row['celular'],
					$row['idArea'],
					$row['idGrado']
				);
				$json = $vo->toJSON();
				// attach jefe flags computed from separate queries when name-filters are used
				$json['isJefeArea'] = (!empty($jefeAreaIds) && in_array((int)$row['numeroEconomico'], $jefeAreaIds)) ? 1 : 0;
				$json['isJefeGrupo'] = (!empty($jefeGrupoIds) && in_array((int)$row['numeroEconomico'], $jefeGrupoIds)) ? 1 : 0;
				array_push($profes, $json);
			}
			return $profes;
		}

		/* Listado para filtros */
		public function listarAreaAcademicas(): array {
			$sql = "SELECT idAreaAcademica, nombre FROM areaacademica ORDER BY nombre";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		public function listarGruposTematicos(): array {
			$sql = "SELECT idGrupoTematico, nombreGrupo, puesto FROM grupotematico ORDER BY nombreGrupo";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		public function listarAreas(): array {
			$sql = "SELECT idArea, nombre FROM area ORDER BY nombre";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		public function listarGrados(): array {
			$sql = "SELECT idGrado, nombre FROM grado_estudios ORDER BY nombre";
			$stmt = $this->conexion->query($sql);
			return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
		}

		/**
		 * Listar tipos de área de profesor (tabla profesorareatipo).
		 * Devuelve idProfesorAreaTipo, descripcion
		 */
		public function listarProfesorAreaTipos(): array {
			$sql = "SELECT idProfesorAreaTipo, descripcion FROM profesorareatipo ORDER BY descripcion";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		public function listarProfesorTipos(): array {
			$sql = "SELECT idProfesorTipo, nombre FROM profesortipo ORDER BY nombre";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		public function listarTrimestres(): array {
			// incluir la sigla del periodo (tabla trimestreperiodo) para poder mostrar "AÑO - SIGLA"
			$sql = "SELECT t.idTrimestre, t.año, t.fechaLimite, tp.sigla FROM trimestre t JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo ORDER BY t.idTrimestre DESC";
			$stmt = $this->conexion->query($sql);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Trimestres en los que un profesor tiene preferencias capturadas.
		 * Devuelve lista de {idTrimestre, año, sigla}
		 */
		public function obtenerTrimestresConPreferenciasPorProfesorId(int $idProfesor): array {
			$sql = "SELECT DISTINCT t.idTrimestre, t.año, tp.sigla
					FROM profesorpreferencias pp
					JOIN trimestre t ON pp.trimestre_idTrimestre = t.idTrimestre
					JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					WHERE pp.profesor_numeroEconomico = ?
					ORDER BY t.idTrimestre DESC";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Dado un arreglo de ids de profesor y un idTrimestre, devuelve un arreglo de ids
		 * de profesores que tienen una fila en `profesorpreferencias` para ese trimestre.
		 * Retorna array<int>
		 */
		public function obtenerProfesConPreferenciasEnTrimestre(array $ids, int $idTrimestre): array {
			if (empty($ids) || $idTrimestre <= 0) return [];
			$placeholders = implode(',', array_fill(0, count($ids), '?'));
			$sql = "SELECT DISTINCT profesor_numeroEconomico FROM profesorpreferencias WHERE trimestre_idTrimestre = ? AND profesor_numeroEconomico IN ($placeholders)";
			$stmt = $this->conexion->prepare($sql);
			$params = array_merge([(int)$idTrimestre], array_values($ids));
			$stmt->execute($params);
			$rows = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
			return array_map('intval', $rows ?: []);
		}

		/**
		 * Dado un arreglo de ids de profesor y un idTrimestre, devuelve un arreglo de ids
		 * de profesores que tienen programación en ese trimestre.
		 * Busca a través de `profesordisposicion` JOIN `programacion`.
		 * Retorna array<int>
		 */
		public function obtenerProfesConProgramacionEnTrimestre(array $ids, int $idTrimestre): array {
			if (empty($ids) || $idTrimestre <= 0) return [];
			$placeholders = implode(',', array_fill(0, count($ids), '?'));
			$sql = "SELECT DISTINCT pd.profesor_numeroEconomico FROM profesordisposicion pd JOIN programacion pr ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion WHERE pd.trimestre_idTrimestre = ? AND pd.profesor_numeroEconomico IN ($placeholders)";
			$stmt = $this->conexion->prepare($sql);
			$params = array_merge([(int)$idTrimestre], array_values($ids));
			$stmt->execute($params);
			$rows = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
			return array_map('intval', $rows ?: []);
		}

		/**
		 * Trimestres en los que un profesor tiene programación.
		 * Devuelve lista de {idTrimestre, año, sigla}
		 */
		public function obtenerTrimestresConProgramacionPorProfesorId(int $idProfesor): array {
			$sql = "SELECT DISTINCT t.idTrimestre, t.año, tp.sigla
					FROM programacion pr
					JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
					JOIN trimestre t ON pd.trimestre_idTrimestre = t.idTrimestre
					JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					WHERE pd.profesor_numeroEconomico = ?
					ORDER BY t.idTrimestre DESC";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Detalle de programación para un profesor en un trimestre.
		 * Devuelve filas con UEA, Grupo, Día, HoraInicio, HoraFin, Salón.
		 */
		public function obtenerProgramacionDetalleProfesorTrimestre(int $idProfesor, int $idTrimestre): array {
			$sql = "SELECT u.claveUEA, u.nombre AS ueaNombre, g.claveGrupo, h.dia, h.horaInicio, h.horaFin, g.salon
					FROM programacion pr
					JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
					JOIN grupo g ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
					JOIN uea u ON g.uea_idUEA = u.idUEA
					JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
					JOIN horario h ON gh.horario_idHorario = h.idHorario
					WHERE pd.profesor_numeroEconomico = ? AND pd.trimestre_idTrimestre = ?
					ORDER BY u.claveUEA, g.claveGrupo, FIELD(h.dia,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'), h.horaInicio";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idProfesor, $idTrimestre]);
			$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
			return $rows ?: [];
		}

		/**
		 * Insertar un nuevo profesor usando un ProfesorVO o datos sueltos.
		 * Retorna el registro insertado como arreglo asociativo.
		 */
		public function insertarProfesor(ProfesorVO $vo): array {
			$sql = "INSERT INTO profesor (numeroEconomico, nombre, celular, correo_uam, correo_personal, idArea, idGrado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([
				(int)$vo->getNumeroEconomico(),
				$vo->getNombre(),
				$vo->getCelular(),
				$vo->getCorreoUAM(),
				$vo->getCorreoP(),
				$vo->getIdArea(),
				$vo->getIdGrado()
			]);
			// No lastInsertId needed, we inserted numeroEconomico manually as PK
			$newId = (int)$vo->getNumeroEconomico();
			
			$sql2 = "SELECT numeroEconomico, nombre, celular, correo_uam, correo_personal, idArea, idGrado FROM profesor WHERE numeroEconomico = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([$newId]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: [];
		}

		/**
		 * Eliminar todas las referencias a un profesor y el propio registro en una transacción.
		 * Retorna true si todo se eliminó correctamente, o lanza Exception en caso de error.
		 */
		public function eliminarProfesorCompleto(int $idProfesor): bool {
			$this->conexion->beginTransaction();
			try {
				// eliminar asociaciones con areaacademica
				$stmt = $this->conexion->prepare('DELETE FROM areaacademica_has_profesor WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// eliminar asociaciones con grupotematico
				$stmt = $this->conexion->prepare('DELETE FROM grupotematico_has_profesor WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// eliminar asociaciones con area (profesor_has_area)
				$stmt = $this->conexion->prepare('DELETE FROM profesor_has_area WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// manejar lugares ligados: primero obtener ids, desasociar del profesor,
				// y luego eliminar solo aquellos lugares que ya no estén asociados a ningún otro profesor
				$stmt = $this->conexion->prepare('SELECT lugar_idLugar FROM profesor_has_lugar WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);
				$idsLugar = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
				if (!empty($idsLugar)){
					// Desasociar todas las filas profesor_has_lugar para este profesor
					$stmtDelAssoc = $this->conexion->prepare('DELETE FROM profesor_has_lugar WHERE profesor_numeroEconomico = ?');
					$stmtDelAssoc->execute([$idProfesor]);

					// Ahora borrar únicamente los lugares que ya no estén asociados a ningún profesor
					$placeholders = implode(',', array_fill(0, count($idsLugar), '?'));
					$sqlDelLugar = 'DELETE FROM lugar WHERE idLugar IN (' . $placeholders . ') AND NOT EXISTS (SELECT 1 FROM profesor_has_lugar ph WHERE ph.lugar_idLugar = lugar.idLugar)';
					$stmtDelLugar = $this->conexion->prepare($sqlDelLugar);
					$stmtDelLugar->execute($idsLugar);
				}

				// eliminar prestamos
				$stmt = $this->conexion->prepare('DELETE FROM prestamo WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// eliminar contratos
				$stmt = $this->conexion->prepare('DELETE FROM profesorcontrato WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// manejar profesordisposicion + programacion
				$stmt = $this->conexion->prepare('SELECT idProfesorDisposicion FROM profesordisposicion WHERE profesor_numeroEconomico = ?');
				$st = $stmt;
				$st->execute([$idProfesor]);
				$idsDisp = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
				if (!empty($idsDisp)){
					// eliminar programacion que apunte a esas disposiciones
					$in = implode(',', array_fill(0, count($idsDisp), '?'));
					$stmtDelProg = $this->conexion->prepare('DELETE FROM programacion WHERE profesordisposicion_idProfesorDisposicion IN (' . $in . ')');
					$stmtDelProg->execute($idsDisp);
				}
				// eliminar profesordisposicion
				$stmt = $this->conexion->prepare('DELETE FROM profesordisposicion WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// manejar profesorpreferencias y sus tablas asociadas
				$stmt = $this->conexion->prepare('SELECT idProfesorPreferencias FROM profesorpreferencias WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);
				$idsPref = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
				if (!empty($idsPref)){
					$in = implode(',', array_fill(0, count($idsPref), '?'));
					// eliminar horarios asociados
					$stmtDel = $this->conexion->prepare('DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias IN (' . $in . ')');
					$stmtDel->execute($idsPref);
					// eliminar uea asociados
					$stmtDel2 = $this->conexion->prepare('DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias IN (' . $in . ')');
					$stmtDel2->execute($idsPref);
					// eliminar preferencias
					$stmtDel3 = $this->conexion->prepare('DELETE FROM profesorpreferencias WHERE idProfesorPreferencias IN (' . $in . ')');
					$stmtDel3->execute($idsPref);
				}

				// eliminar contactos de emergencia
				$stmt = $this->conexion->prepare('DELETE FROM profesoremergencia WHERE profesor_numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				// finalmente eliminar el profesor
				$stmt = $this->conexion->prepare('DELETE FROM profesor WHERE numeroEconomico = ?');
				$stmt->execute([$idProfesor]);

				$this->conexion->commit();
				return true;
			} catch (Exception $e){
				$this->conexion->rollBack();
				throw $e;
			}
		}

		/**
		 * Actualizar datos básicos de un profesor.
		 * Retorna el registro actualizado como arreglo asociativo.
		 */
		public function actualizarProfesor(ProfesorVO $vo, ?int $oldNumeroEconomico = null): array {
			$sql = "UPDATE profesor SET numeroEconomico = ?, nombre = ?, celular = ?, correo_uam = ?, correo_personal = ?, idArea = ?, idGrado = ? WHERE numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			
			$targetId = ($oldNumeroEconomico !== null) ? $oldNumeroEconomico : (int)$vo->getNumeroEconomico();

			$stmt->execute([
				(int)$vo->getNumeroEconomico(),
				$vo->getNombre(),
				$vo->getCelular(),
				$vo->getCorreoUAM(),
				$vo->getCorreoP(),
				$vo->getIdArea(),
				$vo->getIdGrado(),
				$targetId
			]);
			
			// retornar fila actualizada
			$sql2 = "SELECT numeroEconomico, nombre, celular, correo_uam, correo_personal, idArea, idGrado FROM profesor WHERE numeroEconomico = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			// Use the NEW numeroEconomico to fetch
			$s2->execute([(int)$vo->getNumeroEconomico()]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: [];
		}

		public function actualizarArea(int $numeroEconomico, ?int $idArea): bool {
			$sql = "UPDATE profesor SET idArea = ? WHERE numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			return $stmt->execute([$idArea, $numeroEconomico]);
		}

		public function actualizarGrado(int $numeroEconomico, ?int $idGrado): bool {
			$sql = "UPDATE profesor SET idGrado = ? WHERE numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			return $stmt->execute([$idGrado, $numeroEconomico]);
		}

		/* ------------------ Area academica / grupotematico helpers ------------------ */

		public function obtenerAreaAcademicaIdPorNombreYPuesto(string $nombre, bool $esJefe): ?int {
			$sql = "SELECT idAreaAcademica FROM areaacademica WHERE nombre = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombre]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ? (int)$row['idAreaAcademica'] : null;
		}

		/**
		 * Obtener una fila de areaacademica por su id.
		 */
		public function obtenerAreaAcademicaPorId(int $idAreaAcademica): ?array {
			$sql = "SELECT idAreaAcademica, nombre FROM areaacademica WHERE idAreaAcademica = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idAreaAcademica]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		public function obtenerProfesorVinculadoAreaAcademica(int $idAreaAcademica): ?array {
			$sql = "SELECT p.numeroEconomico, p.nombre FROM areaacademica_has_profesor aap JOIN profesor p ON aap.profesor_numeroEconomico = p.numeroEconomico WHERE aap.areaAcademica_idAreaAcademica = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idAreaAcademica]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		public function insertarAreaAcademicaHasProfesor(int $idAreaAcademica, int $idProfesor): bool {
			try{
				$stmt = $this->conexion->prepare('INSERT IGNORE INTO areaacademica_has_profesor (areaAcademica_idAreaAcademica, profesor_numeroEconomico) VALUES (?, ?)');
				return $stmt->execute([$idAreaAcademica, $idProfesor]);
			} catch (Exception $e){ return false; }
		}

		public function eliminarAreaAcademicaHasProfesor(int $idAreaAcademica, int $idProfesor): bool {
			$stmt = $this->conexion->prepare('DELETE FROM areaacademica_has_profesor WHERE areaAcademica_idAreaAcademica = ? AND profesor_numeroEconomico = ?');
			return $stmt->execute([$idAreaAcademica, $idProfesor]);
		}

		// Grupo tematico equivalents
		public function obtenerGrupoTematicoIdPorNombreYPuesto(string $nombre, bool $esJefe): ?int {
			if ($esJefe) {
				$sql = "SELECT idGrupoTematico FROM grupotematico WHERE nombreGrupo = ? AND puesto LIKE '%jef%' LIMIT 1";
			} else {
				$sql = "SELECT idGrupoTematico FROM grupotematico WHERE nombreGrupo = ? AND puesto NOT LIKE '%jef%' LIMIT 1";
			}
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$nombre]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ? (int)$row['idGrupoTematico'] : null;
		}

		public function obtenerProfesorVinculadoGrupoTematico(int $idGrupoTematico): ?array {
			$sql = "SELECT p.numeroEconomico, p.nombre FROM grupotematico_has_profesor gtp JOIN profesor p ON gtp.profesor_numeroEconomico = p.numeroEconomico WHERE gtp.grupoTematico_idGrupoTematico = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idGrupoTematico]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Obtener grupo temático por id (devuelve idGrupoTematico, nombreGrupo as nombre, puesto)
		 */
		public function obtenerGrupoTematicoPorId(int $idGrupoTematico): ?array {
			$sql = "SELECT idGrupoTematico, nombreGrupo AS nombre, puesto FROM grupotematico WHERE idGrupoTematico = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$idGrupoTematico]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		public function insertarGrupoTematicoHasProfesor(int $idGrupoTematico, int $idProfesor): bool {
			try{
				$stmt = $this->conexion->prepare('INSERT IGNORE INTO grupotematico_has_profesor (grupoTematico_idGrupoTematico, profesor_numeroEconomico) VALUES (?, ?)');
				return $stmt->execute([$idGrupoTematico, $idProfesor]);
			} catch (Exception $e){ return false; }
		}

		public function eliminarGrupoTematicoHasProfesor(int $idGrupoTematico, int $idProfesor): bool {
			$stmt = $this->conexion->prepare('DELETE FROM grupotematico_has_profesor WHERE grupoTematico_idGrupoTematico = ? AND profesor_numeroEconomico = ?');
			return $stmt->execute([$idGrupoTematico, $idProfesor]);
		}

		/**
		 * Eliminar un contacto de emergencia por su id y profesor.
		 * Retorna true si se eliminó alguna fila.
		 */
		public function eliminarProfesorEmergencia(int $idProfesorEmergencia, int $idProfesor): bool {
			$stmt = $this->conexion->prepare('DELETE FROM profesoremergencia WHERE idProfesorEmergencia = ? AND profesor_numeroEconomico = ?');
			return $stmt->execute([$idProfesorEmergencia, $idProfesor]);
		}

		/**
		 * Actualizar un contacto de emergencia existente.
		 * Retorna la fila actualizada como arreglo asociativo o null si no existe/ocurre error.
		 */
		public function actualizarProfesorEmergencia(int $idProfesorEmergencia, int $idProfesor, string $nombre, string $parentesco, string $celular): ?array {
			$sql = "UPDATE profesoremergencia SET nombre = ?, parentesco = ?, celular = ? WHERE idProfesorEmergencia = ? AND profesor_numeroEconomico = ?";
			$stmt = $this->conexion->prepare($sql);
			$ok = $stmt->execute([$nombre, $parentesco, $celular, $idProfesorEmergencia, $idProfesor]);
			if (!$ok) return null;
			$sql2 = "SELECT idProfesorEmergencia, profesor_numeroEconomico, nombre, parentesco, celular FROM profesoremergencia WHERE idProfesorEmergencia = ? AND profesor_numeroEconomico = ? LIMIT 1";
			$s2 = $this->conexion->prepare($sql2);
			$s2->execute([$idProfesorEmergencia, $idProfesor]);
			$row = $s2->fetch(PDO::FETCH_ASSOC);
			return $row ?: null;
		}

		/**
		 * Actualizar o insertar el tipo de contrato para un profesor.
		 */
		public function actualizarTipoContrato(int $numeroEconomico, int $idTipo): bool {
			// Verificar si existe contrato previo
			$sql = "SELECT idProfesorContrato FROM profesorcontrato WHERE profesor_numeroEconomico = ? LIMIT 1";
			$stmt = $this->conexion->prepare($sql);
			$stmt->execute([$numeroEconomico]);
			$row = $stmt->fetch(PDO::FETCH_ASSOC);

			if ($row) {
				$sqlUpd = "UPDATE profesorcontrato SET profesortipo_idProfesorTipo = ? WHERE idProfesorContrato = ?";
				$stmtUpd = $this->conexion->prepare($sqlUpd);
				return $stmtUpd->execute([$idTipo, $row['idProfesorContrato']]);
			} else {
				$sqlIns = "INSERT INTO profesorcontrato (profesor_numeroEconomico, profesortipo_idProfesorTipo, descripcion) VALUES (?, ?, '')";
				$stmtIns = $this->conexion->prepare($sqlIns);
				return $stmtIns->execute([$numeroEconomico, $idTipo]);
			}
		}

		public function actualizarGradoYAreaBatch(array $items): array {
			$sql = "UPDATE profesor
					SET idArea = ?,
						idGrado = (SELECT idGrado FROM grado_estudios WHERE nombre = ? LIMIT 1)
					WHERE numeroEconomico = ?";
			
			try {
				$stmt = $this->conexion->prepare($sql);
			} catch (Exception $e) {
				return [
					'isItOk' => false, 
					'error_prepare' => $e->getMessage()
				];
			}

			$stats = [
				'successes' => 0,
				'errors' => 0,
				'details' => []
			];

			foreach ($items as $item) {
				$ne = $item['numeroEconomico'] ?? null;
				if (!$ne) {
					$stats['errors']++;
					$stats['details'][] = "Fila sin número económico";
					continue;
				}

				try {
					// $item expects: ['numeroEconomico' => 123, 'grado' => 'Doctorado', 'idArea' => 1111]
					$exec = $stmt->execute([
						$item['idArea'],
						$item['grado'],
						$ne
					]);
					
					if ($exec) {
						$stats['successes']++;
					} else {
						$stats['errors']++;
						$info = $stmt->errorInfo();
						$stats['details'][] = "Error en número económico: $ne -> " . ($info[2] ?? 'Unknown error');
					}
				} catch (Exception $e) {
					$stats['errors']++;
					$stats['details'][] = "PHP - Exception en número económico: $ne -> " . $e->getMessage();
				}
			}
			
			$stats['isItOk'] = true;
			return $stats;
		}
	}
?>
