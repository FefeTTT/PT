"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all3) => {
    for (var name in all3)
      __defProp(target, name, { get: all3[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // fs_mock.ts
  var fs_mock_exports = {};
  __export(fs_mock_exports, {
    default: () => fs_mock_default,
    fs: () => fs
  });
  var fs, fs_mock_default;
  var init_fs_mock = __esm({
    "fs_mock.ts"() {
      "use strict";
      fs = {
        readFileSync: () => "",
        existsSync: () => false,
        mkdirSync: () => false,
        writeFileSync: () => false
      };
      fs_mock_default = fs;
    }
  });

  // path_mock.ts
  var path_mock_exports = {};
  __export(path_mock_exports, {
    default: () => path_mock_default,
    path: () => path
  });
  var path, path_mock_default;
  var init_path_mock = __esm({
    "path_mock.ts"() {
      "use strict";
      path = {
        resolve: (...args) => args.join("/"),
        join: (...args) => args.join("/")
      };
      path_mock_default = path;
    }
  });

  // data/JSONAssignmentAdapter.ts
  init_fs_mock();

  // models/GrafoBipartito.ts
  var GrafoBipartito = class _GrafoBipartito {
    profesores;
    grupos;
    adyacencias;
    asignacionesInversas;
    /**
     * El constructor copia las estructuras para garantizar inmutabilidad
     * entre estados. Si se omiten mapas, se inicializan vacíos.
     */
    constructor(profesores, grupos, adyacencias, asignacionesInversas) {
      this.profesores = profesores ? new Map(profesores) : /* @__PURE__ */ new Map();
      this.grupos = grupos ? new Map(grupos) : /* @__PURE__ */ new Map();
      const copyAdy = /* @__PURE__ */ new Map();
      if (adyacencias) {
        adyacencias.forEach((listaGrupos, profId) => {
          copyAdy.set(profId, [...listaGrupos]);
        });
      }
      this.adyacencias = copyAdy;
      this.asignacionesInversas = asignacionesInversas ? new Map(asignacionesInversas) : /* @__PURE__ */ new Map();
    }
    clonar() {
      return new _GrafoBipartito(
        this.profesores,
        this.grupos,
        this.adyacencias,
        this.asignacionesInversas
      );
    }
    registrarProfesor(p) {
      this.profesores.set(p.numeroEconomico, p);
      if (!this.adyacencias.has(p.numeroEconomico)) {
        this.adyacencias.set(p.numeroEconomico, []);
      }
    }
    registrarGrupo(g) {
      this.grupos.set(g.idUeaGrupo, g);
    }
    asignar(numeroEconomico, idUeaGrupo) {
      if (this.asignacionesInversas.has(idUeaGrupo)) {
        throw new Error(`El grupo ${idUeaGrupo} ya est\xE1 asignado a otro profesor`);
      }
      const nuevoGrafo = new _GrafoBipartito(
        this.profesores,
        this.grupos,
        this.adyacencias,
        this.asignacionesInversas
      );
      const listaGruposProf = nuevoGrafo.adyacencias.get(numeroEconomico) || [];
      listaGruposProf.push(idUeaGrupo);
      nuevoGrafo.adyacencias.set(numeroEconomico, listaGruposProf);
      nuevoGrafo.asignacionesInversas.set(idUeaGrupo, numeroEconomico);
      return nuevoGrafo;
    }
    /**
     * Asignación in-place (mutable). NO crea una nueva instancia.
     * Uso exclusivo del GreedyOrchestrator para evitar el costo O(P+G+E) de copia por éxito.
     * Para uso desde React/debugger, usar `asignar()` inmutable.
     */
    asignarMutable(numeroEconomico, idUeaGrupo) {
      if (this.asignacionesInversas.has(idUeaGrupo)) {
        throw new Error(`El grupo ${idUeaGrupo} ya est\xE1 asignado a otro profesor`);
      }
      const listaGruposProf = this.adyacencias.get(numeroEconomico) || [];
      listaGruposProf.push(idUeaGrupo);
      this.adyacencias.set(numeroEconomico, listaGruposProf);
      this.asignacionesInversas.set(idUeaGrupo, numeroEconomico);
    }
    /**
     * Des-asignación in-place (mutable). Revierte una asignación existente.
     * Uso exclusivo de EjectionChain para búsqueda local O(1).
     */
    desasignarMutable(idUeaGrupo) {
      const numEco = this.asignacionesInversas.get(idUeaGrupo);
      if (numEco === void 0) {
        throw new Error(`El grupo ${idUeaGrupo} no est\xE1 asignado a ning\xFAn profesor`);
      }
      const listaGruposProf = this.adyacencias.get(numEco);
      if (listaGruposProf) {
        const idx = listaGruposProf.indexOf(idUeaGrupo);
        if (idx !== -1) {
          listaGruposProf.splice(idx, 1);
        }
      }
      this.asignacionesInversas.delete(idUeaGrupo);
    }
    /**
     * Serialización determinista del estado mutable para verificación de rollback.
     * Dos grafos con las mismas asignaciones producen el mismo string.
     */
    hashEstado() {
      const parteInversas = this._serializarAsignacionesInversas();
      const parteAdyacencias = this._serializarAdyacencias();
      return `INV:${parteInversas}|ADY:${parteAdyacencias}`;
    }
    _serializarAsignacionesInversas() {
      const entradas = Array.from(this.asignacionesInversas.entries());
      entradas.sort((a, b) => a[0] - b[0]);
      return entradas.map(([g, p]) => `${g}:${p}`).join(",");
    }
    _serializarAdyacencias() {
      const claves = Array.from(this.adyacencias.keys()).sort((a, b) => a - b);
      return claves.map((k) => {
        const grupos = [...this.adyacencias.get(k) || []].sort((a, b) => a - b);
        return `${k}=[${grupos.join(",")}]`;
      }).join(";");
    }
  };

  // fsm/FSMAsignador.ts
  var FSMAsignador = class {
    _grafoFijo;
    _pipelineReglas;
    constructor(grafoActual, reglas = []) {
      this._grafoFijo = grafoActual;
      this._pipelineReglas = reglas;
    }
    /** Reemplaza el grafo interno para la siguiente evaluación. */
    actualizarGrafo(nuevoGrafo) {
      this._grafoFijo = nuevoGrafo;
    }
    /** Lectura del estado actual del grafo. */
    get grafoActual() {
      return this._grafoFijo;
    }
    procesarAsignacion(numeroEconomico, idUeaGrupo, contexto) {
      let estadoActual = "INICIO" /* INICIO */;
      const profesor = this._grafoFijo.profesores.get(numeroEconomico);
      const grupo = this._grafoFijo.grupos.get(idUeaGrupo);
      if (!profesor || !grupo) {
        return {
          estado: "ERROR_REGLA" /* ERROR_REGLA */,
          error: {
            reglaFallo: "INTEGRIDAD_GRAFO",
            motivo: "El profesor o el grupo solitado no existen en el grafo.",
            numeroEconomico,
            idUeaGrupo
          }
        };
      }
      estadoActual = "EVALUANDO" /* EVALUANDO */;
      for (const regla of this._pipelineReglas) {
        const evaluacion = regla.evaluar(profesor, grupo, this._grafoFijo, contexto);
        if (!evaluacion.resultadoExitoso) {
          estadoActual = "ERROR_REGLA" /* ERROR_REGLA */;
          return {
            estado: estadoActual,
            error: {
              reglaFallo: regla.nombreRegla,
              motivo: evaluacion.motivo || "Regla fallida sin motivo especificado.",
              numeroEconomico,
              idUeaGrupo
            }
          };
        }
      }
      estadoActual = "ASIGNACION_OK" /* ASIGNACION_OK */;
      try {
        const nuevoEstadoGrafo = this._grafoFijo.asignar(numeroEconomico, idUeaGrupo);
        return {
          estado: estadoActual,
          nuevoGrafo: nuevoEstadoGrafo
        };
      } catch (err) {
        return {
          estado: "ERROR_REGLA" /* ERROR_REGLA */,
          error: {
            reglaFallo: "FATAL_MUTACION",
            motivo: err.message,
            numeroEconomico,
            idUeaGrupo
          }
        };
      }
    }
  };

  // fsm/FSMFactory.ts
  var FSMFactory = class {
    /**
     * Instancia un nuevo pipeline de FSM utilizando una lista inmutable de reglas.
     * @param grafo El grafo bipartito sobre el que actuará el FSM
     * @param reglas Array inmutable de las reglas que evaluará el pipeline
     */
    static crear(grafo, reglas) {
      return new FSMAsignador(grafo, [...reglas]);
    }
  };

  // rules/ReglaBase.ts
  var ReglaBase = class {
    nombreRegla;
    constructor(nombre) {
      this.nombreRegla = nombre;
    }
  };

  // models/HorarioLaboral.ts
  var DIAS_MAP = {
    "L-V": [1, 2, 3, 4, 5],
    "L-MI-V": [1, 3, 5],
    "M-J": [2, 4],
    "L": [1],
    "M": [2],
    "MI": [3],
    "J": [4],
    "V": [5]
  };
  var HorarioLaboral = class {
    _horaInicioNum;
    _horaFinNum;
    _diasExpandidos;
    constructor(idDiasDeTrabajo, horaInicio, horaFin) {
      this._horaInicioNum = this.parseTimeToNumber(horaInicio);
      this._horaFinNum = this.parseTimeToNumber(horaFin);
      this._diasExpandidos = DIAS_MAP[idDiasDeTrabajo.toUpperCase()] || [];
    }
    parseTimeToNumber(timeStr) {
      const parts = timeStr.split(":");
      if (parts.length < 2) return 0;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return h + m / 60;
    }
    get horaInicio() {
      return this._horaInicioNum;
    }
    get horaFin() {
      return this._horaFinNum;
    }
    get diasDesglosados() {
      return this._diasExpandidos;
    }
  };

  // models/SemanaLaboral.ts
  var SemanaLaboral = class _SemanaLaboral {
    // ── Caché Singleton por profesor ──
    static _cache = /* @__PURE__ */ new Map();
    /**
     * Obtiene una instancia de SemanaLaboral del caché si existe,
     * o la construye y almacena para reutilización futura.
     */
    static obtenerOCrear(numeroEconomico, datosDB) {
      const cached = _SemanaLaboral._cache.get(numeroEconomico);
      if (cached) return cached;
      const nueva = new _SemanaLaboral(datosDB);
      _SemanaLaboral._cache.set(numeroEconomico, nueva);
      return nueva;
    }
    /** Limpia todo el caché (ej. al iniciar nueva sesión del orquestador). */
    static invalidarCache() {
      _SemanaLaboral._cache.clear();
    }
    /** Invalida la entrada de un profesor específico. */
    static invalidarProfesor(numeroEconomico) {
      _SemanaLaboral._cache.delete(numeroEconomico);
    }
    // ── Instancia ──
    // Almacena los bloques de horario continuos, optimizados y fusionados por cada día
    _horariosFusionadosPorDia = /* @__PURE__ */ new Map();
    constructor(datosDB) {
      this.construir(datosDB);
    }
    construir(datosDB) {
      const franjasPorDia = /* @__PURE__ */ new Map();
      for (const dato of datosDB) {
        const horario = new HorarioLaboral(dato.idDiasDeTrabajo, dato.horaInicio, dato.horaFin);
        for (const diaNum of horario.diasDesglosados) {
          if (!franjasPorDia.has(diaNum)) {
            franjasPorDia.set(diaNum, []);
          }
          franjasPorDia.get(diaNum).push({ inicio: horario.horaInicio, fin: horario.horaFin });
        }
      }
      for (const [dia, bloques] of franjasPorDia.entries()) {
        if (bloques.length === 0) continue;
        bloques.sort((a, b) => a.inicio - b.inicio);
        const fusionados = [];
        let actual = { ...bloques[0] };
        for (let i = 1; i < bloques.length; i++) {
          const siguiente = bloques[i];
          if (siguiente.inicio <= actual.fin) {
            actual.fin = Math.max(actual.fin, siguiente.fin);
          } else {
            fusionados.push({ ...actual });
            actual = { ...siguiente };
          }
        }
        fusionados.push(actual);
        this._horariosFusionadosPorDia.set(dia, fusionados);
      }
    }
    intentarAsignarFranja(franja) {
      const bloquesOptimizados = this._horariosFusionadosPorDia.get(franja.dia);
      if (!bloquesOptimizados || bloquesOptimizados.length === 0) {
        return { asignable: false, esHoraMuerta: false };
      }
      for (const bloque of bloquesOptimizados) {
        if (franja.horaInicio >= bloque.inicio && franja.horaFin <= bloque.fin) {
          return { asignable: true };
        }
      }
      const primerBloque = bloquesOptimizados[0];
      const ultimoBloque = bloquesOptimizados[bloquesOptimizados.length - 1];
      const caeDentroDeLaJornada = franja.horaInicio >= primerBloque.inicio && franja.horaFin <= ultimoBloque.fin;
      return {
        asignable: false,
        esHoraMuerta: caeDentroDeLaJornada
      };
    }
  };

  // misc/helper_functions.ts
  var jsonFiles = {};
  function setJsonFiles(files) {
    jsonFiles = {};
    for (const [key, value] of Object.entries(files)) {
      jsonFiles[`../ml/files/${key}`] = value;
    }
  }
  function loadJsonFile(filename) {
    const key = `../ml/files/${filename}`;
    const data = jsonFiles[key];
    if (data !== void 0) {
      return data;
    }
    if (typeof window === "undefined") {
      try {
        const fs2 = (init_fs_mock(), __toCommonJS(fs_mock_exports));
        const path2 = (init_path_mock(), __toCommonJS(path_mock_exports));
        if (fs2 && path2) {
          let resolvedPath = "";
          if (typeof __dirname !== "undefined") {
            resolvedPath = path2.resolve(__dirname, "../ml/files", filename);
          } else {
            const cwd = process.cwd();
            if (cwd.endsWith("greedy")) {
              resolvedPath = path2.resolve(cwd, "../ml/files", filename);
            } else if (cwd.endsWith("solution")) {
              resolvedPath = path2.resolve(cwd, "ml/files", filename);
            } else {
              resolvedPath = path2.resolve(cwd, "frontend-react/solution/ml/files", filename);
            }
          }
          if (fs2.existsSync(resolvedPath)) {
            return JSON.parse(fs2.readFileSync(resolvedPath, "utf-8"));
          }
        }
      } catch (err) {
        console.error(`loadJsonFile (Node.js fallback): failed to read ${filename}`, err);
      }
    }
    console.warn(`Could not load ${filename}: file is not part of the bundled ml/files set.`);
    return {};
  }

  // rules/ReglasImplementacion.ts
  var ecosVigentesRegular = null;
  var ecosVigentesIrregular = null;
  var areaProfesor = null;
  function hayTraslapeHorario(grupoA, grupoB) {
    for (const franjaA of grupoA.horarios) {
      for (const franjaB of grupoB.horarios) {
        if (franjaA.dia === franjaB.dia && franjaA.horaInicio < franjaB.horaFin && franjaB.horaInicio < franjaA.horaFin) {
          return true;
        }
      }
    }
    return false;
  }
  var ReglaHorarioLaboral = class extends ReglaBase {
    constructor() {
      super("REGLA_HORARIO_LABORAL");
    }
    evaluar(profesor, grupo, _grafo, contexto) {
      const semanaProfesor = SemanaLaboral.obtenerOCrear(
        profesor.numeroEconomico,
        profesor.horariosContratacion
      );
      const acuerdo = contexto?.hayAcuerdoHorarioLaboral;
      const revisarAcuerdo = acuerdo?.revisarAcuerdo ?? 1;
      const umbral = acuerdo?.umbral ?? 0.02;
      const score = acuerdo?.score ?? 0;
      const acuerdoActivo = revisarAcuerdo === true || revisarAcuerdo === 1;
      const permiteAcuerdo = acuerdoActivo && Number.isFinite(score) && score >= umbral;
      let acuerdoAplicado = false;
      for (const franjaGrupo of grupo.horarios) {
        const val = semanaProfesor.intentarAsignarFranja(franjaGrupo);
        if (!val.asignable) {
          if (permiteAcuerdo) {
            acuerdoAplicado = true;
            continue;
          }
          if (val.esHoraMuerta) {
            return {
              resultadoExitoso: false,
              motivo: `Restriccion de Horario: La clase solicitada (Dia ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}) cae en un hueco no laborable en el horario del profesor. HayAcuerdoHorarioLaboral no aplica: score=${score} < umbral=${umbral}.`
            };
          }
          return {
            resultadoExitoso: false,
            motivo: `Restriccion de Horario: El profesor no tiene disponibilidad programada para cubrir la clase del Dia ${franjaGrupo.dia} de ${franjaGrupo.horaInicio} a ${franjaGrupo.horaFin}. HayAcuerdoHorarioLaboral no aplica: score=${score} < umbral=${umbral}.`
          };
        }
      }
      if (acuerdoAplicado) {
        return {
          resultadoExitoso: true,
          motivo: `HayAcuerdoHorarioLaboral permitio horario fuera de contrato: score=${score} >= umbral=${umbral}.`
        };
      }
      return {
        resultadoExitoso: true,
        motivo: "El horario laboral del profesor cubre completamente el horario requerido para el grupo."
      };
    }
  };
  var ReglaTraslapeUEA = class extends ReglaBase {
    constructor() {
      super("REGLA_TRASLAPE_UEA");
    }
    evaluar(profesor, grupo, grafo) {
      const gruposAsignados = grafo.adyacencias.get(profesor.numeroEconomico);
      if (!gruposAsignados || gruposAsignados.length === 0) {
        return {
          resultadoExitoso: true,
          motivo: "El profesor no tiene UEAs asignadas con traslape horario."
        };
      }
      for (const idGrupoAsignado of gruposAsignados) {
        const grupoAsignado = grafo.grupos.get(idGrupoAsignado);
        if (!grupoAsignado) {
          continue;
        }
        if (hayTraslapeHorario(grupoAsignado, grupo)) {
          return {
            resultadoExitoso: false,
            motivo: `La UEA ${grupo.claveGrupo} se traslapa con la UEA ya asignada ${grupoAsignado.claveGrupo}.`
          };
        }
      }
      return {
        resultadoExitoso: true,
        motivo: "La UEA no se traslapa con otras asignaciones del profesor."
      };
    }
  };
  var ReglaMaxHorasDiarias = class extends ReglaBase {
    _limiteHorasDiarias;
    constructor(horasMaximasDiarias = 4.5) {
      super("REGLA_MAXIMO_HORAS_DIARIAS");
      this._limiteHorasDiarias = horasMaximasDiarias;
    }
    _getDuracionGrupoEnDia(grupo, dia) {
      let sumatoria = 0;
      for (const f of grupo.horarios) {
        if (f.dia === dia) {
          sumatoria += f.horaFin - f.horaInicio;
        }
      }
      return sumatoria;
    }
    _getHorasDiaActuales(numeroEconomico, dia, grafo) {
      const listaClavesUeaAsignadas = grafo.adyacencias.get(numeroEconomico) || [];
      let horasAcumuladas = 0;
      for (const claveUea of listaClavesUeaAsignadas) {
        const grupoObj = grafo.grupos.get(claveUea);
        if (grupoObj) {
          horasAcumuladas += this._getDuracionGrupoEnDia(grupoObj, dia);
        }
      }
      return horasAcumuladas;
    }
    evaluar(profesor, grupo, grafo) {
      const diasDelGrupo = Array.from(new Set(grupo.horarios.map((h) => h.dia)));
      for (const dia of diasDelGrupo) {
        const horasOcupadasDia = this._getHorasDiaActuales(profesor.numeroEconomico, dia, grafo);
        const horasQuePideEsteGrupoDia = this._getDuracionGrupoEnDia(grupo, dia);
        const totalProyectadoDia = horasOcupadasDia + horasQuePideEsteGrupoDia;
        if (totalProyectadoDia > this._limiteHorasDiarias) {
          return {
            resultadoExitoso: false,
            motivo: `Asignarlo superaria la carga diaria maxima el Dia ${dia}. Carga actual (${horasOcupadasDia}h) + Grupo a asignar (${horasQuePideEsteGrupoDia}h) = ${totalProyectadoDia}h (Limite: ${this._limiteHorasDiarias}h).`
          };
        }
      }
      return {
        resultadoExitoso: true,
        motivo: `La asignacion es valida. No supera el limite de ${this._limiteHorasDiarias} hrs diarias en los dias de clase.`
      };
    }
  };
  var ReglaGrupoTieneProgramacion = class extends ReglaBase {
    constructor() {
      super("REGLA_GRUPO_TIENE_PROGRAMACION");
    }
    evaluar(_profesor, grupo, _grafo) {
      if (!grupo.horarios || grupo.horarios.length === 0) {
        return {
          resultadoExitoso: false,
          motivo: "El grupo no cuenta con programacion_uea_grupo asignada."
        };
      }
      return {
        resultadoExitoso: true,
        motivo: "Regla superada. El grupo cuenta con horarios programados en BD."
      };
    }
  };
  var ReglaAsignacionGlobal = class extends ReglaBase {
    constructor() {
      super("REGLA_ASIGNACION_GLOBAL");
    }
    evaluar(_profesor, grupo, grafo) {
      if (grafo.asignacionesInversas.has(grupo.idUeaGrupo)) {
        const colision = grafo.asignacionesInversas.get(grupo.idUeaGrupo);
        return {
          resultadoExitoso: false,
          motivo: `El grupo ya ha sido asignado al profesor ${colision}.`
        };
      }
      return {
        resultadoExitoso: true,
        motivo: "El grupo no se encuentra asignado a ning\xFAn profesor."
      };
    }
  };
  var ReglaIgnorarGrupos = class _ReglaIgnorarGrupos extends ReglaBase {
    static GRUPOS_IGNORADOS = ["SAI", "PRO"];
    constructor() {
      super("REGLA_IGNORAR_GRUPOS");
    }
    /**
     * Limpia y tokeniza la clave del grupo, luego verifica si algún token
     * coincide exactamente con SAI o CPRO. Evita falsos positivos como "SAINT".
     */
    evaluar(_profesor, grupo, _grafo) {
      const nombreLimpio = grupo.claveGrupo.trim().toUpperCase();
      for (const ignorado of _ReglaIgnorarGrupos.GRUPOS_IGNORADOS) {
        if (nombreLimpio.includes(ignorado)) {
          return {
            resultadoExitoso: false,
            motivo: `El grupo ${grupo.claveGrupo} es ignorado por contener "${ignorado}" (tipo SAI/CPRO).`
          };
        }
      }
      return {
        resultadoExitoso: true,
        motivo: "El grupo no es un grupo SAI o CPRO, puede ser asignado."
      };
    }
  };
  var ReglaProfesorVigente = class extends ReglaBase {
    constructor(fileRegular = "ecos_vigentes_con_horario_regular.json", fileIrregular = "ecos_vigentes_con_horario_irregular.json") {
      super("REGLA_PROFESOR_VIGENTE");
      if (!ecosVigentesRegular) ecosVigentesRegular = loadJsonFile(fileRegular);
      if (!ecosVigentesIrregular) ecosVigentesIrregular = loadJsonFile(fileIrregular);
    }
    evaluar(profesor, _grupo, _grafo) {
      const ecoStr = profesor.numeroEconomico.toString();
      if (ecosVigentesRegular[ecoStr] || ecosVigentesIrregular[ecoStr]) {
        return { resultadoExitoso: true, motivo: "El profesor es vigente." };
      }
      return {
        resultadoExitoso: false,
        motivo: `El profesor ${profesor.numeroEconomico} no figura como vigente en los cat\xE1logos.`
      };
    }
  };
  var ReglaAreasVistas = class extends ReglaBase {
    constructor(fileAreaProfesor = "area_profesor.json") {
      super("REGLA_AREAS_VISTAS");
      if (!areaProfesor) areaProfesor = loadJsonFile(fileAreaProfesor);
    }
    evaluar(profesor, grupo, _grafo) {
      const ecoStr = profesor.numeroEconomico.toString();
      const areasVistas = areaProfesor[ecoStr] || [];
      if (areasVistas.includes(grupo.idArea.toString())) {
        return { resultadoExitoso: true, motivo: "El \xE1rea del grupo es un \xE1rea hist\xF3ricamente vista por el profesor." };
      }
      return {
        resultadoExitoso: false,
        motivo: `El \xE1rea de la UEA (${grupo.idArea}) no ha sido vista hist\xF3ricamente por el profesor.`
      };
    }
  };

  // rules/ReglasPipeline.ts
  var ReglasPipeline = class {
    static getReglasIngestaGrupos() {
      return [
        new ReglaGrupoTieneProgramacion(),
        new ReglaIgnorarGrupos()
      ];
    }
    static getReglasFastFail() {
      return [
        new ReglaProfesorVigente(),
        new ReglaAreasVistas(),
        new ReglaGrupoTieneProgramacion(),
        new ReglaIgnorarGrupos()
      ];
    }
    /**
     * Devuelve las reglas estructurales y de contrato que mutan estado o son más pesadas.
     * @param maxHorasDiarias Límite diario de horas (default: 4.5h para GRASP, 24 desde frontend hook).
     */
    static getReglasRestantes(maxHorasDiarias = 4.5) {
      return [
        new ReglaAsignacionGlobal(),
        new ReglaTraslapeUEA(),
        new ReglaHorarioLaboral(),
        new ReglaMaxHorasDiarias(maxHorasDiarias)
      ];
    }
  };

  // data/JSONAssignmentAdapter.ts
  var mapDiasAIndex = {
    "L": 1,
    "M": 2,
    "Mi": 3,
    "J": 4,
    "V": 5
  };
  var JSONAssignmentAdapter = class _JSONAssignmentAdapter {
    /**
     * Extrae profesores recibiendo los objetos JSON en memoria (Para uso en Browser sin FS)
     */
    static parsearProfesoresDesdeObjeto(rawEcoHorario, rawAreaProfesor, rawIrregulares) {
      const profesores = [];
      _JSONAssignmentAdapter.procesarRegulares(rawEcoHorario, rawAreaProfesor, profesores);
      if (rawIrregulares) {
        _JSONAssignmentAdapter.procesarIrregulares(rawIrregulares, rawAreaProfesor, profesores);
      }
      return profesores;
    }
    /**
     * Extrae profesores del JSON de los horarios laborales de eco y de area_profesor.json
     */
    static parsearProfesores(ecoHorarioPath, areaProfesorPath, ecoHorarioIrregularPath) {
      const rawEcoHorario = JSON.parse(fs_mock_default.readFileSync(ecoHorarioPath, "utf-8"));
      const rawAreaProfesor = JSON.parse(fs_mock_default.readFileSync(areaProfesorPath, "utf-8"));
      let rawIrregulares = {};
      if (ecoHorarioIrregularPath && fs_mock_default.existsSync(ecoHorarioIrregularPath)) {
        rawIrregulares = JSON.parse(fs_mock_default.readFileSync(ecoHorarioIrregularPath, "utf-8"));
      }
      return _JSONAssignmentAdapter.parsearProfesoresDesdeObjeto(rawEcoHorario, rawAreaProfesor, rawIrregulares);
    }
    static procesarRegulares(rawEcoHorario, rawAreaProfesor, profesores) {
      for (const [ecoStr, horarioStr] of Object.entries(rawEcoHorario)) {
        const numeroEconomico = parseInt(ecoStr, 10);
        if (isNaN(numeroEconomico)) continue;
        const areasStringArr = rawAreaProfesor[ecoStr] || [];
        const [horaInicioStr, horaFinStr] = horarioStr.split("-");
        const horariosContratacion = [
          {
            idDiasDeTrabajo: "L-V",
            horaInicio: `${horaInicioStr}:00`,
            horaFin: `${horaFinStr}:00`
          }
        ];
        profesores.push({
          numeroEconomico,
          idArea: areasStringArr,
          horariosContratacion
        });
      }
    }
    static procesarIrregulares(rawIrregulares, rawAreaProfesor, profesores) {
      for (const [ecoStr, data] of Object.entries(rawIrregulares)) {
        const numeroEconomico = parseInt(ecoStr, 10);
        if (isNaN(numeroEconomico)) continue;
        const areasStringArr = rawAreaProfesor[ecoStr] || [];
        const horariosContratacion = [];
        const inferidoArr = data.inferido || [];
        for (const franja of inferidoArr) {
          let hIn = franja.inicio;
          let hOut = franja.fin;
          if (hIn.split(":").length === 2) hIn += ":00";
          if (hOut.split(":").length === 2) hOut += ":00";
          horariosContratacion.push({
            idDiasDeTrabajo: franja.dia,
            horaInicio: hIn,
            horaFin: hOut
          });
        }
        profesores.push({
          numeroEconomico,
          idArea: areasStringArr,
          horariosContratacion
        });
      }
    }
    /**
     * Extrae grupos de la programación de grupos recibiendo el objeto JSON en memoria (Para uso en Browser sin FS)
     */
    static parsearGruposDesdeObjeto(rawProg) {
      const grupos = [];
      let globalIdCounter = 1;
      for (const [ueaStr, subgruposArr] of Object.entries(rawProg)) {
        const idAreaUEA = ueaStr.substring(0, 4);
        const ueaClave = parseInt(ueaStr, 10);
        for (const subgrupoObj of subgruposArr) {
          if (!subgrupoObj.horario) continue;
          const claveGrupo = subgrupoObj.grupo;
          const franjasDto = [];
          const horariopipes = subgrupoObj.horario.split("|");
          for (const fragment of horariopipes) {
            const primerCol = fragment.indexOf(":");
            const diaRaw = fragment.substring(0, primerCol);
            const rangeRaw = fragment.substring(primerCol + 1);
            const [inicioHm, finHm] = rangeRaw.split("-");
            const [inH, inM] = inicioHm.split(":").map(Number);
            const [outH, outM] = finHm.split(":").map(Number);
            const diaNum = mapDiasAIndex[diaRaw];
            if (diaNum) {
              franjasDto.push({
                dia: diaNum,
                horaInicio: inH + inM / 60,
                horaFin: outH + outM / 60
              });
            }
          }
          if (franjasDto.length > 0) {
            grupos.push({
              idUeaGrupo: globalIdCounter++,
              idGrupo: globalIdCounter * 100,
              // Dummy
              claveGrupo,
              idArea: idAreaUEA,
              ueaClave,
              horarios: franjasDto,
              horarioStringRaw: subgrupoObj.horario
            });
          }
        }
      }
      return grupos;
    }
    /**
     * Extrae grupos de la programación de grupos (uea - horario) a asignar
     */
    static parsearGrupos(programacionPath) {
      const rawProg = JSON.parse(fs_mock_default.readFileSync(programacionPath, "utf-8"));
      return _JSONAssignmentAdapter.parsearGruposDesdeObjeto(rawProg);
    }
    /**
     * Aplica una FSM de ingesta con reglas puramente del grupo.
     * Esto evita que grupos SAI/CPRO o sin programacion entren al MCV,
     * al grafo inicial o a fases posteriores como reparacion/ejection.
     */
    static evaluarGruposPorFSMIngesta(grupos) {
      const ecoIngesta = -1;
      const profesorIngesta = {
        numeroEconomico: ecoIngesta,
        idArea: [],
        horariosContratacion: []
      };
      const grafo = new GrafoBipartito();
      grafo.registrarProfesor(profesorIngesta);
      for (const grupo of grupos) {
        grafo.registrarGrupo(grupo);
      }
      const fsmIngesta = FSMFactory.crear(grafo, ReglasPipeline.getReglasIngestaGrupos());
      const validos = [];
      const rechazados = [];
      for (const grupo of grupos) {
        const evaluacion = fsmIngesta.procesarAsignacion(ecoIngesta, grupo.idUeaGrupo);
        if (evaluacion.estado === "ASIGNACION_OK" /* ASIGNACION_OK */) {
          validos.push(grupo);
          continue;
        }
        rechazados.push({
          idUeaGrupo: grupo.idUeaGrupo,
          ueaClave: grupo.ueaClave,
          claveGrupo: grupo.claveGrupo,
          reglaFallo: evaluacion.error?.reglaFallo ?? "INGESTA_DESCONOCIDA",
          motivo: evaluacion.error?.motivo ?? "Grupo rechazado por la FSM de ingesta."
        });
      }
      return { validos, rechazados };
    }
    static filtrarGruposPorFSMIngesta(grupos, opciones = {}) {
      const resultado = _JSONAssignmentAdapter.evaluarGruposPorFSMIngesta(grupos);
      if (opciones.log !== false && resultado.rechazados.length > 0) {
        console.log(
          `FSM ingesta grupos: ${resultado.validos.length} validos, ${resultado.rechazados.length} rechazados.`
        );
        const resumen = resultado.rechazados.reduce((acc, rechazo) => {
          acc[rechazo.reglaFallo] = (acc[rechazo.reglaFallo] ?? 0) + 1;
          return acc;
        }, {});
        console.table(resumen);
      }
      return resultado.validos;
    }
    /**
     * Identifica los MCV basados en cuellos de botella 
     * en relación con el número de franjas horarias y su duración.
     */
    static identificarMCV(grupos) {
      const ueaFreq = /* @__PURE__ */ new Map();
      for (const g of grupos) {
        ueaFreq.set(g.ueaClave, (ueaFreq.get(g.ueaClave) || 0) + 1);
      }
      const sorted = [...grupos].sort((a, b) => {
        const freqA = ueaFreq.get(a.ueaClave) || 0;
        const freqB = ueaFreq.get(b.ueaClave) || 0;
        if (freqA !== freqB) return freqA - freqB;
        const franjasA = a.horarios.length;
        const franjasB = b.horarios.length;
        if (franjasA !== franjasB) return franjasB - franjasA;
        const durA = a.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
        const durB = b.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
        return durB - durA;
      });
      console.log(`
=== IDENTIFICANDO MCV (Most Constrained Variables) ===`);
      for (let i = 0; i < Math.min(10, sorted.length); i++) {
        const grp = sorted[i];
        const dur = grp.horarios.reduce((s, h) => s + (h.horaFin - h.horaInicio), 0);
        console.log(`[Top ${i + 1}] UEA: ${grp.ueaClave} - Gpo: ${grp.claveGrupo} | Franjas: ${grp.horarios.length} | Hrs totales: ${dur}`);
      }
      console.log(`=== FIN MCV ===
`);
    }
  };

  // ../node_modules/axios/lib/helpers/bind.js
  function bind(fn, thisArg) {
    return function wrap() {
      return fn.apply(thisArg, arguments);
    };
  }

  // ../node_modules/axios/lib/utils.js
  var { toString } = Object.prototype;
  var { getPrototypeOf } = Object;
  var { iterator, toStringTag } = Symbol;
  var kindOf = /* @__PURE__ */ ((cache) => (thing) => {
    const str = toString.call(thing);
    return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
  })(/* @__PURE__ */ Object.create(null));
  var kindOfTest = (type) => {
    type = type.toLowerCase();
    return (thing) => kindOf(thing) === type;
  };
  var typeOfTest = (type) => (thing) => typeof thing === type;
  var { isArray } = Array;
  var isUndefined = typeOfTest("undefined");
  function isBuffer(val) {
    return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction(val.constructor.isBuffer) && val.constructor.isBuffer(val);
  }
  var isArrayBuffer = kindOfTest("ArrayBuffer");
  function isArrayBufferView(val) {
    let result;
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
      result = ArrayBuffer.isView(val);
    } else {
      result = val && val.buffer && isArrayBuffer(val.buffer);
    }
    return result;
  }
  var isString = typeOfTest("string");
  var isFunction = typeOfTest("function");
  var isNumber = typeOfTest("number");
  var isObject = (thing) => thing !== null && typeof thing === "object";
  var isBoolean = (thing) => thing === true || thing === false;
  var isPlainObject = (val) => {
    if (kindOf(val) !== "object") {
      return false;
    }
    const prototype2 = getPrototypeOf(val);
    return (prototype2 === null || prototype2 === Object.prototype || Object.getPrototypeOf(prototype2) === null) && !(toStringTag in val) && !(iterator in val);
  };
  var isEmptyObject = (val) => {
    if (!isObject(val) || isBuffer(val)) {
      return false;
    }
    try {
      return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
    } catch (e) {
      return false;
    }
  };
  var isDate = kindOfTest("Date");
  var isFile = kindOfTest("File");
  var isReactNativeBlob = (value) => {
    return !!(value && typeof value.uri !== "undefined");
  };
  var isReactNative = (formData) => formData && typeof formData.getParts !== "undefined";
  var isBlob = kindOfTest("Blob");
  var isFileList = kindOfTest("FileList");
  var isStream = (val) => isObject(val) && isFunction(val.pipe);
  function getGlobal() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof self !== "undefined") return self;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    return {};
  }
  var G = getGlobal();
  var FormDataCtor = typeof G.FormData !== "undefined" ? G.FormData : void 0;
  var isFormData = (thing) => {
    if (!thing) return false;
    if (FormDataCtor && thing instanceof FormDataCtor) return true;
    const proto = getPrototypeOf(thing);
    if (!proto || proto === Object.prototype) return false;
    if (!isFunction(thing.append)) return false;
    const kind = kindOf(thing);
    return kind === "formdata" || // detect form-data instance
    kind === "object" && isFunction(thing.toString) && thing.toString() === "[object FormData]";
  };
  var isURLSearchParams = kindOfTest("URLSearchParams");
  var [isReadableStream, isRequest, isResponse, isHeaders] = [
    "ReadableStream",
    "Request",
    "Response",
    "Headers"
  ].map(kindOfTest);
  var trim = (str) => {
    return str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
  };
  function forEach(obj, fn, { allOwnKeys = false } = {}) {
    if (obj === null || typeof obj === "undefined") {
      return;
    }
    let i;
    let l;
    if (typeof obj !== "object") {
      obj = [obj];
    }
    if (isArray(obj)) {
      for (i = 0, l = obj.length; i < l; i++) {
        fn.call(null, obj[i], i, obj);
      }
    } else {
      if (isBuffer(obj)) {
        return;
      }
      const keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj);
      const len = keys.length;
      let key;
      for (i = 0; i < len; i++) {
        key = keys[i];
        fn.call(null, obj[key], key, obj);
      }
    }
  }
  function findKey(obj, key) {
    if (isBuffer(obj)) {
      return null;
    }
    key = key.toLowerCase();
    const keys = Object.keys(obj);
    let i = keys.length;
    let _key;
    while (i-- > 0) {
      _key = keys[i];
      if (key === _key.toLowerCase()) {
        return _key;
      }
    }
    return null;
  }
  var _global = (() => {
    if (typeof globalThis !== "undefined") return globalThis;
    return typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
  })();
  var isContextDefined = (context) => !isUndefined(context) && context !== _global;
  function merge(...objs) {
    const { caseless, skipUndefined } = isContextDefined(this) && this || {};
    const result = {};
    const assignValue = (val, key) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return;
      }
      const targetKey = caseless && findKey(result, key) || key;
      const existing = hasOwnProperty(result, targetKey) ? result[targetKey] : void 0;
      if (isPlainObject(existing) && isPlainObject(val)) {
        result[targetKey] = merge(existing, val);
      } else if (isPlainObject(val)) {
        result[targetKey] = merge({}, val);
      } else if (isArray(val)) {
        result[targetKey] = val.slice();
      } else if (!skipUndefined || !isUndefined(val)) {
        result[targetKey] = val;
      }
    };
    for (let i = 0, l = objs.length; i < l; i++) {
      objs[i] && forEach(objs[i], assignValue);
    }
    return result;
  }
  var extend = (a, b, thisArg, { allOwnKeys } = {}) => {
    forEach(
      b,
      (val, key) => {
        if (thisArg && isFunction(val)) {
          Object.defineProperty(a, key, {
            // Null-proto descriptor so a polluted Object.prototype.get cannot
            // hijack defineProperty's accessor-vs-data resolution.
            __proto__: null,
            value: bind(val, thisArg),
            writable: true,
            enumerable: true,
            configurable: true
          });
        } else {
          Object.defineProperty(a, key, {
            __proto__: null,
            value: val,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      },
      { allOwnKeys }
    );
    return a;
  };
  var stripBOM = (content) => {
    if (content.charCodeAt(0) === 65279) {
      content = content.slice(1);
    }
    return content;
  };
  var inherits = (constructor, superConstructor, props, descriptors) => {
    constructor.prototype = Object.create(superConstructor.prototype, descriptors);
    Object.defineProperty(constructor.prototype, "constructor", {
      __proto__: null,
      value: constructor,
      writable: true,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(constructor, "super", {
      __proto__: null,
      value: superConstructor.prototype
    });
    props && Object.assign(constructor.prototype, props);
  };
  var toFlatObject = (sourceObj, destObj, filter2, propFilter) => {
    let props;
    let i;
    let prop;
    const merged = {};
    destObj = destObj || {};
    if (sourceObj == null) return destObj;
    do {
      props = Object.getOwnPropertyNames(sourceObj);
      i = props.length;
      while (i-- > 0) {
        prop = props[i];
        if ((!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop]) {
          destObj[prop] = sourceObj[prop];
          merged[prop] = true;
        }
      }
      sourceObj = filter2 !== false && getPrototypeOf(sourceObj);
    } while (sourceObj && (!filter2 || filter2(sourceObj, destObj)) && sourceObj !== Object.prototype);
    return destObj;
  };
  var endsWith = (str, searchString, position) => {
    str = String(str);
    if (position === void 0 || position > str.length) {
      position = str.length;
    }
    position -= searchString.length;
    const lastIndex = str.indexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
  };
  var toArray = (thing) => {
    if (!thing) return null;
    if (isArray(thing)) return thing;
    let i = thing.length;
    if (!isNumber(i)) return null;
    const arr = new Array(i);
    while (i-- > 0) {
      arr[i] = thing[i];
    }
    return arr;
  };
  var isTypedArray = /* @__PURE__ */ ((TypedArray) => {
    return (thing) => {
      return TypedArray && thing instanceof TypedArray;
    };
  })(typeof Uint8Array !== "undefined" && getPrototypeOf(Uint8Array));
  var forEachEntry = (obj, fn) => {
    const generator = obj && obj[iterator];
    const _iterator = generator.call(obj);
    let result;
    while ((result = _iterator.next()) && !result.done) {
      const pair = result.value;
      fn.call(obj, pair[0], pair[1]);
    }
  };
  var matchAll = (regExp, str) => {
    let matches;
    const arr = [];
    while ((matches = regExp.exec(str)) !== null) {
      arr.push(matches);
    }
    return arr;
  };
  var isHTMLForm = kindOfTest("HTMLFormElement");
  var toCamelCase = (str) => {
    return str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function replacer(m, p1, p2) {
      return p1.toUpperCase() + p2;
    });
  };
  var hasOwnProperty = (({ hasOwnProperty: hasOwnProperty2 }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype);
  var isRegExp = kindOfTest("RegExp");
  var reduceDescriptors = (obj, reducer) => {
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    const reducedDescriptors = {};
    forEach(descriptors, (descriptor, name) => {
      let ret;
      if ((ret = reducer(descriptor, name, obj)) !== false) {
        reducedDescriptors[name] = ret || descriptor;
      }
    });
    Object.defineProperties(obj, reducedDescriptors);
  };
  var freezeMethods = (obj) => {
    reduceDescriptors(obj, (descriptor, name) => {
      if (isFunction(obj) && ["arguments", "caller", "callee"].includes(name)) {
        return false;
      }
      const value = obj[name];
      if (!isFunction(value)) return;
      descriptor.enumerable = false;
      if ("writable" in descriptor) {
        descriptor.writable = false;
        return;
      }
      if (!descriptor.set) {
        descriptor.set = () => {
          throw Error("Can not rewrite read-only method '" + name + "'");
        };
      }
    });
  };
  var toObjectSet = (arrayOrString, delimiter) => {
    const obj = {};
    const define = (arr) => {
      arr.forEach((value) => {
        obj[value] = true;
      });
    };
    isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter));
    return obj;
  };
  var noop = () => {
  };
  var toFiniteNumber = (value, defaultValue) => {
    return value != null && Number.isFinite(value = +value) ? value : defaultValue;
  };
  function isSpecCompliantForm(thing) {
    return !!(thing && isFunction(thing.append) && thing[toStringTag] === "FormData" && thing[iterator]);
  }
  var toJSONObject = (obj) => {
    const visited = /* @__PURE__ */ new WeakSet();
    const visit = (source) => {
      if (isObject(source)) {
        if (visited.has(source)) {
          return;
        }
        if (isBuffer(source)) {
          return source;
        }
        if (!("toJSON" in source)) {
          visited.add(source);
          const target = isArray(source) ? [] : {};
          forEach(source, (value, key) => {
            const reducedValue = visit(value);
            !isUndefined(reducedValue) && (target[key] = reducedValue);
          });
          visited.delete(source);
          return target;
        }
      }
      return source;
    };
    return visit(obj);
  };
  var isAsyncFn = kindOfTest("AsyncFunction");
  var isThenable = (thing) => thing && (isObject(thing) || isFunction(thing)) && isFunction(thing.then) && isFunction(thing.catch);
  var _setImmediate = ((setImmediateSupported, postMessageSupported) => {
    if (setImmediateSupported) {
      return setImmediate;
    }
    return postMessageSupported ? ((token, callbacks) => {
      _global.addEventListener(
        "message",
        ({ source, data }) => {
          if (source === _global && data === token) {
            callbacks.length && callbacks.shift()();
          }
        },
        false
      );
      return (cb) => {
        callbacks.push(cb);
        _global.postMessage(token, "*");
      };
    })(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb);
  })(typeof setImmediate === "function", isFunction(_global.postMessage));
  var asap = typeof queueMicrotask !== "undefined" ? queueMicrotask.bind(_global) : typeof process !== "undefined" && process.nextTick || _setImmediate;
  var isIterable = (thing) => thing != null && isFunction(thing[iterator]);
  var utils_default = {
    isArray,
    isArrayBuffer,
    isBuffer,
    isFormData,
    isArrayBufferView,
    isString,
    isNumber,
    isBoolean,
    isObject,
    isPlainObject,
    isEmptyObject,
    isReadableStream,
    isRequest,
    isResponse,
    isHeaders,
    isUndefined,
    isDate,
    isFile,
    isReactNativeBlob,
    isReactNative,
    isBlob,
    isRegExp,
    isFunction,
    isStream,
    isURLSearchParams,
    isTypedArray,
    isFileList,
    forEach,
    merge,
    extend,
    trim,
    stripBOM,
    inherits,
    toFlatObject,
    kindOf,
    kindOfTest,
    endsWith,
    toArray,
    forEachEntry,
    matchAll,
    isHTMLForm,
    hasOwnProperty,
    hasOwnProp: hasOwnProperty,
    // an alias to avoid ESLint no-prototype-builtins detection
    reduceDescriptors,
    freezeMethods,
    toObjectSet,
    toCamelCase,
    noop,
    toFiniteNumber,
    findKey,
    global: _global,
    isContextDefined,
    isSpecCompliantForm,
    toJSONObject,
    isAsyncFn,
    isThenable,
    setImmediate: _setImmediate,
    asap,
    isIterable
  };

  // ../node_modules/axios/lib/helpers/parseHeaders.js
  var ignoreDuplicateOf = utils_default.toObjectSet([
    "age",
    "authorization",
    "content-length",
    "content-type",
    "etag",
    "expires",
    "from",
    "host",
    "if-modified-since",
    "if-unmodified-since",
    "last-modified",
    "location",
    "max-forwards",
    "proxy-authorization",
    "referer",
    "retry-after",
    "user-agent"
  ]);
  var parseHeaders_default = (rawHeaders) => {
    const parsed = {};
    let key;
    let val;
    let i;
    rawHeaders && rawHeaders.split("\n").forEach(function parser(line) {
      i = line.indexOf(":");
      key = line.substring(0, i).trim().toLowerCase();
      val = line.substring(i + 1).trim();
      if (!key || parsed[key] && ignoreDuplicateOf[key]) {
        return;
      }
      if (key === "set-cookie") {
        if (parsed[key]) {
          parsed[key].push(val);
        } else {
          parsed[key] = [val];
        }
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
      }
    });
    return parsed;
  };

  // ../node_modules/axios/lib/helpers/sanitizeHeaderValue.js
  function trimSPorHTAB(str) {
    let start = 0;
    let end = str.length;
    while (start < end) {
      const code = str.charCodeAt(start);
      if (code !== 9 && code !== 32) {
        break;
      }
      start += 1;
    }
    while (end > start) {
      const code = str.charCodeAt(end - 1);
      if (code !== 9 && code !== 32) {
        break;
      }
      end -= 1;
    }
    return start === 0 && end === str.length ? str : str.slice(start, end);
  }
  var INVALID_UNICODE_HEADER_VALUE_CHARS = new RegExp("[\\u0000-\\u0008\\u000a-\\u001f\\u007f]+", "g");
  var INVALID_BYTE_STRING_HEADER_VALUE_CHARS = new RegExp("[^\\u0009\\u0020-\\u007e\\u0080-\\u00ff]+", "g");
  function sanitizeValue(value, invalidChars) {
    if (utils_default.isArray(value)) {
      return value.map((item) => sanitizeValue(item, invalidChars));
    }
    return trimSPorHTAB(String(value).replace(invalidChars, ""));
  }
  var sanitizeHeaderValue = (value) => sanitizeValue(value, INVALID_UNICODE_HEADER_VALUE_CHARS);
  var sanitizeByteStringHeaderValue = (value) => sanitizeValue(value, INVALID_BYTE_STRING_HEADER_VALUE_CHARS);
  function toByteStringHeaderObject(headers) {
    const byteStringHeaders = /* @__PURE__ */ Object.create(null);
    utils_default.forEach(headers.toJSON(), (value, header) => {
      byteStringHeaders[header] = sanitizeByteStringHeaderValue(value);
    });
    return byteStringHeaders;
  }

  // ../node_modules/axios/lib/core/AxiosHeaders.js
  var $internals = /* @__PURE__ */ Symbol("internals");
  function normalizeHeader(header) {
    return header && String(header).trim().toLowerCase();
  }
  function normalizeValue(value) {
    if (value === false || value == null) {
      return value;
    }
    return utils_default.isArray(value) ? value.map(normalizeValue) : sanitizeHeaderValue(String(value));
  }
  function parseTokens(str) {
    const tokens = /* @__PURE__ */ Object.create(null);
    const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
    let match;
    while (match = tokensRE.exec(str)) {
      tokens[match[1]] = match[2];
    }
    return tokens;
  }
  var isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());
  function matchHeaderValue(context, value, header, filter2, isHeaderNameFilter) {
    if (utils_default.isFunction(filter2)) {
      return filter2.call(this, value, header);
    }
    if (isHeaderNameFilter) {
      value = header;
    }
    if (!utils_default.isString(value)) return;
    if (utils_default.isString(filter2)) {
      return value.indexOf(filter2) !== -1;
    }
    if (utils_default.isRegExp(filter2)) {
      return filter2.test(value);
    }
  }
  function formatHeader(header) {
    return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
  }
  function buildAccessors(obj, header) {
    const accessorName = utils_default.toCamelCase(" " + header);
    ["get", "set", "has"].forEach((methodName) => {
      Object.defineProperty(obj, methodName + accessorName, {
        // Null-proto descriptor so a polluted Object.prototype.get cannot turn
        // this data descriptor into an accessor descriptor on the way in.
        __proto__: null,
        value: function(arg1, arg2, arg3) {
          return this[methodName].call(this, header, arg1, arg2, arg3);
        },
        configurable: true
      });
    });
  }
  var AxiosHeaders = class {
    constructor(headers) {
      headers && this.set(headers);
    }
    set(header, valueOrRewrite, rewrite) {
      const self2 = this;
      function setHeader(_value, _header, _rewrite) {
        const lHeader = normalizeHeader(_header);
        if (!lHeader) {
          throw new Error("header name must be a non-empty string");
        }
        const key = utils_default.findKey(self2, lHeader);
        if (!key || self2[key] === void 0 || _rewrite === true || _rewrite === void 0 && self2[key] !== false) {
          self2[key || _header] = normalizeValue(_value);
        }
      }
      const setHeaders = (headers, _rewrite) => utils_default.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));
      if (utils_default.isPlainObject(header) || header instanceof this.constructor) {
        setHeaders(header, valueOrRewrite);
      } else if (utils_default.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
        setHeaders(parseHeaders_default(header), valueOrRewrite);
      } else if (utils_default.isObject(header) && utils_default.isIterable(header)) {
        let obj = {}, dest, key;
        for (const entry of header) {
          if (!utils_default.isArray(entry)) {
            throw TypeError("Object iterator must return a key-value pair");
          }
          obj[key = entry[0]] = (dest = obj[key]) ? utils_default.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]] : entry[1];
        }
        setHeaders(obj, valueOrRewrite);
      } else {
        header != null && setHeader(valueOrRewrite, header, rewrite);
      }
      return this;
    }
    get(header, parser) {
      header = normalizeHeader(header);
      if (header) {
        const key = utils_default.findKey(this, header);
        if (key) {
          const value = this[key];
          if (!parser) {
            return value;
          }
          if (parser === true) {
            return parseTokens(value);
          }
          if (utils_default.isFunction(parser)) {
            return parser.call(this, value, key);
          }
          if (utils_default.isRegExp(parser)) {
            return parser.exec(value);
          }
          throw new TypeError("parser must be boolean|regexp|function");
        }
      }
    }
    has(header, matcher) {
      header = normalizeHeader(header);
      if (header) {
        const key = utils_default.findKey(this, header);
        return !!(key && this[key] !== void 0 && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
      }
      return false;
    }
    delete(header, matcher) {
      const self2 = this;
      let deleted = false;
      function deleteHeader(_header) {
        _header = normalizeHeader(_header);
        if (_header) {
          const key = utils_default.findKey(self2, _header);
          if (key && (!matcher || matchHeaderValue(self2, self2[key], key, matcher))) {
            delete self2[key];
            deleted = true;
          }
        }
      }
      if (utils_default.isArray(header)) {
        header.forEach(deleteHeader);
      } else {
        deleteHeader(header);
      }
      return deleted;
    }
    clear(matcher) {
      const keys = Object.keys(this);
      let i = keys.length;
      let deleted = false;
      while (i--) {
        const key = keys[i];
        if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
          delete this[key];
          deleted = true;
        }
      }
      return deleted;
    }
    normalize(format) {
      const self2 = this;
      const headers = {};
      utils_default.forEach(this, (value, header) => {
        const key = utils_default.findKey(headers, header);
        if (key) {
          self2[key] = normalizeValue(value);
          delete self2[header];
          return;
        }
        const normalized = format ? formatHeader(header) : String(header).trim();
        if (normalized !== header) {
          delete self2[header];
        }
        self2[normalized] = normalizeValue(value);
        headers[normalized] = true;
      });
      return this;
    }
    concat(...targets) {
      return this.constructor.concat(this, ...targets);
    }
    toJSON(asStrings) {
      const obj = /* @__PURE__ */ Object.create(null);
      utils_default.forEach(this, (value, header) => {
        value != null && value !== false && (obj[header] = asStrings && utils_default.isArray(value) ? value.join(", ") : value);
      });
      return obj;
    }
    [Symbol.iterator]() {
      return Object.entries(this.toJSON())[Symbol.iterator]();
    }
    toString() {
      return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join("\n");
    }
    getSetCookie() {
      return this.get("set-cookie") || [];
    }
    get [Symbol.toStringTag]() {
      return "AxiosHeaders";
    }
    static from(thing) {
      return thing instanceof this ? thing : new this(thing);
    }
    static concat(first, ...targets) {
      const computed = new this(first);
      targets.forEach((target) => computed.set(target));
      return computed;
    }
    static accessor(header) {
      const internals = this[$internals] = this[$internals] = {
        accessors: {}
      };
      const accessors = internals.accessors;
      const prototype2 = this.prototype;
      function defineAccessor(_header) {
        const lHeader = normalizeHeader(_header);
        if (!accessors[lHeader]) {
          buildAccessors(prototype2, _header);
          accessors[lHeader] = true;
        }
      }
      utils_default.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);
      return this;
    }
  };
  AxiosHeaders.accessor([
    "Content-Type",
    "Content-Length",
    "Accept",
    "Accept-Encoding",
    "User-Agent",
    "Authorization"
  ]);
  utils_default.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
    let mapped = key[0].toUpperCase() + key.slice(1);
    return {
      get: () => value,
      set(headerValue) {
        this[mapped] = headerValue;
      }
    };
  });
  utils_default.freezeMethods(AxiosHeaders);
  var AxiosHeaders_default = AxiosHeaders;

  // ../node_modules/axios/lib/core/AxiosError.js
  var REDACTED = "[REDACTED ****]";
  function hasOwnOrPrototypeToJSON(source) {
    if (utils_default.hasOwnProp(source, "toJSON")) {
      return true;
    }
    let prototype2 = Object.getPrototypeOf(source);
    while (prototype2 && prototype2 !== Object.prototype) {
      if (utils_default.hasOwnProp(prototype2, "toJSON")) {
        return true;
      }
      prototype2 = Object.getPrototypeOf(prototype2);
    }
    return false;
  }
  function redactConfig(config, redactKeys) {
    const lowerKeys = new Set(redactKeys.map((k) => String(k).toLowerCase()));
    const seen = [];
    const visit = (source) => {
      if (source === null || typeof source !== "object") return source;
      if (utils_default.isBuffer(source)) return source;
      if (seen.indexOf(source) !== -1) return void 0;
      if (source instanceof AxiosHeaders_default) {
        source = source.toJSON();
      }
      seen.push(source);
      let result;
      if (utils_default.isArray(source)) {
        result = [];
        source.forEach((v, i) => {
          const reducedValue = visit(v);
          if (!utils_default.isUndefined(reducedValue)) {
            result[i] = reducedValue;
          }
        });
      } else {
        if (!utils_default.isPlainObject(source) && hasOwnOrPrototypeToJSON(source)) {
          seen.pop();
          return source;
        }
        result = /* @__PURE__ */ Object.create(null);
        for (const [key, value] of Object.entries(source)) {
          const reducedValue = lowerKeys.has(key.toLowerCase()) ? REDACTED : visit(value);
          if (!utils_default.isUndefined(reducedValue)) {
            result[key] = reducedValue;
          }
        }
      }
      seen.pop();
      return result;
    };
    return visit(config);
  }
  var AxiosError = class _AxiosError extends Error {
    static from(error, code, config, request, response, customProps) {
      const axiosError = new _AxiosError(error.message, code || error.code, config, request, response);
      axiosError.cause = error;
      axiosError.name = error.name;
      if (error.status != null && axiosError.status == null) {
        axiosError.status = error.status;
      }
      customProps && Object.assign(axiosError, customProps);
      return axiosError;
    }
    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [config] The config.
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     *
     * @returns {Error} The created error.
     */
    constructor(message, code, config, request, response) {
      super(message);
      Object.defineProperty(this, "message", {
        // Null-proto descriptor so a polluted Object.prototype.get cannot turn
        // this data descriptor into an accessor descriptor on the way in.
        __proto__: null,
        value: message,
        enumerable: true,
        writable: true,
        configurable: true
      });
      this.name = "AxiosError";
      this.isAxiosError = true;
      code && (this.code = code);
      config && (this.config = config);
      request && (this.request = request);
      if (response) {
        this.response = response;
        this.status = response.status;
      }
    }
    toJSON() {
      const config = this.config;
      const redactKeys = config && utils_default.hasOwnProp(config, "redact") ? config.redact : void 0;
      const serializedConfig = utils_default.isArray(redactKeys) && redactKeys.length > 0 ? redactConfig(config, redactKeys) : utils_default.toJSONObject(config);
      return {
        // Standard
        message: this.message,
        name: this.name,
        // Microsoft
        description: this.description,
        number: this.number,
        // Mozilla
        fileName: this.fileName,
        lineNumber: this.lineNumber,
        columnNumber: this.columnNumber,
        stack: this.stack,
        // Axios
        config: serializedConfig,
        code: this.code,
        status: this.status
      };
    }
  };
  AxiosError.ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
  AxiosError.ERR_BAD_OPTION = "ERR_BAD_OPTION";
  AxiosError.ECONNABORTED = "ECONNABORTED";
  AxiosError.ETIMEDOUT = "ETIMEDOUT";
  AxiosError.ECONNREFUSED = "ECONNREFUSED";
  AxiosError.ERR_NETWORK = "ERR_NETWORK";
  AxiosError.ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
  AxiosError.ERR_DEPRECATED = "ERR_DEPRECATED";
  AxiosError.ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
  AxiosError.ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
  AxiosError.ERR_CANCELED = "ERR_CANCELED";
  AxiosError.ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
  AxiosError.ERR_INVALID_URL = "ERR_INVALID_URL";
  AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED = "ERR_FORM_DATA_DEPTH_EXCEEDED";
  var AxiosError_default = AxiosError;

  // ../node_modules/axios/lib/helpers/null.js
  var null_default = null;

  // ../node_modules/axios/lib/helpers/toFormData.js
  function isVisitable(thing) {
    return utils_default.isPlainObject(thing) || utils_default.isArray(thing);
  }
  function removeBrackets(key) {
    return utils_default.endsWith(key, "[]") ? key.slice(0, -2) : key;
  }
  function renderKey(path2, key, dots) {
    if (!path2) return key;
    return path2.concat(key).map(function each(token, i) {
      token = removeBrackets(token);
      return !dots && i ? "[" + token + "]" : token;
    }).join(dots ? "." : "");
  }
  function isFlatArray(arr) {
    return utils_default.isArray(arr) && !arr.some(isVisitable);
  }
  var predicates = utils_default.toFlatObject(utils_default, {}, null, function filter(prop) {
    return /^is[A-Z]/.test(prop);
  });
  function toFormData(obj, formData, options) {
    if (!utils_default.isObject(obj)) {
      throw new TypeError("target must be an object");
    }
    formData = formData || new (null_default || FormData)();
    options = utils_default.toFlatObject(
      options,
      {
        metaTokens: true,
        dots: false,
        indexes: false
      },
      false,
      function defined(option, source) {
        return !utils_default.isUndefined(source[option]);
      }
    );
    const metaTokens = options.metaTokens;
    const visitor = options.visitor || defaultVisitor;
    const dots = options.dots;
    const indexes = options.indexes;
    const _Blob = options.Blob || typeof Blob !== "undefined" && Blob;
    const maxDepth = options.maxDepth === void 0 ? 100 : options.maxDepth;
    const useBlob = _Blob && utils_default.isSpecCompliantForm(formData);
    if (!utils_default.isFunction(visitor)) {
      throw new TypeError("visitor must be a function");
    }
    function convertValue(value) {
      if (value === null) return "";
      if (utils_default.isDate(value)) {
        return value.toISOString();
      }
      if (utils_default.isBoolean(value)) {
        return value.toString();
      }
      if (!useBlob && utils_default.isBlob(value)) {
        throw new AxiosError_default("Blob is not supported. Use a Buffer instead.");
      }
      if (utils_default.isArrayBuffer(value) || utils_default.isTypedArray(value)) {
        return useBlob && typeof Blob === "function" ? new Blob([value]) : Buffer.from(value);
      }
      return value;
    }
    function defaultVisitor(value, key, path2) {
      let arr = value;
      if (utils_default.isReactNative(formData) && utils_default.isReactNativeBlob(value)) {
        formData.append(renderKey(path2, key, dots), convertValue(value));
        return false;
      }
      if (value && !path2 && typeof value === "object") {
        if (utils_default.endsWith(key, "{}")) {
          key = metaTokens ? key : key.slice(0, -2);
          value = JSON.stringify(value);
        } else if (utils_default.isArray(value) && isFlatArray(value) || (utils_default.isFileList(value) || utils_default.endsWith(key, "[]")) && (arr = utils_default.toArray(value))) {
          key = removeBrackets(key);
          arr.forEach(function each(el, index) {
            !(utils_default.isUndefined(el) || el === null) && formData.append(
              // eslint-disable-next-line no-nested-ternary
              indexes === true ? renderKey([key], index, dots) : indexes === null ? key : key + "[]",
              convertValue(el)
            );
          });
          return false;
        }
      }
      if (isVisitable(value)) {
        return true;
      }
      formData.append(renderKey(path2, key, dots), convertValue(value));
      return false;
    }
    const stack = [];
    const exposedHelpers = Object.assign(predicates, {
      defaultVisitor,
      convertValue,
      isVisitable
    });
    function build(value, path2, depth = 0) {
      if (utils_default.isUndefined(value)) return;
      if (depth > maxDepth) {
        throw new AxiosError_default(
          "Object is too deeply nested (" + depth + " levels). Max depth: " + maxDepth,
          AxiosError_default.ERR_FORM_DATA_DEPTH_EXCEEDED
        );
      }
      if (stack.indexOf(value) !== -1) {
        throw Error("Circular reference detected in " + path2.join("."));
      }
      stack.push(value);
      utils_default.forEach(value, function each(el, key) {
        const result = !(utils_default.isUndefined(el) || el === null) && visitor.call(formData, el, utils_default.isString(key) ? key.trim() : key, path2, exposedHelpers);
        if (result === true) {
          build(el, path2 ? path2.concat(key) : [key], depth + 1);
        }
      });
      stack.pop();
    }
    if (!utils_default.isObject(obj)) {
      throw new TypeError("data must be an object");
    }
    build(obj);
    return formData;
  }
  var toFormData_default = toFormData;

  // ../node_modules/axios/lib/helpers/AxiosURLSearchParams.js
  function encode(str) {
    const charMap = {
      "!": "%21",
      "'": "%27",
      "(": "%28",
      ")": "%29",
      "~": "%7E",
      "%20": "+"
    };
    return encodeURIComponent(str).replace(/[!'()~]|%20/g, function replacer(match) {
      return charMap[match];
    });
  }
  function AxiosURLSearchParams(params, options) {
    this._pairs = [];
    params && toFormData_default(params, this, options);
  }
  var prototype = AxiosURLSearchParams.prototype;
  prototype.append = function append(name, value) {
    this._pairs.push([name, value]);
  };
  prototype.toString = function toString2(encoder) {
    const _encode = encoder ? function(value) {
      return encoder.call(this, value, encode);
    } : encode;
    return this._pairs.map(function each(pair) {
      return _encode(pair[0]) + "=" + _encode(pair[1]);
    }, "").join("&");
  };
  var AxiosURLSearchParams_default = AxiosURLSearchParams;

  // ../node_modules/axios/lib/helpers/buildURL.js
  function encode2(val) {
    return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
  }
  function buildURL(url, params, options) {
    if (!params) {
      return url;
    }
    const _encode = options && options.encode || encode2;
    const _options = utils_default.isFunction(options) ? {
      serialize: options
    } : options;
    const serializeFn = _options && _options.serialize;
    let serializedParams;
    if (serializeFn) {
      serializedParams = serializeFn(params, _options);
    } else {
      serializedParams = utils_default.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams_default(params, _options).toString(_encode);
    }
    if (serializedParams) {
      const hashmarkIndex = url.indexOf("#");
      if (hashmarkIndex !== -1) {
        url = url.slice(0, hashmarkIndex);
      }
      url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
    }
    return url;
  }

  // ../node_modules/axios/lib/core/InterceptorManager.js
  var InterceptorManager = class {
    constructor() {
      this.handlers = [];
    }
    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     * @param {Object} options The options for the interceptor, synchronous and runWhen
     *
     * @return {Number} An ID used to remove interceptor later
     */
    use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled,
        rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    }
    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     *
     * @returns {void}
     */
    eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    }
    /**
     * Clear all interceptors from the stack
     *
     * @returns {void}
     */
    clear() {
      if (this.handlers) {
        this.handlers = [];
      }
    }
    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     *
     * @returns {void}
     */
    forEach(fn) {
      utils_default.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    }
  };
  var InterceptorManager_default = InterceptorManager;

  // ../node_modules/axios/lib/defaults/transitional.js
  var transitional_default = {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false,
    legacyInterceptorReqResOrdering: true
  };

  // ../node_modules/axios/lib/platform/browser/classes/URLSearchParams.js
  var URLSearchParams_default = typeof URLSearchParams !== "undefined" ? URLSearchParams : AxiosURLSearchParams_default;

  // ../node_modules/axios/lib/platform/browser/classes/FormData.js
  var FormData_default = typeof FormData !== "undefined" ? FormData : null;

  // ../node_modules/axios/lib/platform/browser/classes/Blob.js
  var Blob_default = typeof Blob !== "undefined" ? Blob : null;

  // ../node_modules/axios/lib/platform/browser/index.js
  var browser_default = {
    isBrowser: true,
    classes: {
      URLSearchParams: URLSearchParams_default,
      FormData: FormData_default,
      Blob: Blob_default
    },
    protocols: ["http", "https", "file", "blob", "url", "data"]
  };

  // ../node_modules/axios/lib/platform/common/utils.js
  var utils_exports = {};
  __export(utils_exports, {
    hasBrowserEnv: () => hasBrowserEnv,
    hasStandardBrowserEnv: () => hasStandardBrowserEnv,
    hasStandardBrowserWebWorkerEnv: () => hasStandardBrowserWebWorkerEnv,
    navigator: () => _navigator,
    origin: () => origin
  });
  var hasBrowserEnv = typeof window !== "undefined" && typeof document !== "undefined";
  var _navigator = typeof navigator === "object" && navigator || void 0;
  var hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || ["ReactNative", "NativeScript", "NS"].indexOf(_navigator.product) < 0);
  var hasStandardBrowserWebWorkerEnv = (() => {
    return typeof WorkerGlobalScope !== "undefined" && // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope && typeof self.importScripts === "function";
  })();
  var origin = hasBrowserEnv && window.location.href || "http://localhost";

  // ../node_modules/axios/lib/platform/index.js
  var platform_default = {
    ...utils_exports,
    ...browser_default
  };

  // ../node_modules/axios/lib/helpers/toURLEncodedForm.js
  function toURLEncodedForm(data, options) {
    return toFormData_default(data, new platform_default.classes.URLSearchParams(), {
      visitor: function(value, key, path2, helpers) {
        if (platform_default.isNode && utils_default.isBuffer(value)) {
          this.append(key, value.toString("base64"));
          return false;
        }
        return helpers.defaultVisitor.apply(this, arguments);
      },
      ...options
    });
  }

  // ../node_modules/axios/lib/helpers/formDataToJSON.js
  function parsePropPath(name) {
    return utils_default.matchAll(/\w+|\[(\w*)]/g, name).map((match) => {
      return match[0] === "[]" ? "" : match[1] || match[0];
    });
  }
  function arrayToObject(arr) {
    const obj = {};
    const keys = Object.keys(arr);
    let i;
    const len = keys.length;
    let key;
    for (i = 0; i < len; i++) {
      key = keys[i];
      obj[key] = arr[key];
    }
    return obj;
  }
  function formDataToJSON(formData) {
    function buildPath(path2, value, target, index) {
      let name = path2[index++];
      if (name === "__proto__") return true;
      const isNumericKey = Number.isFinite(+name);
      const isLast = index >= path2.length;
      name = !name && utils_default.isArray(target) ? target.length : name;
      if (isLast) {
        if (utils_default.hasOwnProp(target, name)) {
          target[name] = utils_default.isArray(target[name]) ? target[name].concat(value) : [target[name], value];
        } else {
          target[name] = value;
        }
        return !isNumericKey;
      }
      if (!utils_default.hasOwnProp(target, name) || !utils_default.isObject(target[name])) {
        target[name] = [];
      }
      const result = buildPath(path2, value, target[name], index);
      if (result && utils_default.isArray(target[name])) {
        target[name] = arrayToObject(target[name]);
      }
      return !isNumericKey;
    }
    if (utils_default.isFormData(formData) && utils_default.isFunction(formData.entries)) {
      const obj = {};
      utils_default.forEachEntry(formData, (name, value) => {
        buildPath(parsePropPath(name), value, obj, 0);
      });
      return obj;
    }
    return null;
  }
  var formDataToJSON_default = formDataToJSON;

  // ../node_modules/axios/lib/defaults/index.js
  var own = (obj, key) => obj != null && utils_default.hasOwnProp(obj, key) ? obj[key] : void 0;
  function stringifySafely(rawValue, parser, encoder) {
    if (utils_default.isString(rawValue)) {
      try {
        (parser || JSON.parse)(rawValue);
        return utils_default.trim(rawValue);
      } catch (e) {
        if (e.name !== "SyntaxError") {
          throw e;
        }
      }
    }
    return (encoder || JSON.stringify)(rawValue);
  }
  var defaults = {
    transitional: transitional_default,
    adapter: ["xhr", "http", "fetch"],
    transformRequest: [
      function transformRequest(data, headers) {
        const contentType = headers.getContentType() || "";
        const hasJSONContentType = contentType.indexOf("application/json") > -1;
        const isObjectPayload = utils_default.isObject(data);
        if (isObjectPayload && utils_default.isHTMLForm(data)) {
          data = new FormData(data);
        }
        const isFormData2 = utils_default.isFormData(data);
        if (isFormData2) {
          return hasJSONContentType ? JSON.stringify(formDataToJSON_default(data)) : data;
        }
        if (utils_default.isArrayBuffer(data) || utils_default.isBuffer(data) || utils_default.isStream(data) || utils_default.isFile(data) || utils_default.isBlob(data) || utils_default.isReadableStream(data)) {
          return data;
        }
        if (utils_default.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils_default.isURLSearchParams(data)) {
          headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", false);
          return data.toString();
        }
        let isFileList2;
        if (isObjectPayload) {
          const formSerializer = own(this, "formSerializer");
          if (contentType.indexOf("application/x-www-form-urlencoded") > -1) {
            return toURLEncodedForm(data, formSerializer).toString();
          }
          if ((isFileList2 = utils_default.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
            const env = own(this, "env");
            const _FormData = env && env.FormData;
            return toFormData_default(
              isFileList2 ? { "files[]": data } : data,
              _FormData && new _FormData(),
              formSerializer
            );
          }
        }
        if (isObjectPayload || hasJSONContentType) {
          headers.setContentType("application/json", false);
          return stringifySafely(data);
        }
        return data;
      }
    ],
    transformResponse: [
      function transformResponse(data) {
        const transitional2 = own(this, "transitional") || defaults.transitional;
        const forcedJSONParsing = transitional2 && transitional2.forcedJSONParsing;
        const responseType = own(this, "responseType");
        const JSONRequested = responseType === "json";
        if (utils_default.isResponse(data) || utils_default.isReadableStream(data)) {
          return data;
        }
        if (data && utils_default.isString(data) && (forcedJSONParsing && !responseType || JSONRequested)) {
          const silentJSONParsing = transitional2 && transitional2.silentJSONParsing;
          const strictJSONParsing = !silentJSONParsing && JSONRequested;
          try {
            return JSON.parse(data, own(this, "parseReviver"));
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === "SyntaxError") {
                throw AxiosError_default.from(e, AxiosError_default.ERR_BAD_RESPONSE, this, null, own(this, "response"));
              }
              throw e;
            }
          }
        }
        return data;
      }
    ],
    /**
     * A timeout in milliseconds to abort a request. If set to 0 (default) a
     * timeout is not created.
     */
    timeout: 0,
    xsrfCookieName: "XSRF-TOKEN",
    xsrfHeaderName: "X-XSRF-TOKEN",
    maxContentLength: -1,
    maxBodyLength: -1,
    env: {
      FormData: platform_default.classes.FormData,
      Blob: platform_default.classes.Blob
    },
    validateStatus: function validateStatus(status) {
      return status >= 200 && status < 300;
    },
    headers: {
      common: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": void 0
      }
    }
  };
  utils_default.forEach(["delete", "get", "head", "post", "put", "patch", "query"], (method) => {
    defaults.headers[method] = {};
  });
  var defaults_default = defaults;

  // ../node_modules/axios/lib/core/transformData.js
  function transformData(fns, response) {
    const config = this || defaults_default;
    const context = response || config;
    const headers = AxiosHeaders_default.from(context.headers);
    let data = context.data;
    utils_default.forEach(fns, function transform(fn) {
      data = fn.call(config, data, headers.normalize(), response ? response.status : void 0);
    });
    headers.normalize();
    return data;
  }

  // ../node_modules/axios/lib/cancel/isCancel.js
  function isCancel(value) {
    return !!(value && value.__CANCEL__);
  }

  // ../node_modules/axios/lib/cancel/CanceledError.js
  var CanceledError = class extends AxiosError_default {
    /**
     * A `CanceledError` is an object that is thrown when an operation is canceled.
     *
     * @param {string=} message The message.
     * @param {Object=} config The config.
     * @param {Object=} request The request.
     *
     * @returns {CanceledError} The created error.
     */
    constructor(message, config, request) {
      super(message == null ? "canceled" : message, AxiosError_default.ERR_CANCELED, config, request);
      this.name = "CanceledError";
      this.__CANCEL__ = true;
    }
  };
  var CanceledError_default = CanceledError;

  // ../node_modules/axios/lib/core/settle.js
  function settle(resolve, reject, response) {
    const validateStatus2 = response.config.validateStatus;
    if (!response.status || !validateStatus2 || validateStatus2(response.status)) {
      resolve(response);
    } else {
      reject(new AxiosError_default(
        "Request failed with status code " + response.status,
        response.status >= 400 && response.status < 500 ? AxiosError_default.ERR_BAD_REQUEST : AxiosError_default.ERR_BAD_RESPONSE,
        response.config,
        response.request,
        response
      ));
    }
  }

  // ../node_modules/axios/lib/helpers/parseProtocol.js
  function parseProtocol(url) {
    const match = /^([-+\w]{1,25}):(?:\/\/)?/.exec(url);
    return match && match[1] || "";
  }

  // ../node_modules/axios/lib/helpers/speedometer.js
  function speedometer(samplesCount, min) {
    samplesCount = samplesCount || 10;
    const bytes = new Array(samplesCount);
    const timestamps = new Array(samplesCount);
    let head = 0;
    let tail = 0;
    let firstSampleTS;
    min = min !== void 0 ? min : 1e3;
    return function push(chunkLength) {
      const now = Date.now();
      const startedAt = timestamps[tail];
      if (!firstSampleTS) {
        firstSampleTS = now;
      }
      bytes[head] = chunkLength;
      timestamps[head] = now;
      let i = tail;
      let bytesCount = 0;
      while (i !== head) {
        bytesCount += bytes[i++];
        i = i % samplesCount;
      }
      head = (head + 1) % samplesCount;
      if (head === tail) {
        tail = (tail + 1) % samplesCount;
      }
      if (now - firstSampleTS < min) {
        return;
      }
      const passed = startedAt && now - startedAt;
      return passed ? Math.round(bytesCount * 1e3 / passed) : void 0;
    };
  }
  var speedometer_default = speedometer;

  // ../node_modules/axios/lib/helpers/throttle.js
  function throttle(fn, freq) {
    let timestamp = 0;
    let threshold = 1e3 / freq;
    let lastArgs;
    let timer;
    const invoke = (args, now = Date.now()) => {
      timestamp = now;
      lastArgs = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      fn(...args);
    };
    const throttled = (...args) => {
      const now = Date.now();
      const passed = now - timestamp;
      if (passed >= threshold) {
        invoke(args, now);
      } else {
        lastArgs = args;
        if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            invoke(lastArgs);
          }, threshold - passed);
        }
      }
    };
    const flush = () => lastArgs && invoke(lastArgs);
    return [throttled, flush];
  }
  var throttle_default = throttle;

  // ../node_modules/axios/lib/helpers/progressEventReducer.js
  var progressEventReducer = (listener, isDownloadStream, freq = 3) => {
    let bytesNotified = 0;
    const _speedometer = speedometer_default(50, 250);
    return throttle_default((e) => {
      if (!e || typeof e.loaded !== "number") {
        return;
      }
      const rawLoaded = e.loaded;
      const total = e.lengthComputable ? e.total : void 0;
      const loaded = total != null ? Math.min(rawLoaded, total) : rawLoaded;
      const progressBytes = Math.max(0, loaded - bytesNotified);
      const rate = _speedometer(progressBytes);
      bytesNotified = Math.max(bytesNotified, loaded);
      const data = {
        loaded,
        total,
        progress: total ? loaded / total : void 0,
        bytes: progressBytes,
        rate: rate ? rate : void 0,
        estimated: rate && total ? (total - loaded) / rate : void 0,
        event: e,
        lengthComputable: total != null,
        [isDownloadStream ? "download" : "upload"]: true
      };
      listener(data);
    }, freq);
  };
  var progressEventDecorator = (total, throttled) => {
    const lengthComputable = total != null;
    return [
      (loaded) => throttled[0]({
        lengthComputable,
        total,
        loaded
      }),
      throttled[1]
    ];
  };
  var asyncDecorator = (fn) => (...args) => utils_default.asap(() => fn(...args));

  // ../node_modules/axios/lib/helpers/isURLSameOrigin.js
  var isURLSameOrigin_default = platform_default.hasStandardBrowserEnv ? /* @__PURE__ */ ((origin2, isMSIE) => (url) => {
    url = new URL(url, platform_default.origin);
    return origin2.protocol === url.protocol && origin2.host === url.host && (isMSIE || origin2.port === url.port);
  })(
    new URL(platform_default.origin),
    platform_default.navigator && /(msie|trident)/i.test(platform_default.navigator.userAgent)
  ) : () => true;

  // ../node_modules/axios/lib/helpers/cookies.js
  var cookies_default = platform_default.hasStandardBrowserEnv ? (
    // Standard browser envs support document.cookie
    {
      write(name, value, expires, path2, domain, secure, sameSite) {
        if (typeof document === "undefined") return;
        const cookie = [`${name}=${encodeURIComponent(value)}`];
        if (utils_default.isNumber(expires)) {
          cookie.push(`expires=${new Date(expires).toUTCString()}`);
        }
        if (utils_default.isString(path2)) {
          cookie.push(`path=${path2}`);
        }
        if (utils_default.isString(domain)) {
          cookie.push(`domain=${domain}`);
        }
        if (secure === true) {
          cookie.push("secure");
        }
        if (utils_default.isString(sameSite)) {
          cookie.push(`SameSite=${sameSite}`);
        }
        document.cookie = cookie.join("; ");
      },
      read(name) {
        if (typeof document === "undefined") return null;
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i].replace(/^\s+/, "");
          const eq = cookie.indexOf("=");
          if (eq !== -1 && cookie.slice(0, eq) === name) {
            return decodeURIComponent(cookie.slice(eq + 1));
          }
        }
        return null;
      },
      remove(name) {
        this.write(name, "", Date.now() - 864e5, "/");
      }
    }
  ) : (
    // Non-standard browser env (web workers, react-native) lack needed support.
    {
      write() {
      },
      read() {
        return null;
      },
      remove() {
      }
    }
  );

  // ../node_modules/axios/lib/helpers/isAbsoluteURL.js
  function isAbsoluteURL(url) {
    if (typeof url !== "string") {
      return false;
    }
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
  }

  // ../node_modules/axios/lib/helpers/combineURLs.js
  function combineURLs(baseURL, relativeURL) {
    return relativeURL ? baseURL.replace(/\/?\/$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
  }

  // ../node_modules/axios/lib/core/buildFullPath.js
  function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
    let isRelativeUrl = !isAbsoluteURL(requestedURL);
    if (baseURL && (isRelativeUrl || allowAbsoluteUrls === false)) {
      return combineURLs(baseURL, requestedURL);
    }
    return requestedURL;
  }

  // ../node_modules/axios/lib/core/mergeConfig.js
  var headersToObject = (thing) => thing instanceof AxiosHeaders_default ? { ...thing } : thing;
  function mergeConfig(config1, config2) {
    config2 = config2 || {};
    const config = /* @__PURE__ */ Object.create(null);
    Object.defineProperty(config, "hasOwnProperty", {
      // Null-proto descriptor so a polluted Object.prototype.get cannot turn
      // this data descriptor into an accessor descriptor on the way in.
      __proto__: null,
      value: Object.prototype.hasOwnProperty,
      enumerable: false,
      writable: true,
      configurable: true
    });
    function getMergedValue(target, source, prop, caseless) {
      if (utils_default.isPlainObject(target) && utils_default.isPlainObject(source)) {
        return utils_default.merge.call({ caseless }, target, source);
      } else if (utils_default.isPlainObject(source)) {
        return utils_default.merge({}, source);
      } else if (utils_default.isArray(source)) {
        return source.slice();
      }
      return source;
    }
    function mergeDeepProperties(a, b, prop, caseless) {
      if (!utils_default.isUndefined(b)) {
        return getMergedValue(a, b, prop, caseless);
      } else if (!utils_default.isUndefined(a)) {
        return getMergedValue(void 0, a, prop, caseless);
      }
    }
    function valueFromConfig2(a, b) {
      if (!utils_default.isUndefined(b)) {
        return getMergedValue(void 0, b);
      }
    }
    function defaultToConfig2(a, b) {
      if (!utils_default.isUndefined(b)) {
        return getMergedValue(void 0, b);
      } else if (!utils_default.isUndefined(a)) {
        return getMergedValue(void 0, a);
      }
    }
    function mergeDirectKeys(a, b, prop) {
      if (utils_default.hasOwnProp(config2, prop)) {
        return getMergedValue(a, b);
      } else if (utils_default.hasOwnProp(config1, prop)) {
        return getMergedValue(void 0, a);
      }
    }
    const mergeMap = {
      url: valueFromConfig2,
      method: valueFromConfig2,
      data: valueFromConfig2,
      baseURL: defaultToConfig2,
      transformRequest: defaultToConfig2,
      transformResponse: defaultToConfig2,
      paramsSerializer: defaultToConfig2,
      timeout: defaultToConfig2,
      timeoutMessage: defaultToConfig2,
      withCredentials: defaultToConfig2,
      withXSRFToken: defaultToConfig2,
      adapter: defaultToConfig2,
      responseType: defaultToConfig2,
      xsrfCookieName: defaultToConfig2,
      xsrfHeaderName: defaultToConfig2,
      onUploadProgress: defaultToConfig2,
      onDownloadProgress: defaultToConfig2,
      decompress: defaultToConfig2,
      maxContentLength: defaultToConfig2,
      maxBodyLength: defaultToConfig2,
      beforeRedirect: defaultToConfig2,
      transport: defaultToConfig2,
      httpAgent: defaultToConfig2,
      httpsAgent: defaultToConfig2,
      cancelToken: defaultToConfig2,
      socketPath: defaultToConfig2,
      allowedSocketPaths: defaultToConfig2,
      responseEncoding: defaultToConfig2,
      validateStatus: mergeDirectKeys,
      headers: (a, b, prop) => mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true)
    };
    utils_default.forEach(Object.keys({ ...config1, ...config2 }), function computeConfigValue(prop) {
      if (prop === "__proto__" || prop === "constructor" || prop === "prototype") return;
      const merge2 = utils_default.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
      const a = utils_default.hasOwnProp(config1, prop) ? config1[prop] : void 0;
      const b = utils_default.hasOwnProp(config2, prop) ? config2[prop] : void 0;
      const configValue = merge2(a, b, prop);
      utils_default.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config[prop] = configValue);
    });
    return config;
  }

  // ../node_modules/axios/lib/helpers/resolveConfig.js
  var FORM_DATA_CONTENT_HEADERS = ["content-type", "content-length"];
  function setFormDataHeaders(headers, formHeaders, policy) {
    if (policy !== "content-only") {
      headers.set(formHeaders);
      return;
    }
    Object.entries(formHeaders).forEach(([key, val]) => {
      if (FORM_DATA_CONTENT_HEADERS.includes(key.toLowerCase())) {
        headers.set(key, val);
      }
    });
  }
  var encodeUTF8 = (str) => encodeURIComponent(str).replace(
    /%([0-9A-F]{2})/gi,
    (_, hex) => String.fromCharCode(parseInt(hex, 16))
  );
  var resolveConfig_default = (config) => {
    const newConfig = mergeConfig({}, config);
    const own2 = (key) => utils_default.hasOwnProp(newConfig, key) ? newConfig[key] : void 0;
    const data = own2("data");
    let withXSRFToken = own2("withXSRFToken");
    const xsrfHeaderName = own2("xsrfHeaderName");
    const xsrfCookieName = own2("xsrfCookieName");
    let headers = own2("headers");
    const auth = own2("auth");
    const baseURL = own2("baseURL");
    const allowAbsoluteUrls = own2("allowAbsoluteUrls");
    const url = own2("url");
    newConfig.headers = headers = AxiosHeaders_default.from(headers);
    newConfig.url = buildURL(
      buildFullPath(baseURL, url, allowAbsoluteUrls),
      config.params,
      config.paramsSerializer
    );
    if (auth) {
      headers.set(
        "Authorization",
        "Basic " + btoa((auth.username || "") + ":" + (auth.password ? encodeUTF8(auth.password) : ""))
      );
    }
    if (utils_default.isFormData(data)) {
      if (platform_default.hasStandardBrowserEnv || platform_default.hasStandardBrowserWebWorkerEnv) {
        headers.setContentType(void 0);
      } else if (utils_default.isFunction(data.getHeaders)) {
        setFormDataHeaders(headers, data.getHeaders(), own2("formDataHeaderPolicy"));
      }
    }
    if (platform_default.hasStandardBrowserEnv) {
      if (utils_default.isFunction(withXSRFToken)) {
        withXSRFToken = withXSRFToken(newConfig);
      }
      const shouldSendXSRF = withXSRFToken === true || withXSRFToken == null && isURLSameOrigin_default(newConfig.url);
      if (shouldSendXSRF) {
        const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies_default.read(xsrfCookieName);
        if (xsrfValue) {
          headers.set(xsrfHeaderName, xsrfValue);
        }
      }
    }
    return newConfig;
  };

  // ../node_modules/axios/lib/adapters/xhr.js
  var isXHRAdapterSupported = typeof XMLHttpRequest !== "undefined";
  var xhr_default = isXHRAdapterSupported && function(config) {
    return new Promise(function dispatchXhrRequest(resolve, reject) {
      const _config = resolveConfig_default(config);
      let requestData = _config.data;
      const requestHeaders = AxiosHeaders_default.from(_config.headers).normalize();
      let { responseType, onUploadProgress, onDownloadProgress } = _config;
      let onCanceled;
      let uploadThrottled, downloadThrottled;
      let flushUpload, flushDownload;
      function done() {
        flushUpload && flushUpload();
        flushDownload && flushDownload();
        _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);
        _config.signal && _config.signal.removeEventListener("abort", onCanceled);
      }
      let request = new XMLHttpRequest();
      request.open(_config.method.toUpperCase(), _config.url, true);
      request.timeout = _config.timeout;
      function onloadend() {
        if (!request) {
          return;
        }
        const responseHeaders = AxiosHeaders_default.from(
          "getAllResponseHeaders" in request && request.getAllResponseHeaders()
        );
        const responseData = !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response;
        const response = {
          data: responseData,
          status: request.status,
          statusText: request.statusText,
          headers: responseHeaders,
          config,
          request
        };
        settle(
          function _resolve(value) {
            resolve(value);
            done();
          },
          function _reject(err) {
            reject(err);
            done();
          },
          response
        );
        request = null;
      }
      if ("onloadend" in request) {
        request.onloadend = onloadend;
      } else {
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }
          if (request.status === 0 && !(request.responseURL && request.responseURL.startsWith("file:"))) {
            return;
          }
          setTimeout(onloadend);
        };
      }
      request.onabort = function handleAbort() {
        if (!request) {
          return;
        }
        reject(new AxiosError_default("Request aborted", AxiosError_default.ECONNABORTED, config, request));
        done();
        request = null;
      };
      request.onerror = function handleError(event) {
        const msg = event && event.message ? event.message : "Network Error";
        const err = new AxiosError_default(msg, AxiosError_default.ERR_NETWORK, config, request);
        err.event = event || null;
        reject(err);
        done();
        request = null;
      };
      request.ontimeout = function handleTimeout() {
        let timeoutErrorMessage = _config.timeout ? "timeout of " + _config.timeout + "ms exceeded" : "timeout exceeded";
        const transitional2 = _config.transitional || transitional_default;
        if (_config.timeoutErrorMessage) {
          timeoutErrorMessage = _config.timeoutErrorMessage;
        }
        reject(
          new AxiosError_default(
            timeoutErrorMessage,
            transitional2.clarifyTimeoutError ? AxiosError_default.ETIMEDOUT : AxiosError_default.ECONNABORTED,
            config,
            request
          )
        );
        done();
        request = null;
      };
      requestData === void 0 && requestHeaders.setContentType(null);
      if ("setRequestHeader" in request) {
        utils_default.forEach(toByteStringHeaderObject(requestHeaders), function setRequestHeader(val, key) {
          request.setRequestHeader(key, val);
        });
      }
      if (!utils_default.isUndefined(_config.withCredentials)) {
        request.withCredentials = !!_config.withCredentials;
      }
      if (responseType && responseType !== "json") {
        request.responseType = _config.responseType;
      }
      if (onDownloadProgress) {
        [downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true);
        request.addEventListener("progress", downloadThrottled);
      }
      if (onUploadProgress && request.upload) {
        [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);
        request.upload.addEventListener("progress", uploadThrottled);
        request.upload.addEventListener("loadend", flushUpload);
      }
      if (_config.cancelToken || _config.signal) {
        onCanceled = (cancel) => {
          if (!request) {
            return;
          }
          reject(!cancel || cancel.type ? new CanceledError_default(null, config, request) : cancel);
          request.abort();
          done();
          request = null;
        };
        _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
        if (_config.signal) {
          _config.signal.aborted ? onCanceled() : _config.signal.addEventListener("abort", onCanceled);
        }
      }
      const protocol = parseProtocol(_config.url);
      if (protocol && !platform_default.protocols.includes(protocol)) {
        reject(
          new AxiosError_default(
            "Unsupported protocol " + protocol + ":",
            AxiosError_default.ERR_BAD_REQUEST,
            config
          )
        );
        return;
      }
      request.send(requestData || null);
    });
  };

  // ../node_modules/axios/lib/helpers/composeSignals.js
  var composeSignals = (signals, timeout) => {
    signals = signals ? signals.filter(Boolean) : [];
    if (!timeout && !signals.length) {
      return;
    }
    const controller = new AbortController();
    let aborted = false;
    const onabort = function(reason) {
      if (!aborted) {
        aborted = true;
        unsubscribe();
        const err = reason instanceof Error ? reason : this.reason;
        controller.abort(
          err instanceof AxiosError_default ? err : new CanceledError_default(err instanceof Error ? err.message : err)
        );
      }
    };
    let timer = timeout && setTimeout(() => {
      timer = null;
      onabort(new AxiosError_default(`timeout of ${timeout}ms exceeded`, AxiosError_default.ETIMEDOUT));
    }, timeout);
    const unsubscribe = () => {
      if (!signals) {
        return;
      }
      timer && clearTimeout(timer);
      timer = null;
      signals.forEach((signal2) => {
        signal2.unsubscribe ? signal2.unsubscribe(onabort) : signal2.removeEventListener("abort", onabort);
      });
      signals = null;
    };
    signals.forEach((signal2) => signal2.addEventListener("abort", onabort));
    const { signal } = controller;
    signal.unsubscribe = () => utils_default.asap(unsubscribe);
    return signal;
  };
  var composeSignals_default = composeSignals;

  // ../node_modules/axios/lib/helpers/trackStream.js
  var streamChunk = function* (chunk, chunkSize) {
    let len = chunk.byteLength;
    if (!chunkSize || len < chunkSize) {
      yield chunk;
      return;
    }
    let pos = 0;
    let end;
    while (pos < len) {
      end = pos + chunkSize;
      yield chunk.slice(pos, end);
      pos = end;
    }
  };
  var readBytes = async function* (iterable, chunkSize) {
    for await (const chunk of readStream(iterable)) {
      yield* streamChunk(chunk, chunkSize);
    }
  };
  var readStream = async function* (stream) {
    if (stream[Symbol.asyncIterator]) {
      yield* stream;
      return;
    }
    const reader = stream.getReader();
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        yield value;
      }
    } finally {
      await reader.cancel();
    }
  };
  var trackStream = (stream, chunkSize, onProgress, onFinish) => {
    const iterator2 = readBytes(stream, chunkSize);
    let bytes = 0;
    let done;
    let _onFinish = (e) => {
      if (!done) {
        done = true;
        onFinish && onFinish(e);
      }
    };
    return new ReadableStream(
      {
        async pull(controller) {
          try {
            const { done: done2, value } = await iterator2.next();
            if (done2) {
              _onFinish();
              controller.close();
              return;
            }
            let len = value.byteLength;
            if (onProgress) {
              let loadedBytes = bytes += len;
              onProgress(loadedBytes);
            }
            controller.enqueue(new Uint8Array(value));
          } catch (err) {
            _onFinish(err);
            throw err;
          }
        },
        cancel(reason) {
          _onFinish(reason);
          return iterator2.return();
        }
      },
      {
        highWaterMark: 2
      }
    );
  };

  // ../node_modules/axios/lib/helpers/estimateDataURLDecodedBytes.js
  function estimateDataURLDecodedBytes(url) {
    if (!url || typeof url !== "string") return 0;
    if (!url.startsWith("data:")) return 0;
    const comma = url.indexOf(",");
    if (comma < 0) return 0;
    const meta = url.slice(5, comma);
    const body = url.slice(comma + 1);
    const isBase64 = /;base64/i.test(meta);
    if (isBase64) {
      let effectiveLen = body.length;
      const len = body.length;
      for (let i = 0; i < len; i++) {
        if (body.charCodeAt(i) === 37 && i + 2 < len) {
          const a = body.charCodeAt(i + 1);
          const b = body.charCodeAt(i + 2);
          const isHex = (a >= 48 && a <= 57 || a >= 65 && a <= 70 || a >= 97 && a <= 102) && (b >= 48 && b <= 57 || b >= 65 && b <= 70 || b >= 97 && b <= 102);
          if (isHex) {
            effectiveLen -= 2;
            i += 2;
          }
        }
      }
      let pad = 0;
      let idx = len - 1;
      const tailIsPct3D = (j) => j >= 2 && body.charCodeAt(j - 2) === 37 && // '%'
      body.charCodeAt(j - 1) === 51 && // '3'
      (body.charCodeAt(j) === 68 || body.charCodeAt(j) === 100);
      if (idx >= 0) {
        if (body.charCodeAt(idx) === 61) {
          pad++;
          idx--;
        } else if (tailIsPct3D(idx)) {
          pad++;
          idx -= 3;
        }
      }
      if (pad === 1 && idx >= 0) {
        if (body.charCodeAt(idx) === 61) {
          pad++;
        } else if (tailIsPct3D(idx)) {
          pad++;
        }
      }
      const groups = Math.floor(effectiveLen / 4);
      const bytes2 = groups * 3 - (pad || 0);
      return bytes2 > 0 ? bytes2 : 0;
    }
    if (typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function") {
      return Buffer.byteLength(body, "utf8");
    }
    let bytes = 0;
    for (let i = 0, len = body.length; i < len; i++) {
      const c = body.charCodeAt(i);
      if (c < 128) {
        bytes += 1;
      } else if (c < 2048) {
        bytes += 2;
      } else if (c >= 55296 && c <= 56319 && i + 1 < len) {
        const next = body.charCodeAt(i + 1);
        if (next >= 56320 && next <= 57343) {
          bytes += 4;
          i++;
        } else {
          bytes += 3;
        }
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  // ../node_modules/axios/lib/env/data.js
  var VERSION = "1.16.1";

  // ../node_modules/axios/lib/adapters/fetch.js
  var DEFAULT_CHUNK_SIZE = 64 * 1024;
  var { isFunction: isFunction2 } = utils_default;
  var test = (fn, ...args) => {
    try {
      return !!fn(...args);
    } catch (e) {
      return false;
    }
  };
  var factory = (env) => {
    const globalObject = utils_default.global !== void 0 && utils_default.global !== null ? utils_default.global : globalThis;
    const { ReadableStream: ReadableStream2, TextEncoder } = globalObject;
    env = utils_default.merge.call(
      {
        skipUndefined: true
      },
      {
        Request: globalObject.Request,
        Response: globalObject.Response
      },
      env
    );
    const { fetch: envFetch, Request, Response } = env;
    const isFetchSupported = envFetch ? isFunction2(envFetch) : typeof fetch === "function";
    const isRequestSupported = isFunction2(Request);
    const isResponseSupported = isFunction2(Response);
    if (!isFetchSupported) {
      return false;
    }
    const isReadableStreamSupported = isFetchSupported && isFunction2(ReadableStream2);
    const encodeText = isFetchSupported && (typeof TextEncoder === "function" ? /* @__PURE__ */ ((encoder) => (str) => encoder.encode(str))(new TextEncoder()) : async (str) => new Uint8Array(await new Request(str).arrayBuffer()));
    const supportsRequestStream = isRequestSupported && isReadableStreamSupported && test(() => {
      let duplexAccessed = false;
      const request = new Request(platform_default.origin, {
        body: new ReadableStream2(),
        method: "POST",
        get duplex() {
          duplexAccessed = true;
          return "half";
        }
      });
      const hasContentType = request.headers.has("Content-Type");
      if (request.body != null) {
        request.body.cancel();
      }
      return duplexAccessed && !hasContentType;
    });
    const supportsResponseStream = isResponseSupported && isReadableStreamSupported && test(() => utils_default.isReadableStream(new Response("").body));
    const resolvers = {
      stream: supportsResponseStream && ((res) => res.body)
    };
    isFetchSupported && (() => {
      ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((type) => {
        !resolvers[type] && (resolvers[type] = (res, config) => {
          let method = res && res[type];
          if (method) {
            return method.call(res);
          }
          throw new AxiosError_default(
            `Response type '${type}' is not supported`,
            AxiosError_default.ERR_NOT_SUPPORT,
            config
          );
        });
      });
    })();
    const getBodyLength = async (body) => {
      if (body == null) {
        return 0;
      }
      if (utils_default.isBlob(body)) {
        return body.size;
      }
      if (utils_default.isSpecCompliantForm(body)) {
        const _request = new Request(platform_default.origin, {
          method: "POST",
          body
        });
        return (await _request.arrayBuffer()).byteLength;
      }
      if (utils_default.isArrayBufferView(body) || utils_default.isArrayBuffer(body)) {
        return body.byteLength;
      }
      if (utils_default.isURLSearchParams(body)) {
        body = body + "";
      }
      if (utils_default.isString(body)) {
        return (await encodeText(body)).byteLength;
      }
    };
    const resolveBodyLength = async (headers, body) => {
      const length = utils_default.toFiniteNumber(headers.getContentLength());
      return length == null ? getBodyLength(body) : length;
    };
    return async (config) => {
      let {
        url,
        method,
        data,
        signal,
        cancelToken,
        timeout,
        onDownloadProgress,
        onUploadProgress,
        responseType,
        headers,
        withCredentials = "same-origin",
        fetchOptions,
        maxContentLength,
        maxBodyLength
      } = resolveConfig_default(config);
      const hasMaxContentLength = utils_default.isNumber(maxContentLength) && maxContentLength > -1;
      const hasMaxBodyLength = utils_default.isNumber(maxBodyLength) && maxBodyLength > -1;
      let _fetch = envFetch || fetch;
      responseType = responseType ? (responseType + "").toLowerCase() : "text";
      let composedSignal = composeSignals_default(
        [signal, cancelToken && cancelToken.toAbortSignal()],
        timeout
      );
      let request = null;
      const unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
        composedSignal.unsubscribe();
      });
      let requestContentLength;
      try {
        if (hasMaxContentLength && typeof url === "string" && url.startsWith("data:")) {
          const estimated = estimateDataURLDecodedBytes(url);
          if (estimated > maxContentLength) {
            throw new AxiosError_default(
              "maxContentLength size of " + maxContentLength + " exceeded",
              AxiosError_default.ERR_BAD_RESPONSE,
              config,
              request
            );
          }
        }
        if (hasMaxBodyLength && method !== "get" && method !== "head") {
          const outboundLength = await resolveBodyLength(headers, data);
          if (typeof outboundLength === "number" && isFinite(outboundLength) && outboundLength > maxBodyLength) {
            throw new AxiosError_default(
              "Request body larger than maxBodyLength limit",
              AxiosError_default.ERR_BAD_REQUEST,
              config,
              request
            );
          }
        }
        if (onUploadProgress && supportsRequestStream && method !== "get" && method !== "head" && (requestContentLength = await resolveBodyLength(headers, data)) !== 0) {
          let _request = new Request(url, {
            method: "POST",
            body: data,
            duplex: "half"
          });
          let contentTypeHeader;
          if (utils_default.isFormData(data) && (contentTypeHeader = _request.headers.get("content-type"))) {
            headers.setContentType(contentTypeHeader);
          }
          if (_request.body) {
            const [onProgress, flush] = progressEventDecorator(
              requestContentLength,
              progressEventReducer(asyncDecorator(onUploadProgress))
            );
            data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, onProgress, flush);
          }
        }
        if (!utils_default.isString(withCredentials)) {
          withCredentials = withCredentials ? "include" : "omit";
        }
        const isCredentialsSupported = isRequestSupported && "credentials" in Request.prototype;
        if (utils_default.isFormData(data)) {
          const contentType = headers.getContentType();
          if (contentType && /^multipart\/form-data/i.test(contentType) && !/boundary=/i.test(contentType)) {
            headers.delete("content-type");
          }
        }
        headers.set("User-Agent", "axios/" + VERSION, false);
        const resolvedOptions = {
          ...fetchOptions,
          signal: composedSignal,
          method: method.toUpperCase(),
          headers: toByteStringHeaderObject(headers.normalize()),
          body: data,
          duplex: "half",
          credentials: isCredentialsSupported ? withCredentials : void 0
        };
        request = isRequestSupported && new Request(url, resolvedOptions);
        let response = await (isRequestSupported ? _fetch(request, fetchOptions) : _fetch(url, resolvedOptions));
        if (hasMaxContentLength) {
          const declaredLength = utils_default.toFiniteNumber(response.headers.get("content-length"));
          if (declaredLength != null && declaredLength > maxContentLength) {
            throw new AxiosError_default(
              "maxContentLength size of " + maxContentLength + " exceeded",
              AxiosError_default.ERR_BAD_RESPONSE,
              config,
              request
            );
          }
        }
        const isStreamResponse = supportsResponseStream && (responseType === "stream" || responseType === "response");
        if (supportsResponseStream && response.body && (onDownloadProgress || hasMaxContentLength || isStreamResponse && unsubscribe)) {
          const options = {};
          ["status", "statusText", "headers"].forEach((prop) => {
            options[prop] = response[prop];
          });
          const responseContentLength = utils_default.toFiniteNumber(response.headers.get("content-length"));
          const [onProgress, flush] = onDownloadProgress && progressEventDecorator(
            responseContentLength,
            progressEventReducer(asyncDecorator(onDownloadProgress), true)
          ) || [];
          let bytesRead = 0;
          const onChunkProgress = (loadedBytes) => {
            if (hasMaxContentLength) {
              bytesRead = loadedBytes;
              if (bytesRead > maxContentLength) {
                throw new AxiosError_default(
                  "maxContentLength size of " + maxContentLength + " exceeded",
                  AxiosError_default.ERR_BAD_RESPONSE,
                  config,
                  request
                );
              }
            }
            onProgress && onProgress(loadedBytes);
          };
          response = new Response(
            trackStream(response.body, DEFAULT_CHUNK_SIZE, onChunkProgress, () => {
              flush && flush();
              unsubscribe && unsubscribe();
            }),
            options
          );
        }
        responseType = responseType || "text";
        let responseData = await resolvers[utils_default.findKey(resolvers, responseType) || "text"](
          response,
          config
        );
        if (hasMaxContentLength && !supportsResponseStream && !isStreamResponse) {
          let materializedSize;
          if (responseData != null) {
            if (typeof responseData.byteLength === "number") {
              materializedSize = responseData.byteLength;
            } else if (typeof responseData.size === "number") {
              materializedSize = responseData.size;
            } else if (typeof responseData === "string") {
              materializedSize = typeof TextEncoder === "function" ? new TextEncoder().encode(responseData).byteLength : responseData.length;
            }
          }
          if (typeof materializedSize === "number" && materializedSize > maxContentLength) {
            throw new AxiosError_default(
              "maxContentLength size of " + maxContentLength + " exceeded",
              AxiosError_default.ERR_BAD_RESPONSE,
              config,
              request
            );
          }
        }
        !isStreamResponse && unsubscribe && unsubscribe();
        return await new Promise((resolve, reject) => {
          settle(resolve, reject, {
            data: responseData,
            headers: AxiosHeaders_default.from(response.headers),
            status: response.status,
            statusText: response.statusText,
            config,
            request
          });
        });
      } catch (err) {
        unsubscribe && unsubscribe();
        if (composedSignal && composedSignal.aborted && composedSignal.reason instanceof AxiosError_default) {
          const canceledError = composedSignal.reason;
          canceledError.config = config;
          request && (canceledError.request = request);
          err !== canceledError && (canceledError.cause = err);
          throw canceledError;
        }
        if (err && err.name === "TypeError" && /Load failed|fetch/i.test(err.message)) {
          throw Object.assign(
            new AxiosError_default(
              "Network Error",
              AxiosError_default.ERR_NETWORK,
              config,
              request,
              err && err.response
            ),
            {
              cause: err.cause || err
            }
          );
        }
        throw AxiosError_default.from(err, err && err.code, config, request, err && err.response);
      }
    };
  };
  var seedCache = /* @__PURE__ */ new Map();
  var getFetch = (config) => {
    let env = config && config.env || {};
    const { fetch: fetch2, Request, Response } = env;
    const seeds = [Request, Response, fetch2];
    let len = seeds.length, i = len, seed, target, map = seedCache;
    while (i--) {
      seed = seeds[i];
      target = map.get(seed);
      target === void 0 && map.set(seed, target = i ? /* @__PURE__ */ new Map() : factory(env));
      map = target;
    }
    return target;
  };
  var adapter = getFetch();

  // ../node_modules/axios/lib/adapters/adapters.js
  var knownAdapters = {
    http: null_default,
    xhr: xhr_default,
    fetch: {
      get: getFetch
    }
  };
  utils_default.forEach(knownAdapters, (fn, value) => {
    if (fn) {
      try {
        Object.defineProperty(fn, "name", { __proto__: null, value });
      } catch (e) {
      }
      Object.defineProperty(fn, "adapterName", { __proto__: null, value });
    }
  });
  var renderReason = (reason) => `- ${reason}`;
  var isResolvedHandle = (adapter2) => utils_default.isFunction(adapter2) || adapter2 === null || adapter2 === false;
  function getAdapter(adapters, config) {
    adapters = utils_default.isArray(adapters) ? adapters : [adapters];
    const { length } = adapters;
    let nameOrAdapter;
    let adapter2;
    const rejectedReasons = {};
    for (let i = 0; i < length; i++) {
      nameOrAdapter = adapters[i];
      let id;
      adapter2 = nameOrAdapter;
      if (!isResolvedHandle(nameOrAdapter)) {
        adapter2 = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];
        if (adapter2 === void 0) {
          throw new AxiosError_default(`Unknown adapter '${id}'`);
        }
      }
      if (adapter2 && (utils_default.isFunction(adapter2) || (adapter2 = adapter2.get(config)))) {
        break;
      }
      rejectedReasons[id || "#" + i] = adapter2;
    }
    if (!adapter2) {
      const reasons = Object.entries(rejectedReasons).map(
        ([id, state]) => `adapter ${id} ` + (state === false ? "is not supported by the environment" : "is not available in the build")
      );
      let s = length ? reasons.length > 1 ? "since :\n" + reasons.map(renderReason).join("\n") : " " + renderReason(reasons[0]) : "as no adapter specified";
      throw new AxiosError_default(
        `There is no suitable adapter to dispatch the request ` + s,
        "ERR_NOT_SUPPORT"
      );
    }
    return adapter2;
  }
  var adapters_default = {
    /**
     * Resolve an adapter from a list of adapter names or functions.
     * @type {Function}
     */
    getAdapter,
    /**
     * Exposes all known adapters
     * @type {Object<string, Function|Object>}
     */
    adapters: knownAdapters
  };

  // ../node_modules/axios/lib/core/dispatchRequest.js
  function throwIfCancellationRequested(config) {
    if (config.cancelToken) {
      config.cancelToken.throwIfRequested();
    }
    if (config.signal && config.signal.aborted) {
      throw new CanceledError_default(null, config);
    }
  }
  function dispatchRequest(config) {
    throwIfCancellationRequested(config);
    config.headers = AxiosHeaders_default.from(config.headers);
    config.data = transformData.call(config, config.transformRequest);
    if (["post", "put", "patch"].indexOf(config.method) !== -1) {
      config.headers.setContentType("application/x-www-form-urlencoded", false);
    }
    const adapter2 = adapters_default.getAdapter(config.adapter || defaults_default.adapter, config);
    return adapter2(config).then(
      function onAdapterResolution(response) {
        throwIfCancellationRequested(config);
        config.response = response;
        try {
          response.data = transformData.call(config, config.transformResponse, response);
        } finally {
          delete config.response;
        }
        response.headers = AxiosHeaders_default.from(response.headers);
        return response;
      },
      function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);
          if (reason && reason.response) {
            config.response = reason.response;
            try {
              reason.response.data = transformData.call(
                config,
                config.transformResponse,
                reason.response
              );
            } finally {
              delete config.response;
            }
            reason.response.headers = AxiosHeaders_default.from(reason.response.headers);
          }
        }
        return Promise.reject(reason);
      }
    );
  }

  // ../node_modules/axios/lib/helpers/validator.js
  var validators = {};
  ["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
    validators[type] = function validator(thing) {
      return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
    };
  });
  var deprecatedWarnings = {};
  validators.transitional = function transitional(validator, version, message) {
    function formatMessage(opt, desc) {
      return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
    }
    return (value, opt, opts) => {
      if (validator === false) {
        throw new AxiosError_default(
          formatMessage(opt, " has been removed" + (version ? " in " + version : "")),
          AxiosError_default.ERR_DEPRECATED
        );
      }
      if (version && !deprecatedWarnings[opt]) {
        deprecatedWarnings[opt] = true;
        console.warn(
          formatMessage(
            opt,
            " has been deprecated since v" + version + " and will be removed in the near future"
          )
        );
      }
      return validator ? validator(value, opt, opts) : true;
    };
  };
  validators.spelling = function spelling(correctSpelling) {
    return (value, opt) => {
      console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
      return true;
    };
  };
  function assertOptions(options, schema, allowUnknown) {
    if (typeof options !== "object") {
      throw new AxiosError_default("options must be an object", AxiosError_default.ERR_BAD_OPTION_VALUE);
    }
    const keys = Object.keys(options);
    let i = keys.length;
    while (i-- > 0) {
      const opt = keys[i];
      const validator = Object.prototype.hasOwnProperty.call(schema, opt) ? schema[opt] : void 0;
      if (validator) {
        const value = options[opt];
        const result = value === void 0 || validator(value, opt, options);
        if (result !== true) {
          throw new AxiosError_default(
            "option " + opt + " must be " + result,
            AxiosError_default.ERR_BAD_OPTION_VALUE
          );
        }
        continue;
      }
      if (allowUnknown !== true) {
        throw new AxiosError_default("Unknown option " + opt, AxiosError_default.ERR_BAD_OPTION);
      }
    }
  }
  var validator_default = {
    assertOptions,
    validators
  };

  // ../node_modules/axios/lib/core/Axios.js
  var validators2 = validator_default.validators;
  var Axios = class {
    constructor(instanceConfig) {
      this.defaults = instanceConfig || {};
      this.interceptors = {
        request: new InterceptorManager_default(),
        response: new InterceptorManager_default()
      };
    }
    /**
     * Dispatch a request
     *
     * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
     * @param {?Object} config
     *
     * @returns {Promise} The Promise to be fulfilled
     */
    async request(configOrUrl, config) {
      try {
        return await this._request(configOrUrl, config);
      } catch (err) {
        if (err instanceof Error) {
          let dummy = {};
          Error.captureStackTrace ? Error.captureStackTrace(dummy) : dummy = new Error();
          const stack = (() => {
            if (!dummy.stack) {
              return "";
            }
            const firstNewlineIndex = dummy.stack.indexOf("\n");
            return firstNewlineIndex === -1 ? "" : dummy.stack.slice(firstNewlineIndex + 1);
          })();
          try {
            if (!err.stack) {
              err.stack = stack;
            } else if (stack) {
              const firstNewlineIndex = stack.indexOf("\n");
              const secondNewlineIndex = firstNewlineIndex === -1 ? -1 : stack.indexOf("\n", firstNewlineIndex + 1);
              const stackWithoutTwoTopLines = secondNewlineIndex === -1 ? "" : stack.slice(secondNewlineIndex + 1);
              if (!String(err.stack).endsWith(stackWithoutTwoTopLines)) {
                err.stack += "\n" + stack;
              }
            }
          } catch (e) {
          }
        }
        throw err;
      }
    }
    _request(configOrUrl, config) {
      if (typeof configOrUrl === "string") {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }
      config = mergeConfig(this.defaults, config);
      const { transitional: transitional2, paramsSerializer, headers } = config;
      if (transitional2 !== void 0) {
        validator_default.assertOptions(
          transitional2,
          {
            silentJSONParsing: validators2.transitional(validators2.boolean),
            forcedJSONParsing: validators2.transitional(validators2.boolean),
            clarifyTimeoutError: validators2.transitional(validators2.boolean),
            legacyInterceptorReqResOrdering: validators2.transitional(validators2.boolean)
          },
          false
        );
      }
      if (paramsSerializer != null) {
        if (utils_default.isFunction(paramsSerializer)) {
          config.paramsSerializer = {
            serialize: paramsSerializer
          };
        } else {
          validator_default.assertOptions(
            paramsSerializer,
            {
              encode: validators2.function,
              serialize: validators2.function
            },
            true
          );
        }
      }
      if (config.allowAbsoluteUrls !== void 0) {
      } else if (this.defaults.allowAbsoluteUrls !== void 0) {
        config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
      } else {
        config.allowAbsoluteUrls = true;
      }
      validator_default.assertOptions(
        config,
        {
          baseUrl: validators2.spelling("baseURL"),
          withXsrfToken: validators2.spelling("withXSRFToken")
        },
        true
      );
      config.method = (config.method || this.defaults.method || "get").toLowerCase();
      let contextHeaders = headers && utils_default.merge(headers.common, headers[config.method]);
      headers && utils_default.forEach(["delete", "get", "head", "post", "put", "patch", "query", "common"], (method) => {
        delete headers[method];
      });
      config.headers = AxiosHeaders_default.concat(contextHeaders, headers);
      const requestInterceptorChain = [];
      let synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === "function" && interceptor.runWhen(config) === false) {
          return;
        }
        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
        const transitional3 = config.transitional || transitional_default;
        const legacyInterceptorReqResOrdering = transitional3 && transitional3.legacyInterceptorReqResOrdering;
        if (legacyInterceptorReqResOrdering) {
          requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
        } else {
          requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
        }
      });
      const responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });
      let promise;
      let i = 0;
      let len;
      if (!synchronousRequestInterceptors) {
        const chain = [dispatchRequest.bind(this), void 0];
        chain.unshift(...requestInterceptorChain);
        chain.push(...responseInterceptorChain);
        len = chain.length;
        promise = Promise.resolve(config);
        while (i < len) {
          promise = promise.then(chain[i++], chain[i++]);
        }
        return promise;
      }
      len = requestInterceptorChain.length;
      let newConfig = config;
      while (i < len) {
        const onFulfilled = requestInterceptorChain[i++];
        const onRejected = requestInterceptorChain[i++];
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected.call(this, error);
          break;
        }
      }
      try {
        promise = dispatchRequest.call(this, newConfig);
      } catch (error) {
        return Promise.reject(error);
      }
      i = 0;
      len = responseInterceptorChain.length;
      while (i < len) {
        promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
      }
      return promise;
    }
    getUri(config) {
      config = mergeConfig(this.defaults, config);
      const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
      return buildURL(fullPath, config.params, config.paramsSerializer);
    }
  };
  utils_default.forEach(["delete", "get", "head", "options"], function forEachMethodNoData(method) {
    Axios.prototype[method] = function(url, config) {
      return this.request(
        mergeConfig(config || {}, {
          method,
          url,
          data: (config || {}).data
        })
      );
    };
  });
  utils_default.forEach(["post", "put", "patch", "query"], function forEachMethodWithData(method) {
    function generateHTTPMethod(isForm) {
      return function httpMethod(url, data, config) {
        return this.request(
          mergeConfig(config || {}, {
            method,
            headers: isForm ? {
              "Content-Type": "multipart/form-data"
            } : {},
            url,
            data
          })
        );
      };
    }
    Axios.prototype[method] = generateHTTPMethod();
    if (method !== "query") {
      Axios.prototype[method + "Form"] = generateHTTPMethod(true);
    }
  });
  var Axios_default = Axios;

  // ../node_modules/axios/lib/cancel/CancelToken.js
  var CancelToken = class _CancelToken {
    constructor(executor) {
      if (typeof executor !== "function") {
        throw new TypeError("executor must be a function.");
      }
      let resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });
      const token = this;
      this.promise.then((cancel) => {
        if (!token._listeners) return;
        let i = token._listeners.length;
        while (i-- > 0) {
          token._listeners[i](cancel);
        }
        token._listeners = null;
      });
      this.promise.then = (onfulfilled) => {
        let _resolve;
        const promise = new Promise((resolve) => {
          token.subscribe(resolve);
          _resolve = resolve;
        }).then(onfulfilled);
        promise.cancel = function reject() {
          token.unsubscribe(_resolve);
        };
        return promise;
      };
      executor(function cancel(message, config, request) {
        if (token.reason) {
          return;
        }
        token.reason = new CanceledError_default(message, config, request);
        resolvePromise(token.reason);
      });
    }
    /**
     * Throws a `CanceledError` if cancellation has been requested.
     */
    throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    }
    /**
     * Subscribe to the cancel signal
     */
    subscribe(listener) {
      if (this.reason) {
        listener(this.reason);
        return;
      }
      if (this._listeners) {
        this._listeners.push(listener);
      } else {
        this._listeners = [listener];
      }
    }
    /**
     * Unsubscribe from the cancel signal
     */
    unsubscribe(listener) {
      if (!this._listeners) {
        return;
      }
      const index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    }
    toAbortSignal() {
      const controller = new AbortController();
      const abort = (err) => {
        controller.abort(err);
      };
      this.subscribe(abort);
      controller.signal.unsubscribe = () => this.unsubscribe(abort);
      return controller.signal;
    }
    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    static source() {
      let cancel;
      const token = new _CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token,
        cancel
      };
    }
  };
  var CancelToken_default = CancelToken;

  // ../node_modules/axios/lib/helpers/spread.js
  function spread(callback) {
    return function wrap(arr) {
      return callback.apply(null, arr);
    };
  }

  // ../node_modules/axios/lib/helpers/isAxiosError.js
  function isAxiosError(payload) {
    return utils_default.isObject(payload) && payload.isAxiosError === true;
  }

  // ../node_modules/axios/lib/helpers/HttpStatusCode.js
  var HttpStatusCode = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    ImUsed: 226,
    MultipleChoices: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    UseProxy: 305,
    Unused: 306,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UriTooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableEntity: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgradeRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HttpVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
    WebServerIsDown: 521,
    ConnectionTimedOut: 522,
    OriginIsUnreachable: 523,
    TimeoutOccurred: 524,
    SslHandshakeFailed: 525,
    InvalidSslCertificate: 526
  };
  Object.entries(HttpStatusCode).forEach(([key, value]) => {
    HttpStatusCode[value] = key;
  });
  var HttpStatusCode_default = HttpStatusCode;

  // ../node_modules/axios/lib/axios.js
  function createInstance(defaultConfig) {
    const context = new Axios_default(defaultConfig);
    const instance = bind(Axios_default.prototype.request, context);
    utils_default.extend(instance, Axios_default.prototype, context, { allOwnKeys: true });
    utils_default.extend(instance, context, null, { allOwnKeys: true });
    instance.create = function create2(instanceConfig) {
      return createInstance(mergeConfig(defaultConfig, instanceConfig));
    };
    return instance;
  }
  var axios = createInstance(defaults_default);
  axios.Axios = Axios_default;
  axios.CanceledError = CanceledError_default;
  axios.CancelToken = CancelToken_default;
  axios.isCancel = isCancel;
  axios.VERSION = VERSION;
  axios.toFormData = toFormData_default;
  axios.AxiosError = AxiosError_default;
  axios.Cancel = axios.CanceledError;
  axios.all = function all(promises) {
    return Promise.all(promises);
  };
  axios.spread = spread;
  axios.isAxiosError = isAxiosError;
  axios.mergeConfig = mergeConfig;
  axios.AxiosHeaders = AxiosHeaders_default;
  axios.formToJSON = (thing) => formDataToJSON_default(utils_default.isHTMLForm(thing) ? new FormData(thing) : thing);
  axios.getAdapter = adapters_default.getAdapter;
  axios.HttpStatusCode = HttpStatusCode_default;
  axios.default = axios;
  var axios_default = axios;

  // ../node_modules/axios/index.js
  var {
    Axios: Axios2,
    AxiosError: AxiosError2,
    CanceledError: CanceledError2,
    isCancel: isCancel2,
    CancelToken: CancelToken2,
    VERSION: VERSION2,
    all: all2,
    Cancel,
    isAxiosError: isAxiosError2,
    spread: spread2,
    toFormData: toFormData2,
    AxiosHeaders: AxiosHeaders2,
    HttpStatusCode: HttpStatusCode2,
    formToJSON,
    getAdapter: getAdapter2,
    mergeConfig: mergeConfig2,
    create
  } = axios_default;

  // crypto_mock.ts
  function createHash(algo) {
    return {
      update: (data) => ({
        digest: (format) => {
          let hash = 0;
          for (let i = 0; i < data.length; i++) {
            hash = (hash << 5) - hash + data.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash).toString(16);
        }
      })
    };
  }

  // ml/CacheKeys.ts
  var DAY_ORDER = ["L", "M", "Mi", "J", "V"];
  var DAY_RANK = new Map(DAY_ORDER.map((day, index) => [day, index]));
  var SIMPLE_RANGE_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?-(\d{1,2}):(\d{2})(?::\d{2})?$/;
  var SECTION_RE = /^(L|M|Mi|J|V):(\d{1,2}):(\d{2})(?::\d{2})?-(\d{1,2}):(\d{2})(?::\d{2})?$/;
  function canonicalizeTime(hourRaw, minuteRaw) {
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error(`Hora invalida: ${hourRaw}:${minuteRaw}`);
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error(`Minuto invalido: ${hourRaw}:${minuteRaw}`);
    }
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }
  function canonicalizeHorario(horario) {
    const text = horario.trim();
    if (!text) {
      throw new Error("horario no puede estar vacio.");
    }
    const simple = SIMPLE_RANGE_RE.exec(text);
    if (simple) {
      const start = canonicalizeTime(simple[1], simple[2]);
      const end = canonicalizeTime(simple[3], simple[4]);
      const range = `${start}-${end}`;
      return `L:${range}|Mi:${range}|V:${range}`;
    }
    const sections = text.split("|").map((part) => part.trim()).filter(Boolean);
    if (sections.length === 0) {
      throw new Error(`horario invalido: ${horario}`);
    }
    const parsed = sections.map((section) => {
      const match = SECTION_RE.exec(section);
      if (!match) {
        throw new Error(`horario invalido: ${horario}`);
      }
      const day = match[1];
      const start = canonicalizeTime(match[2], match[3]);
      const end = canonicalizeTime(match[4], match[5]);
      return {
        day,
        start,
        end,
        rank: DAY_RANK.get(day) ?? 999
      };
    });
    parsed.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.start !== b.start) return a.start.localeCompare(b.start);
      return a.end.localeCompare(b.end);
    });
    return parsed.map((part) => `${part.day}:${part.start}-${part.end}`).join("|");
  }
  function sijhKey(eco, uea, horario) {
    return `Sijh:v2:${eco}:${uea}:${canonicalizeHorario(horario)}`;
  }
  function canonicalizePenaltyPayload(payload) {
    return {
      eco: String(payload.eco).trim(),
      horario: canonicalizeHorario(payload.horario),
      ueas_asignadas_actuales: payload.ueas_asignadas_actuales.map((value) => String(value).trim()),
      horarios_asignados_actuales: payload.horarios_asignados_actuales.map(canonicalizeHorario),
      uea_prediccion: String(payload.uea_prediccion).trim(),
      ...payload.session_id ? { session_id: payload.session_id } : {}
    };
  }
  function serializePenaltyPayload(payload) {
    const canonical = canonicalizePenaltyPayload(payload);
    return JSON.stringify({
      eco: canonical.eco,
      horario: canonical.horario,
      ueas_asignadas_actuales: canonical.ueas_asignadas_actuales,
      horarios_asignados_actuales: canonical.horarios_asignados_actuales,
      uea_prediccion: canonical.uea_prediccion
    });
  }

  // ml/ModeloSijhBrowser.ts
  var ModeloSijhBrowser = class {
    cacheInternaGRASP = /* @__PURE__ */ new Map();
    gruposDict = /* @__PURE__ */ new Map();
    _lambda_j;
    _lambda_ih;
    constructor(lambda_j = 1, lambda_ih = 1) {
      this._lambda_j = lambda_j;
      this._lambda_ih = lambda_ih;
    }
    async inicializar(profesores, grupos, refrescarCacheDePython = false) {
      this.cacheInternaGRASP.clear();
      this.gruposDict.clear();
      for (const g of grupos) {
        this.gruposDict.set(g.idUeaGrupo, g);
      }
      const redisUrl = localStorage.getItem("cfg_redis_url") || "http://127.0.0.1:7379";
      console.log(`ModeloSijhBrowser: Iniciando carga desde proxy HTTP Webdis en ${redisUrl}`);
      const redisKeysSet = /* @__PURE__ */ new Set();
      for (const prof of profesores) {
        for (const g of grupos) {
          if (!g.horarioStringRaw) continue;
          try {
            const rKey = sijhKey(prof.numeroEconomico, g.ueaClave, g.horarioStringRaw);
            redisKeysSet.add(rKey);
          } catch {
            continue;
          }
        }
      }
      const redisKeysArr = Array.from(redisKeysSet);
      const chunkSize = 50;
      for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
        const chunk = redisKeysArr.slice(i, i + chunkSize);
        try {
          const url = `${redisUrl.replace(/\/$/, "")}/MGET/${chunk.join("/")}`;
          const response = await axios_default.get(url);
          const resultados = response.data.MGET || [];
          for (let j = 0; j < chunk.length; j++) {
            const redisRes = resultados[j];
            const key = chunk[j];
            if (redisRes) {
              try {
                const parsing = JSON.parse(redisRes);
                const rhat = typeof parsing.rhat === "number" ? parsing.rhat : 0;
                const h_ih = typeof parsing.h_ih === "number" ? parsing.h_ih : 0;
                this.cacheInternaGRASP.set(key, { rhat, h_ih });
              } catch (e) {
                this.cacheInternaGRASP.set(key, { rhat: 0, h_ih: 0 });
              }
            } else {
              this.cacheInternaGRASP.set(key, { rhat: 0, h_ih: 0 });
            }
          }
        } catch (err) {
          console.error(`Error cargando chunk MGET en Webdis:`, err);
          for (const key of chunk) {
            this.cacheInternaGRASP.set(key, { rhat: 0, h_ih: 0 });
          }
        }
      }
      console.log(`ModeloSijhBrowser: Carga completada. ${this.cacheInternaGRASP.size} entradas cargadas.`);
    }
    getScoreDetails(profesorId, grupoId) {
      const grupo = this.gruposDict.get(grupoId);
      if (!grupo || !grupo.horarioStringRaw) return { score: 0, h_ih: 0, rhat: 0 };
      let rKey;
      try {
        rKey = sijhKey(profesorId, grupo.ueaClave, canonicalizeHorario(grupo.horarioStringRaw));
      } catch {
        return { score: 0, h_ih: 0, rhat: 0 };
      }
      const entry = this.cacheInternaGRASP.get(rKey);
      const rhat = entry ? entry.rhat : 0;
      const h_ih = entry ? entry.h_ih : 0;
      const scoreFinal = this._lambda_j * rhat + this._lambda_ih * h_ih;
      const score = Math.round(scoreFinal * 1e8) / 1e8;
      return { score, h_ih, rhat };
    }
    score(profesorId, grupoId) {
      return this.getScoreDetails(profesorId, grupoId).score;
    }
  };

  // ml/ModeloPenaltyBrowser.ts
  var ModeloPenaltyBrowser = class {
    cachePenaltyBase = /* @__PURE__ */ new Map();
    // key: eco_horario -> total_penalty
    cacheLoads = /* @__PURE__ */ new Map();
    // key: eco -> loads[]
    cacheBest5 = /* @__PURE__ */ new Map();
    // key: eco -> best_5[]
    _penalty_mean = 0;
    _penalty_std = 1;
    _statsInicializados = false;
    get estadisticosPenalty() {
      return { mean: this._penalty_mean, std: this._penalty_std };
    }
    get tieneEstadisticosPenalty() {
      return this._statsInicializados;
    }
    async inicializar(profesores, grupos) {
      this.cachePenaltyBase.clear();
      this.cacheLoads.clear();
      this.cacheBest5.clear();
      this._statsInicializados = false;
      const redisUrl = localStorage.getItem("cfg_redis_url") || "http://127.0.0.1:7379";
      const redisKeysArr = this._crearRedisKeys(profesores, grupos);
      const chunkSize = 50;
      const penaltyValues = [];
      console.log(`ModeloPenaltyBrowser: Cargando ${redisKeysArr.length} predicciones baseline desde Webdis...`);
      for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
        const chunk = redisKeysArr.slice(i, i + chunkSize);
        try {
          const url = `${redisUrl.replace(/\/$/, "")}/MGET/${chunk.join("/")}`;
          const response = await axios_default.get(url);
          const resultados = response.data.MGET || [];
          for (let j = 0; j < chunk.length; j++) {
            const res = resultados[j];
            if (!res) continue;
            try {
              const data = JSON.parse(res);
              const keyParts = chunk[j].split("_");
              const eco = parseInt(keyParts[1]);
              const horario = keyParts.slice(2).join("_");
              if (typeof data.total_penalty !== "number" || !Number.isFinite(data.total_penalty)) {
                continue;
              }
              this.cachePenaltyBase.set(`${eco}_${horario}`, data.total_penalty);
              penaltyValues.push(data.total_penalty);
              if (!this.cacheLoads.has(eco)) {
                this.cacheLoads.set(eco, data.loads);
                this.cacheBest5.set(eco, data.best_5);
              }
            } catch (e) {
            }
          }
        } catch (err) {
          console.error(`ModeloPenaltyBrowser: Error MGET chunk en Webdis:`, err);
        }
      }
      if (penaltyValues.length > 0) {
        this._actualizarEstadisticos(penaltyValues);
      } else {
        console.warn("ModeloPenaltyBrowser: No se encontraron penalty values validos. Usando defaults.");
      }
      console.log(`ModeloPenaltyBrowser: Inicializacion completada. Memoria: ${this.cachePenaltyBase.size} entradas.`);
    }
    async inicializarEstadisticos(profesores, grupos) {
      this.cachePenaltyBase.clear();
      this.cacheLoads.clear();
      this.cacheBest5.clear();
      this._statsInicializados = false;
      const redisUrl = localStorage.getItem("cfg_redis_url") || "http://127.0.0.1:7379";
      const redisKeysArr = this._crearRedisKeys(profesores, grupos);
      const chunkSize = 50;
      const penaltyValues = [];
      console.log(`ModeloPenaltyBrowser: Cargando estadisticos desde ${redisKeysArr.length} predicciones baseline Webdis...`);
      for (let i = 0; i < redisKeysArr.length; i += chunkSize) {
        const chunk = redisKeysArr.slice(i, i + chunkSize);
        try {
          const url = `${redisUrl.replace(/\/$/, "")}/MGET/${chunk.join("/")}`;
          const response = await axios_default.get(url);
          const resultados = response.data.MGET || [];
          for (const res of resultados) {
            if (!res) continue;
            try {
              const data = JSON.parse(res);
              if (typeof data.total_penalty === "number" && Number.isFinite(data.total_penalty)) {
                penaltyValues.push(data.total_penalty);
              }
            } catch (e) {
            }
          }
        } catch (err) {
          console.error(`ModeloPenaltyBrowser: Error MGET chunk en Webdis:`, err);
        }
      }
      if (penaltyValues.length > 0) {
        this._actualizarEstadisticos(penaltyValues);
      } else {
        console.warn("ModeloPenaltyBrowser: No se encontraron penalty values validos. Usando defaults.");
      }
    }
    getPenaltyBase(eco, horarioRaw) {
      return this.cachePenaltyBase.get(`${eco}_${horarioRaw}`) ?? null;
    }
    getLoads(eco) {
      return this.cacheLoads.get(eco) ?? null;
    }
    getBest5(eco) {
      return this.cacheBest5.get(eco) ?? null;
    }
    _crearRedisKeys(profesores, grupos) {
      const redisKeysSet = /* @__PURE__ */ new Set();
      for (const prof of profesores) {
        for (const g of grupos) {
          if (!g.horarioStringRaw) continue;
          const rKey = `Penalty_${prof.numeroEconomico}_${g.horarioStringRaw}`;
          redisKeysSet.add(rKey);
        }
      }
      return Array.from(redisKeysSet);
    }
    _actualizarEstadisticos(penaltyValues) {
      const sum = penaltyValues.reduce((a, b) => a + b, 0);
      this._penalty_mean = sum / penaltyValues.length;
      const sqDiffs = penaltyValues.map((v) => (v - this._penalty_mean) ** 2);
      const variance = sqDiffs.reduce((a, b) => a + b, 0) / penaltyValues.length;
      this._penalty_std = Math.sqrt(variance);
      if (this._penalty_std < 1e-9) this._penalty_std = 1;
      this._statsInicializados = true;
      console.log(
        `ModeloPenaltyBrowser: z-score params - mean=${this._penalty_mean.toFixed(4)}, std=${this._penalty_std.toFixed(4)}, n=${penaltyValues.length}`
      );
    }
  };

  // ml/ZScoreKDE.ts
  var DAY_COLUMNS = [
    { dia: 1, start: "lunes_i", end: "lunes_f" },
    { dia: 2, start: "martes_i", end: "martes_f" },
    { dia: 3, start: "miercoles_i", end: "miercoles_f" },
    { dia: 4, start: "jueves_i", end: "jueves_f" },
    { dia: 5, start: "viernes_i", end: "viernes_f" }
  ];
  var DEFAULT_OPTIONS = {
    mode: "kde_ij",
    steepPower: 2,
    halfLife: 8,
    bandwidthUea: 8,
    bandwidthDay: 0.35,
    bandwidthHour: 1.25,
    bandwidthDuration: 1.5,
    bandwidthPlanUeaCount: 1,
    bandwidthPlanTurno: 0.75,
    weightKdeIj: 0.35,
    weightKdeIh: 0.35,
    weightKdePlan: 0.3,
    minKdePlan: 0,
    minKdeIj: 0.02,
    minKdeIh: 0.02,
    minScore: 1e-3
  };
  function crearZScoreKDE(input) {
    const options = { ...DEFAULT_OPTIONS, ...input.options ?? {} };
    const gruposPorId = new Map(input.grupos.map((grupo) => [grupo.idUeaGrupo, grupo]));
    const profesoresPorEco = new Map(input.profesores.map((profesor) => [profesor.numeroEconomico, profesor]));
    const observaciones = prepararObservaciones(input.dfHist, options.halfLife);
    const obsPorEco = agruparPorEco(observaciones);
    const obsPorEcoArea = agruparPorEcoArea(observaciones);
    const planesPorEco = agruparPlanesPorEco(prepararPlanesHistoricos(observaciones));
    const evaluarGrupo = (eco, grupo, _grafo) => {
      const legacy = input.legacyProvider?.getScoreDetails(eco, grupo.idUeaGrupo) ?? {
        score: 0,
        h_ih: 0,
        rhat: 0
      };
      if (options.mode === "legacy") {
        return {
          score: legacy.rhat,
          h_ih: legacy.h_ih,
          rhat: legacy.rhat,
          source: "legacy"
        };
      }
      const kde = evaluarKde(eco, grupo, _grafo, profesoresPorEco.get(eco), obsPorEco, obsPorEcoArea, planesPorEco, options);
      const score = kde.zBase;
      const bloqueo = explicarBloqueoKde(score, kde, options);
      return {
        score,
        h_ih: kde.kdeIh,
        rhat: legacy.rhat,
        kde_ij: kde.kdeIj,
        kde_ih: kde.kdeIh,
        kde_ih_raw: kde.kdeIhRaw,
        kde_plan: kde.kdePlan,
        zBase: kde.zBase,
        projectedPlanCount: kde.projectedPlanCount,
        dayCoverage: kde.dayCoverage,
        patternSimilarity: kde.patternSimilarity,
        hourCoverage: kde.hourCoverage,
        contractCoverage: kde.contractCoverage,
        source: "kde_ij",
        domainBlocked: bloqueo !== void 0,
        blockReason: bloqueo
      };
    };
    const funcionZ = (eco, idUeaGrupo, grafo) => {
      const grupo = gruposPorId.get(idUeaGrupo);
      if (!grupo) {
        return {
          score: 0,
          h_ih: 0,
          rhat: 0,
          source: options.mode,
          domainBlocked: true,
          blockReason: `GRUPO_DESCONOCIDO: idUeaGrupo=${idUeaGrupo}`
        };
      }
      return evaluarGrupo(eco, grupo, grafo);
    };
    return {
      funcionZ,
      evaluarGrupo,
      obtenerUeasHistoricas: (eco) => {
        const rows = obsPorEco.get(eco) ?? [];
        return [...new Set(rows.map((row) => row.uea))].sort((a, b) => a - b);
      },
      generarSuperficieEco: (eco, ueas, horas, patron = [1, 3, 5]) => {
        const puntos = [];
        for (const uea of ueas) {
          for (const hora of horas) {
            const grupo = crearGrupoSintetico(uea, hora, patron);
            const detalles = evaluarGrupo(eco, grupo);
            puntos.push({
              eco,
              uea,
              hora,
              kde_ij: detalles.kde_ij ?? 0,
              kde_ih: detalles.kde_ih ?? detalles.h_ih,
              kde_plan: detalles.kde_plan ?? 0,
              score: detalles.score,
              dayCoverage: detalles.dayCoverage ?? 0,
              patternSimilarity: detalles.patternSimilarity ?? detalles.dayCoverage ?? 0
            });
          }
        }
        return puntos;
      }
    };
  }
  function prepararObservaciones(dfHist, halfLife) {
    const rows = dfHist;
    const maxTri = rows.reduce((max, row) => Math.max(max, Number(row.tri_num) || 0), 0);
    const observaciones = [];
    for (const row of rows) {
      const eco = Number(row.eco);
      const uea = Number(row.uea);
      const triNum = Number(row.tri_num) || maxTri;
      if (!Number.isFinite(eco) || !Number.isFinite(uea)) continue;
      const slots = extraerSlots(row);
      if (slots.length === 0) continue;
      const age = Math.max(0, maxTri - triNum);
      observaciones.push({
        eco,
        uea,
        area: String(uea).slice(0, 4),
        triNum,
        weight: Math.pow(0.5, age / halfLife),
        slots
      });
    }
    return observaciones;
  }
  function extraerSlots(row) {
    const slots = [];
    for (const col of DAY_COLUMNS) {
      const start = parseHora(row[col.start]);
      const end = parseHora(row[col.end]);
      if (start === null || end === null || end <= start) continue;
      slots.push({
        dia: col.dia,
        start,
        end,
        center: (start + end) / 2,
        duration: end - start
      });
    }
    return slots;
  }
  function agruparPorEco(observaciones) {
    const mapa = /* @__PURE__ */ new Map();
    for (const obs of observaciones) {
      if (!mapa.has(obs.eco)) mapa.set(obs.eco, []);
      mapa.get(obs.eco).push(obs);
    }
    return mapa;
  }
  function agruparPorEcoArea(observaciones) {
    const mapa = /* @__PURE__ */ new Map();
    for (const obs of observaciones) {
      const key = `${obs.eco}:${obs.area}`;
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key).push(obs);
    }
    return mapa;
  }
  function prepararPlanesHistoricos(observaciones) {
    const porEcoTri = /* @__PURE__ */ new Map();
    for (const obs of observaciones) {
      const key = `${obs.eco}:${obs.triNum}`;
      if (!porEcoTri.has(key)) porEcoTri.set(key, []);
      porEcoTri.get(key).push(obs);
    }
    const planes = [];
    for (const rows of porEcoTri.values()) {
      const first = rows[0];
      const turnos = crearContadorTurnos();
      const patrones = /* @__PURE__ */ new Set();
      let weight = 0;
      for (const row of rows) {
        turnos[turnoDeSlots(row.slots)]++;
        patrones.add(patronDiasSlots(row.slots));
        weight += row.weight;
      }
      planes.push({
        eco: first.eco,
        triNum: first.triNum,
        weight: weight / rows.length,
        ueaCount: rows.length,
        turnos,
        patrones: [...patrones]
      });
    }
    return planes;
  }
  function agruparPlanesPorEco(planes) {
    const mapa = /* @__PURE__ */ new Map();
    for (const plan of planes) {
      if (!mapa.has(plan.eco)) mapa.set(plan.eco, []);
      mapa.get(plan.eco).push(plan);
    }
    return mapa;
  }
  function evaluarKde(eco, grupo, grafo, profesor, obsPorEco, obsPorEcoArea, planesPorEco, options) {
    const contract = coberturaContrato(profesor, grupo);
    const kdeIj = calcularKdeIj(eco, grupo.ueaClave, obsPorEcoArea, options);
    const semanal = calcularKdeIhSemanal(eco, grupo.horarios, obsPorEco, options);
    const plan = calcularKdePlan(eco, grupo, grafo, planesPorEco, options);
    const zBase = promedioPonderadoKde(kdeIj, semanal.kdeIh, plan.kdePlan, options);
    return {
      kdeIj,
      kdeIh: semanal.kdeIh,
      kdeIhRaw: semanal.kdeIh,
      kdePlan: plan.kdePlan,
      zBase,
      projectedPlanCount: plan.projectedPlanCount,
      dayCoverage: semanal.dayCoverage,
      patternSimilarity: semanal.patternSimilarity,
      hourCoverage: semanal.hourCoverage,
      contractCoverage: contract
    };
  }
  function calcularKdeIj(eco, uea, obsPorEcoArea, options) {
    const area = String(uea).slice(0, 4);
    const observaciones = obsPorEcoArea.get(`${eco}:${area}`) ?? [];
    if (observaciones.length === 0) return 0;
    let numerador = 0;
    let denominador = 0;
    for (const obs of observaciones) {
      const distance = Math.abs(obs.uea - uea) / options.bandwidthUea;
      const kernel = Math.exp(-0.5 * Math.pow(distance, options.steepPower));
      numerador += obs.weight * kernel;
      denominador += obs.weight;
    }
    return denominador > 0 ? redondear(numerador / denominador) : 0;
  }
  function calcularKdeIhSemanal(eco, horarios, obsPorEco, options) {
    const observaciones = obsPorEco.get(eco) ?? [];
    if (observaciones.length === 0 || horarios.length === 0) {
      return { kdeIh: 0, dayCoverage: 0, patternSimilarity: 0, hourCoverage: 0 };
    }
    let numerador = 0;
    let denominador = 0;
    let bestCoverage = 0;
    let bestPatternSimilarity = 0;
    let bestHourKernel = 0;
    for (const obs of observaciones) {
      const evaluacion = kernelSemanal(horarios, obs.slots, options);
      numerador += obs.weight * evaluacion.kernel;
      denominador += obs.weight;
      bestCoverage = Math.max(bestCoverage, evaluacion.dayCoverage);
      bestPatternSimilarity = Math.max(bestPatternSimilarity, evaluacion.patternSimilarity);
      bestHourKernel = Math.max(bestHourKernel, evaluacion.hourKernel);
    }
    return {
      kdeIh: denominador > 0 ? redondear(numerador / denominador) : 0,
      dayCoverage: redondear(bestCoverage),
      patternSimilarity: redondear(bestPatternSimilarity),
      hourCoverage: redondear(bestHourKernel)
    };
  }
  function calcularKdePlan(eco, grupo, grafo, planesPorEco, options) {
    const historicos = planesPorEco.get(eco) ?? [];
    const proyectado = crearPlanProyectado(eco, grupo, grafo);
    if (historicos.length === 0 || proyectado.ueaCount === 0) {
      return { kdePlan: 0, projectedPlanCount: proyectado.ueaCount };
    }
    let numerador = 0;
    let denominador = 0;
    for (const plan of historicos) {
      const countDistance = Math.abs(proyectado.ueaCount - plan.ueaCount) / options.bandwidthPlanUeaCount;
      const countKernel = Math.exp(-0.5 * Math.pow(countDistance, 2));
      const turnoDistance = distanciaTurnos(proyectado.turnos, plan.turnos) / options.bandwidthPlanTurno;
      const turnoKernel = Math.exp(-0.5 * Math.pow(turnoDistance, 2));
      const patternKernel = similitudPatronesPlan(proyectado.patrones, plan.patrones);
      const kernel = countKernel * turnoKernel * patternKernel;
      numerador += plan.weight * kernel;
      denominador += plan.weight;
    }
    return {
      kdePlan: denominador > 0 ? redondear(numerador / denominador) : 0,
      projectedPlanCount: proyectado.ueaCount
    };
  }
  function crearPlanProyectado(eco, grupo, grafo) {
    const grupos = /* @__PURE__ */ new Map();
    if (grafo) {
      const asignados = grafo.adyacencias.get(eco) ?? [];
      for (const idGrupo of asignados) {
        const grupoAsignado = grafo.grupos.get(idGrupo);
        if (grupoAsignado) grupos.set(grupoAsignado.idUeaGrupo, grupoAsignado);
      }
    }
    grupos.set(grupo.idUeaGrupo, grupo);
    const turnos = crearContadorTurnos();
    const patrones = /* @__PURE__ */ new Set();
    for (const item of grupos.values()) {
      turnos[turnoDeHorarios(item.horarios)]++;
      patrones.add(patronDiasHorarios(item.horarios));
    }
    return {
      eco,
      triNum: 0,
      weight: 1,
      ueaCount: grupos.size,
      turnos,
      patrones: [...patrones]
    };
  }
  function promedioPonderadoKde(kdeIj, kdeIh, kdePlan, options) {
    const total = options.weightKdeIj + options.weightKdeIh + options.weightKdePlan;
    if (total <= 0) return 0;
    return redondear(
      (options.weightKdeIj * kdeIj + options.weightKdeIh * kdeIh + options.weightKdePlan * kdePlan) / total
    );
  }
  function kernelSemanal(horarios, slotsHistoricos, options) {
    const diasCandidato = new Set(horarios.map((franja) => franja.dia));
    const diasHistoricos = new Set(slotsHistoricos.map((slot) => slot.dia));
    const unionDias = unionSize(diasCandidato, diasHistoricos);
    const interseccionDias = intersectionSize(diasCandidato, diasHistoricos);
    if (unionDias === 0 || interseccionDias === 0) {
      return { kernel: 0, dayCoverage: 0, patternSimilarity: 0, hourKernel: 0 };
    }
    const patternSimilarity = interseccionDias / unionDias;
    const dayDistance = symmetricDifferenceSize(diasCandidato, diasHistoricos) / options.bandwidthDay;
    const dayKernel = Math.exp(-0.5 * Math.pow(dayDistance, options.steepPower));
    let productoHoras = 1;
    let diasConHoraCompatible = 0;
    for (const franja of horarios) {
      const compatibles = slotsHistoricos.filter((slot) => slot.dia === franja.dia);
      if (compatibles.length === 0) {
        continue;
      }
      const center = (franja.horaInicio + franja.horaFin) / 2;
      const duration = franja.horaFin - franja.horaInicio;
      let mejor = 0;
      for (const slot of compatibles) {
        const hourDistance = Math.abs(slot.center - center) / options.bandwidthHour;
        const durationDistance = Math.abs(slot.duration - duration) / options.bandwidthDuration;
        const hourKernel2 = Math.exp(-0.5 * Math.pow(hourDistance, options.steepPower));
        const durationKernel = Math.exp(-0.5 * Math.pow(durationDistance, 2));
        mejor = Math.max(mejor, hourKernel2 * durationKernel);
      }
      if (mejor > 0) {
        productoHoras *= mejor;
        diasConHoraCompatible++;
      }
    }
    if (diasConHoraCompatible === 0) {
      return { kernel: 0, dayCoverage: patternSimilarity, patternSimilarity, hourKernel: 0 };
    }
    const hourKernel = Math.pow(productoHoras, 1 / diasConHoraCompatible);
    return {
      kernel: dayKernel * hourKernel,
      dayCoverage: patternSimilarity,
      patternSimilarity,
      hourKernel
    };
  }
  function unionSize(a, b) {
    return (/* @__PURE__ */ new Set([...a, ...b])).size;
  }
  function intersectionSize(a, b) {
    let count = 0;
    for (const value of a) {
      if (b.has(value)) count++;
    }
    return count;
  }
  function symmetricDifferenceSize(a, b) {
    let count = 0;
    for (const value of a) {
      if (!b.has(value)) count++;
    }
    for (const value of b) {
      if (!a.has(value)) count++;
    }
    return count;
  }
  function crearContadorTurnos() {
    return { manana: 0, medioDia: 0, tarde: 0 };
  }
  function turnoDeSlots(slots) {
    if (slots.length === 0) return "manana";
    return turnoDesdeHora(Math.min(...slots.map((slot) => slot.start)));
  }
  function turnoDeHorarios(horarios) {
    if (horarios.length === 0) return "manana";
    return turnoDesdeHora(Math.min(...horarios.map((horario) => horario.horaInicio)));
  }
  function turnoDesdeHora(hora) {
    if (hora < 12) return "manana";
    if (hora < 16) return "medioDia";
    return "tarde";
  }
  function patronDiasSlots(slots) {
    return [...new Set(slots.map((slot) => slot.dia))].sort((a, b) => a - b).join("-");
  }
  function patronDiasHorarios(horarios) {
    return [...new Set(horarios.map((horario) => horario.dia))].sort((a, b) => a - b).join("-");
  }
  function distanciaTurnos(a, b) {
    const totalA = totalTurnos(a);
    const totalB = totalTurnos(b);
    if (totalA <= 0 || totalB <= 0) return 1;
    const keys = ["manana", "medioDia", "tarde"];
    const suma = keys.reduce((acc, key) => {
      const diff = a[key] / totalA - b[key] / totalB;
      return acc + diff * diff;
    }, 0);
    return Math.sqrt(suma);
  }
  function totalTurnos(turnos) {
    return turnos.manana + turnos.medioDia + turnos.tarde;
  }
  function similitudPatronesPlan(patronesCandidato, patronesHistoricos) {
    if (patronesCandidato.length === 0 || patronesHistoricos.length === 0) return 0;
    let suma = 0;
    for (const patron of patronesCandidato) {
      let mejor = 0;
      for (const historico of patronesHistoricos) {
        mejor = Math.max(mejor, similitudPatron(patron, historico));
      }
      suma += mejor;
    }
    return suma / patronesCandidato.length;
  }
  function similitudPatron(a, b) {
    const setA = new Set(a.split("-").filter(Boolean).map(Number));
    const setB = new Set(b.split("-").filter(Boolean).map(Number));
    const union = unionSize(setA, setB);
    return union > 0 ? intersectionSize(setA, setB) / union : 0;
  }
  function coberturaContrato(profesor, grupo) {
    if (!profesor) return 0;
    const semana = new SemanaLaboral(profesor.horariosContratacion);
    let cubiertos = 0;
    for (const franja of grupo.horarios) {
      if (semana.intentarAsignarFranja(franja).asignable) {
        cubiertos++;
      }
    }
    return grupo.horarios.length > 0 ? cubiertos / grupo.horarios.length : 0;
  }
  function explicarBloqueoKde(score, kde, options) {
    if (kde.kdeIj < options.minKdeIj) {
      return `KDE_IJ_FUERA_DOMINIO: kde_ij=${kde.kdeIj} < ${options.minKdeIj}`;
    }
    if (kde.kdeIhRaw < options.minKdeIh) {
      return `KDE_IH_PATRON_FUERA_DOMINIO: kde_ih_raw=${kde.kdeIhRaw} < ${options.minKdeIh}; patternSimilarity=${kde.patternSimilarity}`;
    }
    if (options.minKdePlan > 0 && kde.projectedPlanCount > 1 && kde.kdePlan < options.minKdePlan) {
      return `KDE_PLAN_FUERA_DOMINIO: kde_plan=${kde.kdePlan} < ${options.minKdePlan}; projectedPlanCount=${kde.projectedPlanCount}`;
    }
    if (score < options.minScore) {
      return `Z_KDE_FUERA_DOMINIO: zBase=${score} < ${options.minScore}`;
    }
    return void 0;
  }
  function crearGrupoSintetico(uea, horaInicio, dias) {
    const horarios = dias.map((dia) => ({
      dia,
      horaInicio,
      horaFin: horaInicio + 1.5
    }));
    return {
      idUeaGrupo: -1,
      idGrupo: -1,
      claveGrupo: "KDE_SURFACE",
      idArea: String(uea).slice(0, 4),
      ueaClave: uea,
      horarios,
      horarioStringRaw: ""
    };
  }
  function parseHora(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text) return null;
    const [hRaw, mRaw] = text.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h + m / 60;
  }
  function redondear(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 1e8) / 1e8;
  }

  // greedy/EstrategiaUeaMenosVista.ts
  var EstrategiaUeaMenosVista = class {
    _frecuenciaUea = /* @__PURE__ */ new Map();
    constructor(gruposBase) {
      for (const grupo of gruposBase) {
        this._frecuenciaUea.set(
          grupo.ueaClave,
          (this._frecuenciaUea.get(grupo.ueaClave) ?? 0) + 1
        );
      }
    }
    ordenarAreas(areas) {
      return Array.from(areas.entries()).sort(([idAreaA, gruposA], [idAreaB, gruposB]) => {
        const rarezaA = this._menorFrecuenciaUea(gruposA);
        const rarezaB = this._menorFrecuenciaUea(gruposB);
        if (rarezaA !== rarezaB) return rarezaA - rarezaB;
        if (gruposA.length !== gruposB.length) return gruposA.length - gruposB.length;
        return idAreaA.localeCompare(idAreaB);
      });
    }
    ordenarGrupos(grupos) {
      return [...grupos].sort((a, b) => {
        const frecuenciaA = this._frecuencia(a.ueaClave);
        const frecuenciaB = this._frecuencia(b.ueaClave);
        if (frecuenciaA !== frecuenciaB) return frecuenciaA - frecuenciaB;
        const franjasA = a.horarios.length;
        const franjasB = b.horarios.length;
        if (franjasA !== franjasB) return franjasB - franjasA;
        const duracionA = this._duracionTotal(a);
        const duracionB = this._duracionTotal(b);
        if (duracionA !== duracionB) return duracionB - duracionA;
        if (a.ueaClave !== b.ueaClave) return a.ueaClave - b.ueaClave;
        return a.idUeaGrupo - b.idUeaGrupo;
      });
    }
    ordenarProfesores(profesores, _grupoId) {
      return [...profesores];
    }
    _frecuencia(ueaClave) {
      return this._frecuenciaUea.get(ueaClave) ?? Number.MAX_SAFE_INTEGER;
    }
    _menorFrecuenciaUea(grupos) {
      if (grupos.length === 0) return Number.MAX_SAFE_INTEGER;
      return Math.min(...grupos.map((grupo) => this._frecuencia(grupo.ueaClave)));
    }
    _duracionTotal(grupo) {
      return grupo.horarios.reduce(
        (total, franja) => total + (franja.horaFin - franja.horaInicio),
        0
      );
    }
  };

  // greedy/FirstFSMLogger.ts
  var FirstFSMLogger = class {
    logsRechazo = [];
    registrarCandidatoRechazado(eco, grupoId, reglaFallo, motivo) {
      this.logsRechazo.push({
        eco,
        grupoId,
        reglaFallo,
        motivo
      });
    }
    obtenerReporte() {
      return this.logsRechazo;
    }
  };

  // greedy/EstrategiaMCV.ts
  var EstrategiaMCV = class {
    ordenarAreas(areas) {
      return Array.from(areas.entries()).sort((a, b) => a[1].length - b[1].length);
    }
    ordenarGrupos(grupos) {
      return [...grupos].sort((a, b) => {
        const franjasA = a.horarios.length;
        const franjasB = b.horarios.length;
        if (franjasB !== franjasA) return franjasB - franjasA;
        const durA = this._duracionTotal(a);
        const durB = this._duracionTotal(b);
        if (durA !== durB) return durB - durA;
        return a.idUeaGrupo - b.idUeaGrupo;
      });
    }
    ordenarProfesores(profesores, grupoId) {
      if (profesores.length <= 1) return [...profesores];
      if (grupoId === void 0) return [...profesores];
      return [...profesores].sort((a, b) => {
        const franjasA = this._contarFranjasContratacion(a);
        const franjasB = this._contarFranjasContratacion(b);
        if (franjasA !== franjasB) return franjasA - franjasB;
        return a.numeroEconomico - b.numeroEconomico;
      });
    }
    _duracionTotal(grupo) {
      return grupo.horarios.reduce(
        (total, franja) => total + (franja.horaFin - franja.horaInicio),
        0
      );
    }
    _contarFranjasContratacion(profesor) {
      return profesor.horariosContratacion.reduce((total, horario) => {
        return total + this._contarDiasLaborales(horario.idDiasDeTrabajo);
      }, 0);
    }
    _contarDiasLaborales(idDiasDeTrabajo) {
      const texto = idDiasDeTrabajo.trim().toUpperCase();
      if (texto === "L-V") return 5;
      if (texto === "L-J") return 4;
      const dias = texto.split(/[-,/\s]+/).filter(Boolean);
      return dias.length > 0 ? dias.length : 1;
    }
  };

  // ml/IModeloML.ts
  function explicarBloqueoZScore(detalles, options = {}) {
    const minScore = options.minScore ?? 0;
    const minHIh = options.minHIh ?? 0.05;
    if (detalles.domainBlocked) {
      return detalles.blockReason ?? "Z_DOMAIN_BLOCK";
    }
    if (!Number.isFinite(detalles.score) || detalles.score <= minScore) {
      return `Z_SCORE_FUERA_DOMINIO: score=${detalles.score}`;
    }
    if (detalles.source === "kde_ij") {
      return void 0;
    }
    if (!Number.isFinite(detalles.h_ih) || detalles.h_ih < minHIh) {
      return `PODA_KDE: h_ih=${detalles.h_ih} < ${minHIh}`;
    }
    return void 0;
  }
  var funcionZUniforme = (_eco, _idUeaGrupo, _grafo) => {
    return { score: 1, h_ih: 1, rhat: 1, zBase: 1, source: "uniform" };
  };

  // objective/FuncionObjetivoZ.ts
  var FuncionObjetivoZ = class {
    _funcionZ;
    _constraints;
    constructor(constraints = [], funcionZ) {
      this._funcionZ = funcionZ ?? funcionZUniforme;
      this._constraints = constraints;
    }
    /**
     * Evalúa la función objetivo Z sobre el grafo completo.
     * @param grafo  Estado actual de asignaciones.
     * @returns Resultado con Z, recompensa, viabilidad general y desglose.
     */
    evaluarGrafo(grafo) {
      let recompensa = 0;
      for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
        const zDetails = this._funcionZ(numEco, idGrupo, grafo);
        recompensa += zDetails.score;
      }
      let viabilidadTotal = 0;
      const desglose = [];
      for (const cp of this._constraints) {
        const scoreViabilidad = cp.constraint.evaluar(grafo, this._funcionZ);
        const valorAportado = cp.lambda * scoreViabilidad;
        viabilidadTotal += valorAportado;
        desglose.push({
          nombre: cp.constraint.nombre,
          scoreViabilidad,
          lambda: cp.lambda,
          valorAportado
        });
      }
      return {
        Z: recompensa + viabilidadTotal,
        recompensa,
        viabilidadTotal,
        desglose
      };
    }
    async evaluarGrafoAsync(grafo, context) {
      let recompensa = 0;
      for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
        const zDetails = this._funcionZ(numEco, idGrupo, grafo);
        recompensa += zDetails.score;
      }
      let viabilidadTotal = 0;
      const desglose = [];
      for (const cp of this._constraints) {
        const scoreViabilidad = cp.constraint.evaluarAsync ? await cp.constraint.evaluarAsync(grafo, this._funcionZ, context) : cp.constraint.evaluar(grafo, this._funcionZ);
        const valorAportado = cp.lambda * scoreViabilidad;
        viabilidadTotal += valorAportado;
        desglose.push({
          nombre: cp.constraint.nombre,
          scoreViabilidad,
          lambda: cp.lambda,
          valorAportado
        });
      }
      return {
        Z: recompensa + viabilidadTotal,
        recompensa,
        viabilidadTotal,
        desglose
      };
    }
    async evaluarDominioCandidatoAsync(grafo, numEco, idGrupoCandidato, context) {
      const rechazos = [];
      const detallesZ = this._funcionZ(numEco, idGrupoCandidato, grafo);
      const bloqueoZ = explicarBloqueoZScore(detallesZ);
      if (bloqueoZ) {
        rechazos.push(`FUNCION_Z: ${bloqueoZ}`);
      }
      for (const cp of this._constraints) {
        if (!cp.constraint.evaluarCandidatoAsync) continue;
        const resultado = await cp.constraint.evaluarCandidatoAsync(
          grafo,
          numEco,
          idGrupoCandidato,
          context
        );
        if (resultado.blocked) {
          rechazos.push(`${cp.constraint.nombre}: ${resultado.blockReason ?? "candidato fuera de dominio"}`);
        }
      }
      return {
        permitido: rechazos.length === 0,
        rechazos
      };
    }
    obtenerDetallesCandidato(grafo, numEco, idGrupoCandidato) {
      return this._funcionZ(numEco, idGrupoCandidato, grafo);
    }
  };

  // objective/SoftConstraints.ts
  function obtenerFranjasHorariasProfesor(numeroEconomico, grafo) {
    const gruposAsignados = grafo.adyacencias.get(numeroEconomico) || [];
    const franjas = [];
    if (gruposAsignados.length === 0) return [];
    for (const idGrupo of gruposAsignados) {
      const grupo = grafo.grupos.get(idGrupo);
      if (!grupo) continue;
      for (const h of grupo.horarios) {
        franjas.push({ dia: h.dia, horaInicio: h.horaInicio, horaFin: h.horaFin, idGrupo });
      }
    }
    return franjas;
  }
  function agruparFranjasPorDiaGetMapa(franjas) {
    const mapa = /* @__PURE__ */ new Map();
    for (const franja of franjas) {
      if (!mapa.has(franja.dia)) {
        mapa.set(franja.dia, []);
      }
      mapa.get(franja.dia).push(franja);
    }
    for (const [, lista] of mapa) {
      lista.sort((a, b) => a.horaInicio - b.horaInicio);
    }
    return mapa;
  }
  var ViabilidadHuecos = class {
    nombre = "VIABILIDAD_HUECOS";
    _refMaxHuecos;
    constructor(refMaxHuecosDia = 4) {
      this._refMaxHuecos = refMaxHuecosDia;
    }
    evaluar(grafo, funcionZ) {
      let viabilidadTotalAcumulada = 0;
      let profesoresActivos = 0;
      for (const [numEco] of grafo.profesores) {
        const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
        if (franjas.length === 0) continue;
        profesoresActivos++;
        const porDia = agruparFranjasPorDiaGetMapa(franjas);
        let reduccionesAlProfesor = 0;
        for (const [, franjasDia] of porDia) {
          if (franjasDia.length < 2) continue;
          for (let i = 1; i < franjasDia.length; i++) {
            const hueco = franjasDia[i].horaInicio - franjasDia[i - 1].horaFin;
            if (hueco > 0) {
              const zAnterior = funcionZ(numEco, franjasDia[i - 1].idGrupo, grafo);
              const zActual = funcionZ(numEco, franjasDia[i].idGrupo, grafo);
              const wAnterior = zAnterior.score;
              const wActual = zActual.score;
              const wPromedio = (wAnterior + wActual) / 2;
              const factorMitigante = Math.max(0, 1 - wPromedio);
              const huecoNorm = Math.min(hueco / this._refMaxHuecos, 1);
              reduccionesAlProfesor += huecoNorm * factorMitigante;
            }
          }
        }
        const viabilidadDeEsteProfesor = Math.max(0, 1 - reduccionesAlProfesor);
        viabilidadTotalAcumulada += viabilidadDeEsteProfesor;
      }
      return profesoresActivos > 0 ? viabilidadTotalAcumulada / profesoresActivos : 0;
    }
  };
  var ViabilidadCargaConsecutiva = class {
    nombre = "VIABILIDAD_CARGA_CONSECUTIVA";
    _umbralHoras;
    _refMaxExceso;
    constructor(umbralHoras = 3, refMaxExceso = 3) {
      this._umbralHoras = umbralHoras;
      this._refMaxExceso = refMaxExceso;
    }
    evaluar(grafo, funcionZ) {
      let viabilidadTotalAcumulada = 0;
      let profesoresActivos = 0;
      for (const [numEco] of grafo.profesores) {
        const franjas = obtenerFranjasHorariasProfesor(numEco, grafo);
        if (franjas.length === 0) continue;
        profesoresActivos++;
        const porDia = agruparFranjasPorDiaGetMapa(franjas);
        let reduccionesAlProfesor = 0;
        for (const [, franjasDia] of porDia) {
          if (franjasDia.length === 0) continue;
          const bloques = [];
          let actual = {
            inicio: franjasDia[0].horaInicio,
            fin: franjasDia[0].horaFin,
            grupoIds: [franjasDia[0].idGrupo]
          };
          for (let i = 1; i < franjasDia.length; i++) {
            if (franjasDia[i].horaInicio <= actual.fin) {
              actual.fin = Math.max(actual.fin, franjasDia[i].horaFin);
              actual.grupoIds.push(franjasDia[i].idGrupo);
            } else {
              bloques.push({ ...actual });
              actual = {
                inicio: franjasDia[i].horaInicio,
                fin: franjasDia[i].horaFin,
                grupoIds: [franjasDia[i].idGrupo]
              };
            }
          }
          bloques.push({ ...actual });
          for (const bloque of bloques) {
            const duracion = bloque.fin - bloque.inicio;
            if (duracion > this._umbralHoras) {
              const exceso = duracion - this._umbralHoras;
              const gruposUnicos = [...new Set(bloque.grupoIds)];
              const sumaW = gruposUnicos.reduce(
                (acc, gId) => acc + funcionZ(numEco, gId, grafo).score,
                0
              );
              let wPromedio = gruposUnicos.length > 0 ? sumaW / gruposUnicos.length : 0;
              const factorMitigante = Math.max(0, 1 - wPromedio);
              const excesoNorm = Math.min(exceso / this._refMaxExceso, 1);
              reduccionesAlProfesor += excesoNorm * factorMitigante;
            }
          }
        }
        const viabilidadDeEsteProfesor = Math.max(0, 1 - reduccionesAlProfesor);
        viabilidadTotalAcumulada += viabilidadDeEsteProfesor;
      }
      return profesoresActivos > 0 ? viabilidadTotalAcumulada / profesoresActivos : 0;
    }
  };

  // objective/ViabilidadPenalizacionCarga.ts
  var ViabilidadPenalizacionCarga = class {
    nombre = "VIABILIDAD_PENALIZACION_CARGA";
    _pythonBaseUrl;
    _modeloPenalty;
    _observedCache;
    _domainBlockThreshold;
    _loadProbabilityThreshold;
    _penaltyScale;
    // key: numeroEconomico -> { hashAsignaciones: string, penalty: number }
    _memoPenalty = /* @__PURE__ */ new Map();
    constructor(pythonBaseUrl = "http://127.0.0.1:8000", modeloPenalty, observedCache, options = {}) {
      this._pythonBaseUrl = pythonBaseUrl;
      this._modeloPenalty = modeloPenalty;
      this._observedCache = observedCache;
      this._domainBlockThreshold = options.domainBlockThreshold ?? -1.5;
      this._loadProbabilityThreshold = options.loadProbabilityThreshold ?? 0.05;
      this._penaltyScale = options.penaltyScale ?? 1;
    }
    /**
     * Ruta historica sincrona. Si se inyecta observedCache, no se permite usar
     * este metodo porque produciria una evaluacion no bloqueante.
     */
    evaluar(grafo, _funcionZ) {
      if (this._observedCache) {
        throw new Error("ViabilidadPenalizacionCarga con observedCache requiere evaluarAsync().");
      }
      let viabilidadTotalAcumulada = 0;
      let profesoresActivos = 0;
      for (const [numEco] of grafo.profesores) {
        const asignaciones = grafo.adyacencias.get(numEco) || [];
        if (asignaciones.length === 0) continue;
        profesoresActivos++;
        const hash = [...asignaciones].sort().join(",");
        const cached = this._memoPenalty.get(numEco);
        if (cached && cached.hash === hash) {
          viabilidadTotalAcumulada += this._normalizarPenalty(cached.penalty);
        } else {
          this._actualizarPenaltyProfesor(numEco, grafo, hash);
          const baseline = this._getBaselinePenalty(numEco, grafo);
          viabilidadTotalAcumulada += this._normalizarPenalty(baseline);
        }
      }
      return viabilidadTotalAcumulada;
    }
    /**
     * Ruta estricta para el elbow: todos los misses esperan al endpoint ML real.
     */
    async evaluarAsync(grafo, _funcionZ, context) {
      if (!this._modeloPenalty || !this._modeloPenalty.tieneEstadisticosPenalty) {
        throw new Error("ViabilidadPenalizacionCarga async requiere ModeloPenaltyCached con estadisticos reales inicializados.");
      }
      if (!this._observedCache) {
        throw new Error("ViabilidadPenalizacionCarga async requiere PenaltyObservedCache.");
      }
      const promesas = [];
      let profesoresActivos = 0;
      for (const [numEco] of grafo.profesores) {
        const asignaciones = grafo.adyacencias.get(numEco) || [];
        if (asignaciones.length === 0) continue;
        profesoresActivos++;
        const payload = this._crearPayloadProfesor(numEco, grafo);
        promesas.push(
          this._observedCache.getOrFetchResponse(payload, { ...context, eco: numEco }).then((response) => this._viabilidadDesdeResponse(response).viabilidad)
        );
      }
      if (profesoresActivos === 0) return 0;
      const viabilidades = await Promise.all(promesas);
      const suma = viabilidades.reduce((acc, value) => acc + value, 0);
      return suma;
    }
    async evaluarCandidatoAsync(grafo, numEco, idGrupoCandidato, context) {
      if (!this._modeloPenalty || !this._modeloPenalty.tieneEstadisticosPenalty) {
        throw new Error("ViabilidadPenalizacionCarga candidato requiere ModeloPenaltyCached con estadisticos reales inicializados.");
      }
      if (!this._observedCache) {
        throw new Error("ViabilidadPenalizacionCarga candidato requiere PenaltyObservedCache.");
      }
      const payload = this._crearPayloadProfesorConCandidato(numEco, grafo, idGrupoCandidato);
      const response = await this._observedCache.getOrFetchResponse(payload, {
        ...context,
        eco: numEco,
        idGrupoCandidato
      });
      const projectedUeaCount = response.projected_uea_count ?? this._contarUeasProyectadas(grafo, numEco, idGrupoCandidato);
      const totalPenalty = response.total_penalty;
      const loadPenalty = this._obtenerLoadPenalty(response, projectedUeaCount);
      const loadProbability = this._obtenerLoadProbability(response, projectedUeaCount);
      const loadDensityRatio = this._obtenerLoadDensityRatio(response, projectedUeaCount);
      const viability = this._viabilidadDesdeResponse(response, loadProbability);
      const blockReason = this._evaluarBloqueoDominio(
        totalPenalty,
        loadPenalty,
        projectedUeaCount,
        loadProbability
      );
      return {
        penalty: totalPenalty,
        viabilidad: viability.viabilidad,
        totalPenalty,
        projectedUeaCount,
        loadPenalty,
        loadProbability,
        penaltyProbability: viability.penaltyProbability,
        loadDensityRatio,
        blocked: blockReason !== void 0,
        blockReason
      };
    }
    _normalizarPenalty(penalty) {
      if (!this._modeloPenalty) {
        return penalty;
      }
      return this._normalizarConEstadisticos(penalty);
    }
    _normalizarConEstadisticos(penalty) {
      return 2 * this._sigmoid(penalty / this._penaltyScale) - 1;
    }
    _viabilidadDesdeResponse(response, loadProbabilityOverride) {
      const loadProbability = loadProbabilityOverride ?? response.load_probability ?? 1;
      const totalProbability = this._sigmoid(response.total_penalty / this._penaltyScale);
      const penaltyProbability = Math.min(this._clampProbability(loadProbability), totalProbability);
      return {
        penaltyProbability,
        viabilidad: 2 * penaltyProbability - 1
      };
    }
    _sigmoid(value) {
      return 1 / (1 + Math.exp(-value));
    }
    _clampProbability(value) {
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(1, value));
    }
    _obtenerLoadPenalty(response, projectedUeaCount) {
      const loadIndex = projectedUeaCount - 2;
      if (!response.loads || loadIndex < 0 || loadIndex >= response.loads.length) {
        return void 0;
      }
      const loadPenalty = response.loads[loadIndex];
      return Number.isFinite(loadPenalty) ? loadPenalty : void 0;
    }
    _obtenerLoadProbability(response, projectedUeaCount) {
      if (typeof response.load_probability === "number" && Number.isFinite(response.load_probability)) {
        return this._clampProbability(response.load_probability);
      }
      const loadIndex = projectedUeaCount - 2;
      if (!response.load_probabilities || loadIndex < 0 || loadIndex >= response.load_probabilities.length) {
        return void 0;
      }
      const value = response.load_probabilities[loadIndex];
      return Number.isFinite(value) ? this._clampProbability(value) : void 0;
    }
    _obtenerLoadDensityRatio(response, projectedUeaCount) {
      if (typeof response.load_density_ratio === "number" && Number.isFinite(response.load_density_ratio)) {
        return this._clampProbability(response.load_density_ratio);
      }
      const loadIndex = projectedUeaCount - 2;
      if (!response.load_density_ratios || loadIndex < 0 || loadIndex >= response.load_density_ratios.length) {
        return void 0;
      }
      const value = response.load_density_ratios[loadIndex];
      return Number.isFinite(value) ? this._clampProbability(value) : void 0;
    }
    _evaluarBloqueoDominio(totalPenalty, loadPenalty, projectedUeaCount, loadProbability) {
      if (loadProbability !== void 0 && loadProbability < this._loadProbabilityThreshold) {
        return `PODA_CARGA_KDE_ECO: load_probability=${loadProbability} < ${this._loadProbabilityThreshold} para W=${projectedUeaCount}`;
      }
      if (totalPenalty <= this._domainBlockThreshold) {
        return `PENALTY_TOTAL_FUERA_DOMINIO: total_penalty=${totalPenalty} <= ${this._domainBlockThreshold}`;
      }
      if (loadPenalty !== void 0 && loadPenalty <= this._domainBlockThreshold) {
        return `PENALTY_LOAD_FUERA_DOMINIO: loads[${projectedUeaCount - 2}]=${loadPenalty} <= ${this._domainBlockThreshold}`;
      }
      return void 0;
    }
    _contarUeasProyectadas(grafo, numEco, idGrupoCandidato) {
      const ueas = /* @__PURE__ */ new Set();
      const asignaciones = [...grafo.adyacencias.get(numEco) || [], idGrupoCandidato];
      for (const idGrupo of asignaciones) {
        const grupo = grafo.grupos.get(idGrupo);
        if (grupo) {
          ueas.add(grupo.ueaClave);
        }
      }
      return ueas.size;
    }
    _getBaselinePenalty(numEco, grafo) {
      if (!this._modeloPenalty) return 0;
      const asignaciones = grafo.adyacencias.get(numEco) || [];
      let suma = 0;
      for (const idG of asignaciones) {
        const g = grafo.grupos.get(idG);
        if (g) {
          suma += this._modeloPenalty.getPenaltyBase(numEco, g.horarioStringRaw) || 0;
        }
      }
      return asignaciones.length > 0 ? suma / asignaciones.length : 0;
    }
    _crearPayloadProfesor(numEco, grafo) {
      const asignaciones = grafo.adyacencias.get(numEco) || [];
      return this._crearPayloadDesdeAsignaciones(numEco, grafo, asignaciones);
    }
    _crearPayloadProfesorConCandidato(numEco, grafo, idGrupoCandidato) {
      const asignaciones = [...grafo.adyacencias.get(numEco) || [], idGrupoCandidato];
      return this._crearPayloadDesdeAsignaciones(numEco, grafo, asignaciones);
    }
    _crearPayloadDesdeAsignaciones(numEco, grafo, asignaciones) {
      const ueas = [];
      const horarios = [];
      for (const idG of asignaciones) {
        const g = grafo.grupos.get(idG);
        if (!g) {
          throw new Error(`No existe el grupo ${idG} al construir payload de penalty para eco ${numEco}.`);
        }
        ueas.push(g.ueaClave.toString());
        horarios.push(canonicalizeHorario(g.horarioStringRaw));
      }
      if (horarios.length === 0) {
        throw new Error(`No hay asignaciones activas para construir payload de penalty del eco ${numEco}.`);
      }
      return {
        eco: numEco.toString(),
        horario: horarios[horarios.length - 1],
        ueas_asignadas_actuales: ueas.slice(0, -1),
        horarios_asignados_actuales: horarios.slice(0, -1),
        uea_prediccion: ueas[ueas.length - 1]
      };
    }
    async _actualizarPenaltyProfesor(numEco, grafo, hash) {
      const payload = this._crearPayloadProfesor(numEco, grafo);
      try {
        const res = await axios_default.post(
          `${this._pythonBaseUrl}/get_horario_penalty_finetuned`,
          payload
        );
        if (res.data) {
          this._memoPenalty.set(numEco, { hash, penalty: res.data.total_penalty });
        }
      } catch (e) {
      }
    }
  };

  // objective/Tolerancia.ts
  var CriterioAceptacion = class {
    _epsAbs;
    _epsRel;
    _alfa;
    constructor(epsAbs = 1e-9, epsRel = 1e-9, alfa = 0) {
      this._epsAbs = epsAbs;
      this._epsRel = epsRel;
      this._alfa = alfa;
    }
    _calcularTolerancia(zActual) {
      return this._epsAbs + this._epsRel * Math.max(1, Math.abs(zActual));
    }
    _calcularUmbralMovimiento(numCambios) {
      return this._alfa * numCambios;
    }
    esMejoraSignificativa(zNuevo, zActual, numCambios = 1) {
      const tolerancia = this._calcularTolerancia(zActual);
      const umbralMovimiento = this._calcularUmbralMovimiento(numCambios);
      return zNuevo > zActual + tolerancia + umbralMovimiento;
    }
    clasificarDelta(zNuevo, zActual, numCambios = 1) {
      const delta = zNuevo - zActual;
      const tolerancia = this._calcularTolerancia(zActual);
      const umbralMovimiento = this._calcularUmbralMovimiento(numCambios);
      if (this.esMejoraSignificativa(zNuevo, zActual, numCambios)) {
        return "MEJORA_SIGNIFICATIVA" /* MEJORA_SIGNIFICATIVA */;
      }
      if (Math.abs(delta) <= tolerancia) {
        return "RUIDO_NUMERICO" /* RUIDO_NUMERICO */;
      }
      if (delta > tolerancia && delta <= tolerancia + umbralMovimiento) {
        return "RECHAZADA_POR_UMBRAL" /* RECHAZADA_POR_UMBRAL */;
      }
      return "SIN_MEJORA" /* SIN_MEJORA */;
    }
  };

  // greedy/EjectionChain.ts
  var EjectionChain = class {
    _maxIteraciones;
    _maxIteracionesSinMejora;
    _criterio;
    constructor(maxIteraciones = 100, maxIteracionesSinMejora = 20, criterio) {
      this._maxIteraciones = maxIteraciones;
      this._maxIteracionesSinMejora = maxIteracionesSinMejora;
      this._criterio = criterio ?? new CriterioAceptacion();
    }
    mejorarSolucion(grafo, fsm, funcionZ, gruposSinAsignar = [], logsEjection = []) {
      const reparaciones = this._repararHuerfanos(grafo, fsm, gruposSinAsignar);
      const optimizacion = this._optimizarZ(grafo, fsm, funcionZ, logsEjection);
      return {
        grafo,
        reparaciones,
        mejoras: optimizacion.mejoras,
        iteracionesEjecutadas: optimizacion.iteraciones,
        telemetria: optimizacion.telemetria
      };
    }
    mejorar(grafo, fsm, funcionZ, gruposSinAsignar = [], logsEjection = []) {
      return this.mejorarSolucion(grafo, fsm, funcionZ, gruposSinAsignar, logsEjection);
    }
    async mejorarSolucionAsync(grafo, fsm, funcionZ, gruposSinAsignar = [], logsEjection = [], context) {
      const reparaciones = await this._repararHuerfanosAsync(
        grafo,
        fsm,
        funcionZ,
        gruposSinAsignar,
        logsEjection,
        context
      );
      const optimizacion = await this._optimizarZAsync(grafo, fsm, funcionZ, logsEjection, context);
      return {
        grafo,
        reparaciones,
        mejoras: optimizacion.mejoras,
        iteracionesEjecutadas: optimizacion.iteraciones,
        telemetria: optimizacion.telemetria
      };
    }
    async mejorarAsync(grafo, fsm, funcionZ, gruposSinAsignar = [], logsEjection = [], context) {
      return this.mejorarSolucionAsync(grafo, fsm, funcionZ, gruposSinAsignar, logsEjection, context);
    }
    // ── Fase 1 ─────────────────────────────────────────
    _repararHuerfanos(grafo, fsm, gruposSinAsignar) {
      let reparaciones = 0;
      const pendientes = [...gruposSinAsignar];
      for (const idGrupoHuerfano of pendientes) {
        if (this._grupoYaAsignado(grafo, idGrupoHuerfano)) continue;
        if (!this._grupoExiste(grafo, idGrupoHuerfano)) continue;
        const reparado = this._intentarReparacionPorEyeccion(grafo, fsm, idGrupoHuerfano);
        if (reparado) {
          reparaciones++;
          continue;
        }
        const reparadoDirecto = this._intentarAsignacionDirecta(grafo, fsm, idGrupoHuerfano);
        if (reparadoDirecto) {
          reparaciones++;
        }
      }
      return reparaciones;
    }
    async _repararHuerfanosAsync(grafo, fsm, funcionZ, gruposSinAsignar, logsEjection, context) {
      let reparaciones = 0;
      const pendientes = [...gruposSinAsignar];
      let zActual = (await funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: "ejection:repair:init" })).Z;
      for (const idGrupoHuerfano of pendientes) {
        if (this._grupoYaAsignado(grafo, idGrupoHuerfano)) continue;
        if (!this._grupoExiste(grafo, idGrupoHuerfano)) continue;
        const reparado = await this._intentarReparacionPorEyeccionAsync(
          grafo,
          fsm,
          funcionZ,
          idGrupoHuerfano,
          zActual,
          logsEjection,
          context
        );
        if (reparado) {
          reparaciones++;
          zActual = (await funcionZ.evaluarGrafoAsync(grafo, {
            ...context,
            fase: "ejection:repair:accepted",
            idUeaGrupo: idGrupoHuerfano
          })).Z;
          continue;
        }
        const reparadoDirecto = await this._intentarAsignacionDirectaAsync(
          grafo,
          fsm,
          funcionZ,
          idGrupoHuerfano,
          zActual,
          logsEjection,
          context
        );
        if (reparadoDirecto) {
          reparaciones++;
          zActual = (await funcionZ.evaluarGrafoAsync(grafo, {
            ...context,
            fase: "ejection:repair:accepted",
            idUeaGrupo: idGrupoHuerfano
          })).Z;
        }
      }
      return reparaciones;
    }
    _grupoYaAsignado(grafo, idGrupo) {
      return grafo.asignacionesInversas.has(idGrupo);
    }
    _grupoExiste(grafo, idGrupo) {
      return grafo.grupos.has(idGrupo);
    }
    _obtenerAreaDelGrupo(grafo, idGrupo) {
      return grafo.grupos.get(idGrupo).idArea;
    }
    _buscarAsignacionesMismaArea(grafo, idArea) {
      const resultado = [];
      for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
        const grupo = grafo.grupos.get(idGrupo);
        if (grupo && grupo.idArea === idArea) {
          resultado.push({ idGrupo, numEco });
        }
      }
      return resultado;
    }
    _buscarProfesoresDelAreaExcluyendo(grafo, idArea, excluirNumEco) {
      return Array.from(grafo.profesores.values()).filter((p) => p.idArea.includes(idArea) && p.numeroEconomico !== excluirNumEco);
    }
    _buscarProfesoresDelArea(grafo, idArea) {
      return Array.from(grafo.profesores.values()).filter((p) => p.idArea.includes(idArea));
    }
    _intentarReparacionPorEyeccion(grafo, fsm, idGrupoHuerfano) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const victimas = this._buscarAsignacionesMismaArea(grafo, idArea);
      for (const victima of victimas) {
        const cadenaExitosa = this._ejecutarCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
        if (cadenaExitosa) return true;
      }
      return false;
    }
    async _intentarReparacionPorEyeccionAsync(grafo, fsm, funcionZ, idGrupoHuerfano, zActual, logsEjection, context) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const victimas = this._buscarAsignacionesMismaArea(grafo, idArea);
      for (const victima of victimas) {
        const cadenaExitosa = await this._ejecutarCadenaEyeccionAsync(
          grafo,
          fsm,
          funcionZ,
          idGrupoHuerfano,
          victima,
          zActual,
          logsEjection,
          context
        );
        if (cadenaExitosa) return true;
      }
      return false;
    }
    _ejecutarCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima) {
      this._eyectarAsignacion(grafo, fsm, victima.idGrupo);
      const huerfanoAsignadoAVictima = this._intentarAsignacionFSM(
        grafo,
        fsm,
        victima.numEco,
        idGrupoHuerfano
      );
      if (!huerfanoAsignadoAVictima) {
        this._restaurarAsignacion(grafo, fsm, victima.numEco, victima.idGrupo);
        return false;
      }
      grafo.asignarMutable(victima.numEco, idGrupoHuerfano);
      const victimaReasignada = this._intentarReasignarVictima(
        grafo,
        fsm,
        victima,
        idGrupoHuerfano
      );
      if (victimaReasignada) return true;
      this._revertirCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
      return false;
    }
    async _ejecutarCadenaEyeccionAsync(grafo, fsm, funcionZ, idGrupoHuerfano, victima, zActual, logsEjection, context) {
      const dominio = this._construirDominioSubconjuntoEyectado(grafo, idGrupoHuerfano, victima);
      const huerfanoParaVictima = dominio.find(
        (t) => t.numEco === victima.numEco && t.idGrupo === idGrupoHuerfano
      );
      if (!huerfanoParaVictima) {
        return false;
      }
      this._eyectarAsignacion(grafo, fsm, victima.idGrupo);
      const huerfanoAsignadoAVictima = await this._intentarAsignacionDominioAsync(
        grafo,
        fsm,
        funcionZ,
        huerfanoParaVictima,
        logsEjection,
        { idGrupoOrig: victima.idGrupo, numEcoOrig: victima.numEco },
        {
          ...context,
          fase: "ejection:repair:huerfano",
          idUeaGrupo: idGrupoHuerfano,
          ecoCandidato: victima.numEco
        }
      );
      if (!huerfanoAsignadoAVictima) {
        this._restaurarAsignacion(grafo, fsm, victima.numEco, victima.idGrupo);
        return false;
      }
      grafo.asignarMutable(victima.numEco, idGrupoHuerfano);
      fsm.actualizarGrafo(grafo);
      const victimaReasignada = await this._intentarReasignarVictimaAsync(
        grafo,
        fsm,
        funcionZ,
        victima,
        idGrupoHuerfano,
        zActual,
        logsEjection,
        context
      );
      if (victimaReasignada) return true;
      this._revertirCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima);
      return false;
    }
    _construirDominioSubconjuntoEyectado(grafo, idGrupoHuerfano, victima) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const gruposEyectados = [idGrupoHuerfano, victima.idGrupo];
      const profesoresCompatibles = this._buscarProfesoresDelArea(grafo, idArea);
      const dominio = [];
      for (const idGrupo of gruposEyectados) {
        const grupo = grafo.grupos.get(idGrupo);
        if (!grupo) continue;
        for (const profesor of profesoresCompatibles) {
          if (idGrupo === idGrupoHuerfano && profesor.numeroEconomico !== victima.numEco) {
            continue;
          }
          if (idGrupo === victima.idGrupo && profesor.numeroEconomico === victima.numEco) {
            continue;
          }
          dominio.push({
            numEco: profesor.numeroEconomico,
            idGrupo,
            uea: grupo.ueaClave,
            horario: grupo.horarioStringRaw
          });
        }
      }
      return dominio;
    }
    _eyectarAsignacion(grafo, fsm, idGrupo) {
      grafo.desasignarMutable(idGrupo);
      fsm.actualizarGrafo(grafo);
    }
    _intentarAsignacionFSM(_grafo, fsm, numEco, idGrupo, logsEjection, vitimaContext, contextoReglas) {
      const resultado = fsm.procesarAsignacion(numEco, idGrupo, contextoReglas);
      if (resultado.estado !== "ASIGNACION_OK" /* ASIGNACION_OK */ && logsEjection && vitimaContext) {
        logsEjection.push({
          ecoVictima: vitimaContext.numEcoOrig,
          ecoCandidato: numEco,
          idUeaGrupo: idGrupo,
          tipo: "FSM_ERROR",
          detalle: resultado.error ? `${resultado.error.reglaFallo} - ${resultado.error.motivo}` : "Error Indeterminado"
        });
      }
      return resultado.estado === "ASIGNACION_OK" /* ASIGNACION_OK */;
    }
    async _intentarAsignacionDominioAsync(grafo, fsm, funcionZ, tupla, logsEjection, victimaContext, context) {
      const detallesZ = funcionZ.obtenerDetallesCandidato(grafo, tupla.numEco, tupla.idGrupo);
      if (!this._intentarAsignacionFSM(
        grafo,
        fsm,
        tupla.numEco,
        tupla.idGrupo,
        logsEjection,
        victimaContext,
        this._contextoReglasDesdeZ(detallesZ)
      )) {
        return false;
      }
      const dominio = await funcionZ.evaluarDominioCandidatoAsync(
        grafo,
        tupla.numEco,
        tupla.idGrupo,
        {
          ...context,
          uea: tupla.uea,
          horario: tupla.horario
        }
      );
      if (!dominio.permitido) {
        logsEjection.push({
          ecoVictima: victimaContext.numEcoOrig,
          ecoCandidato: tupla.numEco,
          idUeaGrupo: tupla.idGrupo,
          tipo: this._tipoRechazoDominio(dominio.rechazos),
          detalle: dominio.rechazos.join(" | ")
        });
        return false;
      }
      return true;
    }
    _restaurarAsignacion(grafo, fsm, numEco, idGrupo) {
      grafo.asignarMutable(numEco, idGrupo);
      fsm.actualizarGrafo(grafo);
    }
    _intentarReasignarVictima(grafo, fsm, victima, idGrupoHuerfano) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const candidatos = this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, victima.numEco);
      fsm.actualizarGrafo(grafo);
      for (const cand of candidatos) {
        if (this._intentarAsignacionFSM(grafo, fsm, cand.numeroEconomico, victima.idGrupo)) {
          grafo.asignarMutable(cand.numeroEconomico, victima.idGrupo);
          fsm.actualizarGrafo(grafo);
          return true;
        }
      }
      return false;
    }
    async _intentarReasignarVictimaAsync(grafo, fsm, funcionZ, victima, idGrupoHuerfano, zActual, logsEjection, context) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const grupoVictima = grafo.grupos.get(victima.idGrupo);
      if (!grupoVictima) return false;
      const candidatos = this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, victima.numEco);
      fsm.actualizarGrafo(grafo);
      for (const cand of candidatos) {
        const tupla = {
          numEco: cand.numeroEconomico,
          idGrupo: victima.idGrupo,
          uea: grupoVictima.ueaClave,
          horario: grupoVictima.horarioStringRaw
        };
        const candidatoValido = await this._intentarAsignacionDominioAsync(
          grafo,
          fsm,
          funcionZ,
          tupla,
          logsEjection,
          { idGrupoOrig: victima.idGrupo, numEcoOrig: victima.numEco },
          {
            ...context,
            fase: "ejection:repair:victima",
            idUeaGrupo: victima.idGrupo,
            ecoCandidato: cand.numeroEconomico
          }
        );
        if (!candidatoValido) continue;
        grafo.asignarMutable(cand.numeroEconomico, victima.idGrupo);
        fsm.actualizarGrafo(grafo);
        const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, {
          ...context,
          fase: "ejection:repair:z",
          idUeaGrupo: victima.idGrupo,
          ecoCandidato: cand.numeroEconomico
        })).Z;
        if (this._aceptaNoDegradacion(zNuevo, zActual)) {
          return true;
        }
        logsEjection.push({
          ecoVictima: victima.numEco,
          ecoCandidato: cand.numeroEconomico,
          idUeaGrupo: victima.idGrupo,
          tipo: "SIN_MEJORA",
          detalle: `Reasignacion de victima fuera de dominio Z. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${zActual.toFixed(2)}`
        });
        grafo.desasignarMutable(victima.idGrupo);
        fsm.actualizarGrafo(grafo);
      }
      return false;
    }
    _revertirCadenaEyeccion(grafo, fsm, idGrupoHuerfano, victima) {
      grafo.desasignarMutable(idGrupoHuerfano);
      grafo.asignarMutable(victima.numEco, victima.idGrupo);
      fsm.actualizarGrafo(grafo);
    }
    _intentarAsignacionDirecta(grafo, fsm, idGrupoHuerfano) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const profesores = this._buscarProfesoresDelArea(grafo, idArea);
      fsm.actualizarGrafo(grafo);
      for (const prof of profesores) {
        if (this._intentarAsignacionFSM(grafo, fsm, prof.numeroEconomico, idGrupoHuerfano)) {
          grafo.asignarMutable(prof.numeroEconomico, idGrupoHuerfano);
          fsm.actualizarGrafo(grafo);
          return true;
        }
      }
      return false;
    }
    async _intentarAsignacionDirectaAsync(grafo, fsm, funcionZ, idGrupoHuerfano, zActual, logsEjection, context) {
      const idArea = this._obtenerAreaDelGrupo(grafo, idGrupoHuerfano);
      const grupo = grafo.grupos.get(idGrupoHuerfano);
      if (!grupo) return false;
      const profesores = this._buscarProfesoresDelArea(grafo, idArea);
      fsm.actualizarGrafo(grafo);
      for (const prof of profesores) {
        const tupla = {
          numEco: prof.numeroEconomico,
          idGrupo: idGrupoHuerfano,
          uea: grupo.ueaClave,
          horario: grupo.horarioStringRaw
        };
        const candidatoValido = await this._intentarAsignacionDominioAsync(
          grafo,
          fsm,
          funcionZ,
          tupla,
          logsEjection,
          { idGrupoOrig: idGrupoHuerfano, numEcoOrig: prof.numeroEconomico },
          {
            ...context,
            fase: "ejection:repair:directa",
            idUeaGrupo: idGrupoHuerfano,
            ecoCandidato: prof.numeroEconomico
          }
        );
        if (!candidatoValido) continue;
        grafo.asignarMutable(prof.numeroEconomico, idGrupoHuerfano);
        fsm.actualizarGrafo(grafo);
        const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, {
          ...context,
          fase: "ejection:repair:directa:z",
          idUeaGrupo: idGrupoHuerfano,
          ecoCandidato: prof.numeroEconomico
        })).Z;
        if (this._aceptaNoDegradacion(zNuevo, zActual)) {
          return true;
        }
        logsEjection.push({
          ecoVictima: prof.numeroEconomico,
          ecoCandidato: prof.numeroEconomico,
          idUeaGrupo: idGrupoHuerfano,
          tipo: "SIN_MEJORA",
          detalle: `Asignacion directa no preserva Z. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${zActual.toFixed(2)}`
        });
        grafo.desasignarMutable(idGrupoHuerfano);
        fsm.actualizarGrafo(grafo);
      }
      return false;
    }
    _tipoRechazoDominio(rechazos) {
      return rechazos.some((rechazo) => rechazo.startsWith("FUNCION_Z:")) ? "Z_DOMAIN_BLOCK" : "PENALTY_DOMAIN_BLOCK";
    }
    // ── Fase 2 ─────────────────────────────────────────
    _contextoReglasDesdeZ(detalles) {
      return {
        hayAcuerdoHorarioLaboral: {
          revisarAcuerdo: 1,
          umbral: 0.02,
          score: detalles.kde_ih_raw ?? detalles.kde_ih ?? detalles.h_ih ?? 0
        }
      };
    }
    _aceptaNoDegradacion(zNuevo, zActual) {
      return zNuevo + 1e-9 >= zActual;
    }
    _optimizarZ(grafo, fsm, funcionZ, logsEjection) {
      const estado = this._crearEstadoOptimizacion(funcionZ.evaluarGrafo(grafo).Z);
      while (this._debeContinuarOptimizacion(estado)) {
        estado.iteracion++;
        const movimiento = this._seleccionarMovimientoAleatorio(grafo);
        if (!movimiento) break;
        const candidatos = this._obtenerCandidatosSwap(grafo, movimiento);
        if (candidatos.length === 0) {
          estado.sinMejora++;
          continue;
        }
        this._ejecutarIteracionSwap(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection);
      }
      return {
        mejoras: estado.telemetria.aceptadasPorMejora,
        iteraciones: estado.iteracion,
        telemetria: estado.telemetria
      };
    }
    async _optimizarZAsync(grafo, fsm, funcionZ, logsEjection, context) {
      const estado = this._crearEstadoOptimizacion((await funcionZ.evaluarGrafoAsync(grafo, { ...context, fase: "ejection:init" })).Z);
      while (this._debeContinuarOptimizacion(estado)) {
        estado.iteracion++;
        const movimiento = this._seleccionarMovimientoAleatorio(grafo);
        if (!movimiento) break;
        const candidatos = this._obtenerCandidatosSwap(grafo, movimiento);
        if (candidatos.length === 0) {
          estado.sinMejora++;
          continue;
        }
        await this._ejecutarIteracionSwapAsync(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection, {
          ...context,
          fase: "ejection:swap",
          iteracionEjection: estado.iteracion,
          idUeaGrupo: movimiento.idGrupo,
          ecoOriginal: movimiento.numEcoOriginal
        });
      }
      return {
        mejoras: estado.telemetria.aceptadasPorMejora,
        iteraciones: estado.iteracion,
        telemetria: estado.telemetria
      };
    }
    _crearEstadoOptimizacion(zInicial) {
      return {
        zActual: zInicial,
        sinMejora: 0,
        iteracion: 0,
        telemetria: {
          aceptadasPorMejora: 0,
          rechazadasPorRuido: 0,
          rechazadasPorUmbral: 0,
          rechazadasSinMejora: 0,
          deltaZAcumulado: 0
        }
      };
    }
    _debeContinuarOptimizacion(estado) {
      return estado.iteracion < this._maxIteraciones && estado.sinMejora < this._maxIteracionesSinMejora;
    }
    _seleccionarMovimientoAleatorio(grafo) {
      const asignaciones = Array.from(grafo.asignacionesInversas.entries());
      if (asignaciones.length === 0) return null;
      const idx = Math.floor(Math.random() * asignaciones.length);
      const [idGrupo, numEcoOriginal] = asignaciones[idx];
      if (!this._grupoExiste(grafo, idGrupo)) return null;
      return { idGrupo, numEcoOriginal };
    }
    _obtenerCandidatosSwap(grafo, movimiento) {
      const idArea = this._obtenerAreaDelGrupo(grafo, movimiento.idGrupo);
      return this._buscarProfesoresDelAreaExcluyendo(grafo, idArea, movimiento.numEcoOriginal);
    }
    _barajarCandidatos(candidatos) {
      const barajados = [...candidatos];
      for (let i = barajados.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [barajados[i], barajados[j]] = [barajados[j], barajados[i]];
      }
      return barajados;
    }
    _ejecutarIteracionSwap(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection) {
      this._eyectarAsignacion(grafo, fsm, movimiento.idGrupo);
      const candidatosBarajados = this._barajarCandidatos(candidatos);
      let swapRealizado = false;
      for (const candidato of candidatosBarajados) {
        const detallesZ = funcionZ.obtenerDetallesCandidato(grafo, candidato.numeroEconomico, movimiento.idGrupo);
        if (!this._intentarAsignacionFSM(
          grafo,
          fsm,
          candidato.numeroEconomico,
          movimiento.idGrupo,
          logsEjection,
          { idGrupoOrig: movimiento.idGrupo, numEcoOrig: movimiento.numEcoOriginal },
          this._contextoReglasDesdeZ(detallesZ)
        )) {
          continue;
        }
        grafo.asignarMutable(candidato.numeroEconomico, movimiento.idGrupo);
        fsm.actualizarGrafo(grafo);
        swapRealizado = this._evaluarYDecidirSwap(
          grafo,
          fsm,
          funcionZ,
          movimiento,
          candidato.numeroEconomico,
          estado,
          logsEjection
        );
        if (swapRealizado) break;
      }
      if (!swapRealizado) {
        this._restaurarAsignacion(grafo, fsm, movimiento.numEcoOriginal, movimiento.idGrupo);
        estado.sinMejora++;
      }
    }
    async _ejecutarIteracionSwapAsync(grafo, fsm, funcionZ, movimiento, candidatos, estado, logsEjection, context) {
      this._eyectarAsignacion(grafo, fsm, movimiento.idGrupo);
      const candidatosBarajados = this._barajarCandidatos(candidatos);
      let swapRealizado = false;
      for (const candidato of candidatosBarajados) {
        if (!this._intentarAsignacionFSM(grafo, fsm, candidato.numeroEconomico, movimiento.idGrupo, logsEjection, { idGrupoOrig: movimiento.idGrupo, numEcoOrig: movimiento.numEcoOriginal })) {
          continue;
        }
        const grupo = grafo.grupos.get(movimiento.idGrupo);
        const dominio = await funcionZ.evaluarDominioCandidatoAsync(
          grafo,
          candidato.numeroEconomico,
          movimiento.idGrupo,
          {
            ...context,
            fase: "ejection:swap:dominio",
            ecoCandidato: candidato.numeroEconomico,
            uea: grupo?.ueaClave,
            horario: grupo?.horarioStringRaw
          }
        );
        if (!dominio.permitido) {
          logsEjection.push({
            ecoVictima: movimiento.numEcoOriginal,
            ecoCandidato: candidato.numeroEconomico,
            idUeaGrupo: movimiento.idGrupo,
            tipo: this._tipoRechazoDominio(dominio.rechazos),
            detalle: dominio.rechazos.join(" | ")
          });
          continue;
        }
        grafo.asignarMutable(candidato.numeroEconomico, movimiento.idGrupo);
        fsm.actualizarGrafo(grafo);
        swapRealizado = await this._evaluarYDecidirSwapAsync(
          grafo,
          fsm,
          funcionZ,
          movimiento,
          candidato.numeroEconomico,
          estado,
          logsEjection,
          { ...context, ecoCandidato: candidato.numeroEconomico }
        );
        if (swapRealizado) break;
      }
      if (!swapRealizado) {
        this._restaurarAsignacion(grafo, fsm, movimiento.numEcoOriginal, movimiento.idGrupo);
        estado.sinMejora++;
      }
    }
    _evaluarYDecidirSwap(grafo, fsm, funcionZ, movimiento, numEcoCandidatoInfo, estado, logsEjection) {
      const zNuevo = funcionZ.evaluarGrafo(grafo).Z;
      const clasificacion = this._criterio.clasificarDelta(zNuevo, estado.zActual);
      if (clasificacion === "MEJORA_SIGNIFICATIVA" /* MEJORA_SIGNIFICATIVA */) {
        this._aceptarSwap(estado, zNuevo);
        return true;
      }
      logsEjection.push({
        ecoVictima: movimiento.numEcoOriginal,
        ecoCandidato: numEcoCandidatoInfo,
        idUeaGrupo: movimiento.idGrupo,
        tipo: clasificacion,
        detalle: `Evalu\xF3 la Z iterativa y no super\xF3 el umbral. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${estado.zActual.toFixed(2)}`
      });
      this._rechazarSwap(grafo, fsm, movimiento, estado, clasificacion);
      return false;
    }
    async _evaluarYDecidirSwapAsync(grafo, fsm, funcionZ, movimiento, numEcoCandidatoInfo, estado, logsEjection, context) {
      const zNuevo = (await funcionZ.evaluarGrafoAsync(grafo, context)).Z;
      const clasificacion = this._criterio.clasificarDelta(zNuevo, estado.zActual);
      if (clasificacion === "MEJORA_SIGNIFICATIVA" /* MEJORA_SIGNIFICATIVA */) {
        this._aceptarSwap(estado, zNuevo);
        return true;
      }
      logsEjection.push({
        ecoVictima: movimiento.numEcoOriginal,
        ecoCandidato: numEcoCandidatoInfo,
        idUeaGrupo: movimiento.idGrupo,
        tipo: clasificacion,
        detalle: `Evaluo la Z iterativa y no supero el umbral. ZNuevo: ${zNuevo.toFixed(2)} | ZActual: ${estado.zActual.toFixed(2)}`
      });
      this._rechazarSwap(grafo, fsm, movimiento, estado, clasificacion);
      return false;
    }
    _aceptarSwap(estado, zNuevo) {
      estado.telemetria.deltaZAcumulado += zNuevo - estado.zActual;
      estado.zActual = zNuevo;
      estado.telemetria.aceptadasPorMejora++;
      estado.sinMejora = 0;
    }
    _rechazarSwap(grafo, fsm, movimiento, estado, clasificacion) {
      grafo.desasignarMutable(movimiento.idGrupo);
      fsm.actualizarGrafo(grafo);
      this._contabilizarRechazo(estado.telemetria, clasificacion);
    }
    _contabilizarRechazo(telemetria, clasificacion) {
      switch (clasificacion) {
        case "RUIDO_NUMERICO" /* RUIDO_NUMERICO */:
          telemetria.rechazadasPorRuido++;
          break;
        case "RECHAZADA_POR_UMBRAL" /* RECHAZADA_POR_UMBRAL */:
          telemetria.rechazadasPorUmbral++;
          break;
        case "SIN_MEJORA" /* SIN_MEJORA */:
          telemetria.rechazadasSinMejora++;
          break;
      }
    }
  };

  // greedy/GreedyOrchestrator.ts
  var GreedyOrchestrator = class {
    _estrategia;
    _funcionZ;
    _funcionZObj;
    _ejectionChain;
    _rclConfig;
    _penaltyRcl;
    _lambdaPenaltyRcl = 1;
    constructor(estrategia = new EstrategiaMCV(), funcionZ, constraintsPersonalizados, ejectionChain, modeloPenalty, rclConfig) {
      this._estrategia = estrategia;
      this._funcionZ = funcionZ ?? funcionZUniforme;
      this._rclConfig = rclConfig ?? { k: 10, alpha: 0.25 };
      const constraints = constraintsPersonalizados ?? [
        { constraint: new ViabilidadHuecos(), lambda: 2 },
        { constraint: new ViabilidadPenalizacionCarga("http://127.0.0.1:8000", modeloPenalty), lambda: 1 }
      ];
      const penaltyConstraint = constraints.find((cp) => cp.constraint instanceof ViabilidadPenalizacionCarga);
      if (penaltyConstraint && penaltyConstraint.constraint instanceof ViabilidadPenalizacionCarga) {
        this._penaltyRcl = penaltyConstraint.constraint;
        this._lambdaPenaltyRcl = penaltyConstraint.lambda;
      }
      this._funcionZObj = new FuncionObjetivoZ(constraints, this._funcionZ);
      this._ejectionChain = ejectionChain ?? new EjectionChain();
    }
    /**
     * Ejecuta el algoritmo GRASP sobre los catálogos proporcionados.
     *
     * @param profesores Lista completa de profesores disponibles.
     * @param grupos Lista completa de grupos a asignar.
     * @param grafoInicial Opcional. Grafo pre-asignado a utilizar como base.
     * @returns ResultadoGreedy con asignaciones exitosas, métricas y scoreZ.
     */
    ejecutar(profesores, grupos, grafoInicial = null) {
      const inicio = performance.now();
      SemanaLaboral.invalidarCache();
      const grafo = grafoInicial ? grafoInicial.clonar() : new GrafoBipartito();
      if (!grafoInicial) {
        profesores.forEach((p) => grafo.registrarProfesor(p));
        grupos.forEach((g) => grafo.registrarGrupo(g));
      }
      const reglasFast = ReglasPipeline.getReglasFastFail();
      const reglasRestantes = ReglasPipeline.getReglasRestantes();
      const fsmFilter = FSMFactory.crear(grafo, reglasFast);
      const fsmRegular = FSMFactory.crear(grafo, reglasRestantes);
      const loggerFirstFSM = new FirstFSMLogger();
      const gruposPorArea = this._agruparPorArea(grupos);
      const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
      const profesoresPorArea = this._agruparProfesoresPorArea(profesores);
      const disableLogs = this._rclConfig.disableLogs === true;
      const gruposAsignados = /* @__PURE__ */ new Set();
      let totalEvaluaciones = 0;
      let totalRechazados = 0;
      const logsFase1 = [];
      const logsEjection = [];
      for (const [idArea, gruposDelArea] of areasOrdenadas) {
        const profesoresDelArea = profesoresPorArea.get(idArea) || [];
        if (profesoresDelArea.length === 0) continue;
        const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);
        const gruposDelAreaPendientes = new Set(gruposOrdenados.map((g) => g.idUeaGrupo).filter((id) => !gruposAsignados.has(id)));
        let candidatosGlobales = [];
        const candidatosTentadosPorGrupo = /* @__PURE__ */ new Map();
        for (const grupo of gruposOrdenados) {
          if (gruposAsignados.has(grupo.idUeaGrupo)) continue;
          candidatosTentadosPorGrupo.set(grupo.idUeaGrupo, []);
          const profesoresParaGrupo = this._estrategia.ordenarProfesores(profesoresDelArea, grupo.idUeaGrupo);
          let validosGrupo = [];
          for (const profesor of profesoresParaGrupo) {
            totalEvaluaciones++;
            const resultadoFilter = fsmFilter.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);
            if (resultadoFilter.estado !== "ASIGNACION_OK" /* ASIGNACION_OK */) {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = resultadoFilter.error ? `${resultadoFilter.error.reglaFallo} - ${resultadoFilter.error.motivo}` : "Fallo Filter FSM";
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoFilter.error?.reglaFallo || "UNKNOWN", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: profesor.numeroEconomico,
                  puntajeSijh: 0,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: errorMsg
                });
              }
              continue;
            }
            const detalles = this._funcionZ(profesor.numeroEconomico, grupo.idUeaGrupo, grafo);
            const scoreSijh = detalles.score;
            const bloqueoZ = explicarBloqueoZScore(detalles);
            if (bloqueoZ) {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = bloqueoZ;
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, "Z_DOMAIN_BLOCK", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  ...this._debugZ(profesor.numeroEconomico, scoreSijh, detalles),
                  estado: "RECHAZADO",
                  zDomainBlocked: true,
                  zBlockReason: errorMsg,
                  ultimoErrorFSM: errorMsg
                });
              }
              continue;
            }
            if (scoreSijh === 0) {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = "CACHE_MISS - Combinaci\xF3n sin predicci\xF3n ML en Redis";
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, "CACHE_MISS", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: profesor.numeroEconomico,
                  puntajeSijh: 0,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: errorMsg
                });
              }
              continue;
            }
            const resultadoRegular = fsmRegular.procesarAsignacion(
              profesor.numeroEconomico,
              grupo.idUeaGrupo,
              this._contextoReglasDesdeZ(detalles)
            );
            if (resultadoRegular.estado === "ASIGNACION_OK" /* ASIGNACION_OK */) {
              validosGrupo.push({
                eco: profesor.numeroEconomico,
                grupo,
                scoreSijh,
                rhat: detalles.rhat,
                h_ih: detalles.h_ih,
                kde_ij: detalles.kde_ij,
                kde_ih: detalles.kde_ih,
                kde_ih_raw: detalles.kde_ih_raw,
                kde_plan: detalles.kde_plan,
                zBase: detalles.zBase,
                projectedPlanCount: detalles.projectedPlanCount,
                dayCoverage: detalles.dayCoverage,
                patternSimilarity: detalles.patternSimilarity,
                estadoFSM: "ASIGNACION_OK" /* ASIGNACION_OK */
              });
            } else {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = resultadoRegular.error ? `${resultadoRegular.error.reglaFallo} - ${resultadoRegular.error.motivo}` : "Fallo Regular FSM";
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoRegular.error?.reglaFallo || "UNKNOWN", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: profesor.numeroEconomico,
                  puntajeSijh: scoreSijh,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: errorMsg
                });
              }
            }
          }
          if (validosGrupo.length > this._rclConfig.k && this._rclConfig.k > 0) {
            validosGrupo.sort((a, b) => b.scoreSijh - a.scoreSijh);
            const descartados = validosGrupo.slice(this._rclConfig.k);
            validosGrupo = validosGrupo.slice(0, this._rclConfig.k);
            if (!disableLogs) {
              for (const desc of descartados) {
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: desc.eco,
                  puntajeSijh: desc.scoreSijh,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: "Fuera del Top K base del grupo"
                });
              }
            }
          }
          candidatosGlobales.push(...validosGrupo);
        }
        while (gruposDelAreaPendientes.size > 0 && candidatosGlobales.length > 0) {
          candidatosGlobales.sort((a, b) => b.scoreSijh - a.scoreSijh);
          let candidatosFiltrados = candidatosGlobales;
          if (this._rclConfig.k > 0) {
            candidatosFiltrados = candidatosFiltrados.slice(0, this._rclConfig.k);
          }
          const maxScore = candidatosFiltrados[0].scoreSijh;
          const minScore = candidatosFiltrados[candidatosFiltrados.length - 1].scoreSijh;
          if (this._rclConfig.alpha > 0) {
            const umbral = maxScore - this._rclConfig.alpha * (maxScore - minScore);
            candidatosFiltrados = candidatosFiltrados.filter((c) => c.scoreSijh >= umbral);
          } else {
            candidatosFiltrados = candidatosFiltrados.filter((c) => c.scoreSijh === maxScore);
          }
          const elegido = candidatosFiltrados[Math.floor(Math.random() * candidatosFiltrados.length)];
          grafo.asignarMutable(elegido.eco, elegido.grupo.idUeaGrupo);
          gruposAsignados.add(elegido.grupo.idUeaGrupo);
          gruposDelAreaPendientes.delete(elegido.grupo.idUeaGrupo);
          if (!disableLogs) {
            const tentados = candidatosTentadosPorGrupo.get(elegido.grupo.idUeaGrupo) || [];
            const grupoCandidatos = candidatosGlobales.filter((c) => c.grupo.idUeaGrupo === elegido.grupo.idUeaGrupo);
            for (const cand of grupoCandidatos) {
              tentados.push({
                eco: cand.eco,
                puntajeSijh: cand.scoreSijh,
                rhat: cand.rhat,
                h_ih: cand.h_ih,
                kde_ij: cand.kde_ij,
                kde_ih: cand.kde_ih,
                kde_ih_raw: cand.kde_ih_raw,
                kde_plan: cand.kde_plan,
                zBase: cand.zBase,
                projectedPlanCount: cand.projectedPlanCount,
                dayCoverage: cand.dayCoverage,
                patternSimilarity: cand.patternSimilarity,
                estado: cand.eco === elegido.eco ? "ELEGIDO" : "RECHAZADO",
                ultimoErrorFSM: cand.eco === elegido.eco ? void 0 : "No seleccionado en RCL Global"
              });
            }
            this._registrarLogFase1(logsFase1, elegido.grupo, tentados, tentados.find((t) => t.estado === "ELEGIDO"));
          }
          candidatosGlobales = candidatosGlobales.filter((c) => c.grupo.idUeaGrupo !== elegido.grupo.idUeaGrupo);
          for (const cand of candidatosGlobales.filter((c) => c.eco === elegido.eco)) {
            const detallesActualizados = this._funcionZ(cand.eco, cand.grupo.idUeaGrupo, grafo);
            const bloqueoZ = explicarBloqueoZScore(detallesActualizados);
            this._aplicarDetallesZ(cand, detallesActualizados);
            if (bloqueoZ) {
              cand.estadoFSM = "ERROR_REGLA" /* ERROR_REGLA */;
              cand.ultimoErrorFSM = bloqueoZ;
              if (!disableLogs) {
                candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                  ...this._debugZ(cand.eco, cand.scoreSijh, detallesActualizados),
                  estado: "RECHAZADO",
                  zDomainBlocked: true,
                  zBlockReason: bloqueoZ,
                  ultimoErrorFSM: bloqueoZ
                });
              }
              continue;
            }
            const res = fsmRegular.procesarAsignacion(
              cand.eco,
              cand.grupo.idUeaGrupo,
              this._contextoReglasDesdeZ(detallesActualizados)
            );
            if (res.estado !== "ASIGNACION_OK" /* ASIGNACION_OK */) {
              cand.estadoFSM = res.estado;
              cand.ultimoErrorFSM = res.error ? `${res.error.reglaFallo} - ${res.error.motivo}` : "Fallo FSM por nueva carga";
              if (!disableLogs) {
                candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                  eco: cand.eco,
                  puntajeSijh: cand.scoreSijh,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: cand.ultimoErrorFSM
                });
              }
            }
          }
          candidatosGlobales = candidatosGlobales.filter((c) => c.estadoFSM === "ASIGNACION_OK" /* ASIGNACION_OK */);
        }
        if (!disableLogs) {
          for (const idGrupoHuerfano of gruposDelAreaPendientes) {
            const grupo = gruposOrdenados.find((g) => g.idUeaGrupo === idGrupoHuerfano);
            const tentados = candidatosTentadosPorGrupo.get(idGrupoHuerfano) || [];
            logsFase1.push({
              idUeaGrupo: grupo.idUeaGrupo,
              uea: grupo.ueaClave,
              claveGrupo: grupo.claveGrupo,
              horario: grupo.horarioStringRaw,
              resolucion: `Ninguno de los ${tentados.length} candidatos logr\xF3 sortear la FSM. Termin\xF3 hu\xE9rfano.`,
              candidatosTentados: tentados
            });
          }
        }
      }
      const todosLosGrupoIds = grupos.map((g) => g.idUeaGrupo);
      const huerfanosPreRepair = todosLosGrupoIds.filter((id) => !grafo.asignacionesInversas.has(id));
      const dummyLogsEjection = [];
      const resultadoMejora = this._ejectionChain.mejorarSolucion(grafo, fsmRegular, this._funcionZObj, huerfanosPreRepair, disableLogs ? dummyLogsEjection : logsEjection);
      const resultadoZ = this._funcionZObj.evaluarGrafo(grafo);
      const asignaciones = [];
      for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
        asignaciones.push({
          numeroEconomico: numEco,
          idUeaGrupo: idGrupo
        });
      }
      const gruposSinAsignar = todosLosGrupoIds.filter((id) => !grafo.asignacionesInversas.has(id));
      const fin = performance.now();
      const metricas = {
        totalEvaluaciones,
        totalAsignados: asignaciones.length,
        totalRechazados,
        tiempoMs: Math.round(fin - inicio),
        gruposSinAsignar,
        scoreZ: resultadoZ.Z,
        mejorasLocales: resultadoMejora.mejoras,
        reparaciones: resultadoMejora.reparaciones,
        logsFase1,
        logsEjection,
        logsFirstFSM: loggerFirstFSM.obtenerReporte()
      };
      return { asignaciones, metricas };
    }
    /**
     * Variante async para evaluaciones que deben esperar restricciones ML reales.
     * Mantiene la fase constructiva sincrona y hace bloqueantes las evaluaciones Z.
     */
    async ejecutarAsync(profesores, grupos, grafoInicial = null, context = {}) {
      const inicio = performance.now();
      SemanaLaboral.invalidarCache();
      const grafo = grafoInicial ? grafoInicial.clonar() : new GrafoBipartito();
      if (!grafoInicial) {
        profesores.forEach((p) => grafo.registrarProfesor(p));
        grupos.forEach((g) => grafo.registrarGrupo(g));
      }
      const reglasFast = ReglasPipeline.getReglasFastFail();
      const reglasRestantes = ReglasPipeline.getReglasRestantes();
      const fsmFilter = FSMFactory.crear(grafo, reglasFast);
      const fsmRegular = FSMFactory.crear(grafo, reglasRestantes);
      const loggerFirstFSM = new FirstFSMLogger();
      const gruposPorArea = this._agruparPorArea(grupos);
      const areasOrdenadas = this._estrategia.ordenarAreas(gruposPorArea);
      const profesoresPorArea = this._agruparProfesoresPorArea(profesores);
      const disableLogs = this._rclConfig.disableLogs === true;
      const gruposAsignados = /* @__PURE__ */ new Set();
      let totalEvaluaciones = 0;
      let totalRechazados = 0;
      const logsFase1 = [];
      const logsEjection = [];
      const usePenalty = !!this._penaltyRcl;
      for (const [idArea, gruposDelArea] of areasOrdenadas) {
        const profesoresDelArea = profesoresPorArea.get(idArea) || [];
        if (profesoresDelArea.length === 0) continue;
        const gruposOrdenados = this._estrategia.ordenarGrupos(gruposDelArea);
        const gruposDelAreaPendientes = new Set(gruposOrdenados.map((g) => g.idUeaGrupo).filter((id) => !gruposAsignados.has(id)));
        let candidatosGlobales = [];
        const candidatosTentadosPorGrupo = /* @__PURE__ */ new Map();
        for (const grupo of gruposOrdenados) {
          if (gruposAsignados.has(grupo.idUeaGrupo)) continue;
          candidatosTentadosPorGrupo.set(grupo.idUeaGrupo, []);
          const profesoresParaGrupo = this._estrategia.ordenarProfesores(profesoresDelArea, grupo.idUeaGrupo);
          const validosGrupo = [];
          for (const profesor of profesoresParaGrupo) {
            totalEvaluaciones++;
            const resultadoFilter = fsmFilter.procesarAsignacion(profesor.numeroEconomico, grupo.idUeaGrupo);
            if (resultadoFilter.estado !== "ASIGNACION_OK" /* ASIGNACION_OK */) {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = resultadoFilter.error ? `${resultadoFilter.error.reglaFallo} - ${resultadoFilter.error.motivo}` : "Fallo Filter FSM";
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoFilter.error?.reglaFallo || "UNKNOWN", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: profesor.numeroEconomico,
                  puntajeSijh: 0,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: errorMsg
                });
              }
              continue;
            }
            const detalles = this._funcionZ(profesor.numeroEconomico, grupo.idUeaGrupo, grafo);
            const scoreSijh = detalles.score;
            const bloqueoZ = explicarBloqueoZScore(detalles);
            if (bloqueoZ) {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = bloqueoZ;
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, "Z_DOMAIN_BLOCK", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  ...this._debugZ(profesor.numeroEconomico, scoreSijh, detalles),
                  estado: "RECHAZADO",
                  zDomainBlocked: true,
                  zBlockReason: errorMsg,
                  ultimoErrorFSM: errorMsg
                });
              }
              continue;
            }
            const resultadoRegular = fsmRegular.procesarAsignacion(
              profesor.numeroEconomico,
              grupo.idUeaGrupo,
              this._contextoReglasDesdeZ(detalles)
            );
            if (resultadoRegular.estado === "ASIGNACION_OK" /* ASIGNACION_OK */) {
              validosGrupo.push({
                eco: profesor.numeroEconomico,
                grupo,
                scoreSijh,
                rhat: detalles.rhat,
                h_ih: detalles.h_ih,
                kde_ij: detalles.kde_ij,
                kde_ih: detalles.kde_ih,
                kde_ih_raw: detalles.kde_ih_raw,
                kde_plan: detalles.kde_plan,
                zBase: detalles.zBase,
                projectedPlanCount: detalles.projectedPlanCount,
                dayCoverage: detalles.dayCoverage,
                patternSimilarity: detalles.patternSimilarity,
                estadoFSM: "ASIGNACION_OK" /* ASIGNACION_OK */,
                scoreRcl: scoreSijh
              });
            } else {
              totalRechazados++;
              if (!disableLogs) {
                const errorMsg = resultadoRegular.error ? `${resultadoRegular.error.reglaFallo} - ${resultadoRegular.error.motivo}` : "Fallo Regular FSM";
                loggerFirstFSM.registrarCandidatoRechazado(profesor.numeroEconomico, grupo.idUeaGrupo, resultadoRegular.error?.reglaFallo || "UNKNOWN", errorMsg);
                candidatosTentadosPorGrupo.get(grupo.idUeaGrupo).push({
                  eco: profesor.numeroEconomico,
                  puntajeSijh: scoreSijh,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: errorMsg
                });
              }
            }
          }
          candidatosGlobales.push(...validosGrupo);
        }
        if (usePenalty) {
          await Promise.all(candidatosGlobales.map(async (cand) => {
            await this._aplicarPenaltyCandidatoRclAsync(grafo, cand, {
              ...context,
              fase: "constructiva:rcl",
              idUeaGrupo: cand.grupo.idUeaGrupo,
              uea: cand.grupo.ueaClave,
              claveGrupo: cand.grupo.claveGrupo
            });
          }));
          if (!disableLogs) {
            for (const cand of candidatosGlobales.filter((c) => c.penaltyBlocked)) {
              candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                eco: cand.eco,
                puntajeSijh: cand.scoreSijh,
                rhat: cand.rhat,
                h_ih: cand.h_ih,
                kde_ij: cand.kde_ij,
                kde_ih: cand.kde_ih,
                kde_ih_raw: cand.kde_ih_raw,
                kde_plan: cand.kde_plan,
                zBase: cand.zBase,
                projectedPlanCount: cand.projectedPlanCount,
                dayCoverage: cand.dayCoverage,
                patternSimilarity: cand.patternSimilarity,
                viabilidadPenalty: cand.viabilidadPenalty,
                penaltyRaw: cand.penaltyRaw,
                scoreRcl: cand.scoreRcl,
                loadPenalty: cand.loadPenalty,
                loadProbability: cand.loadProbability,
                penaltyProbability: cand.penaltyProbability,
                penaltyMask: cand.penaltyMask,
                loadDensityRatio: cand.loadDensityRatio,
                projectedUeaCount: cand.projectedUeaCount,
                penaltyBlocked: true,
                penaltyBlockReason: cand.penaltyBlockReason,
                estado: "RECHAZADO",
                ultimoErrorFSM: cand.penaltyBlockReason ?? "PENALTY_DOMAIN_BLOCK"
              });
            }
          }
          totalRechazados += candidatosGlobales.filter((c) => c.penaltyBlocked).length;
          candidatosGlobales = candidatosGlobales.filter((c) => !c.penaltyBlocked);
        }
        while (gruposDelAreaPendientes.size > 0 && candidatosGlobales.length > 0) {
          candidatosGlobales.sort((a, b) => b.scoreRcl - a.scoreRcl);
          let candidatosFiltrados = candidatosGlobales;
          if (this._rclConfig.k > 0) {
            candidatosFiltrados = candidatosFiltrados.slice(0, this._rclConfig.k);
          }
          const maxScore = candidatosFiltrados[0].scoreRcl;
          const minScore = candidatosFiltrados[candidatosFiltrados.length - 1].scoreRcl;
          if (this._rclConfig.alpha > 0) {
            const umbral = maxScore - this._rclConfig.alpha * (maxScore - minScore);
            candidatosFiltrados = candidatosFiltrados.filter((c) => c.scoreRcl >= umbral);
          } else {
            candidatosFiltrados = candidatosFiltrados.filter((c) => c.scoreRcl === maxScore);
          }
          const elegido = candidatosFiltrados[Math.floor(Math.random() * candidatosFiltrados.length)];
          grafo.asignarMutable(elegido.eco, elegido.grupo.idUeaGrupo);
          gruposAsignados.add(elegido.grupo.idUeaGrupo);
          gruposDelAreaPendientes.delete(elegido.grupo.idUeaGrupo);
          if (!disableLogs) {
            const tentados = candidatosTentadosPorGrupo.get(elegido.grupo.idUeaGrupo) || [];
            const grupoCandidatos = candidatosGlobales.filter((c) => c.grupo.idUeaGrupo === elegido.grupo.idUeaGrupo);
            for (const cand of grupoCandidatos) {
              tentados.push({
                eco: cand.eco,
                puntajeSijh: cand.scoreSijh,
                rhat: cand.rhat,
                h_ih: cand.h_ih,
                kde_ij: cand.kde_ij,
                kde_ih: cand.kde_ih,
                kde_ih_raw: cand.kde_ih_raw,
                kde_plan: cand.kde_plan,
                zBase: cand.zBase,
                projectedPlanCount: cand.projectedPlanCount,
                dayCoverage: cand.dayCoverage,
                patternSimilarity: cand.patternSimilarity,
                viabilidadPenalty: cand.viabilidadPenalty,
                penaltyRaw: cand.penaltyRaw,
                scoreRcl: cand.scoreRcl,
                loadPenalty: cand.loadPenalty,
                loadProbability: cand.loadProbability,
                penaltyProbability: cand.penaltyProbability,
                penaltyMask: cand.penaltyMask,
                loadDensityRatio: cand.loadDensityRatio,
                projectedUeaCount: cand.projectedUeaCount,
                penaltyBlocked: cand.penaltyBlocked,
                penaltyBlockReason: cand.penaltyBlockReason,
                estado: cand.eco === elegido.eco ? "ELEGIDO" : "RECHAZADO",
                ultimoErrorFSM: cand.eco === elegido.eco ? void 0 : "No seleccionado en RCL Global"
              });
            }
            this._registrarLogFase1(logsFase1, elegido.grupo, tentados, tentados.find((t) => t.estado === "ELEGIDO"));
          }
          candidatosGlobales = candidatosGlobales.filter((c) => c.grupo.idUeaGrupo !== elegido.grupo.idUeaGrupo);
          const promesasActualizacion = candidatosGlobales.filter((c) => c.eco === elegido.eco).map(async (cand) => {
            const detallesActualizados = this._funcionZ(cand.eco, cand.grupo.idUeaGrupo, grafo);
            const bloqueoZ = explicarBloqueoZScore(detallesActualizados);
            this._aplicarDetallesZ(cand, detallesActualizados);
            if (bloqueoZ) {
              cand.estadoFSM = "ERROR_REGLA" /* ERROR_REGLA */;
              cand.ultimoErrorFSM = bloqueoZ;
              if (!disableLogs) {
                candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                  ...this._debugZ(cand.eco, cand.scoreSijh, detallesActualizados),
                  estado: "RECHAZADO",
                  zDomainBlocked: true,
                  zBlockReason: bloqueoZ,
                  ultimoErrorFSM: bloqueoZ
                });
              }
              return;
            }
            const res = fsmRegular.procesarAsignacion(
              cand.eco,
              cand.grupo.idUeaGrupo,
              this._contextoReglasDesdeZ(detallesActualizados)
            );
            if (res.estado !== "ASIGNACION_OK" /* ASIGNACION_OK */) {
              cand.estadoFSM = res.estado;
              cand.ultimoErrorFSM = res.error ? `${res.error.reglaFallo} - ${res.error.motivo}` : "Fallo FSM por nueva carga";
              if (!disableLogs) {
                candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                  eco: cand.eco,
                  puntajeSijh: cand.scoreSijh,
                  estado: "RECHAZADO",
                  ultimoErrorFSM: cand.ultimoErrorFSM
                });
              }
            } else if (usePenalty) {
              await this._aplicarPenaltyCandidatoRclAsync(grafo, cand, {
                ...context,
                fase: "constructiva:rcl",
                idUeaGrupo: cand.grupo.idUeaGrupo,
                uea: cand.grupo.ueaClave,
                claveGrupo: cand.grupo.claveGrupo
              });
              if (cand.penaltyBlocked) {
                totalRechazados++;
                if (!disableLogs) {
                  candidatosTentadosPorGrupo.get(cand.grupo.idUeaGrupo).push({
                    eco: cand.eco,
                    puntajeSijh: cand.scoreSijh,
                    rhat: cand.rhat,
                    h_ih: cand.h_ih,
                    kde_ij: cand.kde_ij,
                    kde_ih: cand.kde_ih,
                    kde_ih_raw: cand.kde_ih_raw,
                    kde_plan: cand.kde_plan,
                    zBase: cand.zBase,
                    projectedPlanCount: cand.projectedPlanCount,
                    dayCoverage: cand.dayCoverage,
                    patternSimilarity: cand.patternSimilarity,
                    viabilidadPenalty: cand.viabilidadPenalty,
                    penaltyRaw: cand.penaltyRaw,
                    scoreRcl: cand.scoreRcl,
                    loadPenalty: cand.loadPenalty,
                    penaltyMask: cand.penaltyMask,
                    projectedUeaCount: cand.projectedUeaCount,
                    penaltyBlocked: true,
                    penaltyBlockReason: cand.penaltyBlockReason,
                    estado: "RECHAZADO",
                    ultimoErrorFSM: cand.penaltyBlockReason ?? "PENALTY_DOMAIN_BLOCK"
                  });
                }
              }
            }
          });
          await Promise.all(promesasActualizacion);
          candidatosGlobales = candidatosGlobales.filter(
            (c) => c.estadoFSM === "ASIGNACION_OK" /* ASIGNACION_OK */ && !c.penaltyBlocked
          );
        }
        if (!disableLogs) {
          for (const idGrupoHuerfano of gruposDelAreaPendientes) {
            const grupo = gruposOrdenados.find((g) => g.idUeaGrupo === idGrupoHuerfano);
            const tentados = candidatosTentadosPorGrupo.get(idGrupoHuerfano) || [];
            logsFase1.push({
              idUeaGrupo: grupo.idUeaGrupo,
              uea: grupo.ueaClave,
              claveGrupo: grupo.claveGrupo,
              horario: grupo.horarioStringRaw,
              resolucion: `Ninguno de los ${tentados.length} candidatos logro sortear la FSM y el dominio ML. Termino huerfano.`,
              candidatosTentados: tentados
            });
          }
        }
      }
      const todosLosGrupoIds = grupos.map((g) => g.idUeaGrupo);
      const huerfanosPreRepair = todosLosGrupoIds.filter((id) => !grafo.asignacionesInversas.has(id));
      const dummyLogsEjection = [];
      const resultadoMejora = await this._ejectionChain.mejorarSolucionAsync(
        grafo,
        fsmRegular,
        this._funcionZObj,
        huerfanosPreRepair,
        disableLogs ? dummyLogsEjection : logsEjection,
        { ...context, fase: "ejection" }
      );
      const resultadoZ = await this._funcionZObj.evaluarGrafoAsync(grafo, { ...context, fase: "final-z" });
      const asignaciones = [];
      for (const [idGrupo, numEco] of grafo.asignacionesInversas) {
        asignaciones.push({
          numeroEconomico: numEco,
          idUeaGrupo: idGrupo
        });
      }
      const gruposSinAsignar = todosLosGrupoIds.filter((id) => !grafo.asignacionesInversas.has(id));
      const fin = performance.now();
      const metricas = {
        totalEvaluaciones,
        totalAsignados: asignaciones.length,
        totalRechazados,
        tiempoMs: Math.round(fin - inicio),
        gruposSinAsignar,
        scoreZ: resultadoZ.Z,
        mejorasLocales: resultadoMejora.mejoras,
        reparaciones: resultadoMejora.reparaciones,
        logsFase1,
        logsEjection,
        logsFirstFSM: loggerFirstFSM.obtenerReporte()
      };
      return { asignaciones, metricas };
    }
    _debugZ(eco, puntajeSijh, detalles) {
      return {
        eco,
        puntajeSijh,
        rhat: detalles.rhat,
        h_ih: detalles.h_ih,
        kde_ij: detalles.kde_ij,
        kde_ih: detalles.kde_ih,
        kde_ih_raw: detalles.kde_ih_raw,
        kde_plan: detalles.kde_plan,
        zBase: detalles.zBase,
        projectedPlanCount: detalles.projectedPlanCount,
        dayCoverage: detalles.dayCoverage,
        patternSimilarity: detalles.patternSimilarity
      };
    }
    _aplicarDetallesZ(cand, detalles) {
      cand.scoreSijh = detalles.score;
      cand.rhat = detalles.rhat;
      cand.h_ih = detalles.h_ih;
      cand.kde_ij = detalles.kde_ij;
      cand.kde_ih = detalles.kde_ih;
      cand.kde_ih_raw = detalles.kde_ih_raw;
      cand.kde_plan = detalles.kde_plan;
      cand.zBase = detalles.zBase;
      cand.projectedPlanCount = detalles.projectedPlanCount;
      cand.dayCoverage = detalles.dayCoverage;
      cand.patternSimilarity = detalles.patternSimilarity;
      if (cand.scoreRcl !== void 0) {
        cand.scoreRcl = detalles.score * (cand.penaltyMask ?? 1);
      }
    }
    _contextoReglasDesdeZ(detalles) {
      return {
        hayAcuerdoHorarioLaboral: {
          revisarAcuerdo: 1,
          umbral: 0.02,
          score: detalles.kde_ih_raw ?? detalles.kde_ih ?? detalles.h_ih ?? 0
        }
      };
    }
    _agruparPorArea(grupos) {
      const mapa = /* @__PURE__ */ new Map();
      for (const grupo of grupos) {
        if (!mapa.has(grupo.idArea)) {
          mapa.set(grupo.idArea, []);
        }
        mapa.get(grupo.idArea).push(grupo);
      }
      return mapa;
    }
    _agruparProfesoresPorArea(profesores) {
      const mapa = /* @__PURE__ */ new Map();
      for (const profesor of profesores) {
        for (const area of profesor.idArea) {
          if (!mapa.has(area)) {
            mapa.set(area, []);
          }
          mapa.get(area).push(profesor);
        }
      }
      return mapa;
    }
    async _aplicarPenaltyCandidatoRclAsync(grafo, cand, context) {
      if (!this._penaltyRcl) {
        throw new Error("La RCL async requiere ViabilidadPenalizacionCarga con cache observado real.");
      }
      const penalty = await this._penaltyRcl.evaluarCandidatoAsync(
        grafo,
        cand.eco,
        cand.grupo.idUeaGrupo,
        context
      );
      cand.viabilidadPenalty = penalty.viabilidad;
      cand.penaltyRaw = penalty.penalty;
      cand.loadPenalty = penalty.loadPenalty;
      cand.loadProbability = penalty.loadProbability;
      cand.penaltyProbability = penalty.penaltyProbability;
      cand.loadDensityRatio = penalty.loadDensityRatio;
      cand.projectedUeaCount = penalty.projectedUeaCount;
      cand.penaltyBlocked = penalty.blocked;
      cand.penaltyBlockReason = penalty.blockReason;
      cand.penaltyMask = this._calcularPenaltyMask(penalty.penaltyProbability, penalty.penalty);
      cand.scoreRcl = cand.scoreSijh * cand.penaltyMask;
    }
    _calcularPenaltyMask(penaltyProbability, penaltyRaw) {
      if (typeof penaltyProbability === "number" && Number.isFinite(penaltyProbability)) {
        return this._clamp01(penaltyProbability);
      }
      if (typeof penaltyRaw === "number" && Number.isFinite(penaltyRaw)) {
        return this._clamp01(1 / (1 + Math.exp(-penaltyRaw)));
      }
      return 1;
    }
    _clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }
    _registrarLogFase1(logsFase1, grupo, candidatosTentados, elegido) {
      logsFase1.push({
        idUeaGrupo: grupo.idUeaGrupo,
        uea: grupo.ueaClave,
        claveGrupo: grupo.claveGrupo,
        horario: grupo.horarioStringRaw,
        ecoElegido: elegido?.eco,
        resolucion: elegido ? `Asignado en fase 1 a ${elegido.eco}. Candidatos registrados: ${candidatosTentados.length}.` : `Ninguno de los ${candidatosTentados.length} candidatos logro sortear la FSM y el dominio ML. Termino huerfano.`,
        candidatosTentados
      });
    }
  };

  // ioredis_mock.ts
  var Redis = class {
    constructor() {
      console.warn("Mock Redis initialized in browser. Using memory/Webdis instead of TCP Redis.");
    }
    async get(key) {
      return null;
    }
    async set(key, value) {
      return "OK";
    }
    async mget(...keys) {
      return keys.map(() => null);
    }
    async quit() {
      return "OK";
    }
  };

  // ml/PenaltyObservedCache.ts
  var PenaltyObservedCacheError = class extends Error {
    constructor(message, key, context, cause) {
      super(message);
      this.key = key;
      this.context = context;
      this.cause = cause;
      this.name = "PenaltyObservedCacheError";
    }
    key;
    context;
    cause;
  };
  var PenaltyObservedWatchdogError = class extends PenaltyObservedCacheError {
    constructor(message, key, context) {
      super(message, key, context);
      this.name = "PenaltyObservedWatchdogError";
    }
  };
  var PenaltyObservedCache = class _PenaltyObservedCache {
    _axiosClient;
    _fetcher;
    _maxEntries;
    _maxConcurrentFetches;
    _requestTimeoutMs;
    _maxAttempts;
    _retryBaseDelayMs;
    _watchdogMs;
    _redis;
    _ownsRedis;
    _redisKeyTtlSeconds;
    _cache = /* @__PURE__ */ new Map();
    _queue = [];
    _pendingRejects = /* @__PURE__ */ new Set();
    _batchSize;
    _batchFlushScheduled = false;
    _inFlight = 0;
    _abortedError = null;
    _lastCompletionAt = Date.now();
    _hits = 0;
    _memoryHits = 0;
    _redisHits = 0;
    _misses = 0;
    _redisMisses = 0;
    _redisWrites = 0;
    _requests = 0;
    _retries = 0;
    _errors = 0;
    _completed = 0;
    constructor(options = {}) {
      this._maxEntries = options.maxEntries ?? 5e4;
      this._maxConcurrentFetches = options.maxConcurrentFetches ?? 8;
      this._requestTimeoutMs = options.requestTimeoutMs ?? 15e3;
      this._maxAttempts = options.maxAttempts ?? 3;
      this._retryBaseDelayMs = options.retryBaseDelayMs ?? 250;
      this._watchdogMs = options.watchdogMs ?? 12e4;
      this._batchSize = options.batchSize ?? 1;
      this._redisKeyTtlSeconds = options.redisKeyTtlSeconds;
      this._axiosClient = axios_default.create({
        baseURL: options.baseUrl ?? "http://127.0.0.1:8000",
        timeout: this._requestTimeoutMs
      });
      this._fetcher = options.fetcher ?? (async (payload, timeoutMs) => {
        const response = await this._axiosClient.post(
          "/get_horario_penalty_finetuned",
          payload,
          { timeout: timeoutMs }
        );
        return response.data;
      });
      if (options.redisClient) {
        this._redis = options.redisClient;
        this._ownsRedis = false;
      } else if (options.redis) {
        this._redis = new Redis({
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5e3,
          ...options.redis
        });
        this._ownsRedis = true;
      } else {
        this._ownsRedis = false;
      }
    }
    static keyForPayload(payload) {
      return `PenaltyObserved:v2:${createHash("sha1").update(this.serializePayload(payload)).digest("hex")}`;
    }
    static serializePayload(payload) {
      return serializePenaltyPayload(payload);
    }
    async getOrFetch(payload, context) {
      const response = await this.getOrFetchResponse(payload, context);
      return response.total_penalty;
    }
    async getOrFetchResponse(payload, context) {
      if (this._abortedError) {
        throw this._abortedError;
      }
      const canonicalPayload = canonicalizePenaltyPayload(payload);
      const key = _PenaltyObservedCache.keyForPayload(canonicalPayload);
      const cached = this._getFromCache(key);
      if (cached !== void 0) {
        this._hits++;
        this._memoryHits++;
        return cached;
      }
      const redisCached = await this._getFromRedis(key, context);
      if (redisCached !== void 0) {
        this._hits++;
        this._redisHits++;
        this._setCache(key, redisCached);
        return redisCached;
      }
      this._misses++;
      const taskPromise = new Promise((resolve, reject) => {
        const trackedReject = (error) => {
          this._pendingRejects.delete(trackedReject);
          reject(error);
        };
        this._pendingRejects.add(trackedReject);
        this._queue.push({
          key,
          payload: canonicalPayload,
          context,
          resolve: (value) => {
            this._pendingRejects.delete(trackedReject);
            resolve(value);
          },
          reject: trackedReject
        });
        this._pumpQueue();
      });
      return this._withWatchdog(taskPromise, key, context);
    }
    async waitForIdle(context) {
      if (this._abortedError) {
        throw this._abortedError;
      }
      while (this._queue.length > 0 || this._inFlight > 0) {
        await this._withWatchdog(this._delay(50), "PenaltyObserved:idle", context);
        if (this._abortedError) {
          throw this._abortedError;
        }
      }
    }
    async close() {
      if (this._redis && this._ownsRedis) {
        await this._redis.quit();
      }
    }
    stats() {
      return {
        hits: this._hits,
        memoryHits: this._memoryHits,
        redisHits: this._redisHits,
        misses: this._misses,
        redisMisses: this._redisMisses,
        redisWrites: this._redisWrites,
        requests: this._requests,
        retries: this._retries,
        errors: this._errors,
        completed: this._completed,
        cacheSize: this._cache.size,
        queued: this._queue.length,
        inFlight: this._inFlight,
        lastCompletionAt: this._lastCompletionAt
      };
    }
    _getFromCache(key) {
      const value = this._cache.get(key);
      if (value === void 0) return void 0;
      this._cache.delete(key);
      this._cache.set(key, value);
      return this._cloneResponse(value);
    }
    _setCache(key, value) {
      if (this._cache.has(key)) {
        this._cache.delete(key);
      }
      this._cache.set(key, this._cloneResponse(value));
      while (this._cache.size > this._maxEntries) {
        const oldest = this._cache.keys().next().value;
        if (oldest === void 0) break;
        this._cache.delete(oldest);
      }
    }
    _pumpQueue() {
      if (this._abortedError || this._queue.length === 0) return;
      if (this._batchSize > 1) {
        if (!this._batchFlushScheduled) {
          this._batchFlushScheduled = true;
          setTimeout(() => this._flushBatches(), 15);
        }
        return;
      }
      while (this._inFlight < this._maxConcurrentFetches && this._queue.length > 0) {
        const task = this._queue.shift();
        this._runTask(task);
      }
    }
    _runTask(task) {
      this._inFlight++;
      if (task.context && typeof task.context.fase === "string") {
        task.payload.session_id = task.context.fase;
      }
      this._fetchWithRetries(task).then(async (value) => {
        if (this._abortedError) return;
        await this._writeToRedis(task.key, value, task.context);
        this._setCache(task.key, value);
        task.resolve(value);
      }).catch((error) => {
        const wrapped = error instanceof PenaltyObservedCacheError ? error : new PenaltyObservedCacheError(
          `Penalty ML fetch failed for ${task.key}: ${this._errorMessage(error)}`,
          task.key,
          task.context,
          error
        );
        this._errors++;
        this._failHard(wrapped);
        task.reject(wrapped);
      }).finally(() => {
        this._inFlight--;
        this._pumpQueue();
      });
    }
    _flushBatches() {
      this._batchFlushScheduled = false;
      while (!this._abortedError && this._inFlight < this._maxConcurrentFetches && this._queue.length > 0) {
        const chunk = this._queue.splice(0, this._batchSize);
        if (chunk.length === 1) {
          this._runTask(chunk[0]);
        } else {
          this._runBatch(chunk);
        }
      }
    }
    _runBatch(tasks) {
      this._inFlight++;
      const items = tasks.map((t) => {
        const base = JSON.parse(_PenaltyObservedCache.serializePayload(t.payload));
        base.id = t.key;
        return base;
      });
      const sessionId = tasks[0]?.context?.fase ?? void 0;
      this._fetchBatchWithRetries(items, sessionId).then(async (batchResponse) => {
        if (this._abortedError) return;
        const resultMap = /* @__PURE__ */ new Map();
        for (const r of batchResponse.results || []) {
          const normalized = this._normalizeResponse(r);
          if (normalized) resultMap.set(r.id, normalized);
        }
        const errorMap = /* @__PURE__ */ new Map();
        for (const e of batchResponse.errors || []) {
          errorMap.set(e.id, e.error);
        }
        for (const task of tasks) {
          const result = resultMap.get(task.key);
          if (result) {
            await this._writeToRedis(task.key, result, task.context);
            this._setCache(task.key, result);
            task.resolve(result);
          } else {
            const errorMsg = errorMap.get(task.key) || "Item not found in batch response";
            const err = new PenaltyObservedCacheError(
              `Batch item failed for ${task.key}: ${errorMsg}`,
              task.key,
              task.context
            );
            this._errors++;
            task.reject(err);
          }
        }
      }).catch((error) => {
        const wrapped = error instanceof PenaltyObservedCacheError ? error : new PenaltyObservedCacheError(
          `Penalty ML batch fetch failed: ${this._errorMessage(error)}`,
          "batch",
          tasks[0]?.context,
          error
        );
        this._errors++;
        this._failHard(wrapped);
        for (const task of tasks) {
          task.reject(wrapped);
        }
      }).finally(() => {
        this._inFlight--;
        this._pumpQueue();
      });
    }
    async _fetchBatchWithRetries(items, sessionId) {
      let lastError = null;
      for (let attempt = 1; attempt <= this._maxAttempts; attempt++) {
        this._requests++;
        try {
          const body = { items };
          if (sessionId) body.session_id = sessionId;
          const response = await this._axiosClient.post(
            "/get_horario_penalty_finetuned_batch",
            body,
            { timeout: this._requestTimeoutMs * Math.max(2, Math.ceil(items.length / 16)) }
          );
          this._completed++;
          this._lastCompletionAt = Date.now();
          return response.data;
        } catch (error) {
          lastError = error;
          if (attempt < this._maxAttempts) {
            this._retries++;
            await this._delay(this._retryBaseDelayMs * attempt);
          }
        }
      }
      throw new PenaltyObservedCacheError(
        `Penalty ML batch fetch failed after ${this._maxAttempts} attempts: ${this._errorMessage(lastError)}`,
        "batch",
        void 0,
        lastError
      );
    }
    async _fetchWithRetries(task) {
      let lastError = null;
      for (let attempt = 1; attempt <= this._maxAttempts; attempt++) {
        this._requests++;
        try {
          const response = await this._fetcher(task.payload, this._requestTimeoutMs);
          const normalized = this._normalizeResponse(response);
          if (!normalized) {
            throw new Error("Invalid ML response: total_penalty must be a finite number");
          }
          this._completed++;
          this._lastCompletionAt = Date.now();
          return normalized;
        } catch (error) {
          lastError = error;
          if (attempt < this._maxAttempts) {
            this._retries++;
            await this._delay(this._retryBaseDelayMs * attempt);
          }
        }
      }
      throw new PenaltyObservedCacheError(
        `Penalty ML fetch failed after ${this._maxAttempts} attempts for ${task.key}: ${this._errorMessage(lastError)}`,
        task.key,
        task.context,
        lastError
      );
    }
    async _getFromRedis(key, context) {
      if (!this._redis) return void 0;
      try {
        const raw = await this._redis.get(key);
        if (raw === null) {
          this._redisMisses++;
          return void 0;
        }
        const parsed = this._parseRedisValue(raw);
        if (parsed === void 0) {
          throw new Error(`Invalid Redis value for ${key}: total_penalty must be finite`);
        }
        return parsed;
      } catch (error) {
        const wrapped = new PenaltyObservedCacheError(
          `Penalty observed Redis read failed for ${key}: ${this._errorMessage(error)}`,
          key,
          context,
          error
        );
        this._errors++;
        this._failHard(wrapped);
        throw wrapped;
      }
    }
    async _writeToRedis(key, value, context) {
      if (!this._redis) return;
      try {
        const serialized = JSON.stringify(value);
        if (this._redisKeyTtlSeconds && this._redisKeyTtlSeconds > 0) {
          await this._redis.set(key, serialized, "EX", this._redisKeyTtlSeconds);
        } else {
          await this._redis.set(key, serialized);
        }
        this._redisWrites++;
      } catch (error) {
        const wrapped = new PenaltyObservedCacheError(
          `Penalty observed Redis write failed for ${key}: ${this._errorMessage(error)}`,
          key,
          context,
          error
        );
        this._errors++;
        this._failHard(wrapped);
        throw wrapped;
      }
    }
    _parseRedisValue(raw) {
      const asNumber = Number(raw);
      if (Number.isFinite(asNumber)) return { total_penalty: asNumber };
      try {
        return this._normalizeResponse(JSON.parse(raw));
      } catch (e) {
        return void 0;
      }
      return void 0;
    }
    _normalizeResponse(value) {
      if (!value || typeof value !== "object") return void 0;
      const candidate = value;
      if (typeof candidate.total_penalty !== "number" || !Number.isFinite(candidate.total_penalty)) {
        return void 0;
      }
      const normalized = {
        total_penalty: candidate.total_penalty
      };
      if (Array.isArray(candidate.loads)) {
        const loads = candidate.loads.filter((v) => typeof v === "number" && Number.isFinite(v));
        if (loads.length === candidate.loads.length) {
          normalized.loads = loads;
        }
      }
      if (Array.isArray(candidate.best_5)) {
        normalized.best_5 = candidate.best_5;
      }
      if (typeof candidate.projected_uea_count === "number" && Number.isFinite(candidate.projected_uea_count)) {
        normalized.projected_uea_count = candidate.projected_uea_count;
      }
      if (typeof candidate.load_probability === "number" && Number.isFinite(candidate.load_probability)) {
        normalized.load_probability = candidate.load_probability;
      }
      if (typeof candidate.load_density_ratio === "number" && Number.isFinite(candidate.load_density_ratio)) {
        normalized.load_density_ratio = candidate.load_density_ratio;
      }
      if (Array.isArray(candidate.load_probabilities)) {
        const values = candidate.load_probabilities.filter((v) => typeof v === "number" && Number.isFinite(v));
        if (values.length === candidate.load_probabilities.length) {
          normalized.load_probabilities = values;
        }
      }
      if (Array.isArray(candidate.load_density_ratios)) {
        const values = candidate.load_density_ratios.filter((v) => typeof v === "number" && Number.isFinite(v));
        if (values.length === candidate.load_density_ratios.length) {
          normalized.load_density_ratios = values;
        }
      }
      return normalized;
    }
    _cloneResponse(value) {
      return {
        total_penalty: value.total_penalty,
        loads: value.loads ? [...value.loads] : void 0,
        best_5: value.best_5 ? [...value.best_5] : void 0,
        projected_uea_count: value.projected_uea_count,
        load_probability: value.load_probability,
        load_probabilities: value.load_probabilities ? [...value.load_probabilities] : void 0,
        load_density_ratio: value.load_density_ratio,
        load_density_ratios: value.load_density_ratios ? [...value.load_density_ratios] : void 0
      };
    }
    async _withWatchdog(promise, key, context) {
      let timer = null;
      const watchdog = new Promise((_resolve, reject) => {
        timer = setInterval(() => {
          if (this._queue.length === 0 && this._inFlight === 0) return;
          const idleMs = Date.now() - this._lastCompletionAt;
          if (idleMs >= this._watchdogMs) {
            const error = new PenaltyObservedWatchdogError(
              `Penalty ML watchdog exceeded ${this._watchdogMs}ms without a completed request`,
              key,
              context
            );
            this._errors++;
            this._failHard(error);
            reject(error);
          }
        }, Math.min(1e3, Math.max(50, this._watchdogMs / 10)));
      });
      try {
        return await Promise.race([promise, watchdog]);
      } finally {
        if (timer) {
          clearInterval(timer);
        }
      }
    }
    _failHard(error) {
      if (this._abortedError) return;
      this._abortedError = error;
      while (this._queue.length > 0) {
        const task = this._queue.shift();
        task.reject(error);
      }
      for (const reject of Array.from(this._pendingRejects)) {
        reject(error);
      }
      this._pendingRejects.clear();
    }
    _delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    _errorMessage(error) {
      if (error instanceof Error) return error.message;
      return String(error);
    }
  };

  // browser_entry.ts
  async function ejecutarGRASPBrowser(archivosUnificados, fijacionesPrevias) {
    console.log("Iniciando GRASP en el navegador...", fijacionesPrevias ? `con ${fijacionesPrevias.size} fijaciones` : "");
    const rawEcoHorario = archivosUnificados["ecos_vigentes_con_horario_regular.json"];
    const rawAreaProfesor = archivosUnificados["area_profesor.json"];
    const rawIrregulares = archivosUnificados["ecos_irregulares_inferidos.json"];
    const rawProg = archivosUnificados["programacion_vacia_26P.json"];
    const dfHist = archivosUnificados["df_hist.json"];
    setJsonFiles(archivosUnificados);
    const profesores = JSONAssignmentAdapter.parsearProfesoresDesdeObjeto(rawEcoHorario, rawAreaProfesor, rawIrregulares);
    const gruposCrudos = JSONAssignmentAdapter.parsearGruposDesdeObjeto(rawProg);
    const grupos = JSONAssignmentAdapter.filtrarGruposPorFSMIngesta(gruposCrudos, { log: true });
    JSONAssignmentAdapter.identificarMCV(grupos);
    const modeloSijh = new ModeloSijhBrowser(1, 1);
    await modeloSijh.inicializar(profesores, grupos, false);
    const zFactory = crearZScoreKDE({
      profesores,
      grupos,
      dfHist,
      legacyProvider: modeloSijh,
      options: {
        mode: "kde_ij",
        steepPower: 2,
        halfLife: 8,
        bandwidthUea: 8,
        bandwidthHour: 1.25,
        minKdeIj: 0.02,
        minKdeIh: 0.05,
        minKdePlan: 0.05
      }
    });
    const modeloPenalty = new ModeloPenaltyBrowser();
    await modeloPenalty.inicializarEstadisticos(profesores, grupos);
    const pyUrl = localStorage.getItem("cfg_python_url") || "http://127.0.0.1:8000";
    const penaltyObservedCache = new PenaltyObservedCache({
      baseUrl: pyUrl,
      maxEntries: 1e4,
      maxConcurrentFetches: 4,
      requestTimeoutMs: 3e4,
      maxAttempts: 2,
      retryBaseDelayMs: 500,
      watchdogMs: 6e4
    });
    const constraints = [
      { constraint: new ViabilidadHuecos(), lambda: 3 },
      { constraint: new ViabilidadCargaConsecutiva(), lambda: 1 },
      { constraint: new ViabilidadPenalizacionCarga(pyUrl, modeloPenalty, penaltyObservedCache), lambda: 1 }
    ];
    const estrategia = new EstrategiaUeaMenosVista(grupos);
    const rclConfig = { k: 48, alpha: 0.25 };
    const orquestador = new GreedyOrchestrator(
      estrategia,
      zFactory.funcionZ,
      constraints,
      void 0,
      modeloPenalty,
      rclConfig
    );
    console.log("Ejecutando orquestador...");
    const resultado = await orquestador.ejecutarAsync(profesores, grupos, fijacionesPrevias || null, { K: rclConfig.k, Alpha: rclConfig.alpha, fase: "browser" });
    const mapAssignments = resultado.asignaciones.map((a) => ({
      numeroEconomico: a.numeroEconomico,
      idUeaGrupo: a.idUeaGrupo,
      score: a.scoreObjBase
      // u otro score relevante
    }));
    console.log("GRASP finalizado. Asignaciones generadas:", mapAssignments.length);
    return mapAssignments;
  }
  window.ejecutarGRASPBrowser = ejecutarGRASPBrowser;
})();
