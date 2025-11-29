<?php 
include_once "../modelo/pdo.php";
include_once "../modelo/ProfesorDAO.php";
include_once "../modelo/HorarioDAO.php";
include_once "../modelo/TrimDAO.php";
include_once "../modelo/PreferenciasDAO.php";

session_start();

//se obtienen del formulario docentes.php
$noEco = $_POST["noEco"];
$correo = $_POST["email"];
$noGrupos = $_POST["noGrupos"];
$uea = [$_POST["uea1"],$_POST["uea2"],$_POST["uea3"],$_POST["uea4"],$_POST["uea5"]];
//var_dump($uea);

$obs = $_POST["obser"];
$registro_hecho=1;
$reg_exito=false;
$validacion_dos=false;
$i=0;
//arreglo que contendrá al $_POST['horario']
$idHorario=[];

//recupera el correo para revisar que coincida con el número económico del docente
// Usar DAO (modelo) para encapsular la consulta a la tabla profesor
$profDAO = new ProfesorDAO($pdo);
$idProf = $profDAO->obtenerIdPorNoEcoYCorreo($noEco, $correo);
$row = $idProf ? ['idProf' => $idProf] : null;

// Obtener idTrimestre (se puede enviar vía POST 'trim' o tomar de la sesión). Si no está, tomar el último trimestre disponible.
$trimDAO = new TrimDAO($pdo);
$prefDAO = new PreferenciasDAO($pdo);

$idTrimestre = 0;
if (isset($_POST['trim']) && is_numeric($_POST['trim'])) {
	$idTrimestre = (int)$_POST['trim'];
} else if (isset($_SESSION['trim']) && is_numeric($_SESSION['trim'])) {
	$idTrimestre = (int)$_SESSION['trim'];
}
if ($idTrimestre <= 0) {
	// obtener el último trimestre registrado mediante DAO
	try {
		$lastTrimVO = $trimDAO->buscaUltimo(); // TrimVO
		if ($lastTrimVO && method_exists($lastTrimVO, 'getIdTrim')) {
			$idTrimestre = (int)$lastTrimVO->getIdTrim();
		}
	} catch (Exception $e) {
		// leave idTrimestre as 0
	}
}

// obtener periodo (sigla) y año para el procedimiento via DAO
$trimPeriodo = null;
$trimAno = null;
if ($idTrimestre > 0) {
	$trow = $trimDAO->obtenerPorId($idTrimestre); // retorna fila asociativa o null
	if ($trow) {
		$trimPeriodo = isset($trow['sigla']) ? $trow['sigla'] : null;
		$trimAno = isset($trow['año']) ? (int)$trow['año'] : (isset($trow['ano']) ? (int)$trow['ano'] : null);
	}
}

// Validación adicional: el trimestre debe estar en estado "Recepcion de preferencias" (comparación por texto)
if ($idTrimestre > 0) {
	// si no se pudo obtener el trimestre, rechazar
	if (!$trow) {
		$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'No se encontró el trimestre especificado.');
		echo json_encode($respuesta);
		exit;
	}
	// Normalizar texto para comparar sin acentos y case-insensitive
	function _norm($s){
		if (!isset($s) || $s === null) return '';
		$s = mb_strtolower((string)$s, 'UTF-8');
		// transliterar acentos
		$s = iconv('UTF-8', 'ASCII//TRANSLIT', $s);
		// remover caracteres no alfanuméricos salvo espacios
		$s = preg_replace('/[^a-z0-9\s]/i', '', $s);
		$s = preg_replace('/\s+/', ' ', trim($s));
		return $s;
	}
	$estadoActual = isset($trow['trimestreEstado']) ? $trow['trimestreEstado'] : (isset($trow['estado']) ? $trow['estado'] : '');
	$normEstado = _norm($estadoActual);
	// Aceptar variantes como 'Recepcion de preferencias', 'Recepcion preferencias', con/sin acentos
	$isRecepcion = (strpos($normEstado, 'recepcion') !== false && strpos($normEstado, 'preferenc') !== false) || ($normEstado === _norm('a programar'));
	if (!$isRecepcion) {
		$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => "El trimestre no se encuentra en estado 'Recepcion de preferencias'. Envíos no permitidos.", 'estadoActual' => $estadoActual);
		echo json_encode($respuesta);
		exit;
	}
}

// SERVER-SIDE VALIDATIONS
// 1) número económico y correo deben pertenecer al mismo profesor (ya hecho via $idProf)
// 2) validar número mínimo de grupos
if (!isset($noGrupos) || !is_numeric($noGrupos) || intval($noGrupos) < 2) {
	$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'El número mínimo de grupos es 2');
	echo json_encode($respuesta);
	exit;
}

// 3) validar UEA: deben ser 5 valores distintos y ninguno debe ser '0' o vacío
$ueaVals = array_map(function($v){ return isset($v) ? trim((string)$v) : ''; }, $uea);
if (count($ueaVals) < 5 || in_array('', $ueaVals, true) || in_array('0', $ueaVals, true)) {
	$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Debe escoger 5 UEA válidas.');
	echo json_encode($respuesta);
	exit;
}
// comprobar unicidad
if (count(array_unique($ueaVals)) !== 5) {
	$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Las 5 UEA deben ser diferentes entre sí.');
	echo json_encode($respuesta);
	exit;
}

// 4) validar horarios: existe arreglo horario y por cada día (lu..vi) hay al menos 3 seleccionados
$horDAO = new HorarioDAO($pdo);
$allHorarios = $horDAO->obtenerTodos(); // [{idHorario,dia,horaInicio,horaFin},...]
$horById = [];
foreach ($allHorarios as $h) {
	$horById[(int)$h['idHorario']] = $h;
}

$selectedHorIds = [];
if (!empty($_POST['horario']) && is_array($_POST['horario'])) {
	foreach ($_POST['horario'] as $v) {
		if ($v === '' || $v === null) continue;
		$num = intval($v);
		if ($num > 0) $selectedHorIds[] = $num;
	}
}

if (count($selectedHorIds) === 0) {
	$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Debe seleccionar horarios.');
	echo json_encode($respuesta);
	exit;
}

$counts = ['lu'=>0,'ma'=>0,'mi'=>0,'ju'=>0,'vi'=>0];
foreach ($selectedHorIds as $hid) {
	if (!isset($horById[$hid])) continue; // ignorar ids desconocidos
	$d = strtolower(trim($horById[$hid]['dia']));
	if (strpos($d,'lu') === 0 || strpos($d,'lunes') === 0) $counts['lu']++;
	else if (strpos($d,'ma') === 0 || strpos($d,'martes') === 0) $counts['ma']++;
	else if (strpos($d,'mi') === 0 || strpos($d,'mier') === 0 || strpos($d,'miercoles') === 0) $counts['mi']++;
	else if (strpos($d,'ju') === 0 || strpos($d,'jueves') === 0) $counts['ju']++;
	else if (strpos($d,'vi') === 0 || strpos($d,'viernes') === 0) $counts['vi']++;
}

foreach ($counts as $k => $c) {
	if ($c < 3) {
		$diaNombre = ['lu'=>'Lunes','ma'=>'Martes','mi'=>'Miércoles','ju'=>'Jueves','vi'=>'Viernes'][$k];
		$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => "Debe seleccionar al menos 3 horarios para el día: $diaNombre.");
		echo json_encode($respuesta);
		exit;
	}
}
// Las llamadas a procedimientos se delegan ahora al DAO PreferenciasDAO
// Note: la inserción de horarios se deja vacía por ahora (se implementará más adelante)

//si coinciden
if($row){
	// el profesor está en la base de datos
	// comprobar si ya registró preferencias para el trimestre actual usando PreferenciasDAO
	if ($idTrimestre > 0) {
		try {
			$prefCheck = $prefDAO->obtenerPreferenciasProfesorPorTrimestre($idTrimestre, $idProf);
			// Si devuelve 'preferencia' no es null significa que ya existen preferencias
			if (isset($prefCheck['preferencia']) && $prefCheck['preferencia'] !== null) {
				$validacion_dos = $prefCheck['preferencia'];
			}
		} catch (Exception $e) {
			// en caso de error al consultar DAO, continuar y dejar que el flujo valide más abajo
		}
	}
	//si no ha realizado el registro, éste se lleva a cabo
	if(!$validacion_dos){
		// Ejecutar el procedure INSERTA_PREFERENCIA_PROFESOR usando periodo y año del trimestre
		// Si no tenemos periodo/año, devolver error
		if (empty($trimPeriodo) || empty($trimAno)) {
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'No se pudo determinar el trimestre activo.');
			echo json_encode($respuesta);
			exit;
		}

		// Envolver la secuencia de inserciones en una transacción para evitar estados parciales
		try {
			$pdo->beginTransaction();
		} catch (Exception $e) {
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'No se pudo iniciar la transacción en el servidor.');
			echo json_encode($respuesta);
			exit;
		}

		// Usar PreferenciasDAO para insertar la preferencia y las UEA
		$okPref = $prefDAO->insertarPreferenciaProfesor($trimPeriodo, $trimAno, intval($noEco), $obs, intval($noGrupos));
		if (!$okPref) {
			// rollback y devolver error
			try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
			$debugMsg = null;
			if (method_exists($prefDAO, 'getLastError')) { $debugMsg = $prefDAO->getLastError(); }
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Error al registrar la preferencia del profesor.');
			if ($debugMsg) $respuesta['debug'] = $debugMsg;
			echo json_encode($respuesta);
			exit;
		}

		// Registrar las 5 UEA usando el DAO: si falla alguna, hacemos rollback completo
		$ueaAllOk = true;
		while($i<5 && isset($uea[$i]) && $uea[$i] != 0 && $uea[$i] !== ''){
			$ueaVal = intval($uea[$i]);
			$okUea = $prefDAO->insertarPreferenciaProfesorUEA($trimPeriodo, $trimAno, intval($noEco), $ueaVal, ($i+1));
			if (!$okUea) { $ueaAllOk = false; break; }
			$i++;
		}
		if (!$ueaAllOk) {
			try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Error al registrar una de las UEAs. Operación cancelada.');
			echo json_encode($respuesta);
			exit;
		}

		// Obtener id de preferencia creada
		$idPref = $prefDAO->obtenerIdPreferenciaPorPeriodoAnoYNoEco($trimPeriodo, $trimAno, intval($noEco));
		if ($idPref === null) {
			try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'No se pudo localizar el registro de preferencia para asociar horarios.');
			echo json_encode($respuesta);
			exit;
		}

		// insertar cada idHorario seleccionado y evaluar secuencias contiguas por día (evitando comparaciones estrictas de strings)
		$selectedSet = array_flip($selectedHorIds);
		// agrupar por día
		$selPorDia = ['lunes'=>[], 'martes'=>[], 'miercoles'=>[], 'jueves'=>[], 'viernes'=>[]];
		foreach ($selectedHorIds as $hid) {
			if (!isset($horById[$hid])) continue;
			$h = $horById[$hid];
			$dia = strtolower(trim($h['dia']));
			if (strpos($dia,'lu')===0) $dia='lunes'; else if (strpos($dia,'ma')===0) $dia='martes'; else if (strpos($dia,'mi')===0) $dia='miercoles'; else if (strpos($dia,'ju')===0) $dia='jueves'; else if (strpos($dia,'vi')===0) $dia='viernes';
			$selPorDia[$dia][] = $hid;
			// vínculo directo base (INSERT IGNORE)
			$okH = $prefDAO->insertarHorarioPreferenciaDirecto($idPref, intval($hid));
			if (!$okH) { try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
				$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Error al asociar horarios a la preferencia. Operación cancelada.');
				echo json_encode($respuesta);
				exit;
			}
		}
		// función para comparar si B inicia exactamente donde A termina
		$sonContiguos = function($ha, $hb) {
			if (!$ha || !$hb) return false;
			try { return strtotime($ha['horaFin']) === strtotime($hb['horaInicio']) && strcasecmp($ha['dia'], $hb['dia']) === 0; } catch (Exception $e) { return false; }
		};
		// Deshabilitar la inserción de horarios especiales para evitar crecimiento excesivo de registros
		$specialDebug = ['disabled' => true, 'note' => 'Inserción de horarios especiales deshabilitada temporalmente'];
		foreach ($selPorDia as $dia => $ids) {
			if (!$ids || count($ids)===0) continue;
			// ordenar por horaInicio
			usort($ids, function($a,$b) use($horById){ return strcmp($horById[$a]['horaInicio'], $horById[$b]['horaInicio']); });
			// recorrer y detectar secuencias contiguas
			$seq = [];
			for ($i=0; $i<count($ids); $i++) {
				$cur = $ids[$i];
				if (empty($seq)) { $seq[] = $cur; continue; }
				$prev = end($seq);
				if ($sonContiguos($horById[$prev], $horById[$cur])) { $seq[] = $cur; }
				else {
					// iniciar nueva secuencia
					$seq = [$cur];
				}
			}
		}

		// Si llegamos aquí, todo fue correcto: confirmar la transacción
		try {
			if ($pdo->inTransaction()) $pdo->commit();
			$reg_exito = true;
		} catch (Exception $e) {
			try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
			$respuesta = array('respuesta' => 'incorrecto', 'mensaje' => 'Error al confirmar la operación en la base de datos.');
			echo json_encode($respuesta);
			exit;
		}
	}
}

if(!$row) {
  	$respuesta = array(
  				'respuesta' => 'incorrecto',
                    'mensaje' => 'Número económico o correo electrónico incorrecto'
                );  
} else {
	if($validacion_dos) { 
		$respuesta = array(
				'respuesta' => 'incorrecto',
						'mensaje' => 'Ya se ha realizado un registro con el número económico proporcionado.'
				);  
	} else {
		if($reg_exito){
			// Registro exitoso; ya no enviamos correo de confirmación.
			$respuesta = array(
				'respuesta' => 'correcto',
				'mensaje' => 'Solicitud registrada con éxito.'
			);
			// Adjuntar info de depuración de horarios especiales (temporal)
			if (isset($specialDebug) && is_array($specialDebug)) {
				$respuesta['special'] = $specialDebug;
			}
		} else {
			$respuesta = array(
					'respuesta' => 'incorrecto',
							'mensaje' => 'Error en el registro. Inténtelo de nuevo.'
							);   
		}
	}
}


echo json_encode($respuesta);

?>
