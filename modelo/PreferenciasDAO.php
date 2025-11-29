<?php
	class PreferenciasDAO{
		public $conexion;
		/**
		 * Último mensaje de error capturado por el DAO (debug temporal)
		 * @var string|null
		 */
		private $lastError = null;

		public function __construct($conexion){
			$this->conexion=$conexion;
		}

		public function __destruct(){ }

		public function profesoresCP(): array{
			$profesoresCP = array();
			$sql = "SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre, p.correo_uam, p.correo_personal, sp.noGrupos, sp.observaciones
						FROM dbappcb.profesor as p
						INNER JOIN dbappcb.solicitud_profesor as sp
						ON p.idProfesor=sp.idProfesor;";
			$result = $this->conexion->query($sql);
			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					$row['nombre'],
					$row['correo_uam'],
					$row['correo_personal']
				);
				$prefP= new PreferenciasProfesorVO(
					$prof,
					$row['noGrupos'],
					$row['observaciones'],
				);
				array_push($profesoresCP, $prefP->toJSON());
			}
			return $profesoresCP;
		}

		public function profesoresSP(): array{
			$profesoresCP = array();
			$sql = "SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre, p.correo_uam, p.correo_personal
						FROM dbappcb.profesor as p";
			$result = $this->conexion->query($sql);
			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					$row['nombre'],
					$row['correo_uam'],
					$row['correo_personal']
				);
				$prefP= new PreferenciasProfesorVO(
					$prof,
					1,
					"Sin preferncias llenadas",
				);
				array_push($profesoresCP, $prefP->toJSON());
			}
			return $profesoresCP;
		}

		public function profesoresPreferenciasNomb($buscNombre): array{
			$profesoresCP = array();
			$sql = "SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre, p.correo_uam, p.correo_personal, sp.noGrupos, sp.observaciones
					FROM dbappcb.profesor as p
					INNER JOIN dbappcb.solicitud_profesor as sp ON p.idProfesor=sp.idProfesor
					UNION
					SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre, p.correo_uam, p.correo_personal, sp.noGrupos, sp.observaciones FROM dbappcb.profesor as p
					LEFT JOIN dbappcb.solicitud_profesor as sp ON p.idProfesor=sp.idProfesor
                WHERE sp.idProfesor IS NULL";
			$result = $this->conexion->query($sql);

			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				if (stristr(mb_strtoupper($row['nombre'], 'utf-8'), mb_strtoupper($buscNombre, 'utf-8'))) {
					$prof = new ProfesorVO(
						$row['idProf'],
						$row['noEconomico'],
						$row['nombre'],
						$row['correo_uam'],
						$row['correo_personal']
					);
					if ($row['noGrupos'] == null || $row['observaciones'] == null) {
						$prefP = new PreferenciasProfesorVO(
							$prof,
							-1,
							"No lleno sus preferencias",
						);
					} else {
						$prefP = new PreferenciasProfesorVO(
							$prof,
							$row['noGrupos'],
							$row['observaciones'],
						);
					}
					array_push($profesoresCP, $prefP->toJSON());
				}
			}
			return $profesoresCP;
		}

		public function profesoresPreferenciasNum($buscNE): array{
			$profesoresCP = array();
			$sql = "SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre, p.correo_uam, p.correo_personal, sp.noGrupos, sp.observaciones
					FROM dbappcb.profesor as p
					INNER JOIN dbappcb.solicitud_profesor as sp
					ON p.idProfesor=sp.idProfesor
					WHERE p.numeroEconomico= {$buscNE};";
			$result = $this->conexion->query($sql);

			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					$row['nombre'],
					$row['correo_uam'],
					$row['correo_personal']
				);
				$prefP = new PreferenciasProfesorVO(
					$prof,
					$row['noGrupos'],
					$row['observaciones'],
				);
				array_push($profesoresCP, $prefP->toJSON());
			}
			return $profesoresCP;
		}

		public function preferenciasProfesorNE( $nEconomico): array{
			$preferenciasUEA = array();
			$sql = 'SELECT suea.idSol_uea, suea.prioridad, uea.claveUEA, uea.nombre AS nombreUEA, 
				p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre AS nombreP, p.correo_personal, p.correo_uam,
				sp.noGrupos, sp.observaciones
				FROM dbappcb.solicitud_uea as suea
				INNER JOIN dbappcb.uea as uea ON uea.idUEA= suea.uea_idUEA
				INNER JOIN dbappcb.profesor as p ON suea.profesor_idProfesor= p.idProfesor
				INNER JOIN dbappcb.solicitud_profesor as sp ON sp.idProfesor= p.idProfesor
				WHERE p.numeroEconomico='.$nEconomico;
			
			$result = $this->conexion->query($sql)->fetch(PDO::FETCH_ASSOC);
			if($result ){
				$result = $this->conexion->query($sql);
				while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
					$prof = new ProfesorVO(
						$row['idProf'],
						$row['noEconomico'],
						$row['nombreP'],
						$row['correo_uam'],
						$row['correo_personal']
					);
					$prefP= new PreferenciasProfesorVO(
						$prof,
						$row['noGrupos'],
						$row['observaciones'],
					);
					$prefUEA= new PreferenciasUEAVO(
						$prefP,
						$row['prioridad'],
						$row['claveUEA'],
						$row['nombreUEA']
					);
					array_push($preferenciasUEA, $prefUEA->toJSON());
				}
			} else {
				// fallback: profesor exists but has no solicitudes - adapt to new schema and aliases
				$sql = 'SELECT p.idProfesor AS idProf, p.numeroEconomico AS noEconomico, p.nombre AS nombreP, p.correo_personal, p.correo_uam FROM dbappcb.profesor as p WHERE p.numeroEconomico=' . $nEconomico;
				
				$result = $this->conexion->query($sql);
				while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
					$prof = new ProfesorVO(
						$row['idProf'],
						$row['noEconomico'],
						$row['nombreP'],
						$row['correo_uam'],
						$row['correo_personal']
					);
					$prefP= new PreferenciasProfesorVO(
						$prof,
						-1,
						"Sin preferencias enviadas",
					);
					$prefUEA= new PreferenciasUEAVO(
						$prefP,
						-1, //$row['prioridad'],
						-1, //$row['claveUEA']
						"" //$row['nombreUEA']
					);
					array_push($preferenciasUEA, $prefUEA->toJSON());
				}
			}
			
			return $preferenciasUEA;
		}

		public function preferenciasProgramacionProfesorNEyCUEA($nEconomico, $claveUEA): array{
			$grupos = array();

			$sql = 'SELECT p.noEconomico, p.nombre as "nombreP", gpr.idGrupo, gpr.claveGrupo, uea.claveUEA, uea.nombre as "nombreUEA"
				FROM dbappcb.Programacion as pgr
				INNER JOIN dbappcb.Grupo as gpr ON pgr.idGrupo=gpr.idGrupo
				INNER JOIN dbappcb.Profesor as p ON p.idProf=pgr.idProf
				INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA
				WHERE p.noEconomico= '. $nEconomico.' AND uea.claveUEA= '. $claveUEA.';';

			$result = $this->conexion->query($sql);

			while ($row = $result->fetch(PDO::FETCH_ASSOC)) {
				$uea = new UEAVO(
					$row['nombreUEA'],
					$row['claveUEA'],
					0
				);
				$grupo = new GrupoVO(
					$row['idGrupo'],
					$row['claveGrupo'],
					0,
					$uea,
					new HorarioVO(
						0,
						0,
						0,
						0,
						0
					)
				);
				$prof = new ProfesorVO(
					0,
					$row['noEconomico'],
					$row['nombreP'],
					0,
					0
				);
				$programacion = new ProgramacionProfesorVO(
					$prof,
					$grupo
				);
				array_push($grupos, $programacion->toJSON());
			}
			return $grupos;
		}

		public function borrarPreferenciasNEconomico($nE, $cUEA, $cGpr){
			$sql = "DELETE pgr
				FROM dbappcb.Programacion as pgr
				INNER JOIN dbappcb.Grupo as gpr ON pgr.idGrupo=gpr.idGrupo
				INNER JOIN dbappcb.Profesor as p ON p.idProf=pgr.idProf
				INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA
				WHERE p.noEconomico= {$nE} AND uea.claveUEA= {$cUEA} AND gpr.idGrupo={$cGpr};";
			$this->conexion->query($sql);
		}
		
		public function borrarPreferenciaUEA($nE, $cUEA){
			$sql = "DELETE suea FROM dbappcb.solicitud_uea as suea 
				inner join dbappcb.Profesor as p ON suea.idProf=p.idProf
				inner join dbappcb.UEA as uea ON suea.idUEA=uea.idUEA
				WHERE p.noEconomico= {$nE} AND uea.claveUEA= {$cUEA};";
			$this->conexion->query($sql);
		}

		public function HorarioGruposPrefernciasNEyUEA($nEconomico, $claveUEA): array{
			$horariosNoPedidos = array();
			$gruposHorariosNoPedidos = array();

			$sqlHorariosNoPedidos= "SELECT h.idHorario FROM (dbappcb.solicitud_horario as sh INNER JOIN Profesor as p ON sh.idProf = p.idProf AND p.noEconomico= {$nEconomico}) RIGHT JOIN Horario as h ON sh.idHorario = h.idHorario WHERE sh.idHorario is NULL;";
			
			// obtenemos los ID de los horarios que no ha pedido el profesor 
			$x= $this->conexion->query($sqlHorariosNoPedidos);
			while ( $row =$x->fetch(PDO::FETCH_ASSOC)) {
				array_push( $horariosNoPedidos, $row['idHorario']);
			}

			// obtenemos las claves de los grupos que tienen alguno de los horarios que no pidio el profesor
			if( count( $horariosNoPedidos) != 0){
				$sqlGruposHorariosNoPedidos= "SELECT g.claveGrupo FROM dbappcb.Grupo_Horario as gh INNER JOIN Horario as h ON gh.idHorario= h.idHorario INNER JOIN Grupo as g ON g.idGrupo=gh.idGrupo INNER JOIN UEA as uea ON uea.idUEA= g.idUEA AND uea.claveUEA= {$claveUEA} AND ( ";
			
				$inicio= true;
				foreach ($horariosNoPedidos as $id) {
					if ($inicio) {
						$sqlGruposHorariosNoPedidos.= "h.idHorario= {$id}";
						$inicio= false;
					} else {
						$sqlGruposHorariosNoPedidos.= " OR h.idHorario= {$id}";
					}
				}
				$sqlGruposHorariosNoPedidos.= " );";

				$x= $this->conexion->query($sqlGruposHorariosNoPedidos);
				while ( $row =$x->fetch(PDO::FETCH_ASSOC)) {
					array_push( $gruposHorariosNoPedidos, $row['claveGrupo']);
				}
			}

			$grupos = array();
			$dProgamadas = array();
			$GprsTraslapados = array();
			
			$sqlGprsProfRegistrado= "SELECT gpr.claveGrupo, uea.claveUEA, sh.idHorario, h.dia, h.horaInicio, h.horaFin
					FROM dbappcb.Grupo as gpr
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA
					INNER JOIN dbappcb.Grupo_Horario as gprH ON gprH.idGrupo= gpr.idGrupo
					INNER JOIN dbappcb.Horario as h ON h.idHorario= gprH.idHorario
					INNER JOIN dbappcb.solicitud_horario as sh ON sh.idHorario= h.idHorario
					INNER JOIN dbappcb.Profesor as p ON sh.idProf= p.idProf
					WHERE p.noEconomico= {$nEconomico} AND uea.claveUEA= {$claveUEA} ORDER BY gpr.claveGrupo ASC, sh.idHorario;"
			;

			$sqlGprsProgramados = "SELECT p.idProf, p.noEconomico, p.nombre, grp.idGrupo, grp.claveGrupo, grp.idUEA, h.idHorario, h.dia, h.horaInicio, h.horaFin
					FROM dbappcb.Programacion as prg
					INNER JOIN dbappcb.Profesor as p ON prg.idProf= p.idProf
					INNER JOIN dbappcb.Grupo as grp ON grp.idGrupo= prg.idGrupo
					INNER JOIN dbappcb.Grupo_Horario as gph ON gph.idGrupo= grp.idGrupo
					INNER JOIN dbappcb.Horario as h On gph.idHorario= h.idHorario
					WHERE p.noEconomico= {$nEconomico} ORDER BY grp.claveGrupo ASC;"
			;

			// sacamos los dias y horas en que tiene programacion el profesor 
			$rGprsProgramados = $this->conexion->query($sqlGprsProgramados);
			while ($row = $rGprsProgramados->fetch(PDO::FETCH_ASSOC)) {
				array_push( $dProgamadas, $row);
			}
			
			$rGprsFiltrado = $this->conexion->query($sqlGprsProfRegistrado);
			$pattern = "/(?:(\d{2})(?::{1}(\d{2})))/";
			while ($row = $rGprsFiltrado->fetch(PDO::FETCH_ASSOC)) {
				foreach ($dProgamadas as $idH) {
					preg_match_all($pattern, $idH['horaInicio'], $matches ,PREG_SET_ORDER );
					$profeHoraI= $matches[0][1];
					preg_match_all($pattern, $idH['horaFin'], $matches ,PREG_SET_ORDER );
					$profeHoraF= $matches[0][1];
					if ( $idH['idHorario'] == $row['idHorario']) {
						array_push($GprsTraslapados, $row['claveGrupo']);
					} else if ( $idH['horaInicio'] == $row['horaInicio'] && $idH['dia'] == $row['dia']) {
						array_push($GprsTraslapados, $row['claveGrupo']);
					} else if ( $idH['dia'] == $row['dia']){
						preg_match_all($pattern, $row['horaInicio'], $matches ,PREG_SET_ORDER );
						$horaGrupoI= $matches[0][1];
						preg_match_all($pattern, $row['horaFin'], $matches ,PREG_SET_ORDER );
						$horaGrupoF= $matches[0][1];
						if ( ($profeHoraI> $horaGrupoI && $profeHoraI< $horaGrupoF) || ($horaGrupoI> $profeHoraI && $horaGrupoI< $profeHoraF)){
							array_push($GprsTraslapados, $row['claveGrupo']);
						}
					}
				}
			}
			$GprsTraslapados = array_unique($GprsTraslapados);
			
			$sqlGprsValidosI = "SELECT sh.idProf, p.noEconomico, uea.claveUEA, uea.nombre as 'nombreUEA', gpr.idGrupo, gpr.claveGrupo, sh.idHorario, h.dia, h.horaInicio, h.horaFin
					FROM dbappcb.Grupo as gpr
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA
					INNER JOIN dbappcb.Grupo_Horario as gprH ON gprH.idGrupo= gpr.idGrupo
					INNER JOIN dbappcb.Horario as h ON h.idHorario= gprH.idHorario
					INNER JOIN dbappcb.solicitud_horario as sh ON sh.idHorario= h.idHorario
					INNER JOIN dbappcb.Profesor as p ON sh.idProf= p.idProf
					WHERE p.noEconomico= {$nEconomico} AND uea.claveUEA= {$claveUEA} ";
			$sqlGprsValidosF= "ORDER BY gpr.claveGrupo , h.idHorario ASC;";

			foreach ($GprsTraslapados as $grupo) {
				$sqlGprsValidosI.= "AND claveGrupo!= '{$grupo}' ";
			}
			
			$sqlGprsProgramados = "SELECT uea.claveUEA, uea.nombre as 'nombreUEA', prof.noEconomico, prof.nombre as 'nombrePof', grp.claveGrupo
					FROM dbappcb.Programacion as p
					INNER JOIN dbappcb.Grupo as grp ON p.idGrupo= grp.idGrupo
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= grp.idUEA
					INNER JOIN dbappcb.Profesor as prof ON prof.idProf= p.idProf
					WHERE uea.claveUEA= {$claveUEA}
					;"
			;
			$rsqlGprsProgramados = $this->conexion->query($sqlGprsProgramados);
			while ($row = $rsqlGprsProgramados->fetch(PDO::FETCH_ASSOC)) {
				$sqlGprsValidosI .= "AND gpr.claveGrupo!= '{$row['claveGrupo']}' ";
			}

			$sqlGprsValidos = $sqlGprsValidosI . $sqlGprsValidosF;
			
			$rGprsValidos = $this->conexion->query($sqlGprsValidos);
			
			while ($row = $rGprsValidos->fetch(PDO::FETCH_ASSOC)) {
				$uea = new UEAVO(
					$row['nombreUEA'],
					$row['claveUEA'],
					0
				);
				$grupo = new GrupoVO(
					$row['idGrupo'],
					$row['claveGrupo'],
					0,
					$uea,
					new HorarioVO(
						$row['idHorario'],
						$row['dia'],
						$row['horaInicio'],
						$row['horaFin']
					)
				);
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					0,
					0,
					0
				);
				$programacion = new ProgramacionProfesorVO(
					$prof,
					$grupo
				);
				array_push($grupos, $programacion->toJSON());
			}
			return $grupos;
		}

		public function HorarioGruposNEyUEA($nEconomico, $claveUEA): array{
			$grupos = array();
			$dProgamadas = array();
			$GprsTraslapados = array();

			$sqlGprsProfRegistrado = "SELECT gpr.claveGrupo, uea.claveUEA, sh.idHorario, h.dia, h.horaInicio, h.horaFin FROM dbappcb.Grupo as gpr INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA INNER JOIN dbappcb.Grupo_Horario as gprH ON gprH.idGrupo= gpr.idGrupo INNER JOIN dbappcb.Horario as h ON h.idHorario= gprH.idHorario INNER JOIN dbappcb.solicitud_horario as sh ON sh.idHorario= h.idHorario INNER JOIN dbappcb.Profesor as p ON sh.idProf= p.idProf WHERE p.noEconomico= {$nEconomico} AND uea.claveUEA= {$claveUEA} ORDER BY gpr.claveGrupo ASC, sh.idHorario;";

			$sqlGprsProgramados = "SELECT p.idProf, p.noEconomico, p.nombre, grp.idGrupo, grp.claveGrupo, grp.idUEA, h.idHorario, h.dia, h.horaInicio, h.horaFin FROM dbappcb.Programacion as prg INNER JOIN dbappcb.Profesor as p ON prg.idProf= p.idProf INNER JOIN dbappcb.Grupo as grp ON grp.idGrupo= prg.idGrupo INNER JOIN dbappcb.Grupo_Horario as gph ON gph.idGrupo= grp.idGrupo INNER JOIN dbappcb.Horario as h On gph.idHorario= h.idHorario WHERE p.noEconomico= {$nEconomico} ORDER BY grp.claveGrupo ASC;";

			// sacamos los dias y horas en que tiene programacion el profesor 
			$rGprsProgramados = $this->conexion->query($sqlGprsProgramados);
			while ($row = $rGprsProgramados->fetch(PDO::FETCH_ASSOC)) {
				array_push($dProgamadas, $row['idHorario']);
			}
			// quitamos posible duplicidad
			$dProgamadas = array_unique($dProgamadas);
			// print_r($dProgamadas);

			$rGprsFiltrado = $this->conexion->query($sqlGprsProfRegistrado);
			while ($row = $rGprsFiltrado->fetch(PDO::FETCH_ASSOC)) {
				foreach ($dProgamadas as $idH) {
					if ($idH == $row['idHorario']) {
						array_push($GprsTraslapados, $row['claveGrupo']);
					}
				}
			}
			// quitamos posible duplicidad
			$GprsTraslapados = array_unique($GprsTraslapados);
			// print_r($GprsTraslapados);

			$sqlGprsValidosI = "SELECT p.idProf, p.noEconomico, uea.claveUEA, uea.nombre as 'nombreUEA', gpr.idGrupo, gpr.claveGrupo, h.idHorario, h.dia, h.horaInicio, h.horaFin FROM dbappcb.Grupo as gpr INNER JOIN dbappcb.UEA as uea ON uea.idUEA= gpr.idUEA INNER JOIN dbappcb.Grupo_Horario as gprH ON gprH.idGrupo= gpr.idGrupo INNER JOIN dbappcb.Horario as h ON h.idHorario= gprH.idHorario INNER JOIN dbappcb.solicitud_uea as suea ON suea.idUEA= uea.idUEA INNER JOIN dbappcb.Profesor as p ON suea.idProf= p.idProf WHERE p.noEconomico= {$nEconomico} AND uea.claveUEA= {$claveUEA} ";
			$sqlGprsValidosF = "ORDER BY gpr.claveGrupo ASC, h.idHorario;";

			foreach ($GprsTraslapados as $grupo) {
				$sqlGprsValidosI .= "AND claveGrupo!= '{$grupo}' ";
			}

			$sqlGprsProgramados = "SELECT uea.claveUEA, uea.nombre as 'nombreUEA', prof.noEconomico, prof.nombre as 'nombrePof', grp.claveGrupo
					FROM dbappcb.Programacion as p
					INNER JOIN dbappcb.Grupo as grp ON p.idGrupo= grp.idGrupo
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= grp.idUEA
					INNER JOIN dbappcb.Profesor as prof ON prof.idProf= p.idProf
					WHERE uea.claveUEA= {$claveUEA}
					;";
			$rsqlGprsProgramados = $this->conexion->query($sqlGprsProgramados);
			while ($row = $rsqlGprsProgramados->fetch(PDO::FETCH_ASSOC)) {
				$sqlGprsValidosI .= "AND gpr.claveGrupo!= '{$row['claveGrupo']}' ";
			}

			$sqlGprsValidos = $sqlGprsValidosI . $sqlGprsValidosF;
			// echo $sqlGprsValidos.'<br/>';

			$rGprsValidos = $this->conexion->query($sqlGprsValidos);

			while ($row = $rGprsValidos->fetch(PDO::FETCH_ASSOC)) {
				$uea = new UEAVO(
					$row['nombreUEA'],
					$row['claveUEA'],
					0
				);
				$grupo = new GrupoVO(
					$row['idGrupo'],
					$row['claveGrupo'],
					0,
					$uea,
					new HorarioVO(
						$row['idHorario'],
						$row['dia'],
						$row['horaInicio'],
						$row['horaFin']
					)
				);
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					0,
					0,
					0
				);
				$programacion = new ProgramacionProfesorVO(
					$prof,
					$grupo
				);
				array_push($grupos, $programacion->toJSON());
			}
			return $grupos;
		}

		public function InsertarGrupoProgramacion($idProf, $idGrp){
			$sql = "INSERT INTO `dbappcb`.`Programacion` (`idGrupo`, `idProf`) VALUES ( {$idGrp}, {$idProf});";
			$result = $this->conexion->query($sql);
			$result->fetch(PDO::FETCH_ASSOC);
		}
		
		public function InsertarPlaneacionProfesor($numEco, $claveUEA, $claveGrupo){
			$sqlIdGrp = 
				"SELECT grp.idGrupo, grp.claveGrupo, grp.cupo, uea.idUEA, uea.claveUEA, uea.nombre
						FROM dbappcb.Grupo as grp
						INNER JOIN dbappcb.UEA as uea ON uea.idUEA= grp.idUEA
						WHERE uea.claveUEA= {$claveUEA} AND grp.claveGrupo= '{$claveGrupo}';";
			$sqlIdProf = "SELECT * FROM dbappcb.Profesor where noEconomico={$numEco};";
			$result = $this->conexion->query($sqlIdGrp);
			$rowGrp = $result->fetch(PDO::FETCH_ASSOC);
				
			$result = $this->conexion->query($sqlIdProf);
			$rowProf = $result->fetch(PDO::FETCH_ASSOC);
			if ( $rowProf != null && $rowGrp != null){
				$idProfesor= $rowProf['idProf'];
				$idGrupo= $rowGrp['idGrupo'];
				
				$this->InsertarGrupoProgramacion( $idProfesor, $idGrupo);
			} else {
				return $numEco;
			}
		}

		public function mostrarProgramacionNE($nEconomico): array {
			$ueas = array();

			$sql = "SELECT p.idProf, p.noEconomico, p.nombre, grp.idGrupo, grp.claveGrupo, grp.idUEA, uea.claveUEA, uea.nombre as 'nombreUEA', h.idHorario, h.dia, h.horaInicio, h.horaFin
					FROM dbappcb.Programacion as prg
					INNER JOIN dbappcb.Profesor as p ON prg.idProf= p.idProf
					INNER JOIN dbappcb.Grupo as grp ON grp.idGrupo= prg.idGrupo
					INNER JOIN dbappcb.Grupo_Horario as gph ON gph.idGrupo= grp.idGrupo
					INNER JOIN dbappcb.Horario as h ON gph.idHorario= h.idHorario
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= grp.idUEA
					WHERE p.noEconomico= {$nEconomico} ORDER BY grp.claveGrupo ASC, uea.nombre;";

			$resultado = $this->conexion->query($sql);
			while ($row = $resultado->fetch(PDO::FETCH_ASSOC)) {
				$uea = new UEAVO(
					$row['nombreUEA'],
					$row['claveUEA'],
					0
				);
				$grupo = new GrupoVO(
					$row['idGrupo'],
					$row['claveGrupo'],
					0,
					$uea,
					new HorarioVO(
						$row['idHorario'],
						$row['dia'],
						$row['horaInicio'],
						$row['horaFin']
					)
				);
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					$row['nombre'],
					0,
					0
				);
				$programacion = new ProgramacionProfesorVO(
					$prof,
					$grupo
				);
				array_push($ueas, $programacion->toJSON());
			}
			return $ueas;
		}

		public function mostrarProgramacion( ): array{
			$ueas = array();

			$sql = "SELECT p.idProf, p.noEconomico, p.nombre, grp.idGrupo, grp.claveGrupo, grp.idUEA, uea.claveUEA, uea.nombre as 'nombreUEA', h.idHorario, h.dia, h.horaInicio, h.horaFin
					FROM dbappcb.Programacion as prg
					INNER JOIN dbappcb.Profesor as p ON prg.idProf= p.idProf
					INNER JOIN dbappcb.Grupo as grp ON grp.idGrupo= prg.idGrupo
					INNER JOIN dbappcb.Grupo_Horario as gph ON gph.idGrupo= grp.idGrupo
					INNER JOIN dbappcb.Horario as h ON gph.idHorario= h.idHorario
					INNER JOIN dbappcb.UEA as uea ON uea.idUEA= grp.idUEA
					ORDER BY p.noEconomico DESC, grp.claveGrupo;"
			;

			$resultado = $this->conexion->query($sql);
			while ($row = $resultado->fetch(PDO::FETCH_ASSOC)) {
				$uea = new UEAVO(
					$row['nombreUEA'],
					$row['claveUEA'],
					0
				);
				$grupo = new GrupoVO(
					$row['idGrupo'],
					$row['claveGrupo'],
					0,
					$uea,
					new HorarioVO(
						$row['idHorario'],
						$row['dia'],
						$row['horaInicio'],
						$row['horaFin']
					)
				);
				$prof = new ProfesorVO(
					$row['idProf'],
					$row['noEconomico'],
					$row['nombre'],
					0,
					0
				);
				$programacion = new ProgramacionProfesorVO(
					$prof,
					$grupo
				);
				array_push($ueas, $programacion->toJSON());
			}
			return $ueas;
		}

		/**
		 * Obtener las preferencias de un profesor para un trimestre específico.
		 * Retorna un array con 'profesor' (id, numeroEconomico, nombre), 'preferencia' (id, noGrupos, observaciones), 'ueas' y 'horarios'
		 */
		public function obtenerPreferenciasProfesorPorTrimestre(int $idTrimestre, int $idProfesor): array {
			// Resultado por defecto: null data
			$result = ['profesor' => null, 'preferencia' => null, 'ueas' => [], 'horarios' => []];

			// 1) Preferencia base
			$st = $this->conexion->prepare("SELECT pp.idProfesorPreferencias, pp.noGrupos, pp.observaciones, p.idProfesor, p.numeroEconomico, p.nombre
							FROM profesorpreferencias pp
							INNER JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
							WHERE pp.trimestre_idTrimestre = :idTr AND pp.profesor_idProfesor = :idP LIMIT 1");
			$st->execute([':idTr' => $idTrimestre, ':idP' => $idProfesor]);
			$base = $st->fetch(PDO::FETCH_ASSOC);
			if (!$base) return ['ok' => true, 'data' => null];

			$idPref = (int)$base['idProfesorPreferencias'];
			$result['profesor'] = [
				'idProfesor' => (int)$base['idProfesor'],
				'numeroEconomico' => (int)$base['numeroEconomico'],
				'nombre' => $base['nombre'],
			];
			$result['preferencia'] = [
				'id' => $idPref,
				'noGrupos' => isset($base['noGrupos']) ? (int)$base['noGrupos'] : null,
				'observaciones' => $base['observaciones'] ?? null,
			];

			// 2) UEAs con prioridad
			$stU = $this->conexion->prepare("SELECT u.idUEA, u.claveUEA, u.nombre, pu.prioridad
						FROM profesorpreferencia_has_uea pu
						INNER JOIN uea u ON u.idUEA = pu.uea_idUEA
						WHERE pu.profesorPreferencia_idProfesorPreferencias = :idPref
						ORDER BY pu.prioridad ASC");
			$stU->execute([':idPref' => $idPref]);
			$result['ueas'] = $stU->fetchAll(PDO::FETCH_ASSOC) ?: [];

			// 3) Horarios
			$stH = $this->conexion->prepare("SELECT h.idHorario, h.dia, h.horaInicio, h.horaFin
						FROM profesorpreferencia_has_horario ph
						INNER JOIN horario h ON h.idHorario = ph.horario_idHorario
						WHERE ph.profesorPreferencia_idProfesorPreferencias = :idPref
						ORDER BY FIELD(LOWER(h.dia),'lunes','martes','miercoles','jueves','viernes'), h.horaInicio");
			$stH->execute([':idPref' => $idPref]);
			$result['horarios'] = $stH->fetchAll(PDO::FETCH_ASSOC) ?: [];

			return $result;
		}

		/**
		 * Obtener todas las preferencias de profesores para un trimestre específico.
		 * Retorna un array de elementos con: numeroEconomico, nombre, noGrupos, observaciones, ueas (array up to 5), dias (array con llaves lunes..viernes => bool)
		 */
		public function obtenerPreferenciasPorTrimestreCompleto(int $idTrimestre): array {
			$out = [];
			try {
				$st = $this->conexion->prepare("SELECT pp.idProfesorPreferencias, pp.noGrupos, pp.observaciones, p.idProfesor, p.numeroEconomico, p.nombre
					FROM profesorpreferencias pp
					INNER JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
					WHERE pp.trimestre_idTrimestre = :idTr
					ORDER BY p.numeroEconomico ASC");
				$st->execute([':idTr' => $idTrimestre]);
				$rows = $st->fetchAll(PDO::FETCH_ASSOC);
				if (!$rows) return $out;

				$stU = $this->conexion->prepare("SELECT u.claveUEA, u.nombre FROM profesorpreferencia_has_uea pu INNER JOIN uea u ON u.idUEA = pu.uea_idUEA WHERE pu.profesorPreferencia_idProfesorPreferencias = :idPref ORDER BY pu.prioridad ASC LIMIT 5");
				$stH = $this->conexion->prepare("SELECT DISTINCT LOWER(h.dia) AS dia FROM profesorpreferencia_has_horario ph INNER JOIN horario h ON h.idHorario = ph.horario_idHorario WHERE ph.profesorPreferencia_idProfesorPreferencias = :idPref");

				foreach ($rows as $row) {
					$idPref = (int)$row['idProfesorPreferencias'];
					// UEAs
					$stU->execute([':idPref' => $idPref]);
					$ueas = $stU->fetchAll(PDO::FETCH_ASSOC) ?: [];
					// Horarios -> dias
					$stH->execute([':idPref' => $idPref]);
					$drows = $stH->fetchAll(PDO::FETCH_ASSOC) ?: [];
					$dias = ['lunes' => false, 'martes' => false, 'miercoles' => false, 'jueves' => false, 'viernes' => false];
					foreach ($drows as $dr) {
						$dn = strtolower(trim($dr['dia'] ?? ''));
						if (isset($dias[$dn])) $dias[$dn] = true;
					}

					$out[] = [
						'idPref' => $idPref,
						'idProfesor' => (int)$row['idProfesor'],
						'numeroEconomico' => $row['numeroEconomico'],
						'nombre' => $row['nombre'],
						'noGrupos' => isset($row['noGrupos']) ? (int)$row['noGrupos'] : null,
						'observaciones' => $row['observaciones'] ?? null,
						'ueas' => $ueas,
						'dias' => $dias
					];
				}
				return $out;
			} catch (Exception $e) {
				// en caso de error devolver arreglo vacío
				$this->lastError = $e->getMessage();
				return $out;
			}
		}

		/**
		 * Obtener, para una UEA e idTrimestre, el listado de profesores que la eligieron
		 * por prioridad (0..5). Devuelve un mapa prioridad => [ { idProfesor, numeroEconomico, nombre } ]
		 */
		public function obtenerProfesoresPorUEAEnTrimestre(int $idTrimestre, int $idUEA): array {
			$out = [0=>[],1=>[],2=>[],3=>[],4=>[],5=>[]];
			try{
				$sql = "SELECT pu.prioridad, p.idProfesor, p.numeroEconomico, p.nombre
					FROM profesorpreferencias pp
					INNER JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
					INNER JOIN profesorpreferencia_has_uea pu ON pu.profesorPreferencia_idProfesorPreferencias = pp.idProfesorPreferencias
					WHERE pp.trimestre_idTrimestre = :idTr AND pu.uea_idUEA = :idU
					ORDER BY pu.prioridad ASC, p.numeroEconomico ASC";
				$st = $this->conexion->prepare($sql);
				$st->execute([':idTr'=>$idTrimestre, ':idU'=>$idUEA]);
				$rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
				foreach ($rows as $r){
					$pri = isset($r['prioridad']) ? (int)$r['prioridad'] : 0;
					if (!isset($out[$pri])) $out[$pri] = [];
					$out[$pri][] = [
						'idProfesor' => (int)$r['idProfesor'],
						'numeroEconomico' => isset($r['numeroEconomico']) ? (int)$r['numeroEconomico'] : null,
						'nombre' => $r['nombre'] ?? ''
					];
				}
				return $out;
			} catch(Exception $e){
				return $out;
			}
		}

		/**
		 * Obtener los horarios de preferencias (por día y rango) de todos los profesores
		 * para un trimestre dado.
		 * Devuelve filas: { idProfesor, dia, horaInicio, horaFin }
		 */
		public function obtenerHorariosPreferenciasPorTrimestre(int $idTrimestre): array {
			try{
				$sql = "SELECT p.idProfesor, LOWER(h.dia) AS dia, DATE_FORMAT(h.horaInicio,'%H:%i') AS horaInicio, DATE_FORMAT(h.horaFin,'%H:%i') AS horaFin
					FROM profesorpreferencias pp
					INNER JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
					INNER JOIN profesorpreferencia_has_horario ph ON ph.profesorPreferencia_idProfesorPreferencias = pp.idProfesorPreferencias
					INNER JOIN horario h ON h.idHorario = ph.horario_idHorario
					WHERE pp.trimestre_idTrimestre = :idTr
					ORDER BY p.idProfesor, h.dia, h.horaInicio";
				$st = $this->conexion->prepare($sql);
				$st->execute([':idTr' => $idTrimestre]);
				$rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
				$out = [];
				foreach ($rows as $r){
					$out[] = [
						'idProfesor' => isset($r['idProfesor']) ? (int)$r['idProfesor'] : null,
						'dia' => strtolower($r['dia'] ?? ''),
						'horaInicio' => $r['horaInicio'] ?? '',
						'horaFin' => $r['horaFin'] ?? ''
					];
				}
				return $out;
			} catch(Exception $e){ return []; }
		}

		/**
		 * Obtener preferencias agregadas con filtros múltiples.
		 * - $trimestres: array de idTrimestre
		 * - $ueas: array de idUEA (si vacío => no filtra UEAs)
		 * - $profesores: array de idProfesor (si vacío => todos)
		 * Devuelve filas con columnas: trimestre, numeroEconomico, nombre, tipoProfesor, disciplina,
		 * noGrupos, uea0..uea5, lunes..viernes, observaciones
		 */
		public function obtenerPreferenciasMulti(array $trimestres = [], array $ueas = [], array $profesores = []): array {
			$params = [];
			$where = [];
			$existsUea = '';
			if (!empty($trimestres)) {
				$place = implode(',', array_fill(0, count($trimestres), '?'));
				$where[] = "t.idTrimestre IN ($place)";
				foreach ($trimestres as $idT) { $params[] = (int)$idT; }
			}
			if (!empty($profesores)) {
				$place = implode(',', array_fill(0, count($profesores), '?'));
				$where[] = "p.idProfesor IN ($place)";
				foreach ($profesores as $idP) { $params[] = (int)$idP; }
			}
			if (!empty($ueas)) {
				$place = implode(',', array_fill(0, count($ueas), '?'));
				$existsUea = " AND EXISTS (SELECT 1 FROM profesorpreferencia_has_uea pu2 WHERE pu2.profesorPreferencia_idProfesorPreferencias = pp.idProfesorPreferencias AND pu2.uea_idUEA IN ($place))";
				foreach ($ueas as $idU) { $params[] = (int)$idU; }
			}
			$whereSql = '';
			if (!empty($where)) { $whereSql = 'WHERE ' . implode(' AND ', $where); }

			// NOTA: agregamos filtro de UEAs como EXISTS en $existsUea si se proporcionó
			$sql = "SELECT 
				t.idTrimestre,
				CONCAT(t.año, ' - ', tp.sigla) AS trimestre,
				MAX(p.numeroEconomico) AS numeroEconomico,
				MAX(p.nombre) AS nombre,
				MAX(pt.nombre) AS tipoProfesor,
				MAX(aa.nombre) AS disciplina,
				MAX(pp.noGrupos) AS noGrupos,
				MAX(CASE WHEN pu.prioridad = 0 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea0,
				MAX(CASE WHEN pu.prioridad = 1 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea1,
				MAX(CASE WHEN pu.prioridad = 2 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea2,
				MAX(CASE WHEN pu.prioridad = 3 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea3,
				MAX(CASE WHEN pu.prioridad = 4 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea4,
				MAX(CASE WHEN pu.prioridad = 5 THEN CONCAT(u.claveUEA, ' - ', u.nombre) END) AS uea5,
				-- Usar DISTINCT para evitar filas duplicadas cuando las joins con UEAs/PU duplican registros
				GROUP_CONCAT(DISTINCT CASE WHEN LOWER(h.dia)='lunes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS lunes_raw,
				GROUP_CONCAT(DISTINCT CASE WHEN LOWER(h.dia)='martes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS martes_raw,
				GROUP_CONCAT(DISTINCT CASE WHEN LOWER(h.dia)='miercoles' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS miercoles_raw,
				GROUP_CONCAT(DISTINCT CASE WHEN LOWER(h.dia)='jueves' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS jueves_raw,
				GROUP_CONCAT(DISTINCT CASE WHEN LOWER(h.dia)='viernes' THEN CONCAT(DATE_FORMAT(h.horaInicio,'%H:%i'),'-',DATE_FORMAT(h.horaFin,'%H:%i')) END ORDER BY h.horaInicio SEPARATOR ', ') AS viernes_raw,
				MAX(pp.observaciones) AS observaciones
			FROM profesorpreferencias pp
			JOIN profesor p ON p.idProfesor = pp.profesor_idProfesor
			JOIN trimestre t ON t.idTrimestre = pp.trimestre_idTrimestre
			JOIN trimestreperiodo tp ON tp.idTrimestrePeriodo = t.trimestreperiodo_idTrimestrePeriodo
			LEFT JOIN profesorcontrato pc ON pc.profesor_idProfesor = p.idProfesor
			LEFT JOIN profesortipo pt ON pt.idProfesorTipo = pc.profesortipo_idProfesorTipo
			LEFT JOIN areaacademica_has_profesor ahp ON ahp.profesor_idProfesor = p.idProfesor
			LEFT JOIN areaacademica aa ON aa.idAreaAcademica = ahp.areaAcademica_idAreaAcademica
			LEFT JOIN profesorpreferencia_has_uea pu ON pu.profesorPreferencia_idProfesorPreferencias = pp.idProfesorPreferencias
			LEFT JOIN uea u ON u.idUEA = pu.uea_idUEA
			LEFT JOIN profesorpreferencia_has_horario ph ON ph.profesorPreferencia_idProfesorPreferencias = pp.idProfesorPreferencias
			LEFT JOIN horario h ON h.idHorario = ph.horario_idHorario
			$whereSql $existsUea
			GROUP BY p.idProfesor, t.idTrimestre
			ORDER BY t.año DESC, tp.sigla, p.numeroEconomico";

			try {
				$st = $this->conexion->prepare($sql);
				$st->execute($params);
				$rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
				$out = [];
				foreach ($rows as $r){
					$out[] = [
						'idTrimestre' => (int)$r['idTrimestre'],
						'trimestre' => $r['trimestre'],
						'numeroEconomico' => $r['numeroEconomico'],
						'nombre' => $r['nombre'],
						'tipoProfesor' => $r['tipoProfesor'] ?? '',
						'disciplina' => $r['disciplina'] ?? '',
						'noGrupos' => isset($r['noGrupos']) ? (int)$r['noGrupos'] : null,
						'uea0' => $r['uea0'] ?? '',
						'uea1' => $r['uea1'] ?? '',
						'uea2' => $r['uea2'] ?? '',
						'uea3' => $r['uea3'] ?? '',
						'uea4' => $r['uea4'] ?? '',
						'uea5' => $r['uea5'] ?? '',
						'lunes' => $r['lunes_raw'] ?: '',
						'martes' => $r['martes_raw'] ?: '',
						'miercoles' => $r['miercoles_raw'] ?: '',
						'jueves' => $r['jueves_raw'] ?: '',
						'viernes' => $r['viernes_raw'] ?: '',
						'observaciones' => $r['observaciones'] ?? ''
					];
				}
				return $out;
			} catch (Exception $e) {
				return [];
			}
		}

		/**
		 * Insertar preferencia de profesor usando el procedimiento almacenado INSERTA_PREFERENCIA_PROFESOR
		 * Retorna true si se ejecutó correctamente, false en caso de error.
		 */
		public function insertarPreferenciaProfesor(string $trimPeriodo, int $trimAno, int $noEco, ?string $obs, int $noGrupos): bool {
			try {
				$st = $this->conexion->prepare("CALL INSERTA_PREFERENCIA_PROFESOR(:trimPeriodo, :trimAno, :noEco, :obs, :noGrupos)");
				$st->execute([':trimPeriodo' => $trimPeriodo, ':trimAno' => $trimAno, ':noEco' => $noEco, ':obs' => $obs, ':noGrupos' => $noGrupos]);
				return true;
			} catch (Exception $e) {
				// guardar el mensaje de error para depuración temporal
				$this->lastError = $e->getMessage();
				return false;
			}
		}

		/**
		 * Retorna el último mensaje de error capturado por este DAO.
		 * Uso: debug temporal, remover antes de producción o controlar mediante flag.
		 * @return string|null
		 */
		public function getLastError(){
			return $this->lastError;
		}

		/**
		 * Obtener el id de profesorpreferencias para un periodo/año y número económico.
		 * Retorna el id (int) o null si no se encuentra.
		 */
		public function obtenerIdPreferenciaPorPeriodoAnoYNoEco(string $trimPeriodo, int $trimAno, int $noEco){
			try{
				$st = $this->conexion->prepare(
					"SELECT pp.idProfesorPreferencias FROM profesorpreferencias pp
					 JOIN trimestre t ON pp.trimestre_idTrimestre = t.idTrimestre
					 JOIN trimestreperiodo tp ON t.trimestreperiodo_idTrimestrePeriodo = tp.idTrimestrePeriodo
					 JOIN profesor p ON pp.profesor_idProfesor = p.idProfesor
					 WHERE tp.sigla = :sigla AND t.año = :anio AND p.numeroEconomico = :noEco LIMIT 1"
				);
				$st->execute([':sigla'=>$trimPeriodo, ':anio'=>$trimAno, ':noEco'=>$noEco]);
				$r = $st->fetch(PDO::FETCH_ASSOC);
				if ($r && isset($r['idProfesorPreferencias'])) return (int)$r['idProfesorPreferencias'];
				return null;
			} catch (Exception $e){
				return null;
			}
		}

		/**
		 * Insertar vínculo directo horario <-> preferencia (INSERT IGNORE)
		 */
		public function insertarHorarioPreferenciaDirecto(int $idPref, int $idHorario): bool {
			try{
				$st = $this->conexion->prepare("INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (:idH, :idP)");
				return $st->execute([':idH'=>$idHorario, ':idP'=>$idPref]);
			} catch(Exception $e){
				return false;
			}
		}

		/**
		 * Invocar el procedimiento almacenado que genera variantes de horarios a partir de un idHorario
		 * CALL INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL(_idProfesorPreferencias, _idHorarioUno)
		 */
		/**
		 * Invocar el procedimiento almacenado que genera variantes de horarios a partir de un idHorario
		 * Ahora acepta número económico y idTrimestre para localizar la preferencia del trimestre destino.
		 * CALL INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL(_noEco, _idHorarioUno, _idTrimestre)
		 */
		public function insertarPreferenciaProfesorHorarioEspecial(int $noEco, int $idHorarioUno, int $idTrimestre): bool {
			try{
				$st = $this->conexion->prepare("CALL INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL(:noEco, :idH, :idTr)");
				$ok = $st->execute([':noEco'=>$noEco, ':idH'=>$idHorarioUno, ':idTr'=>$idTrimestre]);
				if (!$ok) {
					// guardar último error si es posible
					$this->lastError = implode(" | ", $st->errorInfo());
				}
				return $ok;
			} catch(Exception $e){
				$this->lastError = $e->getMessage();
				return false;
			}
		}

		/**
		 * Invocar el procedimiento para el caso de 3 horarios contiguos (ventana de 4:30)
		 * CALL INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS(_noEco, _idHorarioUno, _idTrimestre)
		 */
		public function insertarPreferenciaProfesorHorarioEspecialDos(int $noEco, int $idHorarioUno, int $idTrimestre): bool {
			try{
				$st = $this->conexion->prepare("CALL INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS(:noEco, :idH, :idTr)");
				$ok = $st->execute([':noEco'=>$noEco, ':idH'=>$idHorarioUno, ':idTr'=>$idTrimestre]);
				if (!$ok) { $this->lastError = implode(" | ", $st->errorInfo()); }
				return $ok;
			} catch(Exception $e){
				$this->lastError = $e->getMessage();
				return false;
			}
		}

		/**
		 * Borrar todas las preferencias de un profesor para un trimestre dado.
		 * Elimina filas en: profesorpreferencia_has_uea, profesorpreferencia_has_horario y profesorpreferencias
		 * Retorna un arreglo con el resultado y contadores de filas eliminadas.
		 * @param int $idProfesor
		 * @param int $idTrimestre
		 * @return array ['ok'=>bool, 'deleted_uea'=>int, 'deleted_horario'=>int, 'deleted_preferencias'=>int, 'error' => string?]
		 */
		public function borrarPreferenciasPorIdProfesorYTrimestre(int $idProfesor, int $idTrimestre): array {
			try {
				$this->conexion->beginTransaction();
				$st = $this->conexion->prepare("SELECT idProfesorPreferencias FROM profesorpreferencias WHERE profesor_idProfesor = :idP AND trimestre_idTrimestre = :idTr");
				$st->execute([':idP' => $idProfesor, ':idTr' => $idTrimestre]);
				$ids = $st->fetchAll(PDO::FETCH_COLUMN, 0);
				if (!$ids || count($ids) === 0) {
					$this->conexion->commit();
					return ['ok' => true, 'deleted_uea' => 0, 'deleted_horario' => 0, 'deleted_preferencias' => 0];
				}
				$placeholders = implode(',', array_fill(0, count($ids), '?'));
				// eliminar UEAs vinculadas
				$st1 = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias IN ($placeholders)");
				$st1->execute($ids);
				$deleted_uea = $st1->rowCount();
				// eliminar horarios vinculados
				$st2 = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias IN ($placeholders)");
				$st2->execute($ids);
				$deleted_horario = $st2->rowCount();
				// eliminar la(s) preferencia(s)
				$st3 = $this->conexion->prepare("DELETE FROM profesorpreferencias WHERE idProfesorPreferencias IN ($placeholders)");
				$st3->execute($ids);
				$deleted_pref = $st3->rowCount();
				$this->conexion->commit();
				return ['ok' => true, 'deleted_uea' => $deleted_uea, 'deleted_horario' => $deleted_horario, 'deleted_preferencias' => $deleted_pref];
			} catch (Exception $e) {
				try { $this->conexion->rollBack(); } catch(Exception $_) {}
				$this->lastError = $e->getMessage();
				return ['ok' => false, 'error' => $e->getMessage()];
			}
		}

		/**
		 * Insertar una UEA (prioridad) para una preferencia de profesor usando
		 * el procedimiento almacenado INSERTA_PREFERENCIA_PROFESOR_UEA
		 */
		public function insertarPreferenciaProfesorUEA(string $trimPeriodo, int $trimAno, int $noEco, int $uea, int $prior): bool {
			try {
				$st = $this->conexion->prepare("CALL INSERTA_PREFERENCIA_PROFESOR_UEA(:trimPeriodo, :trimAno, :noEco, :uea, :prior)");
				$st->execute([':trimPeriodo' => $trimPeriodo, ':trimAno' => $trimAno, ':noEco' => $noEco, ':uea' => $uea, ':prior' => $prior]);
				return true;
			} catch (Exception $e) {
				return false;
			}
		}

		/**
		 * Asegura la existencia de un registro base en profesorpreferencias para (idTrimestre, idProfesor).
		 * Si existe, retorna su id. Si no existe, lo crea con datos genéricos y retorna el nuevo id.
		 */
		public function ensurePreferenciaBase(int $idTrimestre, int $idProfesor): ?int {
			try{
				$this->conexion->beginTransaction();
				$st = $this->conexion->prepare("SELECT idProfesorPreferencias FROM profesorpreferencias WHERE trimestre_idTrimestre = :idTr AND profesor_idProfesor = :idP LIMIT 1");
				$st->execute([':idTr'=>$idTrimestre, ':idP'=>$idProfesor]);
				$r = $st->fetch(PDO::FETCH_ASSOC);
				if ($r && isset($r['idProfesorPreferencias'])){
					$this->conexion->commit();
					return (int)$r['idProfesorPreferencias'];
				}
				$ins = $this->conexion->prepare("INSERT INTO profesorpreferencias (trimestre_idTrimestre, profesor_idProfesor, noGrupos, observaciones) VALUES (:idTr, :idP, NULL, 'Creada automáticamente')");
				$ok = $ins->execute([':idTr'=>$idTrimestre, ':idP'=>$idProfesor]);
				if (!$ok){ $this->conexion->rollBack(); return null; }
				$id = (int)$this->conexion->lastInsertId();
				$this->conexion->commit();
				return $id;
			} catch(Exception $e){ try{ if ($this->conexion->inTransaction()) $this->conexion->rollBack(); }catch(Exception $_){} return null; }
		}


		/**
		 * Verifica si existe una preferencia para un profesor en un trimestre dado.
		 * Retorna true si existe, false en caso contrario.
		 */
		public function existePreferencia(int $idTrimestre, int $idProfesor): bool {
			try{
				$st = $this->conexion->prepare("SELECT 1 FROM profesorpreferencias WHERE trimestre_idTrimestre = :idTr AND profesor_idProfesor = :idP LIMIT 1");
				$st->execute([':idTr'=>$idTrimestre, ':idP'=>$idProfesor]);
				$r = $st->fetch(PDO::FETCH_COLUMN);
				return (bool)$r;
			} catch (Exception $e){
				return false;
			}
		}

		/**
		 * Inserta una UEA en profesorpreferencia_has_uea con una prioridad dada.
		 */
		public function insertarUEAEnPreferencia(int $idPref, int $idUEA, int $prioridad = 0): bool {
			try{
				$st = $this->conexion->prepare("INSERT IGNORE INTO profesorpreferencia_has_uea (profesorPreferencia_idProfesorPreferencias, uea_idUEA, prioridad) VALUES (:idP, :idU, :pri)");
				return $st->execute([':idP'=>$idPref, ':idU'=>$idUEA, ':pri'=>$prioridad]);
			} catch(Exception $e){ return false; }
		}

		/**
		 * Eliminar una UEA de una preferencia concreta.
		 * Usa la conexión PDO del DAO y no ejecuta borrados de programación aquí: se espera que el controlador
		 * haya limpiado programaciones relacionadas previamente si fuera necesario.
		 * Retorna true si la eliminación se ejecutó correctamente (aunque no hubiera filas afectadas), false en caso de error.
		 */
		public function eliminarUEAEnPreferencia(int $idPreferencia, int $idUEA): bool {
			try{
				$st = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias = :idP AND uea_idUEA = :idU");
				return $st->execute([':idP' => $idPreferencia, ':idU' => $idUEA]);
			} catch(Exception $e){
				$this->lastError = $e->getMessage();
				return false;
			}
		}

		/**
		 * Inserta en profesorpreferencia_has_horario los horarios base cada 1:30 de 07:00 a 20:30 (si existen en tabla horario), para Lunes-Viernes.
		 */
		public function insertarHorariosBase(int $idPref): int {
			$insertados = 0;
			try{
				$stSel = $this->conexion->prepare("SELECT idHorario FROM horario WHERE LOWER(dia) = :dia AND horaInicio = :ini AND horaFin = :fin LIMIT 1");
				$stIns = $this->conexion->prepare("INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (:idH, :idP)");
				$days = ['lunes','martes','miercoles','jueves','viernes'];
				// generar intervalos de 90 minutos entre 07:00 y 20:30
				$start = new DateTime('07:00');
				$end = new DateTime('20:30');
				$interval = new DateInterval('PT90M');
				for ($t = clone $start; $t <= $end; $t->add($interval)){
					$ini = $t->format('H:i:s');
					$finDT = (clone $t)->add($interval);
					$fin = $finDT->format('H:i:s');
					foreach ($days as $d){
						$stSel->execute([':dia'=>$d, ':ini'=>$ini, ':fin'=>$fin]);
						$row = $stSel->fetch(PDO::FETCH_ASSOC);
						if ($row && isset($row['idHorario'])){
							$ok = $stIns->execute([':idH'=>(int)$row['idHorario'], ':idP'=>$idPref]);
							if ($ok) $insertados += $stIns->rowCount();
						}
					}
				}
			} catch(Exception $e){ }
			return $insertados;
		}

		/**
		 * Actualiza campos base (noGrupos, observaciones) de una preferencia.
		 */
		public function actualizarPreferenciaBase(int $idPref, ?int $noGrupos, ?string $observaciones): bool {
			try{
				$st = $this->conexion->prepare("UPDATE profesorpreferencias SET noGrupos = :ng, observaciones = :obs WHERE idProfesorPreferencias = :idP");
				return $st->execute([':ng'=>$noGrupos, ':obs'=>$observaciones, ':idP'=>$idPref]);
			} catch(Exception $e){ $this->lastError = $e->getMessage(); return false; }
		}

		/**
		 * Reemplaza el listado de UEAs (con prioridad) de una preferencia. Recibe array de ['idUEA'=>int,'prioridad'=>int]
		 */
		public function reemplazarUEAsPreferidas(int $idPref, array $ueas): bool {
			try{
				$this->conexion->beginTransaction();
				$del = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_uea WHERE profesorPreferencia_idProfesorPreferencias = :idP");
				$del->execute([':idP'=>$idPref]);
				$ins = $this->conexion->prepare("INSERT INTO profesorpreferencia_has_uea (profesorPreferencia_idProfesorPreferencias, uea_idUEA, prioridad) VALUES (:idP, :idU, :pri)");
				foreach ($ueas as $u){
					if (!isset($u['idUEA'])) continue; $idU = (int)$u['idUEA']; $pri = isset($u['prioridad']) ? (int)$u['prioridad'] : 0;
					$ins->execute([':idP'=>$idPref, ':idU'=>$idU, ':pri'=>$pri]);
				}
				$this->conexion->commit();
				return true;
			} catch(Exception $e){ try{ if ($this->conexion->inTransaction()) $this->conexion->rollBack(); }catch(Exception $_){} $this->lastError = $e->getMessage(); return false; }
		}

		/**
		 * Reemplaza el listado de horarios preferidos. Recibe array de ['dia'=>string,'horaInicio'=>string,'horaFin'=>string]
		 */
		public function reemplazarHorariosPreferidos(int $idPref, array $horarios): bool {
			try{
				$this->conexion->beginTransaction();
				$del = $this->conexion->prepare("DELETE FROM profesorpreferencia_has_horario WHERE profesorPreferencia_idProfesorPreferencias = :idP");
				$del->execute([':idP'=>$idPref]);
				if (!empty($horarios)){
					$sel = $this->conexion->prepare("SELECT idHorario FROM horario WHERE LOWER(dia)=LOWER(:dia) AND horaInicio = :ini AND horaFin = :fin LIMIT 1");
					$ins = $this->conexion->prepare("INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (:idH, :idP)");
					foreach ($horarios as $h){
						if (!isset($h['dia'],$h['horaInicio'],$h['horaFin'])) continue;
						$sel->execute([':dia'=>$h['dia'], ':ini'=>$h['horaInicio'], ':fin'=>$h['horaFin']]);
						$r = $sel->fetch(PDO::FETCH_ASSOC);
						if ($r && isset($r['idHorario'])){
							$ins->execute([':idH'=>(int)$r['idHorario'], ':idP'=>$idPref]);
						}
					}
				}
				$this->conexion->commit();
				return true;
			} catch(Exception $e){ try{ if ($this->conexion->inTransaction()) $this->conexion->rollBack(); }catch(Exception $_){} $this->lastError = $e->getMessage(); return false; }
		}
	}
?>