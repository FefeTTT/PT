// JS para Programación Trimestral (Bootstrap 5)
// Requisitos:
// - Usa DOM APIs (createElement, etc.) y Promesas (fetch + async/await)
// - Usa /controlador para invocar a DAOs/VOs en /modelo

(function(){
	'use strict';

	// Not keeping global debug hooks here to avoid noisy console output in production.

	// No deshabilitamos SweetAlert aquí: en lugar de sobrescribir globals,
	// preservamos las referencias (si existen) para diagnóstico pero no las
	// anulamos, porque dejar `swal`/`Swal` undefined rompe llamadas no
	// protegidas en otros módulos. Si necesitamos forzar un fallback, usaremos
	// wrappers locales en las funciones concretas.
	try{
		if (typeof window !== 'undefined'){
			if (typeof window.swal !== 'undefined' || typeof window.Swal !== 'undefined'){
				// Guardar referencias por si queremos inspeccionarlas desde la consola
				window.__saved_swal = window.swal;
				window.__saved_Swal = window.Swal;
				// referencias preservadas (no deshabilitado).
			}
		}
	} catch(e){ /* noop */ }

	const ID_TRIM = (typeof window !== 'undefined' && window.ID_TRIMESTRE) ? parseInt(window.ID_TRIMESTRE, 10) : 0;
	const elTitulo = () => document.getElementById('titulo-trimestre');
	const elSub = () => document.getElementById('subtitulo-trimestre');
		const btnProf = () => document.getElementById('btn-modo-profesores');
		const btnUEA = () => document.getElementById('btn-modo-uea');
		const vistaProfes = () => document.getElementById('vista-profesores');
		const vistaUEA = () => document.getElementById('vista-uea');
		// tabla profesores y filtro unificado
		const filtroBusqueda = () => document.getElementById('filtro-busqueda');
		const tbProfes = () => document.getElementById('tb-profesores');
		const detNombre = () => document.getElementById('det-nombre');
		const detNE = () => document.getElementById('det-ne');
		const detEstado = () => document.getElementById('det-estado');
		const detNoGrupos = () => document.getElementById('det-no-grupos');
		const detObservaciones = () => document.getElementById('det-observaciones');
		const btnVerPref = () => document.getElementById('btn-ver-preferencias');
		const tbPrefUEAs = () => document.getElementById('tb-pref-ueas');
		const addUEAArea = () => document.getElementById('agregar-uea-area');
		const btnAddUEA = () => document.getElementById('btn-agregar-uea');
		// modal
		const modalPrefUEAs = () => document.getElementById('modal-pref-ueas');
		const modalHorariosGridWrap = () => document.getElementById('modal-pref-horarios-grid');
		const modalPrefResumen = () => document.getElementById('pref-resumen');
		const modalPrefExtra = () => document.getElementById('pref-extra');
		const btnEditarPref = () => document.getElementById('btn-editar-preferencias');

	const swalErr = (msg) => {
		// compat wrapper: use compatible swal/Swal API or fallback to alert
		try{
			compatSwal({ icon: 'error', title: 'Error', text: msg, customClass: { popup: 'my-swal-popup', confirmButton: 'my-swal-confirm' } });
		} catch(e){ try{ alert(msg); }catch(_){ /* noop */ } }
	};

// --- SweetAlert compatibility helpers ---
function isFunctionClass(fn){
	try{
		if (typeof fn !== 'function') return false;
		const s = Function.prototype.toString.call(fn);
		return s.trim().startsWith('class ');
	}catch(e){ return false; }
}

function normalizeArgsToOptions(args){
	// support swal(title, text, icon) and swal(optionsObj)
	if (!args || args.length === 0) return {};
	if (args.length === 1 && typeof args[0] === 'object') return args[0];
	const [a,b,c] = args;
	const opt = {};
	if (typeof a === 'string') opt.title = a;
	if (typeof b === 'string') opt.text = b;
	if (typeof c === 'string') opt.icon = c;
	return opt;
}

async function compatSwal(...args){
	// Try swal (v1) or Swal.fire (v2+) or fallback to alert/confirm
	try{
		const s = window.swal;
		if (typeof s === 'function'){
			// detect if it's actually a class (transpiled) which must be 'new'-ed
			if (isFunctionClass(s)){
				// prefer Swal.fire if available
				if (window.Swal && typeof window.Swal.fire === 'function'){
					const opt = normalizeArgsToOptions(args);
					return window.Swal.fire(opt);
				}
				// attempt to instantiate with new
				try{ return new s(...args); }catch(e){ /* fallthrough to other fallbacks */ }
			} else {
				// normal function-like swal
				try{ return s(...args); }catch(e){ /* fallthrough */ }
			}
		}
		if (window.Swal && typeof window.Swal.fire === 'function'){
			const opt = normalizeArgsToOptions(args);
			return window.Swal.fire(opt);
		}
	}catch(e){ /* continue to fallback */ }

	// Minimal fallback: if args represent a confirm-like object, emulate
	const opt = normalizeArgsToOptions(args);
	if (opt && (opt.buttons === true || opt.showCancelButton === true || Array.isArray(opt.buttons))){
		// use native confirm
		return Promise.resolve(confirm(opt.text || opt.title || 'Confirmar?'));
	}
	// otherwise just alert the message
	try{ alert(opt.text || opt.title || String(args[0] || '')); }catch(e){}
	return Promise.resolve(true);
}

async function compatConfirm(options){
	try{
		const res = await compatSwal(options);
		if (typeof res === 'boolean') return res;
		if (res && typeof res === 'object'){
			if (res.isConfirmed !== undefined) return !!res.isConfirmed;
			if (res.value !== undefined) return !!res.value;
		}
		return !!res;
	}catch(e){ return false; }
}


    function setModoActivo(modo){
		if (modo === 'profesores'){
			btnProf().classList.remove('btn-outline-secondary');
			btnProf().classList.add('btn-primary');
			btnUEA().classList.remove('btn-primary');
			btnUEA().classList.add('btn-outline-secondary');
			if (vistaProfes()) vistaProfes().style.display = '';
			if (vistaUEA()) vistaUEA().style.display = 'none';
		} else {
			btnUEA().classList.remove('btn-outline-secondary');
			btnUEA().classList.add('btn-primary');
			btnProf().classList.remove('btn-primary');
			btnProf().classList.add('btn-outline-secondary');
			if (vistaProfes()) vistaProfes().style.display = 'none';
			if (vistaUEA()) vistaUEA().style.display = '';
		}
	}

		// cache simple
		let cacheUEAs = null; // lista completa de UEA para agregar
		let cacheProgTrim = null; // programacion del trimestre
		let listaProfes = []; // lista completa para la tabla
		let seleccionado = null; // { idProfesor, numeroEconomico, nombre, enTrimestre }
		let editMode = false; // modo edición del modal
		let lastPrefData = null; // cache de última preferencia cargada
		let currentHorarioSlots = []; // slots visibles en la grilla
		const diasConst = ['lunes','martes','miercoles','jueves','viernes'];

	async function fetchJSON(url, data){
		const form = new URLSearchParams();
		if (data && typeof data === 'object'){
			Object.keys(data).forEach(k => {
				if (data[k] !== undefined && data[k] !== null) form.append(k, data[k]);
			});
		}
		const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
		if (!res.ok) throw new Error('HTTP '+res.status);
		return res.json();
	}

	async function cargarTitulo(){
		try{
			// controlador/recuperarTrimestre.php acepta GET ?trim=ID
			const res = await fetch(`./controlador/recuperarTrimestre.php?trim=${encodeURIComponent(ID_TRIM)}`);
			const json = await res.json();
			if (!json || json.ok !== true || !json.data){
				elTitulo().textContent = 'Programación del trimestre';
				elSub().textContent = '';
				return;
			}
			const { año, sigla, periodoNombre, trimestreEstado } = json.data;
			elTitulo().textContent = `Programación del trimestre ${año}-${sigla}`;
			const extra = [];
			if (periodoNombre) extra.push(periodoNombre);
			if (trimestreEstado) extra.push(trimestreEstado);
			elSub().textContent = extra.join(' · ');
		} catch(e){
			// fallback en caso de error
			elTitulo().textContent = 'Programación del trimestre';
			elSub().textContent = '';
		}
	}

		async function cargarProfesoresTabla(){
				try{
					const json = await fetchJSON('./controlador/recuperarProfesoresTrimestre.php', { idTrimestre: ID_TRIM });
					if (!json.ok) throw new Error(json.msg || 'Respuesta inválida');
					listaProfes = json.profesores || [];
					pintarProfesoresTabla();
					// seleccionar el primero por defecto
					if (listaProfes.length > 0){
						seleccionarProfesor(listaProfes[0]);
					}
				}catch(e){ swalErr('No se pudo cargar el listado de profesores'); }
		}

	// ------------------ Filter menu class (inserta UI junto al buscador y aplica filtros) ------------------
	class FilterMenu {
		constructor(containerInputEl) {
			this.input = containerInputEl; // input DOM element
			this.wrap = null; // panel DOM
			this.selectArea = null;
			this.selectProfTipo = null;
			this.selectPref = null;
			this.selectProg = null;
	            this.selectDisponibilidad = null;
			this.btnApply = null;
			this.btnClear = null;
		}

		async init(){
			// construir DOM y colocarlo después del input
			const parent = this.input.parentNode;
			if (!parent) return;
			const panel = document.createElement('div');
			panel.className = 'filter-panel mt-2 p-2 border rounded bg-white';
			panel.style.display = 'flex';
			panel.style.flexWrap = 'wrap';
			panel.style.gap = '8px';
			panel.style.alignItems = 'center';

			// Area select
			const areaSel = document.createElement('select');
			areaSel.className = 'form-select form-select-sm filter-select-area';
			areaSel.style.minWidth = '150px';
			const optAllA = document.createElement('option'); optAllA.value = ''; optAllA.textContent = 'Área: Todos'; areaSel.appendChild(optAllA);

			// Profesor tipo select
			const tipoSel = document.createElement('select');
			tipoSel.className = 'form-select form-select-sm filter-select-tipo';
			tipoSel.style.minWidth = '160px';
			const optAllT = document.createElement('option'); optAllT.value = ''; optAllT.textContent = 'Tipo: Todos'; tipoSel.appendChild(optAllT);

			// Preferencias select
			const prefSel = document.createElement('select');
			prefSel.className = 'form-select form-select-sm filter-select-pref';
			prefSel.style.minWidth = '140px';
			['Preferencias: Todos','Con preferencias','Sin preferencias'].forEach((t, i)=>{
				const o = document.createElement('option');
				o.value = i===0? 'todos' : (i===1? 'si' : 'no'); o.textContent = t; prefSel.appendChild(o);
			});

			// Programacion select
			const progSel = document.createElement('select');
			progSel.className = 'form-select form-select-sm filter-select-prog';
			progSel.style.minWidth = '140px';
			['Programación: Todos','Con programación','Sin programación'].forEach((t,i)=>{
				const o = document.createElement('option'); o.value = i===0? 'todos' : (i===1? 'si' : 'no'); o.textContent = t; progSel.appendChild(o);
			});

			// Disponibilidad select (si el profesor está disponible en el trimestre)
			const availSel = document.createElement('select');
			availSel.className = 'form-select form-select-sm filter-select-disponibilidad';
			availSel.style.minWidth = '160px';
			['Disponibilidad: Todos','Disponibles','No disponibles'].forEach((t,i)=>{
				const o = document.createElement('option'); o.value = i===0? 'todos' : (i===1? 'si' : 'no'); o.textContent = t; availSel.appendChild(o);
			});

			// Buttons
			const btnApply = document.createElement('button'); btnApply.type='button'; btnApply.className='btn btn-sm btn-primary'; btnApply.textContent='Aplicar filtros';
			const btnClear = document.createElement('button'); btnClear.type='button'; btnClear.className='btn btn-sm btn-outline-secondary'; btnClear.textContent='Limpiar';

			panel.appendChild(areaSel);
			panel.appendChild(tipoSel);
			panel.appendChild(prefSel);
			panel.appendChild(progSel);
			panel.appendChild(availSel);
			panel.appendChild(btnApply);
			panel.appendChild(btnClear);

			parent.appendChild(panel);

			this.wrap = panel; this.selectArea = areaSel; this.selectProfTipo = tipoSel; this.selectPref = prefSel; this.selectProg = progSel; this.selectDisponibilidad = availSel; this.btnApply = btnApply; this.btnClear = btnClear;

			// cargar opciones desde el servidor
			await this.loadOptions();

			// eventos
			this.btnApply.addEventListener('click', async ()=>{ await this.applyFilters(); });
			this.btnClear.addEventListener('click', async ()=>{ this.clearFilters(); await this.applyFilters(); });
		}

		async loadOptions(){
			try{
				const resp = await fetch('./controlador/recuperarFiltrosProfesores.php', { method: 'GET' });
				const j = await resp.json();
				if (!j || !j.ok) return;
				// poblar áreas: preferimos usar profesorAreaTipos (tabla profesorAreaTipo). Si no está disponible, hacer fallback a 'areas'
				const paTypes = Array.isArray(j.profesorAreaTipos) ? j.profesorAreaTipos : (Array.isArray(j.areas) ? j.areas : []);
				for (const a of paTypes){
					const opt = document.createElement('option');
					// si viene de profesorAreaTipos usar idProfesorAreaTipo/descripcion, si viene de areas usar idArea/nombre
					if (a.idProfesorAreaTipo !== undefined) {
						opt.value = String(a.idProfesorAreaTipo);
						opt.textContent = a.descripcion || ('Área ' + a.idProfesorAreaTipo);
					} else if (a.idArea !== undefined) {
						opt.value = String(a.idArea);
						opt.textContent = a.nombre || ('Área ' + a.idArea);
					}
					this.selectArea.appendChild(opt);
				}
				// poblar tipos
				const tipos = Array.isArray(j.profesorTipos) ? j.profesorTipos : [];
				for (const t of tipos){ const o = document.createElement('option'); o.value = String(t.idProfesorTipo); o.textContent = t.nombre || ('Tipo '+t.idProfesorTipo); this.selectProfTipo.appendChild(o); }
			}catch(e){ console.error('No se pudieron cargar opciones de filtros', e); }
		}

		clearFilters(){
			if (this.selectArea) this.selectArea.value = '';
			if (this.selectProfTipo) this.selectProfTipo.value = '';
			if (this.selectPref) this.selectPref.value = 'todos';
			if (this.selectProg) this.selectProg.value = 'todos';
			if (this.selectDisponibilidad) this.selectDisponibilidad.value = 'todos';
			// no tocar el input de búsqueda
		}

		async applyFilters(){
			try{
				// construir payload y llamar al controlador de filtrado
				const body = new URLSearchParams();
				body.append('idTrimestre', String(ID_TRIM));
				const qv = (filtroBusqueda()?.value || '').trim();
				if (qv) body.append('q', qv);
				// enviar como 'profesorAreaTipo' para que el controlador filtre por profesorAreaTipo
				if (this.selectArea && this.selectArea.value) body.append('profesorAreaTipo', this.selectArea.value);
				if (this.selectProfTipo && this.selectProfTipo.value) body.append('profesorTipo', this.selectProfTipo.value);
				if (this.selectPref) body.append('tienePreferencias', this.selectPref.value || 'todos');
				if (this.selectProg) body.append('tieneProgramacion', this.selectProg.value || 'todos');
				if (this.selectDisponibilidad) body.append('disponibilidadTrimestre', this.selectDisponibilidad.value || 'todos');

				const resp = await fetch('./controlador/recuperarProfesoresFiltrados.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
				const j = await resp.json();
				if (!j || !j.ok) { swalErr('No se pudieron obtener profesores filtrados'); return; }
				listaProfes = Array.isArray(j.profesores) ? j.profesores : [];
				// repintar tabla y seleccionar primero si hay resultados
				pintarProfesoresTabla();
				if (listaProfes.length>0){ seleccionarProfesor(listaProfes[0]); }
			}catch(e){ swalErr('Error aplicando filtros'); }
		}
	}


		function pintarProfesoresTabla(){
				tbProfes().innerHTML = '';
				const term = (filtroBusqueda()?.value || '').trim().toLowerCase();
				const rows = listaProfes.filter(p => {
						if (!term) return true;
						const ne = String(p.numeroEconomico ?? '').toLowerCase();
						const nom = String(p.nombre ?? '').toLowerCase();
						return ne.includes(term) || nom.includes(term);
				});
				for (const r of rows){
						const tr = document.createElement('tr');
						if (seleccionado && seleccionado.idProfesor === r.idProfesor) tr.classList.add('table-active');
						tr.style.cursor = 'pointer';
						const tdNE = document.createElement('td'); tdNE.textContent = r.numeroEconomico ?? '';
						const tdNom = document.createElement('td'); tdNom.textContent = r.nombre ?? '';
			const tdEn = document.createElement('td');
			// botón toggle para incluir/excluir del trimestre (usa compat wrappers)
			const btnToggle = document.createElement('button');
			btnToggle.type = 'button';
			btnToggle.className = r.enTrimestre ? 'btn btn-sm btn-success' : 'btn btn-sm btn-secondary';
			btnToggle.textContent = r.enTrimestre ? 'Sí' : 'No';
			btnToggle.title = r.enTrimestre ? 'Quitar del trimestre' : 'Incluir en trimestre';
			btnToggle.addEventListener('click', async (ev) => {
				try{
					ev.stopPropagation();
					btnToggle.disabled = true;
					const currently = !!r.enTrimestre;
					if (currently) {
						// excluir: borrar prefs + programacion
						const confirmOk = await compatConfirm({ title: 'Quitar del trimestre', text: '¿Deseas quitar a este profesor del trimestre? Se eliminarán todas sus preferencias y programación para este trimestre.', showCancelButton: true });
						if (!confirmOk) { btnToggle.disabled = false; return; }
						const body = new URLSearchParams(); body.append('idProfesor', String(r.idProfesor)); body.append('idTrimestre', String(ID_TRIM)); body.append('action', 'exclude');
						const resp = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
						const j = await resp.json();
							if (j && j.ok) {
								r.enTrimestre = false;
								try{ await compatSwal('Profesor excluido', 'Preferencias y programación eliminadas', 'success'); } catch(e){}
								pintarProfesoresTabla();
								if (seleccionado && seleccionado.idProfesor === r.idProfesor) {
									seleccionarProfesor(r);
									await cargarPreferenciasProfesor(); // refrescar panel derecho automáticamente
								}
							} else {
							try{ await compatSwal('Error', j && (j.error||j.msg) ? (j.error||j.msg) : 'No se pudo excluir al profesor', 'error'); } catch(e){}
						}
					} else {
						// incluir: crear preferencia base + horarios
						const confirmOk = await compatConfirm({ title: 'Incluir en trimestre', text: '¿Deseas incluir a este profesor en el trimestre? Se crearán preferencias genéricas (horarios 07:00-20:30 en intervalos de 1h30).', showCancelButton: true });
						if (!confirmOk) { btnToggle.disabled = false; return; }
						const body = new URLSearchParams(); body.append('idProfesor', String(r.idProfesor)); body.append('idTrimestre', String(ID_TRIM)); body.append('action', 'include');
						const resp = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
						const j = await resp.json();
							if (j && j.ok) {
								r.enTrimestre = true;
								try{ await compatSwal('Profesor incluido', 'Preferencias generadas', 'success'); } catch(e){}
								pintarProfesoresTabla();
								if (seleccionado && seleccionado.idProfesor === r.idProfesor) {
									seleccionarProfesor(r);
									await cargarPreferenciasProfesor(); // refrescar panel derecho automáticamente
								}
							} else {
							try{ await compatSwal('Error', j && (j.error||j.msg) ? (j.error||j.msg) : 'No se pudo incluir al profesor', 'error'); } catch(e){}
						}
					}
				}catch(err){ console.error('toggle enTrimestre error:', err); try{ await compatSwal('Error','Error en la operación','error'); }catch(_){ } 
				}finally{ try{ btnToggle.disabled = false; }catch(_){ } }
			});
			tdEn.appendChild(btnToggle);
						tr.appendChild(tdNE); tr.appendChild(tdNom); tr.appendChild(tdEn);
						tr.addEventListener('click', async ()=>{
								seleccionarProfesor(r);
								// repintar activo
								pintarProfesoresTabla();
								await cargarPreferenciasProfesor();
						});
						tbProfes().appendChild(tr);
				}
		}

		function seleccionarProfesor(p){
				seleccionado = {
						idProfesor: p.idProfesor,
						numeroEconomico: p.numeroEconomico,
						nombre: p.nombre,
						enTrimestre: !!p.enTrimestre,
				};
				pintarDetallesProfesor();
		}

		function pintarDetallesProfesor(){
				const p = seleccionado;
				if (!p){
						detNombre().textContent = '';
						detNE().textContent = '';
						detEstado().innerHTML = '';
						detEstado().className = '';
					detNoGrupos().textContent = '—';
					detObservaciones().textContent = '—';
						return;
				}
				detNombre().textContent = p.nombre || '';
				detNE().textContent = p.numeroEconomico || '';
				// Renderizar botón toggle también en el panel derecho con la misma funcionalidad
				detEstado().innerHTML = '';
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = p.enTrimestre ? 'btn btn-sm btn-success' : 'btn btn-sm btn-secondary';
				btn.textContent = p.enTrimestre ? 'Incluido' : 'No incluido';
				btn.title = p.enTrimestre ? 'Quitar del trimestre' : 'Incluir en trimestre';
				btn.addEventListener('click', async () => {
					try{
						btn.disabled = true;
						const currently = !!seleccionado?.enTrimestre;
						if (currently){
							const ok = await compatConfirm({ title: 'Quitar del trimestre', text: '¿Deseas quitar a este profesor del trimestre? Se eliminarán todas sus preferencias y programación para este trimestre.', showCancelButton: true });
							if (!ok) { btn.disabled = false; return; }
							const body = new URLSearchParams(); body.append('idProfesor', String(seleccionado.idProfesor)); body.append('idTrimestre', String(ID_TRIM)); body.append('action', 'exclude');
							const resp = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
							const j = await resp.json();
							if (!resp.ok || !j || j.ok !== true) throw new Error(j && (j.error||j.msg) ? (j.error||j.msg) : 'No se pudo excluir al profesor');
							// Actualizar estados locales y UI
							seleccionado.enTrimestre = false;
							const idx = listaProfes.findIndex(x => String(x.idProfesor) === String(seleccionado.idProfesor));
							if (idx >= 0) listaProfes[idx].enTrimestre = false;
							await compatSwal('Profesor excluido', 'Preferencias y programación eliminadas', 'success');
							pintarProfesoresTabla();
							pintarDetallesProfesor();
							await cargarPreferenciasProfesor();
						} else {
							const ok = await compatConfirm({ title: 'Incluir en trimestre', text: '¿Deseas incluir a este profesor en el trimestre? Se crearán preferencias genéricas (horarios 07:00-20:30 en intervalos de 1h30).', showCancelButton: true });
							if (!ok) { btn.disabled = false; return; }
							const body = new URLSearchParams(); body.append('idProfesor', String(seleccionado.idProfesor)); body.append('idTrimestre', String(ID_TRIM)); body.append('action', 'include');
							const resp = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
							const j = await resp.json();
							if (!resp.ok || !j || j.ok !== true) throw new Error(j && (j.error||j.msg) ? (j.error||j.msg) : 'No se pudo incluir al profesor');
							// Actualizar estados locales y UI
							seleccionado.enTrimestre = true;
							const idx = listaProfes.findIndex(x => String(x.idProfesor) === String(seleccionado.idProfesor));
							if (idx >= 0) listaProfes[idx].enTrimestre = true;
							await compatSwal('Profesor incluido', 'Preferencias generadas', 'success');
							pintarProfesoresTabla();
							pintarDetallesProfesor();
							await cargarPreferenciasProfesor();
						}
					} catch(err){
						try{ await compatSwal('Error', err && err.message ? err.message : 'Error en la operación', 'error'); }catch(_){ }
					} finally {
						btn.disabled = false;
					}
				});
				detEstado().appendChild(btn);
		}

		function pintarUEAsPreferencias(ueas, gruposAsignadosPorClaveUEA){
			tbPrefUEAs().innerHTML = '';
			for (const u of (ueas || [])){
				const tr = document.createElement('tr');
				const tdU = document.createElement('td');
				const tdP = document.createElement('td');
				const tdG = document.createElement('td');
				const clave = u.claveUEA ?? u.clave ?? '';
				const nombre = u.nombre ?? u.nombreUEA ?? '';
				// Título con clave - nombre
				const tituloUEA = document.createElement('span');
				tituloUEA.textContent = `${clave} - ${nombre}`;
				tdU.appendChild(tituloUEA);
				tdP.appendChild(document.createTextNode(String(u.prioridad ?? '')));

				// grupos asignados a esta UEA para el profesor
				const cont = document.createElement('div');
				const btnMas = document.createElement('button');
				btnMas.type = 'button';
				btnMas.className = 'btn btn-sm btn-outline-primary me-2';
				btnMas.textContent = '+';
				btnMas.title = 'Ver/Asignar grupos de esta UEA';
				btnMas.addEventListener('click', async ()=>{
					try{
						await abrirSelectorGruposUEA({ claveUEA: String(clave), nombreUEA: String(nombre) });
					}catch(e){ swalErr(e.message || 'No se pudo cargar grupos de la UEA'); }
				});
				cont.appendChild(btnMas);

				const grupos = gruposAsignadosPorClaveUEA.get(String(clave)) || [];
				for (const g of grupos){
					// botón de grupo con X de borrado visible al hover
					const btnGrp = document.createElement('button');
					btnGrp.type = 'button';
					btnGrp.className = 'btn btn-sm btn-outline-secondary me-1 mb-1 position-relative d-inline-flex align-items-center';
					btnGrp.classList.add('assigned-group');
					btnGrp.textContent = g.claveGrupo;
					btnGrp.dataset.claveGrupo = String(g.claveGrupo);

					// crear la X (span) que estará oculta hasta hover
					const xSpan = document.createElement('span');
					xSpan.className = 'assigned-group-delete';
					xSpan.textContent = '×';
					xSpan.title = 'Quitar asignación';

					// mostrar/ocultar la X al entrar/salir
					// manejo del click en la X: eliminar la asignación (usar SweetAlert si disponible)
					xSpan.addEventListener('click', (ev)=>{
						ev.stopPropagation();
						const doDelete = function(){
							const clave = btnGrp.dataset.clavegrupo || btnGrp.dataset.claveGrupo || '';
							if (!clave){ swalErr('Clave de grupo no disponible'); return; }
							// usar Promises (fetch) para invocar el controlador que borra por claveGrupo
							fetch('./controlador/quitarProgramacionProfesorGrupo.php', {
								method: 'POST',
								headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
								body: new URLSearchParams({ idTrimestre: String(ID_TRIM), idProfesor: String(seleccionado.idProfesor), claveGrupo: String(clave) }).toString()
							}).then(function(resp){
								if (!resp.ok) throw new Error(resp.statusText || 'HTTP error');
								return resp.json();
							}).then(function(json){
								if (!json || !json.ok){ throw new Error(json && json.msg ? json.msg : 'No se pudo eliminar la asignación'); }
								// refrescar programación y vista
								cacheProgTrim = null;
								return cargarPreferenciasProfesor();
							}).then(function(){
								compatSwal('Asignación eliminada', '', 'success');
							}).catch(function(err){
								if (err && err.message) swalErr('Error: ' + err.message); else swalErr('Error al eliminar asignación');
							});
						};
						if (typeof window.swal === 'function'){
							compatConfirm({ title: 'Quitar asignación', text: '¿Quitar esta asignación de grupo al profesor?', icon: 'warning', buttons: ['Cancelar','Quitar'], dangerMode: true })
							.then(function(willDelete){ if (willDelete) doDelete(); });
						} else {
							if (!confirm('¿Quitar esta asignación de grupo al profesor?')) return;
							doDelete();
						}
					});

					cont.appendChild(btnGrp);
					btnGrp.appendChild(xSpan);
				}
				tdG.appendChild(cont);

				tr.appendChild(tdU); tr.appendChild(tdP); tr.appendChild(tdG);
				tbPrefUEAs().appendChild(tr);
			}
		}

		function buildMapGruposPorClaveUEA(programacionFiltrada){
			const map = new Map(); // claveUEA => [{claveGrupo}]
			const vistosPorUEA = new Map(); // claveUEA => Set(claveGrupo)
			for (const r of (programacionFiltrada || [])){
				const cUEA = String(r.claveUEA);
				const cGrp = String(r.claveGrupo);
				if (!map.has(cUEA)){
					map.set(cUEA, []);
					vistosPorUEA.set(cUEA, new Set());
				}
				const vistos = vistosPorUEA.get(cUEA);
				if (!vistos.has(cGrp)){
					map.get(cUEA).push({ claveGrupo: r.claveGrupo });
					vistos.add(cGrp);
				}
			}
			return map;
		}

		async function cargarProgramacionTrimestre(){
			if (cacheProgTrim) return cacheProgTrim;
			try{
				const json = await fetchJSON('./controlador/recuperarProgramacionTrimestre.php', { idTrimestre: ID_TRIM });
				if (!json.ok) throw new Error(json.msg || 'Respuesta inválida');
				cacheProgTrim = json.programacion || [];
				return cacheProgTrim;
			} catch(e){ return []; }
		}

		// Reconstruye el contenedor original de preferencias (tabla + botón agregar)
		function resetPrefUEAContainer(){
			const wrap = document.getElementById('pref-uea-wrap');
			if (!wrap) return;
			wrap.innerHTML = '';
			const tblWrap = document.createElement('div');
			const table = document.createElement('table'); table.className='table table-sm align-middle';
			const thead = document.createElement('thead'); thead.className='table-dark';
			const tr = document.createElement('tr');
			const th1 = document.createElement('th'); th1.textContent='UEA (clave - nombre)';
			const th2 = document.createElement('th'); th2.style.width='120px'; th2.textContent='Prioridad';
			const th3 = document.createElement('th'); th3.textContent='Grupos asignados';
			tr.appendChild(th1); tr.appendChild(th2); tr.appendChild(th3);
			thead.appendChild(tr); table.appendChild(thead);
			const tbody = document.createElement('tbody'); tbody.id = 'tb-pref-ueas'; table.appendChild(tbody);
			wrap.appendChild(table);
			// zona agregar
			const controls = document.createElement('div');
			controls.className = 'mt-2 d-flex flex-column flex-sm-row align-items-sm-center gap-2';
			const btn = document.createElement('button'); btn.id='btn-agregar-uea'; btn.type='button'; btn.className='btn btn-outline-primary btn-sm'; btn.textContent = '+ Agregar UEA (prioridad 0)';
			const area = document.createElement('div'); area.id='agregar-uea-area'; area.className='mt-2 mt-sm-0'; area.style.display='none'; area.style.minWidth='0';
			controls.appendChild(btn); controls.appendChild(area);
			wrap.appendChild(controls);
			// rewire botón agregar (por si wireEvents corrió antes)
			btn.addEventListener('click', async ()=>{ await toggleAgregarUEA(); });
		}

			// Utilidad: obtener programación del profesor seleccionado (por NE)
			async function obtenerProgramacionProfesorSeleccionado(){
				const prog = await cargarProgramacionTrimestre();
				const ne = seleccionado?.numeroEconomico || null;
				return (ne ? prog.filter(r => String(r.numeroEconomico) === String(ne)) : []);
			}

		async function cargarPreferenciasProfesor(){
			// Reconstruir el contenedor de preferencias para asegurar la vista
			// por defecto (tabla de UEA). Esto evita que el selector de grupos
			// permanezca visible al cambiar de profesor.
			try{ resetPrefUEAContainer(); } catch(e){ /* noop */ }
			// limpiar UI
			tbPrefUEAs().innerHTML = '';
			modalPrefUEAs().innerHTML = '';
			modalHorariosGridWrap().innerHTML = '';
			modalPrefResumen().textContent = '';
			modalPrefExtra().textContent = '';

			const p = seleccionado; if (!p) return;
			const idProfesor = p.idProfesor;
			const ne = p.numeroEconomico || null;

			try{
				const json = await fetchJSON('./controlador/recuperarPreferenciasProfesorTrimestre.php', { idTrimestre: ID_TRIM, idProfesor });
				const data = json && json.ok ? json.data : null;
				lastPrefData = data;
				// Estilo del botón Ver preferencias
				if (data && data.preferencias || (data && data.preferencia)){
					btnVerPref().className = 'btn btn-sm btn-success';
				} else if (data && (data.ueas?.length || data.horarios?.length)){
					btnVerPref().className = 'btn btn-sm btn-success';
				} else {
					btnVerPref().className = 'btn btn-sm btn-danger';
				}

				const ueas = data && data.ueas ? data.ueas : [];
				const horarios = data && data.horarios ? data.horarios : [];

				// Programación del trimestre filtrada por NE del profesor seleccionado
				const prog = await cargarProgramacionTrimestre();
				const progProf = (ne ? prog.filter(r => String(r.numeroEconomico) === String(ne)) : []);
				const mapGrupos = buildMapGruposPorClaveUEA(progProf);

				// Si el profesor tiene programación en el trimestre, mostrar un botón para verla
				(function ensureMostrarProgramacionButton(){
					const btnId = 'btn-mostrar-programacion';
					let existing = document.getElementById(btnId);
					if (progProf && progProf.length > 0){
						if (!existing){
							existing = document.createElement('button');
							existing.type = 'button';
							existing.id = btnId;
							existing.className = 'btn btn-sm btn-outline-primary ms-2';
							existing.textContent = 'Mostrar programación';
							existing.title = 'Ver programación asignada al profesor en este trimestre';
							existing.addEventListener('click', async () => {
								// obtener programación más reciente antes de mostrar
								const latest = await obtenerProgramacionProfesorSeleccionado();
								mostrarProgramacionProfesorModal(latest);
							});
							// intentar insertarlo inmediatamente después del botón Ver preferencias
							const anchor = btnVerPref();
							if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(existing, anchor.nextSibling);
						} else {
							existing.style.display = '';
						}
					} else if (existing){
						existing.style.display = 'none';
					}
				})();

				// pintar tabla principal
				pintarUEAsPreferencias(ueas, mapGrupos);

				// rellenar modal - resumen profesor + noGrupos + observaciones
				const noGrupos = data && data.preferencia ? (data.preferencia.noGrupos ?? null) : null;
				const observaciones = data && data.preferencia ? (data.preferencia.observaciones ?? null) : null;
				// pintar datos rápidos en panel principal
				if (noGrupos !== null) detNoGrupos().textContent = String(noGrupos); else detNoGrupos().textContent = 'NA';
				detObservaciones().textContent = observaciones ? observaciones : '—';
				modalPrefResumen().textContent = `${detNombre().textContent} — NE ${ne || ''}`;
				if (!editMode){
					// Construir usando DOM en lugar de innerHTML
					const cont = modalPrefExtra();
					cont.textContent = '';
					const divGr = document.createElement('div');
					divGr.className = 'mb-1';
					const labelGr = document.createElement('span');
					labelGr.textContent = 'Número de grupos solicitados: ';
					const strongGr = document.createElement('strong');
					strongGr.textContent = (noGrupos !== null) ? String(noGrupos) : 'NA';
					divGr.appendChild(labelGr);
					divGr.appendChild(strongGr);
					cont.appendChild(divGr);
					const divObs = document.createElement('div');
					if (observaciones && String(observaciones).trim() !== ''){
						const labObs = document.createElement('span'); labObs.textContent = 'Observaciones: ';
						const txtObs = document.createElement('span'); txtObs.textContent = observaciones; // contenido plano (ya visible), si hubiera HTML se escaparía previamente
						divObs.appendChild(labObs);
						divObs.appendChild(txtObs);
					} else {
						divObs.classList.add('text-body-secondary');
						divObs.textContent = 'Sin observaciones';
					}
					cont.appendChild(divObs);
				} else {
					// inputs de edición con placeholder
					modalPrefExtra().innerHTML = '';
					const row = document.createElement('div'); row.className = 'd-flex align-items-center gap-3';
					const wrapNo = document.createElement('div'); wrapNo.className = 'd-flex align-items-center gap-2';
					const labNo = document.createElement('label'); labNo.className = 'form-label mb-0'; labNo.textContent = 'Número de grupos';
					const inpNo = document.createElement('input'); inpNo.type='number'; inpNo.min='0'; inpNo.id='inp-no-grupos'; inpNo.className='form-control form-control-sm'; inpNo.style.maxWidth='140px'; inpNo.placeholder = (noGrupos!==null && noGrupos!==undefined) ? String(noGrupos) : '';
					wrapNo.appendChild(labNo); wrapNo.appendChild(inpNo);
					const wrapObs = document.createElement('div'); wrapObs.className = 'd-flex align-items-center gap-2 flex-fill';
					const labObs = document.createElement('label'); labObs.className = 'form-label mb-0'; labObs.textContent = 'Observaciones';
					const inpObs = document.createElement('input'); inpObs.type='text'; inpObs.id='inp-observaciones'; inpObs.className='form-control form-control-sm'; inpObs.placeholder = observaciones ? observaciones : '';
					wrapObs.appendChild(labObs); wrapObs.appendChild(inpObs);
					row.appendChild(wrapNo); row.appendChild(wrapObs);
					modalPrefExtra().appendChild(row);
				}


				// asegurar catálogo UEA si se editan
				if (editMode && !cacheUEAs){
					try{ const resUEA = await fetch('./controlador/recuperaUEAS.php'); const j = await resUEA.json(); cacheUEAs = Array.isArray(j)? j : []; } catch(e){ cacheUEAs = []; }
				}
				for (const u of ueas){
					const tr = document.createElement('tr');
					const td1 = document.createElement('td');
					const td2 = document.createElement('td');
					const td3 = document.createElement('td');
					const claveX = u.claveUEA ?? '';
					const gruposThis = mapGrupos.get(String(claveX)) || [];
					if (!editMode){
						td1.textContent = `${claveX} - ${u.nombre ?? ''}`;
					} else {
						// edición: sólo mostrar SELECT (buscar por texto no necesario aquí)
						const sel = document.createElement('select');
						sel.className = 'form-select form-select-sm'; sel.dataset.role='uea-select';
						// almacenar id/claves originales para validación al cambiar
						if (u.idUEA) sel.dataset.originalId = String(u.idUEA);
						if (u.claveUEA) sel.dataset.originalClave = String(u.claveUEA);
						poblarOpcionesUEASelect(sel, cacheUEAs || [], u.idUEA);
						// Cuando el usuario cambie la UEA, validar asignaciones y, si existen, pedir confirmación y borrarlas
						sel.addEventListener('change', async (ev) => {
							const newId = parseInt(sel.value || '0', 10);
							const origId = parseInt(sel.dataset.originalId || '0', 10);
							const origClave = sel.dataset.originalClave || '';
							if (!origId || newId === origId) return; // nada que hacer

							// obtener catálogo para resolver claves
							const newU = (cacheUEAs || []).find(x => String(x.idUEA) === String(newId));
							const newClave = newU ? String(newU.cUEA ?? newU.claveUEA ?? '') : '';

							// comprobar si el profesor tiene grupos asignados en la UEA original
							try{
								const prog = await cargarProgramacionTrimestre();
								const ne = seleccionado?.numeroEconomico || null;
								const progProf = (ne ? prog.filter(r => String(r.numeroEconomico) === String(ne)) : []);
								const gruposOrig = progProf.filter(r => String(r.claveUEA) === String(origClave));
								if (gruposOrig.length > 0){
									const msg = `El profesor tiene ${gruposOrig.length} grupo(s) asignados en la UEA que está reemplazando. Al cambiar la UEA esas asignaciones serán eliminadas.\n¿Desea continuar?`;
										// solicitar confirmación usando SweetAlert si está disponible
										let proceed = false;
										if (typeof window.swal === 'function'){
											try{
												proceed = await new Promise((resolve) => {
													try{ compatConfirm({ title: 'Confirmar', text: msg, icon: 'warning', buttons: ['Cancelar','Continuar'], dangerMode: true }).then(res => resolve(!!res)); }
													catch(e){ resolve(confirm(msg)); }
												});
											} catch(e){ proceed = confirm(msg); }
										} else if (window.Swal && typeof Swal.fire === 'function'){
											try{
												const r = await Swal.fire({ title: 'Confirmar', text: msg, icon: 'warning', showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar', customClass: { popup: 'my-swal-popup', confirmButton: 'my-swal-confirm', cancelButton: 'my-swal-cancel' } });
												proceed = !!(r && r.isConfirmed);
											} catch(e){ proceed = confirm(msg); }
										} else {
											proceed = confirm(msg);
										}
										if (!proceed){ sel.value = String(origId); return; }
									// llamar al controlador que borra programacion de profesor/uea
									const body = new URLSearchParams();
									body.append('idTrimestre', String(ID_TRIM));
									body.append('idProfesor', String(seleccionado.idProfesor));
									// preferir idUEA si existe en catálogo, sino enviar clave
									if (origId && origId>0) body.append('idUEA', String(origId));
									else if (origClave) body.append('claveUEA', String(origClave));

									const resp = await fetch('./controlador/quitarProgramacionProfesorUEA.php', { method: 'POST', body: body });
									const j = await resp.json();
									if (!resp.ok || !j.ok){
										swalErr('No se pudo quitar la(s) asignación(es) de grupo: ' + (j.msg || resp.statusText));
										sel.value = String(origId);
										return;
									}
									// actualizar el dataset original para futura ediciones en la misma fila
									sel.dataset.originalId = String(newId);
									sel.dataset.originalClave = newClave || '';
									// refrescar la programación en caché y la tabla de UEAs para reflejar los cambios
									cacheProgTrim = null; // forzar recarga
									await cargarPreferenciasProfesor();
								} else {
									// no hay grupos, simplemente actualizar originalId para futuras operaciones
									sel.dataset.originalId = String(newId);
									const newU2 = (cacheUEAs || []).find(x => String(x.idUEA)===String(newId));
									if (newU2) sel.dataset.originalClave = String(newU2.cUEA ?? newU2.claveUEA ?? '');
								}
							} catch (err){
								swalErr('Error validando asignaciones: ' + (err.message || err));
								sel.value = String(origId);
							}
						});

						// envolver select y botón en un contenedor flex para que quepan en la misma línea
						const wrapSelBtn = document.createElement('div');
						wrapSelBtn.className = 'd-flex align-items-center gap-2';
						// permitir que el select ocupe el espacio disponible
						sel.className = (sel.className ? sel.className + ' ' : '') + 'flex-grow-1';
						const btnDel = document.createElement('button');
						btnDel.type = 'button';
						btnDel.className = 'btn btn-sm btn-outline-danger me-2';
						btnDel.title = 'Quitar UEA de preferencias';
						btnDel.textContent = 'X';
						btnDel.addEventListener('click', async (ev) => {
							// confirmación usando SweetAlert cuando esté disponible
							const confirmMsg = '¿Eliminar esta UEA de las preferencias? Si existen grupos programados en esta UEA, serán eliminados primero.';
							let okDel = false;
							if (typeof window.swal === 'function'){
								try{ okDel = await new Promise(resolve => { try{ compatConfirm({ title: 'Eliminar UEA', text: confirmMsg, icon: 'warning', buttons: ['Cancelar','Eliminar'], dangerMode: true }).then(res => resolve(!!res)); } catch(e){ resolve(confirm(confirmMsg)); } }); } catch(e){ okDel = confirm(confirmMsg); }
							} else if (window.Swal && typeof Swal.fire === 'function'){
								try{ const r = await Swal.fire({ title: 'Eliminar UEA', text: confirmMsg, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', customClass: { popup: 'my-swal-popup', confirmButton: 'my-swal-confirm', cancelButton: 'my-swal-cancel' } }); okDel = !!(r && r.isConfirmed); } catch(e){ okDel = confirm(confirmMsg); }
							} else { okDel = confirm(confirmMsg); }
							if (!okDel) return;
							try{
									const idUEA = parseInt(sel.value || sel.dataset.originalId || '0', 10);
									const idPref = lastPrefData && lastPrefData.preferencia ? (lastPrefData.preferencia.id || 0) : 0;
									if (!idUEA || !idPref){ swalErr('No se pudo identificar la preferencia o la UEA'); return; }
									const body = new URLSearchParams();
									body.append('idTrimestre', String(ID_TRIM));
									body.append('idProfesor', String(seleccionado.idProfesor));
									body.append('idPreferencia', String(idPref));
									body.append('idUEA', String(idUEA));
									// Añadir logs de depuración para capturar stack en caso de fallo runtime
									try{
										const resp = await fetch('./controlador/quitarUEAPreferenciaProfesor.php', { method: 'POST', body: body });
										const j = await resp.json();
										if (!resp.ok || !j.ok){ swalErr('No se pudo eliminar la UEA: ' + (j.msg || resp.statusText)); return; }
										// refrescar datos
										cacheProgTrim = null;
										await cargarPreferenciasProfesor();
									} catch(innerErr){
										// Reutilizar el mensaje de usuario habitual
										swalErr('Error al quitar la UEA: ' + (innerErr && innerErr.message ? innerErr.message : innerErr));
									}
							} catch(err){ swalErr('Error al quitar la UEA: ' + (err.message||err)); }
						});
						// poner el botón antes del select para ahorrar espacio horizontal
						wrapSelBtn.appendChild(btnDel);
						wrapSelBtn.appendChild(sel);
						td1.appendChild(wrapSelBtn);
					}

					// prioridad: si estamos en edición mostrar input numérico para permitir editar (respetar 0)
					if (!editMode){
						td2.textContent = String(u.prioridad ?? '');
					} else {
						const inpPri = document.createElement('input');
						inpPri.type = 'number'; inpPri.min = '0'; inpPri.className = 'form-control form-control-sm'; inpPri.style.maxWidth = '120px';
						inpPri.dataset.role = 'prio-input';
						inpPri.value = (typeof u.prioridad !== 'undefined' && u.prioridad !== null) ? String(u.prioridad) : '';
						td2.appendChild(inpPri);
					}
					td3.textContent = String(gruposThis.length);
					tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
					modalPrefUEAs().appendChild(tr);
				}

				// Construir tabla de horarios preferidos (dias vs horas)
				// construirTablaHorarios puede necesitar consultar el catálogo completo de horarios
				await construirTablaHorarios(horarios);
			} catch(e){
				btnVerPref().className = 'btn btn-sm btn-danger';
			}
		}

	// --------------------- Selector de grupos por UEA ---------------------

	async function abrirSelectorGruposUEA(uea){
		if (!uea || !uea.claveUEA){ swalErr('UEA inválida'); return; }
		const wrap = document.getElementById('pref-uea-wrap');
		if (!wrap){ swalErr('No se encontró el contenedor de preferencias'); return; }

		// Header con título y navegación de filtros
		wrap.innerHTML = '';
		const head = document.createElement('div');
		head.className = 'd-flex flex-column flex-sm-row align-items-sm-center justify-content-between mb-2 gap-2';
		const hTitle = document.createElement('div');
		hTitle.className = 'fw-semibold';
		hTitle.textContent = `${uea.claveUEA} - ${uea.nombreUEA || ''}`;
		const nav = document.createElement('div');
		nav.className = 'btn-group btn-group-sm';
		const btnFiltroPref = document.createElement('button'); btnFiltroPref.className='btn btn-primary'; btnFiltroPref.textContent='Filtro de preferencias';
		const btnSinPref = document.createElement('button'); btnSinPref.className='btn btn-outline-secondary'; btnSinPref.textContent='Sin filtro de preferencias';
		const btnTodos = document.createElement('button'); btnTodos.className='btn btn-outline-secondary'; btnTodos.textContent='Todos los grupos';
		nav.appendChild(btnFiltroPref); nav.appendChild(btnSinPref); nav.appendChild(btnTodos);
		const btnBack = document.createElement('button'); btnBack.className='btn btn-link btn-sm'; btnBack.textContent='« Volver a preferencias'; btnBack.addEventListener('click', async ()=>{ resetPrefUEAContainer(); await cargarPreferenciasProfesor(); });
		head.appendChild(hTitle); head.appendChild(nav); head.appendChild(btnBack);
		wrap.appendChild(head);

		// Tabla (scroll vertical y horizontal)
		const tblWrap = document.createElement('div'); tblWrap.className='pref-table-responsive';
		const table = document.createElement('table'); table.className='table table-sm align-middle pref-table-minwidth table-horarios';
	const thead = document.createElement('thead'); thead.className='table-dark';
	const trh = document.createElement('tr');
	// Cabeceras: Grupo, Cupo, Inscritos, Salón, Lunes..Viernes, Económico, Profesor, Acciones
	['Grupo','Cupo','Inscritos','Salón'].forEach(t=>{ const th=document.createElement('th'); th.textContent=t; if (t === 'Grupo') th.className = 'grupo-col sticky-col'; trh.appendChild(th); });
	for (const d of diasConst){ const th = document.createElement('th'); th.textContent = capitalizar(d); trh.appendChild(th); }
	const thEco = document.createElement('th'); thEco.textContent = 'Económico'; trh.appendChild(thEco);
	const thProf = document.createElement('th'); thProf.textContent = 'Profesor'; trh.appendChild(thProf);

	// marcar columnas para poder ocultarlas según el modo
	thEco.className = 'col-eco';
	thProf.className = 'col-prof';
	const thAcc = document.createElement('th'); thAcc.textContent = 'Acciones'; trh.appendChild(thAcc);
	thead.appendChild(trh); table.appendChild(thead);
		const tbody = document.createElement('tbody'); table.appendChild(tbody);
		tblWrap.appendChild(table); wrap.appendChild(tblWrap);

		// Cargar datos de grupos de la UEA
		const gruposResp = await fetchJSON('./controlador/recuperarGruposUEATrimestre.php', { idTrimestre: ID_TRIM, claveUEA: uea.claveUEA });
		if (!gruposResp.ok){ throw new Error(gruposResp.msg || 'No se pudieron recuperar los grupos'); }
		const grupos = gruposResp.grupos || [];

		// Obtener asignaciones (profesor por grupo) para rellenar columnas Económico/Profesor
		let asignMapByGrupo = new Map();
		try{
			const assignResp = await fetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM });
			if (assignResp.ok && Array.isArray(assignResp.asignaciones)){
				for (const a of assignResp.asignaciones){
					if (a && (a.idGrupo || a.idGrupo === 0)) asignMapByGrupo.set(String(a.idGrupo), a);
				}
			}
		} catch(e){ console.error('No se pudo recuperar asignaciones por trimestre', e); }

		// -------------------------------------------------------------
		// Filtro 0 (nuevo): obtener grupos del trimestre que ya fueron
		// asignados a otros profesores y construir un Set para excluirlos
		// del listado. Hacemos la petición de forma síncrona (await) para
		// garantizar que el render inicial aplique correctamente el filtro.
		let assignedOtherSet = new Set();
		let assignedOtherMap = new Map();
		try {
			const params = new URLSearchParams();
			params.append('idTrimestre', String(ID_TRIM));
			params.append('excludeProfesor', String(seleccionado?.idProfesor || 0));
			const resp = await fetch('./controlador/recuperarGruposAsignadosTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
			const j = await resp.json().catch(() => null);
			if (j && j.ok && Array.isArray(j.assignedKeys)) {
				for (const k of j.assignedKeys) assignedOtherSet.add(String(k));
				if (j.assignedMap) {
					for (const kk in j.assignedMap) assignedOtherMap.set(kk, j.assignedMap[kk]);
				}
			}
		} catch(e) { console.error('No se pudo recuperar grupos asignados:', e); }


		// Prepara estructuras para filtros
		const prefSlots = new Set((lastPrefData?.horarios || []).map(h => `${String(h.dia).toLowerCase()}|${h.horaInicio}-${h.horaFin}`));
		// Construir cobertura de preferencias por día (uniendo intervalos contiguos/traslapados)
		const prefByDay = new Map(); // dia -> Array<[iniMin, finMin]> (unidos)
		(function buildPrefCoverage(){
			const rawByDay = new Map();
			for (const h of (lastPrefData?.horarios || [])){
				const d = String(h.dia).toLowerCase();
				if (!rawByDay.has(d)) rawByDay.set(d, []);
				rawByDay.get(d).push([toMinutes(h.horaInicio), toMinutes(h.horaFin)]);
			}
			function mergeIntervals(list){
				if (!list || list.length === 0) return [];
				// ordenar por inicio
				list.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
				const out = [];
				let [cs, cf] = list[0];
				for (let i=1;i<list.length;i++){
					const [s, f] = list[i];
					// unir si traslapan o son contiguos (cf >= s)
					if (s <= cf){
						cf = Math.max(cf, f);
					} else {
						out.push([cs, cf]);
						cs = s; cf = f;
					}
				}
				out.push([cs, cf]);
				return out;
			}
			for (const [d, arr] of rawByDay.entries()){
				prefByDay.set(d, mergeIntervals(arr));
			}
		})();
		const progProf = await obtenerProgramacionProfesorSeleccionado();
	const progSlots = progProf.map(r => ({ dia: String(r.dia).toLowerCase(), ini: r.horaInicio, fin: r.horaFin, claveGrupo: r.claveGrupo, claveUEA: r.claveUEA }));
	// usar clave compuesta UEA|claveGrupo para evitar colisiones entre UEAs distintas que comparten la misma claveGrupo
	const asignadosSet = new Set(progProf.map(r => `${String(r.claveUEA)}|${String(r.claveGrupo)}`));

		function toMinutes(t){ if (!t) return 0; const parts = String(t).split(':'); const h=parseInt(parts[0]||'0',10), m=parseInt(parts[1]||'0',10); return h*60+m; }
		function overlap(aIni,aFin,bIni,bFin){ const ai=toMinutes(aIni), af=toMinutes(aFin), bi=toMinutes(bIni), bf=toMinutes(bFin); return (ai < bf) && (bi < af); }
		function horariosFormato(arr){
			if (!arr || !arr.length) return '—';
			const byDia = {};
			for (const h of arr){ const d=String(h.dia).toLowerCase(); if(!byDia[d]) byDia[d]=[]; byDia[d].push(`${h.horaInicio}-${h.horaFin}`); }
			const orden = ['lunes','martes','miercoles','jueves','viernes'];
			return orden.filter(d=>byDia[d]).map(d=>`${capitalizar(d)} ${byDia[d].join(', ')}`).join(' | ');
		}

		function aplicarFiltro(modo){
			// FILTRO 0: excluir grupos ya asignados a OTROS profesores en el trimestre
			// si assignedOtherSet fue poblado por la petición al controlador


			// Verifica si el intervalo [aIni,aFin] está totalmente cubierto por preferencias del día dado
			function isCoveredByPrefs(dia, aIni, aFin){
				const d = String(dia).toLowerCase();
				const ai = toMinutes(aIni), af = toMinutes(aFin);
				const covers = prefByDay.get(d) || [];
				for (const [s,f] of covers){ if (s <= ai && af <= f) return true; }
				return false;
			}
			let ret = grupos.slice();

			// aplicar filtro 0 ahora que ret está inicializado
			if (assignedOtherSet && assignedOtherSet.size > 0){
				ret = ret.filter(g => {
					const key = `${String(uea.claveUEA)}|${String(g.claveGrupo)}`;
					if (assignedOtherSet.has(key)) return false;
					return true;
				});
			}
			if (modo === 'prefs'){
				// 1) Debe estar completamente cubierto por las preferencias del profesor (permitiendo intervalos largos)
				ret = ret.filter(g => {
					const hrs = Array.isArray(g.horarios)? g.horarios : [];
					if (hrs.length === 0) return false; // sin horarios no es asignable con filtro
					return hrs.every(h => isCoveredByPrefs(h.dia, h.horaInicio, h.horaFin));
				});
			}
			// 2) excluir por traslape con programación existente
			ret = ret.filter(g => {
				const hrs = Array.isArray(g.horarios)? g.horarios : [];
				for (const h of hrs){
					const d = String(h.dia).toLowerCase();
					for (const pr of progSlots){ if (pr.dia === d && overlap(h.horaInicio, h.horaFin, pr.ini, pr.fin)) return false; }
				}
				return true;
			});
			// 3) excluir grupos ya asignados al profesor (comparar por UEA + claveGrupo)
			ret = ret.filter(g => {
				const key = `${String(uea.claveUEA)}|${String(g.claveGrupo)}`;
				return !asignadosSet.has(key);
			});
			return ret;
		}

		async function render(modo){
			// ajustar visibilidad de columnas Económico/Profesor según modo
			try{
				const thEcoEl = table.querySelector('th.col-eco');
				const thProfEl = table.querySelector('th.col-prof');
				if (thEcoEl) thEcoEl.style.display = (modo === 'todos') ? '' : 'none';
				if (thProfEl) thProfEl.style.display = (modo === 'todos') ? '' : 'none';
			} catch(e){ /* noop */ }
			// Actualiza activos en nav
			btnFiltroPref.className = 'btn ' + (modo==='prefs' ? 'btn-primary' : 'btn-outline-secondary');
			btnSinPref.className = 'btn ' + (modo==='sinpref' ? 'btn-primary' : 'btn-outline-secondary');
			btnTodos.className = 'btn ' + (modo==='todos' ? 'btn-primary' : 'btn-outline-secondary');
			// Datos
			let datos = [];
			if (modo === 'todos') datos = grupos;
			else if (modo === 'sinpref') datos = aplicarFiltro('sinpref');
			else datos = aplicarFiltro('prefs');
			// Pintar
			tbody.innerHTML = '';
			for (const g of datos){
				const tr = document.createElement('tr');
				const tdG = document.createElement('td'); tdG.textContent = g.claveGrupo; tdG.className = 'grupo-col sticky-col';
				const tdC = document.createElement('td'); tdC.textContent = (g.cupo!=null && g.cupo!==undefined)? String(g.cupo): '';
				const tdI = document.createElement('td'); tdI.textContent = (g.inscritos!=null && g.inscritos!==undefined)? String(g.inscritos): '';
				const tdS = document.createElement('td'); tdS.textContent = (g.salon!=null && g.salon!==undefined && String(g.salon).trim()!=='')? String(g.salon): '';
				// Preparar mapa dia -> [horarios]
				const horariosArr = Array.isArray(g.horarios) ? g.horarios : [];
				const byDay = {};
				for (const h of horariosArr){
					const d = String(h.dia).toLowerCase();
					const label = (h.horaInicio? h.horaInicio : '') + (h.horaFin? '-' + h.horaFin : '');
					if (!byDay[d]) byDay[d] = [];
					if (!byDay[d].includes(label)) byDay[d].push(label);
				}
				const tdA = document.createElement('td');
				// Columnas: Económico, Profesor (antes de Acciones) — sólo en modo 'todos'
				let tdEco = null;
				let tdProf = null;
				if (modo === 'todos'){
					tdEco = document.createElement('td');
					tdProf = document.createElement('td');
					// Llenar con asignación si existe (preferir idGrupo key)
					try{
						const asg = asignMapByGrupo.get(String(g.idGrupo)) || asignMapByGrupo.get(String(g.claveGrupo)) || null;
						if (asg){ tdEco.textContent = asg.numeroEconomico || ''; tdProf.textContent = asg.profesor || ''; }
					} catch(e){ /* noop */ }
				}
				const b = document.createElement('button'); b.type='button'; b.className='btn btn-sm btn-success'; b.textContent='Asignar';
                b.addEventListener('click', async ()=>{
						// Validación rápida: si ya está asignado, no continuar (comparar por UEA + claveGrupo)
						const compositeKey = `${String(uea.claveUEA)}|${String(g.claveGrupo)}`;
						if (asignadosSet.has(compositeKey)) { swalErr('Este grupo ya está asignado al profesor'); return; }

					// Si el grupo está asignado a OTRO profesor, pedir confirmación de reemplazo
					try{
						const existingAssign = asignMapByGrupo.get(String(g.idGrupo)) || asignMapByGrupo.get(String(g.claveGrupo)) || null;
						if (existingAssign && existingAssign.idProfesor && Number(existingAssign.idProfesor) !== Number(seleccionado.idProfesor)){
							const curName = existingAssign.profesor || (existingAssign.numeroEconomico ? ('NE ' + existingAssign.numeroEconomico) : 'Otro profesor');
							const newName = seleccionado ? (seleccionado.nombre || ('NE ' + seleccionado.numeroEconomico)) : 'Profesor';
							const okReplace = await compatConfirm({ title: 'Reemplazar asignación', text: `El grupo ya está asignado a ${curName}. ¿Deseas reemplazarlo por ${newName}?`, showCancelButton: true });
							if (!okReplace) return;
						}
					} catch(e){ /* si falla la confirmación, continuar con la asignación normal */ }

					// Enviar al servidor para validación de traslapes y asignación
					const body = new URLSearchParams({ idTrimestre: String(ID_TRIM), idProfesor: String(seleccionado.idProfesor), idGrupo: String(g.idGrupo) }).toString();
					fetch('./controlador/asignarGrupoProfesor.php', {
						method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
					}).then(resp => {
						return resp.json().then(j => ({ httpOk: resp.ok, status: resp.status, json: j }));
					}).then(async ({ httpOk, status, json }) => {
						if (!httpOk || !json || json.ok === false) {
							if (json && json.code === 'overlap' && Array.isArray(json.conflicts) && json.conflicts.length) {
								// Construir contenido HTML con comparación visual
								const html = buildOverlapHtml(json.conflicts);
								if (window.Swal && typeof Swal.fire === 'function'){
									try{ await Swal.fire({ icon: 'error', title: 'Conflicto de horario', html, width: 800, customClass: { popup: 'my-swal-popup' } }); } catch(e){ swalErr(json.msg || 'Conflicto de horario'); }
								} else if (typeof window.swal === 'function'){
									// SweetAlert v1 no soporta bien HTML complejo: usar texto de respaldo
									const txt = conflictsToPlain(json.conflicts);
									try{ compatSwal('Conflicto de horario', txt, 'error'); } catch(e){ alert('Conflicto de horario:\n' + txt); }
								} else {
									alert('Conflicto de horario');
								}
								return;
							}
							throw new Error((json && json.msg) ? json.msg : ('HTTP ' + status));
						}
						// Éxito: refrescar programación y re-render
						cacheProgTrim = null;
						const nuevaProg = await obtenerProgramacionProfesorSeleccionado();
						progSlots.length = 0; asignadosSet.clear();
						for (const r of nuevaProg){ progSlots.push({ dia:String(r.dia).toLowerCase(), ini:r.horaInicio, fin:r.horaFin, claveGrupo:r.claveGrupo, claveUEA: r.claveUEA }); asignadosSet.add(`${String(r.claveUEA)}|${String(r.claveGrupo)}`); }
						await render(modo);
						compatSwal('Grupo asignado', '', 'success');
					}).catch(err => {
						swalErr(err && err.message ? err.message : 'Error al asignar');
					});
				});
				tdA.appendChild(b);
				tr.appendChild(tdG); tr.appendChild(tdC); tr.appendChild(tdI); tr.appendChild(tdS);
				// Añadir celdas por día L-V con horarios
				for (const d of diasConst){
					const tdDay = document.createElement('td');
					const arr = byDay[d] || [];
					tdDay.textContent = arr.length ? arr.join(', ') : '—';
					tr.appendChild(tdDay);
				}
				// insertar Económico/Profesor antes de acciones sólo si existen
				if (modo === 'todos'){
					tr.appendChild(tdEco);
					tr.appendChild(tdProf);
				}
				tr.appendChild(tdA);
				tbody.appendChild(tr);
			}
		}

		btnFiltroPref.addEventListener('click', ()=> render('prefs'));
		btnSinPref.addEventListener('click', ()=> render('sinpref'));
		btnTodos.addEventListener('click', ()=> render('todos'));

		// Asegurar que el botón 'Filtro de preferencias' aparece activo y
		// que la vista por defecto sea 'prefs'.
		btnFiltroPref.className = 'btn btn-primary';
		btnSinPref.className = 'btn btn-outline-secondary';
		btnTodos.className = 'btn btn-outline-secondary';

		// Render inicial con filtro de preferencias
		await render('prefs');
	}

	// Construir HTML de comparación de traslapes para SweetAlert2
	function buildOverlapHtml(conflicts){
		try{
			const rows = conflicts.map((c, idx) => {
				const ex = c.existing || {}; const inc = c.incoming || {};
				const sameUEA = c.sameUEA ? '<span class="badge bg-warning text-dark ms-2">Misma UEA</span>' : '';
				return `
				<div class="swal-conflict-row">
				  <div class="swal-conflict-card">
					<div class="swal-conflict-title">Asignación existente ${sameUEA}</div>
					<div><strong>UEA:</strong> ${escapeHtml(ex.claveUEA||'')} - ${escapeHtml(ex.nombreUEA||'')}</div>
					<div><strong>Grupo:</strong> ${escapeHtml(ex.claveGrupo||'')}</div>
					<div><strong>Día:</strong> ${escapeHtml(ex.dia||'')}</div>
					<div><strong>Horario:</strong> ${escapeHtml(ex.horaInicio||'')} - ${escapeHtml(ex.horaFin||'')}</div>
					<div><strong>Salón:</strong> ${escapeHtml(ex.salon||'')}</div>
				  </div>
				  <div class="swal-conflict-card">
					<div class="swal-conflict-title">Nuevo grupo</div>
					<div><strong>UEA:</strong> ${escapeHtml(inc.claveUEA||'')} - ${escapeHtml(inc.nombreUEA||'')}</div>
					<div><strong>Grupo:</strong> ${escapeHtml(inc.claveGrupo||'')}</div>
					<div><strong>Día:</strong> ${escapeHtml(inc.dia||'')}</div>
					<div><strong>Horario:</strong> ${escapeHtml(inc.horaInicio||'')} - ${escapeHtml(inc.horaFin||'')}</div>
					<div><strong>Salón:</strong> ${escapeHtml(inc.salon||'')}</div>
				  </div>
				</div>`;
			}).join('');
			return `<div class="swal-conflict-grid">${rows}</div>`;
		}catch(e){ return '<div>Conflicto de horario</div>'; }
	}

	function conflictsToPlain(conflicts){
		try{
			return conflicts.map(c => {
				const ex = c.existing || {}; const inc = c.incoming || {};
				const line1 = `EXISTENTE: ${ex.claveUEA||''}-${ex.nombreUEA||''} | Grupo ${ex.claveGrupo||''} | ${ex.dia||''} ${ex.horaInicio||''}-${ex.horaFin||''}`;
				const line2 = `NUEVO: ${inc.claveUEA||''}-${inc.nombreUEA||''} | Grupo ${inc.claveGrupo||''} | ${inc.dia||''} ${inc.horaInicio||''}-${inc.horaFin||''}`;
				return line1 + "\n" + line2;
			}).join("\n\n");
		}catch(e){ return 'Conflicto de horario'; }
	}

	// Modal para mostrar la programación asignada a un profesor
	function mostrarProgramacionProfesorModal(prog){
		// Crear modal si no existe
		let modal = document.getElementById('modal-programacion-profesor');
		if (!modal){
			modal = document.createElement('div');
			modal.id = 'modal-programacion-profesor';
			modal.className = 'modal fade';
			modal.tabIndex = -1;
			modal.innerHTML = `
				<div class="modal-dialog modal-xl">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">Programación asignada</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
						</div>
						<div class="modal-body"><div id="modal-programacion-body"></div></div>
						<div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button></div>
					</div>
				</div>`;
			document.body.appendChild(modal);
		}
		const body = modal.querySelector('#modal-programacion-body');
		body.innerHTML = '';
		if (!prog || !prog.length){
			body.innerHTML = '<div class="text-body-secondary">El profesor no tiene grupos asignados en este trimestre.</div>';
			// mostrar modal igualmente
		} else {
			// Reorganizar prog en grupos: una fila por grupo, columnas por día
			const wrapTable = document.createElement('div');
			wrapTable.className = 'table-responsive';
			const table = document.createElement('table');
			table.className = 'table table-sm table-bordered';
			const thead = document.createElement('thead');
			const tr = document.createElement('tr');
			// Cabeceras: Clave UEA, UEA (nombre), Grupo, días, Salón
			const thClave = document.createElement('th'); thClave.textContent = 'Clave UEA'; tr.appendChild(thClave);
			const thUEAname = document.createElement('th'); thUEAname.textContent = 'UEA'; tr.appendChild(thUEAname);
			const thGrp = document.createElement('th'); thGrp.textContent = 'Grupo'; tr.appendChild(thGrp);
			for (const d of diasConst){ const th = document.createElement('th'); th.textContent = capitalizar(d); tr.appendChild(th); }
			const thSalon = document.createElement('th'); thSalon.textContent = 'Salón'; tr.appendChild(thSalon);
			thead.appendChild(tr); table.appendChild(thead);

			// Agrupar por grupo: usar clave compuesta UEA|claveGrupo|idGrupo para evitar colisiones
			const gruposMap = new Map();
			for (const r of prog){
				const key = `${String(r.claveUEA || '')}|${String(r.claveGrupo || '')}|${String(r.idGrupo || '')}`;
				if (!gruposMap.has(key)){
					gruposMap.set(key, {
						claveUEA: r.claveUEA || r.clave || '',
						nombreUEA: r.nombreUEA || r.nombre || '',
						claveGrupo: r.claveGrupo || r.clave || '',
						salon: r.salon || r.salonNombre || '',
						horariosByDay: {}
					});
				}
				const g = gruposMap.get(key);
				const dia = String(r.dia || '').toLowerCase();
				const label = (r.horaInicio ? r.horaInicio : '') + (r.horaFin ? ('-' + r.horaFin) : '');
				if (!g.horariosByDay[dia]) g.horariosByDay[dia] = [];
				// evitar duplicados exactos
				if (!g.horariosByDay[dia].includes(label)) g.horariosByDay[dia].push(label);
			}

			const tbody = document.createElement('tbody');
			for (const [k, g] of gruposMap.entries()){
				const tr2 = document.createElement('tr');
				const tdClave = document.createElement('td'); tdClave.textContent = g.claveUEA || '';
				const tdNombre = document.createElement('td'); tdNombre.textContent = g.nombreUEA || '';
				const tdGrp = document.createElement('td'); tdGrp.textContent = g.claveGrupo || '';
				tr2.appendChild(tdClave); tr2.appendChild(tdNombre); tr2.appendChild(tdGrp);
				for (const d of diasConst){
					const td = document.createElement('td');
					const arr = g.horariosByDay[d] || [];
					td.textContent = arr.length ? arr.join(', ') : '—';
					tr2.appendChild(td);
				}
				const tdSalon = document.createElement('td'); tdSalon.textContent = g.salon || '';
				tr2.appendChild(tdSalon);
				tbody.appendChild(tr2);
			}
			table.appendChild(tbody);
			wrapTable.appendChild(table);
			body.appendChild(wrapTable);
		}
		// Mostrar modal usando Bootstrap si está disponible
		try{
			if (window.bootstrap && bootstrap.Modal){
				const modalObj = new bootstrap.Modal(modal);
				modalObj.show();
			} else {
				// Fallback simple: añadir clase show y estilo inline
				modal.style.display = 'block';
				modal.classList.add('show');
			}
		}catch(e){ console.error('No se pudo abrir modal:', e); }
	}

			async function toggleAgregarUEA(){
			if (addUEAArea().style.display === 'none'){
				// abrir: construir UI si no existe
				addUEAArea().innerHTML = '';
				const wrap = document.createElement('div');
				wrap.className = 'd-flex flex-column gap-2';

				// fila superior: buscador + botón agregar
				const controlsRow = document.createElement('div');
				controlsRow.className = 'd-flex align-items-center gap-2';
				const inputBuscar = document.createElement('input');
				inputBuscar.type = 'search';
				inputBuscar.className = 'form-control form-control-sm flex-grow-1';
				inputBuscar.placeholder = 'Buscar UEA (clave o nombre)...';
				inputBuscar.style.maxWidth = '100%';

				const btnAdd = document.createElement('button');
				btnAdd.type = 'button';
				btnAdd.className = 'btn btn-sm btn-primary';
				btnAdd.textContent = 'Agregar';

				// select (lista) debajo de la fila de controles
				const sel = document.createElement('select');
				sel.className = 'form-select form-select-sm';
				sel.style.width = '100%';
				sel.size = 1; // actuará como listbox temporalmente cuando se expanda
				sel.style.maxHeight = '240px';

				// obtener UEAs completas si no en cache
				if (!cacheUEAs){
					try{
						const res = await fetch('./controlador/recuperaUEAS.php');
						const json = await res.json();
						cacheUEAs = Array.isArray(json) ? json : [];
					} catch(e){ cacheUEAs = []; }
				}

				// excluir las que ya están en preferencias
				const existentes = new Set();
				for (const tr of tbPrefUEAs().children){
					const txt = tr.children[0]?.textContent || '';
					const clave = (txt.split('-')[0] || '').trim();
					if (clave) existentes.add(clave);
				}

				// Configurar comportamiento del buscador
				inputBuscar.addEventListener('input', ()=>{
					poblarOpcionesUEASelect(sel, cacheUEAs || [], null, inputBuscar.value || '', existentes);
					// ajustar tamaño visible para mostrar las opciones filtradas
					try{ sel.size = Math.min(10, Math.max(1, sel.options.length)); }catch(e){ /* noop */ }
				});

				inputBuscar.addEventListener('focus', ()=>{
					try{ sel.size = Math.min(10, Math.max(1, sel.options.length)); }catch(e){}
				});

				// cuando el select recibe blur cerrarlo (con pequeño retraso para clicks)
				sel.addEventListener('blur', ()=>{ setTimeout(()=>{ try{ sel.size = 1; }catch(e){} }, 150); });

				// inicializar select usando la utilidad (filtrado por existentes)
				poblarOpcionesUEASelect(sel, cacheUEAs || [], null, '', existentes);
				try{ sel.size = Math.min(10, Math.max(1, sel.options.length)); }catch(e){}

				// montar controles en la UI: fila controles arriba, select debajo
				controlsRow.appendChild(inputBuscar);
				controlsRow.appendChild(btnAdd);
				wrap.appendChild(controlsRow);
				wrap.appendChild(sel);

						btnAdd.addEventListener('click', async ()=>{
							if (!seleccionado){ swalErr('Selecciona un profesor primero'); return; }
							const idUEA = sel.value ? parseInt(sel.value,10) : 0;
							if (!idUEA){ swalErr('Selecciona una UEA'); return; }
							try{
								const res = await fetch('./controlador/agregarUEAPreferenciaProfesor.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ idTrimestre: String(ID_TRIM), idProfesor: String(seleccionado.idProfesor), idUEA: String(idUEA) }).toString()});
								const json = await res.json();
								if (!res.ok || !json.ok){ throw new Error(json.msg || 'No se pudo agregar la UEA'); }
								// refrescar
								await cargarPreferenciasProfesor();
								addUEAArea().style.display = 'none';
							} catch(e){ swalErr(e.message || 'Error al agregar UEA'); }
						});

				wrap.appendChild(sel); wrap.appendChild(btnAdd);
				addUEAArea().appendChild(wrap);
				addUEAArea().style.display = '';
			} else {
				addUEAArea().style.display = 'none';
			}
		}

	function wireEvents(){
			btnProf().addEventListener('click', async ()=>{
				// invalidar caches relevantes y recargar listado de profesores
				try{
					cacheProgTrim = null;
					cacheUEAs = null;
					// limpiar selección/detalle UEA (si existe) para evitar datos obsoletos
					try{
						const right = document.getElementById('uea-detail');
						if (right){ while(right.firstChild) right.removeChild(right.firstChild); const hint = document.createElement('div'); hint.className='text-muted'; hint.textContent='Selecciona una UEA para ver detalle.'; right.appendChild(hint); }
						const prevU = document.querySelectorAll('.uea-selected'); if (prevU && prevU.length){ prevU.forEach(n=>n.classList.remove('uea-selected')); }
						const prevCell = document.querySelectorAll('.uea-cell-selected'); if (prevCell && prevCell.length){ prevCell.forEach(n=>n.classList.remove('uea-cell-selected')); }
					}catch(_e){}
					// recargar lista desde BD
					setModoActivo('profesores');
					await cargarProfesoresTabla();
				}catch(e){ console.error('Error al cambiar a modo profesores', e); swalErr('No se pudo actualizar datos de profesores'); }
			});
				btnUEA().addEventListener('click', async ()=>{
					console.debug('asignacionTrimestral: btn-modo-uea clicked');
					// limpiar selección de profesor y detalles para evitar mostrar datos obsoletos cuando cambiemos
					try{
						seleccionado = null;
						lastPrefData = null;
						// limpiar panel derecho de profesor
						try{ pintarDetallesProfesor(); }catch(_e){}
						// remover clase activa de filas de la tabla de profesores
						try{ const rows = document.querySelectorAll('#tb-profesores tr.table-active'); if (rows) rows.forEach(r => r.classList.remove('table-active')); }catch(_e){}
					}catch(_e){}
					// invalidar caches para forzar recarga completa en modo UEA
					try{
						cacheUEAs = null;
						cacheProgTrim = null;
						setModoActivo('uea');
						await renderUEAMode();
					}catch(e){ console.error('renderUEAMode error', e); swalErr('No se pudo cargar el modo UEA'); }
				});
				filtroBusqueda().addEventListener('input', ()=> pintarProfesoresTabla());
			btnAddUEA().addEventListener('click', async ()=>{ await toggleAgregarUEA(); });
			btnEditarPref().addEventListener('click', async ()=>{
				if (!seleccionado){ swalErr('Selecciona un profesor primero'); return; }
				if (!editMode){
					editMode = true;
					btnEditarPref().textContent = 'Finalizar';
					await cargarPreferenciasProfesor();
				} else {
					await finalizarEdicionPreferencias();
				}
			});
	}

	document.addEventListener('DOMContentLoaded', async ()=>{
		console.debug('asignacionTrimestral: DOMContentLoaded start');
		if (!ID_TRIM || isNaN(ID_TRIM) || ID_TRIM <= 0){
			swalErr('Falta el id del trimestre. Regrese al menú y elija "Programar" nuevamente.');
			return;
		}
			wireEvents();

			// Inyectar toggles de panel izquierdo (profesores y UEA)
			try {
				setupLeftPanelToggle('vista-profesores', 'filtro-busqueda');
				setupLeftPanelToggle('vista-uea', 'uea-search');
			} catch(e){ console.warn('Toggle panel setup failed', e); }

			// Crear menú de filtros junto al buscador (si existe)
			try{
				const input = document.getElementById('filtro-busqueda');
				if (input){
					const fm = new FilterMenu(input);
					fm.init().catch(e => console.error('FilterMenu init error', e));
				}
			} catch(e){ console.error(e); }
			// Añadir botón en la parte superior derecha para volver al panel de administrador
			try {
				const titleEl = elTitulo();
				if (titleEl && !document.getElementById('btn-back-admin')){
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.id = 'btn-back-admin';
					btn.className = 'btn btn-outline-secondary btn-sm float-end';
					btn.style.marginLeft = '8px';
					btn.title = 'Volver al panel de administrador';
					btn.textContent = 'Volver admin';
					btn.addEventListener('click', function(){
						// Navegar al índice de administrador incluyendo el parámetro 'user' si está disponible
						try {
							const params = new URLSearchParams(window.location.search || '');
							let user = params.get('user') || (window.currentUser || null);
							if (!user) {
								// intentar leer desde un elemento global si existe
								if (typeof window.USER !== 'undefined' && window.USER) user = window.USER;
							}
							if (!user) {
								// No tenemos user -> mostrar advertencia y evitar navegar para no cerrar sesión
								if (typeof window.swal === 'function') {
									try { compatSwal('Usuario no disponible', 'No se puede volver al panel de administrador porque falta el parámetro user en la URL.', 'warning'); }
									catch(e){ /* noop */ }
								} else if (window.Swal && typeof Swal.fire === 'function'){
									try { Swal.fire({ icon: 'warning', title: 'Usuario no disponible', text: 'No se puede volver al panel de administrador porque falta el parámetro user en la URL.', customClass: { popup: 'my-swal-popup', confirmButton: 'my-swal-confirm' } }); }
									catch(e){}
								} else {
									alert('No se puede volver al panel de administrador porque falta el parámetro user en la URL.');
								}
								return;
							}
							const target = './index_administrador.php?user=' + encodeURIComponent(String(user));
							window.location.href = target;
						} catch (e) {
							// Fallback simple
							window.location.href = './index_administrador.php';
						}
					});
					// Intentar anexarlo al contenedor del título (si existe su padre)
					if (titleEl.parentNode) titleEl.parentNode.appendChild(btn);
				}
			} catch (e) { /* noop */ }
				await cargarTitulo();
				setModoActivo('profesores');
				await cargarProfesoresTabla();
				await cargarPreferenciasProfesor();
	});

		// Utilidad: configurar botón para ocultar/mostrar panel izquierdo dentro de una vista 2 columnas
		function setupLeftPanelToggle(viewId, searchInputId){
			const row = document.getElementById(viewId);
			if (!row) return;
			// marcar como layout de dos columnas
			row.classList.add('view-two-col');
			// ubicar columnas izquierda/derecha (estructura: primera col-lg-4 y segunda col-lg-8)
			const leftCol = row.querySelector(':scope > .col-lg-4');
			const rightCol = row.querySelector(':scope > .col-lg-8');
			if (!leftCol || !rightCol) return;
			leftCol.classList.add('left-col');
			rightCol.classList.add('right-col');

			// insertar barra con botón de ocultar por encima del buscador
			const hideBar = document.createElement('div'); hideBar.className = 'left-panel-toggle-bar';
			const hideBtn = document.createElement('button'); hideBtn.type='button'; hideBtn.className='btn-toggle-left'; hideBtn.title='Ocultar panel izquierdo'; hideBtn.textContent = '◀ Ocultar';
			hideBar.appendChild(hideBtn);
			// ubicar antes del primer bloque (label/buscador)
			const firstBlock = leftCol.firstElementChild; // normalmente el div .mb-2 con label/input
			if (firstBlock) leftCol.insertBefore(hideBar, firstBlock); else leftCol.appendChild(hideBar);

			// botón para mostrar cuando esté colapsado: insertarlo al inicio del panel derecho
			const showWrap = document.createElement('div'); showWrap.className = 'right-panel-show-btn'; showWrap.style.display = 'none';
			const showBtn = document.createElement('button'); showBtn.type='button'; showBtn.className='btn-toggle-show'; showBtn.title='Mostrar panel izquierdo'; showBtn.textContent = 'Mostrar ▶';
			showWrap.appendChild(showBtn);
			// intentar insertarlo antes del primer hijo visible en el panel derecho
			const rightFirst = rightCol.firstElementChild;
			if (rightFirst) rightCol.insertBefore(showWrap, rightFirst); else rightCol.appendChild(showWrap);

			// handlers
			hideBtn.addEventListener('click', () => {
				row.classList.add('left-collapsed');
				showWrap.style.display = '';
			});
			showBtn.addEventListener('click', () => {
				row.classList.remove('left-collapsed');
				showWrap.style.display = 'none';
				// opcional: devolver foco al buscador correspondiente
				try { const inp = document.getElementById(searchInputId); if (inp) inp.focus(); } catch(_){}
			});
		}

	// Utilidad para escapar HTML simple
	function escapeHtml(str){
		return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
	}

	async function construirTablaHorarios(horarios){
		const wrap = modalHorariosGridWrap();
		wrap.innerHTML = '';
		// Si no hay horarios y no estamos en modo edición, mostrar mensaje y salir.
		if ((!horarios || !horarios.length) && !editMode){
			wrap.innerHTML = '<div class="text-body-secondary">Sin horarios preferidos</div>';
			return;
		}
		// Cargar catálogo completo de horarios para mapear a idHorario (si disponible)
		let horariosCatalogo = [];
		try {
			const resp = await fetch('controlador/recuperarHorarios.php', { credentials: 'same-origin' });
			if (resp && resp.ok) {
				const j = await resp.json();
				if (j && j.ok && Array.isArray(j.horarios)) horariosCatalogo = j.horarios;
			}
		} catch (e) { /* ignore */ }
		const mapaIdHorario = new Map();
		// normalizar tiempo a formato H:MM (sin 0 inicial en hora)
		function normalizeTime(h){ try{ if(!h) return ''; const p = String(h).split(':'); const hh = parseInt(p[0]||'0',10); const mm = (p[1]||'00'); return String(hh)+':'+(mm.length===1? '0'+mm : mm); }catch(e){ return String(h); } }
		// indexar por clave: dia|inicio-fin (normalizado)
		for (const hh of horariosCatalogo){
			try {
				const d = (hh.dia || '').toString().toLowerCase();
				const key = `${d}|${normalizeTime(hh.horaInicio)}-${normalizeTime(hh.horaFin)}`;
				if (!mapaIdHorario.has(key)) mapaIdHorario.set(key, hh.idHorario);
			} catch (e){}
		}

		// Generar lista de slots. Si estamos en modo edición queremos mostrar la lista completa
		// de 07:00 a 20:30 en pasos de 90 minutos. En modo lectura usamos los horarios reales.
		function generateSlotsRange(start, end, stepMin){
			const toMinutes = (t) => { const p = String(t).split(':'); return (parseInt(p[0]||'0',10))*60 + parseInt(p[1]||'0',10); };
			const fromMinutes = (m) => { const hh = Math.floor(m/60); const mm = m%60; return String(hh)+':' + (mm<10? '0'+mm : String(mm)); };
			const s = toMinutes(start);
			const e = toMinutes(end);
			const out = [];
			for (let t = s; t <= e; t += stepMin){
				const inicio = fromMinutes(t);
				const fin = fromMinutes(t + stepMin);
				out.push({ inicio: inicio, fin: fin });
			}
			return out;
		}

		let slots = [];
		if (editMode){
			// mostrar rango completo desde 7:00 hasta 20:30 en intervalos de 90 minutos
			slots = generateSlotsRange('07:00','20:30', 90);
		} else {
			// Obtener slots únicos por horaInicio-horaFin a partir de los horarios preferidos
			const slotsMap = new Map();
			for (const h of horarios){
				const inicio = normalizeTime(h.horaInicio);
				const fin = normalizeTime(h.horaFin);
				const key = `${inicio}-${fin}`;
				if (!slotsMap.has(key)) slotsMap.set(key, { inicio: inicio, fin: fin });
			}
			// ordenar por minutos (no por orden lexicográfico) para que 10:00 > 7:00
			function toMinutesStr(t){ try{ const p = String(t).split(':'); return parseInt(p[0]||'0',10)*60 + parseInt(p[1]||'0',10); }catch(e){ return 0; } }
			slots = Array.from(slotsMap.values()).sort((a,b)=> toMinutesStr(a.inicio) - toMinutesStr(b.inicio));
		}
		const dias = diasConst;
		// Set para marcar seleccionados (normalizar tiempos para coincidir con 'slots')
		const preferidos = new Set(horarios.map(h => `${h.dia.toLowerCase()}|${normalizeTime(h.horaInicio)}-${normalizeTime(h.horaFin)}`));
		const table = document.createElement('table');
		table.className = 'table table-sm table-bordered table-horarios';
		const thead = document.createElement('thead');
		const trHead = document.createElement('tr');
		const thDia = document.createElement('th'); thDia.textContent = 'Día'; thDia.className = 'sticky-col bg-dark text-white'; trHead.appendChild(thDia);
		for (const s of slots){
			const th = document.createElement('th'); th.textContent = `${s.inicio}`; trHead.appendChild(th);
		}
		thead.appendChild(trHead); table.appendChild(thead);
		const tbody = document.createElement('tbody');
		for (const d of dias){
			const tr = document.createElement('tr');
			const thD = document.createElement('th'); thD.textContent = capitalizar(d); thD.className = 'sticky-col'; tr.appendChild(thD);
			for (const s of slots){
				const td = document.createElement('td');
				const selected = preferidos.has(`${d}|${s.inicio}-${s.fin}`);
				td.dataset.dia = d; td.dataset.inicio = s.inicio; td.dataset.fin = s.fin;
				// intentar asignar idHorario si existe en el catálogo
				try {
					const lookupKey = `${d}|${s.inicio}-${s.fin}`;
					if (mapaIdHorario.has(lookupKey)) td.dataset.idHorario = String(mapaIdHorario.get(lookupKey));
				} catch(e){}
				dibujarCeldaHorario(td, selected);
				if (editMode){
					td.style.cursor = 'pointer';
					td.addEventListener('click', ()=>{
						const nowSel = td.dataset.sel === '1' ? false : true;
						dibujarCeldaHorario(td, nowSel);
					});
				}
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}
		table.appendChild(tbody);
		wrap.appendChild(table);
		currentHorarioSlots = slots;
	}

	function capitalizar(str){
		return String(str).charAt(0).toUpperCase()+String(str).slice(1);
	}

	function dibujarCeldaHorario(td, selected){
		td.innerHTML = '';
		td.dataset.sel = selected ? '1' : '0';
		const span = document.createElement('span');
		span.textContent = selected ? 'X' : '';
		span.className = selected ? 'cell-ok' : 'cell-empty';
		td.appendChild(span);
	}

		function poblarOpcionesUEASelect(selectEl, ueaCatalog, selectedId, term, existentes){
			const t = (term||'').toLowerCase();
			const existingSet = (existentes && existentes instanceof Set) ? existentes : new Set();
			const opts = [];
			for (const u of (ueaCatalog||[])){
				const clave = String(u.cUEA ?? u.claveUEA ?? '');
				const nombre = String(u.nUEA ?? u.nombre ?? '');
				const txt = `${clave} - ${nombre}`;
				if (!clave) continue;
				if (existingSet.has(clave)) continue; // excluir ya existentes
				if (t && !txt.toLowerCase().includes(t)) continue;
				opts.push({ value: String(u.idUEA ?? ''), text: txt });
			}
			selectEl.innerHTML = '';
			for (const o of opts){
				const opt = document.createElement('option');
				opt.value = o.value; opt.textContent = o.text;
				if (selectedId && String(selectedId)===o.value) opt.selected = true;
				selectEl.appendChild(opt);
			}
		}

	async function finalizarEdicionPreferencias(){
		try{
			if (!lastPrefData || !lastPrefData.preferencia){ swalErr('No hay datos de preferencia cargados'); return; }
			const idPref = lastPrefData.preferencia.id;
			// recopilar UEA seleccionadas con prioridad (sin editar prioridad por ahora)
			const ueasOut = [];
			const rows = Array.from(modalPrefUEAs().querySelectorAll('tr'));
			for (const tr of rows){
				const sel = tr.querySelector('select[data-role="uea-select"]');
				// prioridad: aceptar input numérico si existe, si no leer texto
				let pri = 0;
				try{
					const inp = tr.querySelector('input[data-role="prio-input"]');
					if (inp) {
						const v = String(inp.value||'').trim();
						pri = v === '' ? 0 : parseInt(v, 10) || 0;
					} else if (tr.children[1]) {
						pri = parseInt(tr.children[1].textContent.trim()||'0',10) || 0;
					}
				} catch(e){ pri = 0; }
				if (sel && sel.value){ ueasOut.push({ idUEA: parseInt(sel.value,10), prioridad: pri }); }
			}
			// recopilar horarios seleccionados (si el td contiene dataset.idHorario, enviaremos ids como hace menuTrimestres)
			const horarioIdsOut = [];
			const grid = modalHorariosGridWrap().querySelector('table');
			if (grid){
				for (const td of grid.querySelectorAll('tbody td')){
					if (td.dataset.sel === '1'){
						// preferir idHorario si está disponible
						if (td.dataset && td.dataset.idHorario && String(td.dataset.idHorario).trim() !== '') {
							horarioIdsOut.push(String(td.dataset.idHorario));
						} else {
							// respaldo: enviar objeto con dia/hora para compatibilidad
							horarioIdsOut.push(JSON.stringify({ dia: td.dataset.dia, horaInicio: td.dataset.inicio, horaFin: td.dataset.fin }));
						}
					}
				}
			}
			// inputs noGrupos/observaciones
			let noGruposNuevo = null, obsNueva = null;
			const elNo = document.getElementById('inp-no-grupos');
			const elObs = document.getElementById('inp-observaciones');
			if (elNo && elNo.value.trim() !== '') noGruposNuevo = parseInt(elNo.value.trim(),10);
			if (elObs && elObs.value.trim() !== '') obsNueva = elObs.value.trim();

			// Construir FormData al estilo menuTrimestres: uea1..uea5 y horario[] (ids)
			const fd = new FormData();
			fd.append('idTrimestre', String(ID_TRIM));
			fd.append('idProfesor', String(seleccionado.idProfesor));
			fd.append('idPreferencia', String(idPref));
			if (noGruposNuevo !== null) fd.append('noGrupos', String(noGruposNuevo));
			if (obsNueva !== null) fd.append('observaciones', obsNueva);
			// ueasOut es array [{idUEA, prioridad}]; enviar como JSON en 'ueas' para preservar prioridades (incluido 0)
			if (ueasOut.length > 0) {
				fd.append('ueas', JSON.stringify(ueasOut));
			}
			// horarios: enviar todos los seleccionados en 'horario[]'. Si el elemento es un objeto
			// (JSON serializado) lo enviamos como JSON string dentro de horario[] para que el
			// controlador lo procese igual que los ids numéricos.
			for (const h of horarioIdsOut) {
				try {
					const parsed = JSON.parse(h);
					// Enviar el objeto serializado como string en horario[]
					fd.append('horario[]', JSON.stringify(parsed));
				} catch (e) {
					// not JSON -> es id
					fd.append('horario[]', h);
				}
			}

			const res = await fetch('./controlador/actualizarPreferenciasProfesor.php', { method: 'POST', body: fd });
			const json = await res.json();
			if (!res.ok || !json.ok) throw new Error(json.msg || 'No se pudieron guardar los cambios');
			editMode = false; btnEditarPref().textContent = 'Editar preferencias';
			await cargarPreferenciasProfesor();
			compatSwal('Preferencias actualizadas', '', 'success');
		}catch(e){ swalErr(e.message || 'Error al guardar cambios'); }
	}
})();

// =============================
// Modo UEA (por trimestre) — lista con filtros + panel de detalle
// =============================
(function(){
	// estado local simple
	let ueaState = { built: false, rawRows: [], filtered: [], elements: {} };

	// Helper local para POST x-www-form-urlencoded que devuelve el JSON del servidor
	async function fetchJSON(url, data){
		const form = new URLSearchParams();
		if (data && typeof data === 'object'){
			Object.keys(data).forEach(k=>{ if (data[k] !== undefined && data[k] !== null) form.append(k, data[k]); });
		}
		const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
		try { const j = await res.json(); return j; } catch(e) { return { ok: res.ok, status: res.status }; }
	}

	// Asegura y devuelve la lista de profesores para búsquedas dentro del IIFE UEA
	async function ensureListaProfes(){
		if (Array.isArray(ueaState.profesores) && ueaState.profesores.length) return ueaState.profesores;
		try{
			const res = await fetch('./controlador/recuperarProfesoresTrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: (new URLSearchParams({ idTrimestre: String(ID_TRIM) })).toString() });
			const j = await res.json().catch(()=>null);
			const arr = (j && j.ok && Array.isArray(j.profesores)) ? j.profesores : [];
			ueaState.profesores = arr;
			return arr;
		}catch(e){ console.error('ensureListaProfes error', e); ueaState.profesores = []; return []; }
	}

	// Compat wrappers locales: usan las funciones globales si existen, sino fallback
	const compatSwal = (typeof window !== 'undefined' && typeof window.compatSwal === 'function') ? window.compatSwal : (async function(opt){
		try{
			if (typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function'){
				return await window.Swal.fire(opt);
			}
			// simple fallback: if opt is string -> alert, if object with title/text use confirm for boolean
			if (typeof opt === 'string') { alert(opt); return true; }
			if (opt && (opt.showCancelButton || opt.buttons)){
				return confirm(opt.title || opt.text || '¿Continuar?');
			}
			alert(opt && (opt.title || opt.text) ? (opt.title ? opt.title + '\n' + (opt.text||'') : (opt.text||'')) : 'Mensaje');
			return true;
		}catch(e){ console.error('compatSwal fallback error', e); return true; }
	});

	// Compat confirm wrapper local que usa compatSwal y normaliza la respuesta a boolean
	async function compatConfirm(opt){
		try{
			const res = await compatSwal(opt);
			if (typeof res === 'boolean') return res;
			if (res && typeof res === 'object'){
				if (res.isConfirmed !== undefined) return !!res.isConfirmed;
				if (res.value !== undefined) return !!res.value;
			}
			return !!res;
		}catch(e){ return false; }
	}

	const swalErr = (typeof window !== 'undefined' && typeof window.swalErr === 'function') ? window.swalErr : function(msg){
		try{ if (typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function'){ window.Swal.fire({ title: 'Error', text: String(msg||''), icon: 'error' }); return; } }catch(e){}
		alert(String(msg||'Error'));
	};

	function clearChildren(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }
	// ID del trimestre (leer desde la variable global establecida por programacion.php)
	const ID_TRIM = (typeof window !== 'undefined' && window.ID_TRIMESTRE) ? parseInt(window.ID_TRIMESTRE, 10) : 0;

	function buildUEADom(container){
		// If the page contains a static skeleton (added in programacion.php), reuse its controls
		const hasStatic = !!container.querySelector('#uea-search');
		if (hasStatic){
			const inputSearch = container.querySelector('#uea-search');
			const selArea = container.querySelector('#uea-area-select');
			const selEstado = container.querySelector('#uea-estado-select');
			const tbody = container.querySelector('#uea-tbody');
			const right = container.querySelector('#uea-detail');
			ueaState.elements = { inputSearch, selArea, selEstado, tbody, right };
			ueaState.built = true;
			return;
		}

		// Bloque de controles (selector UEA + buscador + filtros)
		const controlWrap = document.createElement('div'); controlWrap.className='mb-2'; left.appendChild(controlWrap);
		// Selector de UEA
		const selLabel = document.createElement('label'); selLabel.className='form-label mb-1'; selLabel.textContent='Selecciona UEA'; controlWrap.appendChild(selLabel);
		// No selector dropdown here: selection is via table rows

		// Toolbar de filtros
		const toolbar = document.createElement('div'); toolbar.className='uea-toolbar d-flex flex-wrap gap-2 mt-2'; controlWrap.appendChild(toolbar);
		const inputSearch = document.createElement('input'); inputSearch.type='text'; inputSearch.className='form-control form-control-sm uea-search-input'; inputSearch.placeholder='Buscar por clave o nombre';
		const selArea = document.createElement('select'); selArea.className='form-select form-select-sm uea-area-select';
		const selEstado = document.createElement('select'); selEstado.className='form-select form-select-sm uea-estado-select';
		;['Estado: Todos','Completas (100%)','Con faltantes'].forEach((txt,idx)=>{ const o=document.createElement('option'); o.value= String(idx); o.textContent=txt; selEstado.appendChild(o); });
		toolbar.appendChild(inputSearch); toolbar.appendChild(selArea); toolbar.appendChild(selEstado);

		// Tabla lista
		const tableWrap = document.createElement('div'); tableWrap.className='table-responsive'; left.appendChild(tableWrap);
		const table = document.createElement('table'); table.className='table table-sm table-hover align-middle uea-table'; tableWrap.appendChild(table);
		// construir thead y tbody usando DOM
		const thead = document.createElement('thead');
		const trh = document.createElement('tr');
		const thClave = document.createElement('th'); thClave.className = 'nowrap'; thClave.textContent = 'Clave'; trh.appendChild(thClave);
		const thNombre = document.createElement('th'); thNombre.textContent = 'Nombre'; trh.appendChild(thNombre);
		thead.appendChild(trh); table.appendChild(thead);
		const tbody = document.createElement('tbody'); table.appendChild(tbody);
		// mensaje por defecto en panel derecho
		clearChildren(right);
		const hint = document.createElement('div'); hint.className = 'text-muted'; hint.textContent = 'Selecciona una UEA para ver detalle.'; right.appendChild(hint);

		ueaState.elements = { inputSearch, selArea, selEstado, tbody, right };
		ueaState.built = true;
	}

	function aplicarFiltros(){
		const { inputSearch, selArea, selEstado, tbody, right } = ueaState.elements;
		const q = (inputSearch.value || '').toLowerCase().trim();
		const a = selArea.value || '';
		const e = selEstado.value || '0';
		ueaState.filtered = (ueaState.rawRows||[]).filter(r=>{
			const matchText = !q || (String(r.claveUEA||'').toLowerCase().includes(q) || String(r.nombre||'').toLowerCase().includes(q));
			const matchArea = !a || String(r.areaNombre||'') === a;
			let estado = 'mixto';
			if ((r.totalGrupos||0) === 0) estado = 'mixto';
			else if ((r.totalGrupos||0) === (r.gruposProgramados||0)) estado = 'completo';
			else if ((r.gruposProgramados||0) < (r.totalGrupos||0)) estado = 'pendiente';
			const matchEstado = (e==='0') || (e==='1' && estado==='completo') || (e==='2' && estado==='pendiente');
			return matchText && matchArea && matchEstado;
		});
		// render tabla
		clearChildren(tbody);
		ueaState.filtered.forEach(r => {
			const tr = document.createElement('tr');
			const tdClave = document.createElement('td'); tdClave.className = 'nowrap'; tdClave.textContent = (r.claveUEA||''); tr.appendChild(tdClave);
			const tdNombre = document.createElement('td'); tdNombre.textContent = (r.nombre||''); tr.appendChild(tdNombre);
			tr.style.cursor='pointer';
			tr.dataset.ueaId = String(r.idUEA || r.claveUEA || '');
			tr.addEventListener('click', function(){
				// marcar fila seleccionada (usar clases, no innerHTML)
				const prev = tbody.querySelector('tr.uea-selected');
				if (prev){
					prev.classList.remove('uea-selected');
					const prevCell = prev.querySelector('td'); if (prevCell) prevCell.classList.remove('uea-cell-selected');
				}
				// marcar la fila y la celda de clave UEA
				this.classList.add('uea-selected');
				const myCell = this.querySelector('td'); if (myCell) myCell.classList.add('uea-cell-selected');
				cargarDetalleUEA(r);
			});
			tbody.appendChild(tr);
		});
		// No hay selector; si el detalle actual no está en la lista filtrada, limpiar panel
		try{
			const currentDetalleClave = right && right.querySelector && right.querySelector('.uea-detail-head') && right.querySelector('.uea-detail-head').dataset && right.querySelector('.uea-detail-head').dataset.ueaId;
			if (currentDetalleClave){ if (!ueaState.filtered.some(r=>String(r.idUEA)===String(currentDetalleClave))){ clearChildren(right); const hint2=document.createElement('div'); hint2.className='text-muted'; hint2.textContent='Selecciona una UEA para ver detalle.'; right.appendChild(hint2); } }
		}catch(e){}
	}

	function cargarDetalleUEA(row){
		const { right } = ueaState.elements;
		clearChildren(right); const loadingMsg = document.createElement('div'); loadingMsg.className='text-muted'; loadingMsg.textContent='Cargando detalle...'; right.appendChild(loadingMsg);
		const url = 'controlador/recuperaDetalleUEATrimestre.php?idTrimestre='+encodeURIComponent(ID_TRIM)+'&idUEA='+encodeURIComponent(row.idUEA);
		fetch(url).then(r=>r.json()).then(j=>{
			if (!j || !j.ok) { clearChildren(right); const err=document.createElement('div'); err.className='text-danger'; err.textContent='No se pudo cargar el detalle.'; right.appendChild(err); return; }
			const d = j.data || {};
			pintarDetalle(d);
		}).catch(_=>{ clearChildren(right); const err2=document.createElement('div'); err2.className='text-danger'; err2.textContent='Error de red al cargar detalle.'; right.appendChild(err2); });
	}

	function pintarDetalle(d){
		const { right } = ueaState.elements;
		clearChildren(right);
		const u = d.uea || {};
		// Encabezado con resumen
		const head = document.createElement('div');
		head.className = 'uea-detail-head';
		head.dataset.ueaId = u.idUEA || u.claveUEA || '';
		const h6 = document.createElement('h6'); h6.className='mb-1'; h6.textContent = (u.nombre||'');
		const small = document.createElement('small'); small.className='text-muted'; small.textContent = ' [' + (u.claveUEA||'') + ']';
		h6.appendChild(document.createTextNode(' ')); h6.appendChild(small);
		head.appendChild(h6);
		const areaDiv = document.createElement('div'); const areaSmall = document.createElement('small'); areaSmall.className='text-muted'; areaSmall.textContent = 'Área: ' + (u.areaNombre||''); areaDiv.appendChild(areaSmall); head.appendChild(areaDiv);
		const badges = document.createElement('div'); badges.className='mt-2';
		const bTot = document.createElement('span'); bTot.className='badge bg-secondary me-1'; bTot.textContent = 'Tot: ' + (u.totalGrupos||0); badges.appendChild(bTot);
		const bProg = document.createElement('span'); bProg.className='badge bg-success me-1'; bProg.textContent = 'Prog: ' + (u.gruposProgramados||0); badges.appendChild(bProg);
		const bSin = document.createElement('span'); bSin.className='badge bg-warning text-dark'; bSin.textContent = 'Sin: ' + (u.gruposSinProgramar||0); badges.appendChild(bSin);
		head.appendChild(badges);
		right.appendChild(head);
		right.appendChild(document.createElement('hr'));

		// Submenú (3 botones)
		const submenu = document.createElement('div');
		submenu.className = 'uea-submenu btn-group btn-group-sm mb-2';
		const btnSubPref = document.createElement('button'); btnSubPref.type='button'; btnSubPref.className='btn btn-primary'; btnSubPref.textContent='Preferencias de profesor';
		const btnSubImpartido = document.createElement('button'); btnSubImpartido.type='button'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubImpartido.textContent='Profesores que han impartido la UEA';
		const btnSubLibre = document.createElement('button'); btnSubLibre.type='button'; btnSubLibre.className='btn btn-outline-secondary'; btnSubLibre.textContent='Libre';
		submenu.appendChild(btnSubPref); submenu.appendChild(btnSubImpartido); submenu.appendChild(btnSubLibre);
		right.appendChild(submenu);

		// Contenedor de contenido
		const subContent = document.createElement('div'); subContent.id = 'uea-subcontent'; right.appendChild(subContent);

		// Helper para construir tabla de "Preferencias de profesor"
		function buildPreferenciasTable(grupos, prioridades, asignMapByGrupo, prefMapByProf, progMapByProf){
			clearChildren(subContent);
			const tblWrap = document.createElement('div'); tblWrap.className='pref-table-responsive';
			const table = document.createElement('table'); table.className='table table-sm align-middle pref-table-minwidth pref-uea-table';
			const thead = document.createElement('thead'); thead.className='table-dark';
			const trh = document.createElement('tr');
			const cols = ['Grupo','Lunes','Martes','Miércoles','Jueves','Viernes','Número económico','Nombre','Prioridad 0','Prioridad 1','Prioridad 2','Prioridad 3','Prioridad 4','Prioridad 5'];
			cols.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; if (c==='Grupo') th.className='grupo-col sticky-col'; trh.appendChild(th); });
			thead.appendChild(trh); table.appendChild(thead);
			const tbody = document.createElement('tbody'); table.appendChild(tbody);

			function toMin(t){ if (!t) return 0; const [h,m] = String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(m||'0',10)); }
			function mergeIntervals(list){ if (!list||!list.length) return []; list = list.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last = out[out.length-1]; if (s<=last[1]){ last[1]=Math.max(last[1],f); }else{ out.push([s,f]); } } return out; }
			function hasOverlap(dayMap, d, s, f){ const arr = dayMap && dayMap[d] ? dayMap[d] : []; for (const [si,fi] of arr){ if (si < f && s < fi) return true; } return false; }
			function isCovered(prefDayMap, d, s, f){ const arr = prefDayMap && prefDayMap[d] ? prefDayMap[d] : []; for (const [si,fi] of arr){ if (si <= s && f <= fi) return true; } return false; }
			function normDay(x){ const v=String(x||'').toLowerCase(); return v.normalize('NFD').replace(/\p{Diacritic}/gu,''); }
			function buildGroupDayMap(g){ const m = { lunes:[], martes:[], miercoles:[], jueves:[], viernes:[] }; const arr = Array.isArray(g.horarios) ? g.horarios : []; for (const h of arr){ const d = normDay(h.dia); const s = toMin(h.horaInicio); const f = toMin(h.horaFin); if (m[d]) m[d].push([s,f]); } for (const k of Object.keys(m)){ m[k] = mergeIntervals(m[k]); } return m; }

			for (const g of (grupos||[])){
				const tr = document.createElement('tr');
				const tdG = document.createElement('td'); tdG.textContent = g.claveGrupo; tdG.className='grupo-col sticky-col'; tr.appendChild(tdG);
				const horariosArr = Array.isArray(g.horarios) ? g.horarios : [];
				const byDay = { lunes:[], martes:[], miercoles:[], jueves:[], viernes:[] };
				for (const h of horariosArr){ const d = String(h.dia).toLowerCase(); const label=(h.horaInicio? h.horaInicio:'') + (h.horaFin? '-' + h.horaFin:''); if(byDay[d] && !byDay[d].includes(label)) byDay[d].push(label); }
				['lunes','martes','miercoles','jueves','viernes'].forEach(dia=>{ const td=document.createElement('td'); td.textContent = byDay[dia].length? byDay[dia].join(', ') : '—'; tr.appendChild(td); });
				const asg = asignMapByGrupo.get(String(g.idGrupo)) || asignMapByGrupo.get(String(g.claveGrupo)) || null;
				const tdEco = document.createElement('td'); tdEco.textContent = asg ? (asg.numeroEconomico || '') : ''; tr.appendChild(tdEco);
				const tdNom = document.createElement('td'); tdNom.textContent = asg ? (asg.profesor || '') : ''; tr.appendChild(tdNom);
				for (let pri=0; pri<=5; pri++){
					const td = document.createElement('td');
					const baseList = (prioridades && prioridades[pri]) ? prioridades[pri] : [];
					const gDay = buildGroupDayMap(g);
					const assignedProfId = asg && asg.idProfesor ? parseInt(asg.idProfesor,10) : null;
					const list = baseList.filter(p => {
						const pid = parseInt(p.idProfesor,10);
						if (assignedProfId && pid === assignedProfId) return false;
						const prefMap = prefMapByProf && prefMapByProf.get ? prefMapByProf.get(pid) : null;
						const progMap = progMapByProf && progMapByProf.get ? progMapByProf.get(pid) : null;
						if (!prefMap) return false;
						for (const day of ['lunes','martes','miercoles','jueves','viernes']){
							const intervals = gDay[day];
							if (!intervals || !intervals.length) continue;
							for (const [s,f] of intervals){
								if (progMap && hasOverlap(progMap, day, s, f)) return false;
								if (!isCovered(prefMap, day, s, f)) return false;
							}
						}
						return true;
					});
					if (pri === 0){
						const btnAdd = document.createElement('button');
						btnAdd.type='button'; btnAdd.className='btn btn-outline-success btn-sm priority-add-btn me-1'; btnAdd.textContent = '+ Agregar';
						btnAdd.addEventListener('click', async ()=>{
							try{
								// 1) Obtener listado de profesores para este trimestre
								let profesores = [];
								try{
									const resp = await localFetchJSON('./controlador/recuperarProfesoresTrimestre.php', { idTrimestre: ID_TRIM });
									if (resp && resp.ok && Array.isArray(resp.profesores)) profesores = resp.profesores;
								} catch(_e){ profesores = []; }

								// 2) Si SweetAlert2 está disponible, mostrar buscador + tabla construidos con DOM
								if (typeof Swal !== 'undefined' && Swal.fire){
									await Swal.fire({
										 title: 'Agregar a prioridad 0',
										 width: 800,
										 showCancelButton: true,
										 showConfirmButton: false,
										 didOpen: () => {
											const container = Swal.getHtmlContainer();
											if (!container) return;
											// construir estructura
											const root = document.createElement('div'); root.className = 'swal-prof-search';
											const input = document.createElement('input'); input.type='search'; input.id='swal-prof-input'; input.className='form-control form-control-sm'; input.placeholder='Buscar por NE o nombre';
											const respDiv = document.createElement('div'); respDiv.className='table-responsive mt-2';
											const table = document.createElement('table'); table.className='table table-sm table-hover align-middle swal-prof-table';
											const thead = document.createElement('thead'); thead.className='table-light';
											const trh = document.createElement('tr');
											const thNE = document.createElement('th'); thNE.style.width='120px'; thNE.textContent='No. Económico';
											const thNom = document.createElement('th'); thNom.textContent='Nombre';
											const thEst = document.createElement('th'); thEst.style.width='120px'; thEst.textContent='Estado';
											trh.appendChild(thNE); trh.appendChild(thNom); trh.appendChild(thEst);
											thead.appendChild(trh);
											const tbody = document.createElement('tbody'); tbody.id='swal-prof-tbody';
											table.appendChild(thead); table.appendChild(tbody); respDiv.appendChild(table);
											root.appendChild(input); root.appendChild(respDiv);
											container.appendChild(root);

											function renderRows(list){
												try{ while (tbody.firstChild) tbody.removeChild(tbody.firstChild); }catch(_){ }
												for (const p of list){
													const tr = document.createElement('tr'); tr.style.cursor='pointer';
													const tdNE = document.createElement('td'); tdNE.textContent = p.numeroEconomico || '';
													const tdNom = document.createElement('td'); tdNom.textContent = p.nombre || '';
													const tdEst = document.createElement('td');
													const badge = document.createElement('span');
													const active = !!p.enTrimestre;
													badge.className = active ? 'badge bg-success' : 'badge bg-secondary';
													badge.textContent = active ? 'Activo' : 'Inactivo';
													tdEst.appendChild(badge);
													tr.appendChild(tdNE); tr.appendChild(tdNom); tr.appendChild(tdEst);
													tr.addEventListener('click', async ()=>{
														try{
															// 3) Si está inactivo, incluirlo (genera preferencias genéricas)
															if (!active){
																const bodyInc = new URLSearchParams();
																bodyInc.append('idProfesor', String(p.idProfesor));
																bodyInc.append('idTrimestre', String(ID_TRIM));
																bodyInc.append('action', 'include');
																const rInc = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyInc.toString() });
																const jInc = await rInc.json().catch(()=>null);
																if (!rInc.ok || !jInc || jInc.ok !== true) throw new Error((jInc && (jInc.error||jInc.msg)) ? (jInc.error||jInc.msg) : 'No se pudo activar al profesor');
															}
															// 4) Si el grupo ya tiene un profesor distinto asignado, pedir quitarlo antes de agregar la preferencia
															try{
																if (asg && asg.idProfesor && String(asg.idProfesor) !== String(p.idProfesor)){
																	const txt = 'El grupo ' + (g.claveGrupo || '') + ' está asignado a ' + (asg.profesor || asg.nombre || ('NE ' + (asg.numeroEconomico || ''))) + 
																		'. Se quitará esa asignación antes de agregar la preferencia. ¿Continuar?';
																	const okDel = await compatConfirm({ title: 'Quitar asignación previa', text: txt, showCancelButton: true });
																	if (!okDel) return;
																	// eliminar asignación previa por claveGrupo
																	const delBody = new URLSearchParams();
																	delBody.append('idTrimestre', String(ID_TRIM));
																	delBody.append('idProfesor', String(asg.idProfesor));
																	delBody.append('claveGrupo', String(g.claveGrupo || g.clave || ''));
																	const delResp = await fetch('./controlador/quitarProgramacionProfesorGrupo.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: delBody.toString() });
																	const delJ = await delResp.json().catch(()=>null);
																	if (!delResp.ok || !delJ || delJ.ok !== true){ throw new Error((delJ && delJ.msg) ? delJ.msg : 'No se pudo quitar la asignación previa'); }
																	// actualizar la vista local inmediata
																	try{ tdEco.textContent = '—'; tdNom.textContent = '—'; }catch(_e){}
																}
															} catch(errDel){ swalErr('No se pudo eliminar la asignación previa: ' + (errDel && errDel.message ? errDel.message : errDel)); return; }

															// 5) Agregar UEA a prioridad 0 para ese profesor
															const body = new URLSearchParams();
															body.append('idTrimestre', String(ID_TRIM));
															body.append('claveUEA', String(u.claveUEA));
															body.append('numeroEconomico', String(p.numeroEconomico || ''));
															body.append('prioridad', '0');
															const resp = await fetch('./controlador/agregarProfesorUEAPrioridad.php', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
															const j = await resp.json().catch(()=>null);
															if (!resp.ok || !j || j.ok !== true) throw new Error((j && j.error) ? j.error : ('HTTP ' + resp.status));
															// 5) Refrescar prioridades y estructuras relacionadas en vista
															// Obtener prioridades de la UEA y datos auxiliares actualizados
															const [pNew, assignResp2, prefH2, progDetNew] = await Promise.all([
																localFetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: u.claveUEA }),
																localFetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM }),
																localFetchJSON('./controlador/recuperarPreferenciasHorariosTrimestre.php', { idTrimestre: ID_TRIM }),
																localFetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM })
															]);
															if (!pNew || !pNew.ok) throw new Error('No se pudo recargar preferencias');
															// reconstruir asignMapByGrupo
															const asignMapByGrupo2 = new Map();
															if (assignResp2 && assignResp2.ok && Array.isArray(assignResp2.asignaciones)){
																for (const a of assignResp2.asignaciones){ if (a && (a.idGrupo || a.idGrupo === 0)) asignMapByGrupo2.set(String(a.idGrupo), a); }
															}
															// reconstruir prefMapByProf a partir de prefH2
															const prefMapByProf2 = new Map();
															try{
																const rows = Array.isArray(prefH2 && prefH2.horarios) ? prefH2.horarios : [];
																const toM = t => { const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
																const normalizeDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
																for (const r of rows){ const pid = parseInt(r.idProfesor,10); const d = normalizeDay(r.dia||''); if (!prefMapByProf2.has(pid)) prefMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m = prefMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
																const merge = (list)=>{ if(!list||!list.length) return []; list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last=out[out.length-1]; if (s<=last[1]) last[1]=Math.max(last[1],f); else out.push([s,f]); } return out; };
																for (const m of prefMapByProf2.values()){ m.lunes=merge(m.lunes); m.martes=merge(m.martes); m.miercoles=merge(m.miercoles); m.jueves=merge(m.jueves); m.viernes=merge(m.viernes); }
															}catch(_e){}
															// reconstruir progMapByProf a partir de progDetNew
															const progMapByProf2 = new Map();
															try{
																const rows = Array.isArray(progDetNew && progDetNew.programacion) ? progDetNew.programacion : [];
																const toM = t => { const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
																const normalizeDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
																for (const r of rows){ const pid = parseInt(r.idProfesor,10); const d = normalizeDay(r.dia||''); if (!progMapByProf2.has(pid)) progMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m = progMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
															}catch(_e){}
															// finalmente reconstruir la vista con datos frescos
															buildPreferenciasTable(grupos, pNew.prioridades, asignMapByGrupo2, prefMapByProf2, progMapByProf2);
															Swal.close();
														}catch(err){ swalErr(err && err.message ? err.message : 'No se pudo agregar a prioridad 0'); }
													});
													tbody.appendChild(tr);
												}
											}
											function doFilter(){
												const q = (input.value || '').toLowerCase().trim();
												if (!q) { renderRows(availableProfs); return; }
												const out = availableProfs.filter(pp => {
													const ne = String(pp.numeroEconomico || '').toLowerCase();
													const nom = String(pp.nombre || '').toLowerCase();
													return ne.includes(q) || nom.includes(q);
												});
												renderRows(out);
											}
											// Excluir profesores que ya tienen la UEA en sus preferencias
											const existingNEs = new Set();
											try{
												for (let pi=0; pi<=5; pi++){
													const arr = (prioridades && prioridades[pi]) ? prioridades[pi] : [];
													for (const pp of arr){ if (pp && (pp.numeroEconomico || pp.numeroEconomico===0)) existingNEs.add(String(pp.numeroEconomico)); }
												}
											}catch(_e){}
											// Excluir profesores que ya tienen la UEA en sus preferencias
											// y también excluir profesores cuya programación en el trimestre
											// traslape con los horarios del grupo `g`.
											const availableProfs = (profesores || []).filter(pf => {
												if (existingNEs.has(String(pf.numeroEconomico))) return false;
												try{
													// Compruebe traslapes usando el mapa de programación por profesor
													// `progMapByProf` viene del scope exterior de buildPreferenciasTable
													const pid = parseInt(pf.idProfesor, 10);
													const progMap = (typeof progMapByProf !== 'undefined' && progMapByProf && typeof progMapByProf.get === 'function') ? progMapByProf.get(pid) : null;
													// gDay existe en el scope (se construyó antes para esta fila)
													const groupDayMap = gDay || (typeof buildGroupDayMap === 'function' ? buildGroupDayMap(g) : null);
													if (progMap && groupDayMap){
														// Para cada intervalo del grupo, si hay traslape con la programación del profesor, excluirlo
														const dias = ['lunes','martes','miercoles','jueves','viernes'];
														for (const d of dias){
															const intervals = groupDayMap[d] || [];
															if (!intervals || !intervals.length) continue;
															for (const [s,f] of intervals){
																if (typeof hasOverlap === 'function'){
																	if (hasOverlap(progMap, d, s, f)) return false;
																} else {
																	// Fallback: comparar por minutos localmente
																	const toMin = t => { const p = String(t||'').split(':'); return (parseInt(p[0]||'0',10)*60) + (parseInt(p[1]||'0',10) || 0); };
																	const sMin = s, fMin = f;
																	const arr = progMap[d] || [];
																	for (const [pi,pf_] of arr){ if (pi < fMin && sMin < pf_) return false; }
																}
															}
														}
													}
												}catch(_e){ /* si falla la validación, mantener al profesor (no excluir) */ }
												return true;
											});
											renderRows(availableProfs);
											input.addEventListener('input', doFilter);
										 }
									});
								} else {
									// Fallback sin SweetAlert2: usar prompt como antes
									const input = prompt('Número económico del profesor a agregar a prioridad 0:');
									if (!input) return;
									const body = new URLSearchParams();
									body.append('idTrimestre', String(ID_TRIM));
									body.append('claveUEA', String(u.claveUEA));
									body.append('numeroEconomico', String(input));
									body.append('prioridad', '0');
									const resp = await fetch('./controlador/agregarProfesorUEAPrioridad.php', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
									const j = await resp.json().catch(()=>null);
									if (!resp.ok || !j || j.ok !== true) throw new Error((j && j.error) ? j.error : ('HTTP ' + resp.status));
									// Re-fetch preferencias y estructuras relacionadas para refrescar la vista
									const [pNew, assignResp2, prefH2, progDetNew] = await Promise.all([
										localFetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: u.claveUEA }),
										localFetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM }),
										localFetchJSON('./controlador/recuperarPreferenciasHorariosTrimestre.php', { idTrimestre: ID_TRIM }),
										localFetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM })
									]);
									if (!pNew || !pNew.ok) throw new Error('No se pudo recargar preferencias');
									const asignMapByGrupo2 = new Map();
									if (assignResp2 && assignResp2.ok && Array.isArray(assignResp2.asignaciones)){
										for (const a of assignResp2.asignaciones){ if (a && (a.idGrupo || a.idGrupo === 0)) asignMapByGrupo2.set(String(a.idGrupo), a); }
									}
									const prefMapByProf2 = new Map();
									try{
										const rows = Array.isArray(prefH2 && prefH2.horarios) ? prefH2.horarios : [];
										const toM = t => { const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
										const normalizeDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
										for (const r of rows){ const pid = parseInt(r.idProfesor,10); const d = normalizeDay(r.dia||''); if (!prefMapByProf2.has(pid)) prefMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m = prefMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
										const merge = (list)=>{ if(!list||!list.length) return []; list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last=out[out.length-1]; if (s<=last[1]) last[1]=Math.max(last[1],f); else out.push([s,f]); } return out; };
										for (const m of prefMapByProf2.values()){ m.lunes=merge(m.lunes); m.martes=merge(m.martes); m.miercoles=merge(m.miercoles); m.jueves=merge(m.jueves); m.viernes=merge(m.viernes); }
									}catch(_e){}
									const progMapByProf2 = new Map();
									try{
										const rows = Array.isArray(progDetNew && progDetNew.programacion) ? progDetNew.programacion : [];
										const toM = t => { const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
										const normalizeDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
										for (const r of rows){ const pid = parseInt(r.idProfesor,10); const d = normalizeDay(r.dia||''); if (!progMapByProf2.has(pid)) progMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m = progMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
									}catch(_e){}
									buildPreferenciasTable(grupos, pNew.prioridades, asignMapByGrupo2, prefMapByProf2, progMapByProf2);
								}
							} catch(e){ swalErr(e && e.message ? e.message : 'No se pudo agregar a prioridad 0'); }
						});
						td.appendChild(btnAdd);
					}
					if (Array.isArray(list) && list.length){
						for (const prof of list){
							const b = document.createElement('button'); b.type='button'; b.className='btn btn-outline-primary btn-sm priority-chip me-1'; b.textContent = prof.nombre || ('NE ' + (prof.numeroEconomico||''));
							b.title = (prof.numeroEconomico ? ('NE ' + prof.numeroEconomico + ' - ') : '') + (prof.nombre || '');
							b.addEventListener('click', async ()=>{
								const pid = parseInt(prof.idProfesor,10);
								if (assignedProfId && pid === assignedProfId){ if (typeof Swal !== 'undefined' && Swal.fire){ Swal.fire('Aviso','Este profesor ya está asignado a este grupo.','info'); } else { alert('Este profesor ya está asignado a este grupo.'); } return; }
								const proceedAssign = async ()=>{
									try{
										const body = new URLSearchParams();
										body.append('idTrimestre', String(ID_TRIM));
										body.append('idProfesor', String(pid));
										body.append('idGrupo', String(g.idGrupo));
										const resp = await fetch('./controlador/asignarGrupoProfesor.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
										const jr = await resp.json().catch(()=>null);
										if (!resp.ok){
											if (jr && jr.code === 'overlap' && Array.isArray(jr.conflicts)){
												const html = (typeof buildOverlapHtml === 'function') ? buildOverlapHtml(jr.conflicts) : 'Conflictos detectados con la programación actual.';
												if (typeof Swal !== 'undefined' && Swal.fire){ Swal.fire({ title:'Traslape de horario', html, icon:'warning'}); } else { alert('Traslape de horario'); }
												return;
											}
											throw new Error((jr && jr.msg) ? jr.msg : ('HTTP '+resp.status));
										}
										// Recargar asignaciones y programación para refrescar filtros y NE/Nombre
										const [assignResp2, progDetNew] = await Promise.all([
											localFetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM }),
											localFetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM })
										]);
										const asignMapByGrupo2 = new Map();
										if (assignResp2 && assignResp2.ok && Array.isArray(assignResp2.asignaciones)){
											for (const a of assignResp2.asignaciones){ if (a && (a.idGrupo || a.idGrupo === 0)) asignMapByGrupo2.set(String(a.idGrupo), a); }
										}
										const progMapByProf2 = new Map();
										try{ const rows = Array.isArray(progDetNew && progDetNew.programacion) ? progDetNew.programacion : []; const toM=t=>{ const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); }; const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); for (const r of rows){ const p2=parseInt(r.idProfesor,10); const d=norm(r.dia||''); if (!progMapByProf2.has(p2)) progMapByProf2.set(p2,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m=progMapByProf2.get(p2); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); } }catch(_e){}
										// Reusar mismas prioridades y prefMapByProf actuales
										buildPreferenciasTable(grupos, prioridades, asignMapByGrupo2, prefMapByProf, progMapByProf2);
										Swal && Swal.fire ? Swal.fire('Listo','Profesor asignado al grupo','success') : alert('Profesor asignado');
									} catch(err){ swalErr(err && err.message ? err.message : 'No se pudo asignar el profesor'); }
								};
								if (assignedProfId && assignedProfId !== pid){
									const detalle = document.createElement('div'); detalle.className='swal-uea-details';
									const ueaNombre = (u && (u.nombre ?? u.nombreUEA ?? u.UEA)) || '';
									const p1 = document.createElement('p');
									const lbl1 = document.createElement('span'); lbl1.className = 'label'; lbl1.textContent = 'UEA:';
									p1.appendChild(lbl1);
									p1.appendChild(document.createTextNode(' ' + (u.claveUEA || '') + ' - ' + ueaNombre));
									detalle.appendChild(p1);

									const p2 = document.createElement('p');
									const lbl2 = document.createElement('span'); lbl2.className = 'label'; lbl2.textContent = 'Grupo:';
									p2.appendChild(lbl2);
									p2.appendChild(document.createTextNode(' ' + (g.claveGrupo || '')));
									detalle.appendChild(p2);

									const p3 = document.createElement('p');
									const lbl3 = document.createElement('span'); lbl3.className = 'label'; lbl3.textContent = 'Profesor actual:';
									p3.appendChild(lbl3);
									p3.appendChild(document.createTextNode(' ' + (asg.profesor || '') + ' (' + (asg.numeroEconomico || '') + ')'));
									detalle.appendChild(p3);

									const p4 = document.createElement('p');
									const lbl4 = document.createElement('span'); lbl4.className = 'label'; lbl4.textContent = 'Nuevo profesor:';
									p4.appendChild(lbl4);
									p4.appendChild(document.createTextNode(' ' + (prof.nombre || '') + ' (' + (prof.numeroEconomico || '') + ')'));
									detalle.appendChild(p4);
									if (Swal && Swal.fire){
										Swal.fire({
											title: 'Reemplazar profesor asignado',
											html: detalle,
											icon: 'warning',
											showCancelButton: true,
											confirmButtonText: 'Sí, reemplazar',
											cancelButtonText: 'No'
										}).then(r => { if (r && r.isConfirmed) proceedAssign(); });
									} else {
										const ok = confirm('El grupo ya tiene profesor asignado. Si continúas, se reemplazará por el nuevo.');
										if (ok) proceedAssign();
									}
								} else {
									proceedAssign();
								}
							});
							td.appendChild(b);
						}
					} else {
						const span = document.createElement('span'); span.className='text-muted'; span.textContent='—'; td.appendChild(span);
					}
					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}
			tblWrap.appendChild(table); subContent.appendChild(tblWrap);
		}

		// Cargar datos y renderizar por defecto la vista "Preferencias de profesor"
		// Helper local para llamadas POST con x-www-form-urlencoded (evita depender de fetchJSON en otro scope)
		async function localFetchJSON(url, data){
			const form = new URLSearchParams();
			if (data && typeof data === 'object'){
				Object.keys(data).forEach(k=>{ if (data[k] !== undefined && data[k] !== null) form.append(k, data[k]); });
			}
			const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
			if (!res.ok) throw new Error('HTTP '+res.status);
			return res.json();
		}
		(async ()=>{
			try{
				const normalizeDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
				// Grupos con horarios de la UEA
				const gruposResp = await localFetchJSON('./controlador/recuperarGruposUEATrimestre.php', { idTrimestre: ID_TRIM, claveUEA: (u.claveUEA||'') });
				const grupos = (gruposResp && gruposResp.ok && Array.isArray(gruposResp.grupos)) ? gruposResp.grupos : [];
				// Asignaciones por trimestre (para columnas NE y Nombre)
				let asignMapByGrupo = new Map();
				try{
					const assignResp = await localFetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM });
					if (assignResp.ok && Array.isArray(assignResp.asignaciones)){
						for (const a of assignResp.asignaciones){ if (a && (a.idGrupo || a.idGrupo === 0)) asignMapByGrupo.set(String(a.idGrupo), a); }
					}
				} catch(_e){ asignMapByGrupo = new Map(); }
				// Preferencias por prioridad y mapas de horarios (preferencias + programación) en paralelo
				const [prefResp, prefH, progDet] = await Promise.all([
					localFetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: (u.claveUEA||'') }),
					localFetchJSON('./controlador/recuperarPreferenciasHorariosTrimestre.php', { idTrimestre: ID_TRIM }),
					localFetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM })
				]);
				if (!prefResp || !prefResp.ok){ throw new Error(prefResp && prefResp.error ? prefResp.error : 'No se pudieron cargar preferencias de UEA'); }
				const prefMapByProf = new Map();
				try{
					const rows = Array.isArray(prefH && prefH.horarios) ? prefH.horarios : [];
					const toM=t=>{ const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
					for (const r of rows){ const pid=parseInt(r.idProfesor,10); const d=normalizeDay(r.dia||''); if (!prefMapByProf.has(pid)) prefMapByProf.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m=prefMapByProf.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
					const merge=(list)=>{ if(!list||!list.length) return []; list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last=out[out.length-1]; if (s<=last[1]) last[1]=Math.max(last[1],f); else out.push([s,f]); } return out; };
					for (const m of prefMapByProf.values()){ m.lunes=merge(m.lunes); m.martes=merge(m.martes); m.miercoles=merge(m.miercoles); m.jueves=merge(m.jueves); m.viernes=merge(m.viernes); }
				} catch(_e){}
				const progMapByProf = new Map();
				try{
					const rows = Array.isArray(progDet && progDet.programacion) ? progDet.programacion : [];
					const toM=t=>{ const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); };
					for (const r of rows){ const pid=parseInt(r.idProfesor,10); const d=normalizeDay(r.dia||''); if (!progMapByProf.has(pid)) progMapByProf.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m=progMapByProf.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); }
				} catch(_e){}
				buildPreferenciasTable(grupos, prefResp.prioridades || {}, asignMapByGrupo, prefMapByProf, progMapByProf);
				// Eventos del submenú
				btnSubPref.addEventListener('click', async ()=>{
					try{ const [res, prefH2, progDet2] = await Promise.all([
						localFetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: (u.claveUEA||'') }),
						localFetchJSON('./controlador/recuperarPreferenciasHorariosTrimestre.php', { idTrimestre: ID_TRIM }),
						localFetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM })
					]);
					const prefMapByProf2 = new Map();
					try{ const rows = Array.isArray(prefH2 && prefH2.horarios) ? prefH2.horarios : []; const toM=t=>{ const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); }; for (const r of rows){ const pid=parseInt(r.idProfesor,10); const d=normalizeDay(r.dia||''); if (!prefMapByProf2.has(pid)) prefMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m=prefMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); } const merge=(list)=>{ if(!list||!list.length) return []; list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last=out[out.length-1]; if (s<=last[1]) last[1]=Math.max(last[1],f); else out.push([s,f]); } return out; }; for (const m of prefMapByProf2.values()){ m.lunes=merge(m.lunes); m.martes=merge(m.martes); m.miercoles=merge(m.miercoles); m.jueves=merge(m.jueves); m.viernes=merge(m.viernes);} }catch(_e){}
					const progMapByProf2 = new Map();
					try{ const rows = Array.isArray(progDet2 && progDet2.programacion) ? progDet2.programacion : []; const toM=t=>{ const [h,mm]=String(t).split(':'); return (parseInt(h||'0',10)*60)+(parseInt(mm||'0',10)); }; for (const r of rows){ const pid=parseInt(r.idProfesor,10); const d=normalizeDay(r.dia||''); if (!progMapByProf2.has(pid)) progMapByProf2.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]}); const m=progMapByProf2.get(pid); if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]); } }catch(_e){}
					if (res && res.ok) buildPreferenciasTable(grupos, res.prioridades||{}, asignMapByGrupo, prefMapByProf2, progMapByProf2); else swalErr('No se pudieron cargar preferencias');
					} catch(e){ swalErr('No se pudieron cargar preferencias'); }
					btnSubPref.className='btn btn-primary'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubLibre.className='btn btn-outline-secondary';
				});
				btnSubImpartido.addEventListener('click', async ()=>{
					// Profesores que han impartido la UEA - implementado
					try{
						clearChildren(subContent);
						const wrap = document.createElement('div'); wrap.className = 'table-responsive uea-impartido-wrap';
						// Table: Grupo | Lunes..Viernes | NE | Nombre | Trimestre
						const tbl = document.createElement('table'); tbl.className = 'table table-sm table-bordered uea-impartido-table';
						const thead = document.createElement('thead'); thead.className = 'uea-impartido-thead';
						const trh = document.createElement('tr');
						['Grupo','Lunes','Martes','Miércoles','Jueves','Viernes','Número económico','Nombre','Trimestre'].forEach(h=>{
							const th = document.createElement('th');
							th.textContent = h;
							trh.appendChild(th);
						});
						thead.appendChild(trh); tbl.appendChild(thead);
						const tbody2 = document.createElement('tbody'); tbl.appendChild(tbody2);
						wrap.appendChild(tbl);
						subContent.appendChild(wrap);

						// Fetch groups of this UEA for the current trimestre
						const params = new URLSearchParams(); params.append('idTrimestre', String(ID_TRIM)); params.append('claveUEA', String(u.claveUEA));
						const gruposResp = await fetch('./controlador/recuperarGruposUEATrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: params.toString() });
						const gruposJ = await gruposResp.json().catch(()=>null);
						const grupos = (gruposJ && gruposJ.ok && Array.isArray(gruposJ.grupos)) ? gruposJ.grupos : [];

						// Obtener asignaciones del trimestre actual para mostrar NE/Nombre
						const assignResp = await fetch('./controlador/recuperarAsignacionPorTrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: (new URLSearchParams({ idTrimestre: String(ID_TRIM) })).toString() });
						const assignJ = await assignResp.json().catch(()=>null);
						const asignMap = new Map(); if (assignJ && assignJ.ok && Array.isArray(assignJ.asignaciones)){ for (const a of assignJ.asignaciones){ if (a && (a.idGrupo || a.idGrupo===0)) asignMap.set(String(a.idGrupo), a); } }

						// Obtener trimestres con programación para esta UEA (nuevo endpoint específico)
						const trimsForm = new URLSearchParams(); trimsForm.append('claveUEA', String(u.claveUEA));
						const trimsResp = await fetch('./controlador/recuperarTrimestresProgramacionUEA.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: trimsForm.toString() });
						const trimsJ = await trimsResp.json().catch(()=>null);
						const ueatrims = (trimsJ && trimsJ.ok && Array.isArray(trimsJ.trimestres)) ? trimsJ.trimestres : [];
						// Construir lista de trimestres disponibles (excluyendo el trimestre actual) y mapa de profesores por trimestre
						const availableTrims = ueatrims
							.filter(t => Number(t.idTrimestre) !== Number(ID_TRIM))
							.map(t => ({ idTrimestre: t.idTrimestre, label: t.trimestre }));
						const trimProfMap = new Map();
						for (const t of ueatrims){
							const profMap = new Map();
							const gruposT = Array.isArray(t.grupos) ? t.grupos : [];
							for (const g2 of gruposT){
								const pinfo = g2 && g2.profesor ? g2.profesor : null;
								if (!pinfo || !pinfo.idProfesor) continue;
								const pid = parseInt(pinfo.idProfesor, 10);
								if (!profMap.has(pid)){
									profMap.set(pid, { idProfesor: pid, numeroEconomico: pinfo.numeroEconomico || '', nombre: pinfo.nombre || '' });
								}
							}
							trimProfMap.set(String(t.idTrimestre), profMap);
						}

						// Construir mapa de programación actual (trimestre activo) por profesor para detección de traslapes
						let currentProgMapByProf = new Map();
						try {
							const progDetResp = await fetch('./controlador/recuperarProgramacionDetalladaTrimestre.php', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:(new URLSearchParams({ idTrimestre:String(ID_TRIM) })).toString() });
							const progDetJ = await progDetResp.json().catch(()=>null);
							const rows = (progDetJ && progDetJ.ok && Array.isArray(progDetJ.programacion)) ? progDetJ.programacion : [];
							const toM = t => { const p=String(t).split(':'); return (parseInt(p[0]||'0',10)*60)+parseInt(p[1]||'0',10); };
							const normDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
							for (const r of rows){
								const pid = parseInt(r.idProfesor,10); if (!pid) continue;
								const d = normDay(r.dia||'');
								if (!currentProgMapByProf.has(pid)) currentProgMapByProf.set(pid,{lunes:[],martes:[],miercoles:[],jueves:[],viernes:[]});
								const m = currentProgMapByProf.get(pid);
								if (m[d]) m[d].push([toM((r.horaInicio||'').slice(0,5)), toM((r.horaFin||'').slice(0,5))]);
							}
							// unir intervalos traslapados por día para cada profesor
							const merge = list => { if(!list||!list.length) return []; list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const out=[[list[0][0],list[0][1]]]; for(let i=1;i<list.length;i++){ const [s,f]=list[i]; const last=out[out.length-1]; if (s<=last[1]) last[1]=Math.max(last[1],f); else out.push([s,f]); } return out; };
							for (const m of currentProgMapByProf.values()){ m.lunes=merge(m.lunes); m.martes=merge(m.martes); m.miercoles=merge(m.miercoles); m.jueves=merge(m.jueves); m.viernes=merge(m.viernes); }
						} catch(e){ currentProgMapByProf = new Map(); }

						// Helper to format horarios per day
						const diaOrder = ['lunes','martes','miercoles','jueves','viernes'];
						function horariosPorDiaText(horarios, dia){
							const arr = (horarios||[]).filter(hh => String(hh.dia).toLowerCase() === String(dia).toLowerCase()).map(hh => `${hh.horaInicio.slice(0,5)}-${hh.horaFin.slice(0,5)}`);
							return arr.join(', ');
						}

						// Track open professor button container to clear when another select changes
						let currentProfButtonsContainer = null;

						for (const g of grupos){
							const tr = document.createElement('tr');
							// Grupo
							const tdG = document.createElement('td'); tdG.textContent = g.claveGrupo || (g.idGrupo || ''); tr.appendChild(tdG);
							// Lunes..Viernes
							for (const d of diaOrder){ const td = document.createElement('td'); td.textContent = horariosPorDiaText(g.horarios, d); tr.appendChild(td); }
							// NE, Nombre from asignMap
							const asg = asignMap.get(String(g.idGrupo));
							const tdNE = document.createElement('td'); tdNE.textContent = (asg && (asg.numeroEconomico||asg.numeroEconomico===0)) ? String(asg.numeroEconomico) : '—'; tr.appendChild(tdNE);
							const tdNom = document.createElement('td'); tdNom.textContent = (asg && (asg.profesor || asg.nombre)) ? (asg.profesor || asg.nombre) : '—'; tr.appendChild(tdNom);
							// Trimestre select cell - render a button and only create the select on demand
							const tdTrim = document.createElement('td');
							const btnShow = document.createElement('button'); btnShow.type='button'; btnShow.className='btn btn-sm btn-outline-secondary'; btnShow.textContent = 'Seleccionar trimestre';
							tdTrim.appendChild(btnShow);
							// container for professor buttons (below select)
							const profWrap = document.createElement('div'); profWrap.className = 'prof-buttons-wrap mt-2'; tdTrim.appendChild(profWrap);
							tr.appendChild(tdTrim);

							// create select lazily when user presses the button
							btnShow.addEventListener('click', async function(){
								try{
									// if select already exists, focus it
									if (tdTrim.querySelector('select')){ tdTrim.querySelector('select').focus(); return; }
									// build select
									const sel = document.createElement('select'); sel.className = 'form-select form-select-sm trim-select';
									const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent = 'Seleccione trimestre'; sel.appendChild(opt0);
									for (const t of availableTrims){ const o = document.createElement('option'); o.value = String(t.idTrimestre); o.textContent = t.label || String(t.idTrimestre); sel.appendChild(o); }
									// replace button with select
									tdTrim.replaceChild(sel, btnShow);
									sel.focus();

									sel.addEventListener('change', async function(){
										try{
											// clear previous open container if different
											if (currentProfButtonsContainer && currentProfButtonsContainer !== profWrap){ currentProfButtonsContainer.innerHTML = ''; }
											currentProfButtonsContainer = profWrap;
											profWrap.innerHTML = '';
											const val = this.value;
											if (!val) return;
											// profesores distintos de esta UEA en el trimestre seleccionado (desde el endpoint nuevo)
											const profMap = trimProfMap.get(String(val)) || new Map();
											if (profMap.size === 0){ const none = document.createElement('div'); none.className='text-muted'; none.textContent='No hay profesores en ese trimestre'; profWrap.appendChild(none); return; }
											// create buttons
											// Filtrar profesores que NO tengan traslapes con la programación actual del trimestre
											const visibleProfs = [];
											for (const [pid, pinfo] of profMap.entries()){
												let hasConflict = false;
												try {
													const progM = currentProgMapByProf.get(pid);
													if (progM && Array.isArray(g.horarios)){
														const toM = t => { const p=String(t).split(':'); return (parseInt(p[0]||'0',10)*60)+parseInt(p[1]||'0',10); };
														const normDay = s => String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
														for (const h of g.horarios){
															const d = normDay(h.dia||'');
															const s = toM((h.horaInicio||'').slice(0,5));
															const f = toM((h.horaFin||'').slice(0,5));
															const intervals = progM[d] || [];
															for (const [si,fi] of intervals){ if (si < f && s < fi){ hasConflict = true; break; } }
															if (hasConflict) break;
														}
													}
												} catch(_e){ hasConflict = false; }
												if (!hasConflict) visibleProfs.push({ pid, pinfo });
											}
											if (visibleProfs.length === 0){ const none = document.createElement('div'); none.className='text-muted'; none.textContent='No hay profesores disponibles sin traslapes en ese trimestre'; profWrap.appendChild(none); return; }
											for (const item of visibleProfs){
												const pinfo = item.pinfo;
												const btn = document.createElement('button'); btn.type='button'; btn.className='btn btn-sm btn-outline-primary me-1 mb-1'; btn.textContent = (pinfo.numeroEconomico ? ('NE ' + pinfo.numeroEconomico + ' - ') : '') + (pinfo.nombre || 'Profesor');
												btn.addEventListener('click', async ()=>{
													try{
														btn.disabled = true;
															// Si ya existe otra asignación para este grupo, pedir confirmación
															const existingAssign = asignMap.get(String(g.idGrupo)) || null;
															if (existingAssign && existingAssign.idProfesor && Number(existingAssign.idProfesor) !== Number(pinfo.idProfesor)){
																const curName = existingAssign.profesor || (existingAssign.numeroEconomico ? ('NE ' + existingAssign.numeroEconomico) : 'Otro profesor');
																const newName = pinfo ? (pinfo.nombre || ('NE ' + pinfo.numeroEconomico)) : 'Profesor';
																const confirmReplace = await compatConfirm({ title: 'Reemplazar asignación', text: `El grupo ya está asignado a ${curName}. ¿Deseas quitar esa asignación y asignar a ${newName}?`, showCancelButton: true });
																if (!confirmReplace){ btn.disabled = false; return; }
																// Quitar la programación del profesor actual para este grupo en el trimestre
																try{
																	const delBody = new URLSearchParams();
																	delBody.append('idTrimestre', String(ID_TRIM));
																	// preferir idProfesor numérico
																	delBody.append('idProfesor', String(existingAssign.idProfesor));
																	// enviar claveGrupo para identificar el grupo
																	delBody.append('claveGrupo', String(g.claveGrupo || g.clave || ''));
																	const delResp = await fetch('./controlador/quitarProgramacionProfesorGrupo.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: delBody.toString() });
																	const delJ = await delResp.json().catch(()=>null);
																	if (!delResp.ok || !delJ || delJ.ok !== true){ throw new Error((delJ && delJ.msg) ? delJ.msg : 'No se pudo quitar la asignación previa'); }
																	// Actualizar mapa local para evitar mostrar al profesor eliminado en la UI inmediata
																	try{ asignMap.delete(String(g.idGrupo)); tdNE.textContent = '—'; tdNom.textContent = '—'; }catch(_e){}
																} catch(errDel){ swalErr('No se pudo eliminar la asignación previa: ' + (errDel && errDel.message ? errDel.message : errDel)); btn.disabled = false; return; }
															}

															// ensure professor is included in current trimestre before assigning
															const bodyInc = new URLSearchParams(); bodyInc.append('idProfesor', String(pinfo.idProfesor)); bodyInc.append('idTrimestre', String(ID_TRIM)); bodyInc.append('action', 'include');
															const incResp = await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyInc.toString() });
															const incJ = await incResp.json().catch(()=>null);
															if (!incResp.ok || !incJ || incJ.ok !== true){ /* ignore include errors if already included */ }

															// Asegurar que la UEA esté en las preferencias del profesor para este trimestre (prioridad 0)
															try{
																const prefResp = await fetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: (u.claveUEA||'') });
																let already = false;
																if (prefResp && prefResp.ok && prefResp.prioridades){
																	for (let pri=0; pri<=5; pri++){
																		const arr = Array.isArray(prefResp.prioridades[pri]) ? prefResp.prioridades[pri] : [];
																		for (const pp of arr){
																			if (!pp) continue;
																			if (pp.numeroEconomico && pinfo.numeroEconomico && String(pp.numeroEconomico) === String(pinfo.numeroEconomico)){ already = true; break; }
																			if (pp.idProfesor && pinfo.idProfesor && String(pp.idProfesor) === String(pinfo.idProfesor)){ already = true; break; }
																		}
																		if (already) break;
																	}
																}
																if (!already){
																	const bodyAdd = new URLSearchParams();
																	bodyAdd.append('idTrimestre', String(ID_TRIM));
																	bodyAdd.append('claveUEA', String(u.claveUEA || u.clave || ''));
																	bodyAdd.append('numeroEconomico', String(pinfo.numeroEconomico || ''));
																	bodyAdd.append('prioridad', '0');
																	const addResp = await fetch('./controlador/agregarProfesorUEAPrioridad.php', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyAdd.toString() });
																	const addJ = await addResp.json().catch(()=>null);
																	if (!addResp.ok || !addJ || addJ.ok !== true){ throw new Error((addJ && (addJ.error||addJ.msg)) ? (addJ.error||addJ.msg) : 'No se pudo agregar la UEA a preferencias'); }
																}
															} catch(e){ swalErr((e && e.message) ? e.message : 'No se pudo validar/agregar preferencias'); return; }
															// now assign professor to this group in current trimestre
															const bodyA = new URLSearchParams(); bodyA.append('idTrimestre', String(ID_TRIM)); bodyA.append('idProfesor', String(pinfo.idProfesor)); bodyA.append('idGrupo', String(g.idGrupo));
															const aResp = await fetch('./controlador/asignarGrupoProfesor.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: bodyA.toString() });
															const aJ = await aResp.json().catch(()=>null);
															if (!aResp.ok){
																if (aJ && aJ.code === 'overlap' && Array.isArray(aJ.conflicts)){
																	const html = (typeof buildOverlapHtml === 'function') ? buildOverlapHtml(aJ.conflicts) : 'Conflictos detectados con la programación actual.';
																	if (typeof Swal !== 'undefined' && Swal.fire){ Swal.fire({ title:'Traslape de horario', html, icon:'warning'}); } else { alert('Traslape de horario'); }
																	return;
																}
																throw new Error((aJ && aJ.msg) ? aJ.msg : ('HTTP '+(aResp.status||'?')));
															}
														// refresh assign map and update row NE/Nombre
														const assignResp2 = await fetch('./controlador/recuperarAsignacionPorTrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: (new URLSearchParams({ idTrimestre: String(ID_TRIM) })).toString() });
														const assignJ2 = await assignResp2.json().catch(()=>null);
														const asignMap2 = new Map(); if (assignJ2 && assignJ2.ok && Array.isArray(assignJ2.asignaciones)){ for (const a of assignJ2.asignaciones){ if (a && (a.idGrupo || a.idGrupo===0)) asignMap2.set(String(a.idGrupo), a); } }
														const newAsg = asignMap2.get(String(g.idGrupo));
														if (newAsg){ tdNE.textContent = (newAsg.numeroEconomico||newAsg.numeroEconomico===0) ? String(newAsg.numeroEconomico) : '—'; tdNom.textContent = (newAsg.profesor || newAsg.nombre) ? (newAsg.profesor || newAsg.nombre) : '—'; }
														if (typeof Swal !== 'undefined' && Swal.fire) Swal.fire('Listo','Profesor asignado al grupo','success'); else alert('Profesor asignado');
													}catch(err){ swalErr(err && err.message ? err.message : 'No se pudo asignar al profesor'); }
													finally{ btn.disabled = false; }
												});
												profWrap.appendChild(btn);
											}
										}catch(err){ const errEl = document.createElement('div'); errEl.className='text-danger'; errEl.textContent = 'Error cargando profesores'; profWrap.appendChild(errEl); }
									});
								}catch(e){ const errEl = document.createElement('div'); errEl.className='text-danger'; errEl.textContent = 'Error creando selector'; profWrap.appendChild(errEl); }
							});

							tbody2.appendChild(tr);
						}

						btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-primary'; btnSubLibre.className='btn btn-outline-secondary';
					}catch(e){ clearChildren(subContent); const err = document.createElement('div'); err.className='text-danger'; err.textContent = (e && e.message) ? e.message : 'Error cargando profesores impartidos'; subContent.appendChild(err); }
				});
				btnSubLibre.addEventListener('click', async ()=>{
					// Render vista 'Libre' para asignar directamente a un grupo
					clearChildren(subContent);
					btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubLibre.className='btn btn-primary';
					const loading = document.createElement('div'); loading.className='text-muted'; loading.textContent='Cargando grupos...'; subContent.appendChild(loading);
					try{
						// obtener grupos de la UEA en el trimestre
						const clave = (u.claveUEA || u.idUEA || u.clave || '');
						const gruposResp = await fetchJSON('./controlador/recuperarGruposUEATrimestre.php', { idTrimestre: ID_TRIM, claveUEA: clave });
						if (!gruposResp.ok){ clearChildren(subContent); const err=document.createElement('div'); err.className='text-danger'; err.textContent='No se pudo recuperar los grupos.'; subContent.appendChild(err); return; }
						const grupos = gruposResp.grupos || [];
						// obtener asignaciones actuales para el trimestre
						const asResp = await fetchJSON('./controlador/recuperarAsignacionPorTrimestre.php', { idTrimestre: ID_TRIM });
						const asignMap = new Map(); if (asResp && asResp.ok && Array.isArray(asResp.asignaciones)){ for (const a of asResp.asignaciones){ if (a && (a.idGrupo || a.idGrupo===0)) asignMap.set(String(a.idGrupo), a); } }
						// asegurar listaProfes cargada (local a este IIFE)
						const profs = await ensureListaProfes();

						// construir tabla
						clearChildren(subContent);
						const tableWrap = document.createElement('div'); tableWrap.className = 'table-responsive';
						const table = document.createElement('table'); table.className = 'table table-sm table-hover align-middle';
						const thead = document.createElement('thead'); thead.className = 'table-dark';
						const trh = document.createElement('tr');
						['Grupo','Lunes','Martes','Miércoles','Jueves','Viernes','Número económico','Nombre','Candidato'].forEach(h=>{ const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
						thead.appendChild(trh); table.appendChild(thead);
						const tbody = document.createElement('tbody');

						function horarioDiaTexto(gr, diaNorm){ if (!gr || !Array.isArray(gr.horarios)) return ''; for (const hh of gr.horarios){ if (String((hh.dia||'')).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'') === diaNorm){ const inicio = (hh.horaInicio||'').slice(0,5); const fin = (hh.horaFin||'').slice(0,5); return inicio && fin ? (inicio + ' - ' + fin) : ''; } } return ''; }

						for (const gr of grupos){
							const tr = document.createElement('tr');
							const tdG = document.createElement('td'); tdG.textContent = (gr.claveGrupo || gr.clave || gr.idGrupo); tr.appendChild(tdG);
							const dias = ['lunes','martes','miercoles','jueves','viernes'];
							for (const d of dias){ const td = document.createElement('td'); td.textContent = horarioDiaTexto(gr, d); tr.appendChild(td); }
							const asg = asignMap.get(String(gr.idGrupo)) || null;
							const tdNE = document.createElement('td'); tdNE.textContent = (asg && (asg.numeroEconomico || asignMap.numeroEconomico===0)) ? String(asg.numeroEconomico) : '—'; tr.appendChild(tdNE);
							const tdNom = document.createElement('td'); tdNom.textContent = (asg && (asg.profesor || asg.nombre)) ? (asg.profesor || asg.nombre) : '—'; tr.appendChild(tdNom);

							// Candidato - buscador y dropdown
							const tdCand = document.createElement('td'); tdCand.style.position='relative';
							const inp = document.createElement('input'); inp.type='text'; inp.className='form-control form-control-sm candidato-search'; inp.placeholder='Buscar profesor...'; tdCand.appendChild(inp);
							const drop = document.createElement('div'); drop.className='list-group position-absolute shadow-sm candidato-list'; drop.style.zIndex='9999'; drop.style.display='none'; drop.style.maxHeight='240px'; drop.style.overflow='auto'; drop.style.width='100%'; tdCand.appendChild(drop);

							let lastTimer = null;
							inp.addEventListener('input', ()=>{
								const q = (inp.value || '').toLowerCase().trim();
								if (lastTimer) clearTimeout(lastTimer);
								lastTimer = setTimeout(()=>{
									drop.innerHTML = '';
									if (!q){ drop.style.display='none'; return; }
									// Excluir el profesor ya asignado al grupo (si existe)
									const assignedId = (asg && (asg.idProfesor || asg.idProfesor === 0)) ? String(asg.idProfesor) : null;
									const assignedNe = (asg && (asg.numeroEconomico || asg.numeroEconomico === 0)) ? String(asg.numeroEconomico) : null;
									const matches = (profs||[]).filter(p => {
										// si este profesor es el ya asignado al grupo, excluirlo
										if (assignedId && String(p.idProfesor) === assignedId) return false;
										if (assignedNe && String(p.numeroEconomico) === assignedNe) return false;
										return (String(p.nombre||'') + ' ' + String(p.numeroEconomico||'')).toLowerCase().indexOf(q) !== -1;
									}).slice(0,10);
									if (!matches.length){ const none = document.createElement('div'); none.className='list-group-item text-muted'; none.textContent='No encontrado'; drop.appendChild(none); drop.style.display='block'; return; }
									for (const p of matches){ const a = document.createElement('button'); a.type='button'; a.className='list-group-item list-group-item-action'; a.textContent = (p.numeroEconomico ? ('NE '+p.numeroEconomico+' - ') : '') + (p.nombre||''); a.addEventListener('click', ()=>{ confirmCandidateAssign(p, gr, tdNE, tdNom, inp, drop); }); drop.appendChild(a); }
									drop.style.display='block';
								}, 180);
							});
							inp.addEventListener('blur', ()=>{ setTimeout(()=>{ drop.style.display='none'; }, 250); });

							tr.appendChild(tdCand);
							tbody.appendChild(tr);
						}

						table.appendChild(tbody); tableWrap.appendChild(table); subContent.appendChild(tableWrap);

						// función para confirmar y asignar
						async function confirmCandidateAssign(prof, grupo, tdNE, tdNom, inp, drop){
							try{
								// obtener programación del profesor en el trimestre
								const progResp = await fetchJSON('./controlador/recuperarProgramacionDetalladaTrimestre.php', { idTrimestre: ID_TRIM, idProfesor: prof.idProfesor });
								const progRows = (progResp && progResp.ok && Array.isArray(progResp.programacion)) ? progResp.programacion : (progResp && Array.isArray(progResp) ? progResp : []);
								// Filtrar sólo las filas del profesor seleccionado (por idProfesor)
								const profRows = progRows.filter(r => String(r.idProfesor || r.id || '') === String(prof.idProfesor));
								const map = new Map();
								for (const r of profRows){
									const key = `${r.claveUEA||r.uea||''}||${r.claveGrupo||r.grupo||''}`;
									if (!map.has(key)) map.set(key, { ueaClave: r.claveUEA||r.uea||'', ueaNombre: r.nombreUEA||r.nombre||'', grupo: r.claveGrupo||r.grupo||'', dias: { lunes:'', martes:'', miercoles:'', jueves:'', viernes:'' }, horarios: [] });
									const rec = map.get(key);
									const dia = String(r.dia||'').toLowerCase();
									if (r.horaInicio && r.horaFin) rec.dias[dia] = (r.horaInicio.slice(0,5) + ' - ' + r.horaFin.slice(0,5));
									// guardar horarios detallados para detección de traslapes
									rec.horarios.push({ dia: dia, horaInicio: (r.horaInicio||'').slice(0,5), horaFin: (r.horaFin||'').slice(0,5), claveGrupo: r.claveGrupo||r.grupo||'' });
								}
								// Construir nodo que mostrará datos del profesor arriba de la tabla
								const headerWrap = document.createElement('div'); headerWrap.className = 'swal-prof-header mb-2 d-flex align-items-center gap-3';
								const infoDiv = document.createElement('div'); infoDiv.className = 'swal-prof-info';
								const hName = document.createElement('div'); hName.className = 'fw-semibold'; hName.textContent = (prof.nombre || '');
								const hNE = document.createElement('div'); hNE.className = 'text-muted small'; hNE.textContent = 'NE: ' + (prof.numeroEconomico || '');
								infoDiv.appendChild(hName); infoDiv.appendChild(hNE);
								headerWrap.appendChild(infoDiv);
								// Crear título del bloque con año y sigla del trimestre (si está disponible)
								let titleText = 'Programación actual';
								try{
									const rTrim = await fetch(`./controlador/recuperarTrimestre.php?trim=${encodeURIComponent(ID_TRIM)}`);
									const jTrim = await rTrim.json().catch(()=>null);
									if (jTrim && jTrim.ok && jTrim.data){
										const year = jTrim.data['año'] || jTrim.data.anio || jTrim.data.year || '';
										const sig = jTrim.data.sigla || jTrim.data.sig || '';
										if (year || sig) titleText = `Programación actual del ${year} - ${sig}`;
									}
								} catch(e){ /* noop */ }

								const titleEl = document.createElement('div'); titleEl.className = 'swal-programacion-title fw-semibold mb-1'; titleEl.textContent = titleText;

								// Construir bloque con datos del grupo que se va a asignar
								const groupDiv = document.createElement('div'); groupDiv.className = 'swal-group-data small text-muted mb-2';
								try{
									const parts = [];
									if (grupo.claveGrupo) parts.push('Grupo: ' + grupo.claveGrupo);
									if (grupo.salon) parts.push('Salón: ' + grupo.salon);
									if (grupo.cupo !== undefined && grupo.cupo !== null) parts.push('Cupo: ' + String(grupo.cupo));
									if (Array.isArray(grupo.horarios) && grupo.horarios.length){
										const hrs = grupo.horarios.map(h => `${h.dia} ${String(h.horaInicio||'').slice(0,5)}-${String(h.horaFin||'').slice(0,5)}`);
										parts.push('Horarios: ' + hrs.join(' | '));
									}
									groupDiv.textContent = parts.join(' · ');
								} catch(e){ groupDiv.textContent = ''; }

								const tbl = document.createElement('table'); tbl.className='table table-sm table-bordered';
								const thead2 = document.createElement('thead'); const trh2 = document.createElement('tr');
								['UEA','Grupo','Lunes','Martes','Miércoles','Jueves','Viernes',''].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh2.appendChild(th); }); thead2.appendChild(trh2); tbl.appendChild(thead2);
								const tbody2 = document.createElement('tbody');
								// Determinar si existe traslape entre la programación del profesor y el grupo objetivo
								function toMinLocal(t){ const p = String(t||'').split(':'); return (parseInt(p[0]||'0',10)*60) + (parseInt(p[1]||'0',10) || 0); }
								const targetIntervalsByDay = {};
								if (Array.isArray(grupo.horarios)){
									for (const hh of grupo.horarios){ const d = String(hh.dia||'').toLowerCase(); if (!targetIntervalsByDay[d]) targetIntervalsByDay[d]=[]; targetIntervalsByDay[d].push({ s: (hh.horaInicio||'').slice(0,5), f: (hh.horaFin||'').slice(0,5) }); }
								}
								for (const v of map.values()){
									const trr = document.createElement('tr');
									const tdU = document.createElement('td'); tdU.textContent = ((v.ueaClave||'') + (v.ueaNombre ? (' - ' + v.ueaNombre) : '')).trim(); trr.appendChild(tdU);
									const tdG = document.createElement('td'); tdG.textContent = v.grupo; trr.appendChild(tdG);
									let hasConflict = false;
									// comprobar cada horario existente del profesor contra intervals del grupo objetivo
									for (const h of (v.horarios || [])){
										const d = h.dia || '';
										const arr = targetIntervalsByDay[d] || [];
										for (const tI of arr){
											if (typeof overlap === 'function'){
												if (overlap(h.horaInicio, h.horaFin, tI.s, tI.f)) { hasConflict = true; break; }
											} else {
												// fallback
												const si = toMinLocal(h.horaInicio); const fi = toMinLocal(h.horaFin); const ti = toMinLocal(tI.s); const tf = toMinLocal(tI.f);
												if (si < tf && ti < fi){ hasConflict = true; break; }
											}
										}
										if (hasConflict) break;
									}
									// celdas por día
									['lunes','martes','miercoles','jueves','viernes'].forEach(d=>{ const td=document.createElement('td'); td.textContent = v.dias[d]||''; trr.appendChild(td); });
									if (hasConflict){
										trr.classList.add('conflict-row');
										const iconTd = document.createElement('td'); iconTd.className = 'text-center conflict-indicator';
										const icon = document.createElement('span'); icon.className = 'conflict-icon'; icon.textContent = '\u26A0'; icon.title = 'Traslape con grupo a asignar';
										iconTd.appendChild(icon);
										trr.appendChild(iconTd);
									} else {
										// mantener la estructura de celdas consistente: añadir celda vacía para la columna de indicador
										const emptyTd = document.createElement('td'); emptyTd.textContent = '';
										trr.appendChild(emptyTd);
									}
									tbody2.appendChild(trr);
								}
								tbl.appendChild(tbody2);
								// Construir contenedor que incluya la información del profesor, los datos del grupo,
								// un separador y la sección de programación (título + tabla)
								const modalContainer = document.createElement('div');
								modalContainer.appendChild(headerWrap);
								// bloque con datos del grupo (separado)
								modalContainer.appendChild(groupDiv);
								// separador visual
								const divider = document.createElement('div'); divider.className = 'swal-divider';
								modalContainer.appendChild(divider);
								// contenedor de la programación: título + tabla
								const programContainer = document.createElement('div'); programContainer.className = 'swal-programacion-wrap';
								programContainer.appendChild(titleEl);
								programContainer.appendChild(tbl);
								modalContainer.appendChild(programContainer);

								// Usar SweetAlert2 con DOM node si está disponible y ampliar ancho
								let confirm;
								if (typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function'){
									confirm = await window.Swal.fire({ title: 'Confirmar asignación', html: modalContainer, width: 900, showCancelButton: true, confirmButtonText: 'Asignar', cancelButtonText: 'Cancelar', customClass: { popup: 'my-swal-popup' } });
									if (confirm && confirm.isConfirmed) confirm = true; else confirm = false;
								} else {
									// Evitar usar outerHTML/innerHTML en el fallback: construir texto plano con la info relevante
									const fallbackTextParts = [];
									fallbackTextParts.push(titleText || 'Programación actual');
									const groupTxt = (groupDiv && groupDiv.textContent) ? groupDiv.textContent : '';
									if (groupTxt) fallbackTextParts.push(groupTxt);
									fallbackTextParts.push('Verifique la programación del profesor antes de confirmar.');
									const fallbackText = fallbackTextParts.join('\n\n');
									confirm = await compatSwal({ title: 'Confirmar asignación', text: fallbackText, showCancelButton: true, confirmButtonText: 'Asignar', cancelButtonText: 'Cancelar' });
								}
								if (!confirm) return;
								// Si el grupo ya tiene profesor distinto, pedir confirmación para quitarlo antes de asignar
								const existingAsg = asignMap.get(String(grupo.idGrupo));
								if (existingAsg && existingAsg.idProfesor && String(existingAsg.idProfesor) !== String(prof.idProfesor)){
									const txt = `Este grupo ya tiene asignado a ${(existingAsg.profesor||existingAsg.nombre||'un profesor')} (NE ${existingAsg.numeroEconomico||''}). Se quitará antes de asignar al nuevo profesor. ¿Continuar?`;
									const okReplace = await compatSwal({ title: 'Reemplazar profesor asignado', text: txt, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, reemplazar', cancelButtonText: 'No' });
									if (!okReplace) return;
								}
								// incluir profesor si es necesario
								const bodyInc = new URLSearchParams(); bodyInc.append('idProfesor', String(prof.idProfesor)); bodyInc.append('idTrimestre', String(ID_TRIM)); bodyInc.append('action', 'include');
								await fetch('./controlador/toggleProfesorEnTrimestre.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyInc.toString() }).catch(()=>null);

								// Validar si la UEA ya está en las preferencias del profesor; si no, agregarla con prioridad 0
								try{
									const prefResp = await fetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: (u.claveUEA||'') });
									let already = false;
									if (prefResp && prefResp.ok && prefResp.prioridades){
										for (let pri=0; pri<=5; pri++){
											const arr = Array.isArray(prefResp.prioridades[pri]) ? prefResp.prioridades[pri] : [];
											for (const pp of arr){
												if (!pp) continue;
												// comparar por número económico si está disponible, fallback a idProfesor
												if (pp.numeroEconomico && prof.numeroEconomico && String(pp.numeroEconomico) === String(prof.numeroEconomico)){ already = true; break; }
												if (pp.idProfesor && prof.idProfesor && String(pp.idProfesor) === String(prof.idProfesor)){ already = true; break; }
											}
											if (already) break;
										}
									}
									if (!already){
										// agregar prioridad 0 para este profesor y UEA
										const bodyAdd = new URLSearchParams();
										bodyAdd.append('idTrimestre', String(ID_TRIM));
										bodyAdd.append('claveUEA', String(u.claveUEA || u.clave || ''));
										bodyAdd.append('numeroEconomico', String(prof.numeroEconomico || ''));
										bodyAdd.append('prioridad', '0');
										const addResp = await fetch('./controlador/agregarProfesorUEAPrioridad.php', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyAdd.toString() });
										const addJ = await addResp.json().catch(()=>null);
										if (!addResp.ok || !addJ || addJ.ok !== true){ throw new Error((addJ && (addJ.error||addJ.msg)) ? (addJ.error||addJ.msg) : 'No se pudo agregar la UEA a preferencias'); }
									}
								}catch(e){ swalErr((e && e.message) ? e.message : 'No se pudo validar/agregar preferencias'); return; }

								// asignar
								const bodyA = new URLSearchParams(); bodyA.append('idTrimestre', String(ID_TRIM)); bodyA.append('idProfesor', String(prof.idProfesor)); bodyA.append('idGrupo', String(grupo.idGrupo));
								const aResp = await fetch('./controlador/asignarGrupoProfesor.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyA.toString() });
								const aJ = await aResp.json().catch(()=>null);
								// Manejar caso de traslape devuelto por el servidor
								if (aJ && aJ.code === 'overlap' && Array.isArray(aJ.conflicts) && aJ.conflicts.length){
									// Construir DOM con los conflictos para mostrar en SweetAlert2
									const conflicts = aJ.conflicts;
									let askRemove = false;
									if (typeof window !== 'undefined' && window.Swal && typeof window.Swal.fire === 'function'){
										const container = document.createElement('div');
										container.className = 'swal-conflicts-list';
										for (const c of conflicts){
											const ex = c.existing || {};
											const item = document.createElement('div'); item.className = 'swal-conflict-item mb-2 p-2 border rounded';
											const title = document.createElement('div'); title.className = 'fw-semibold'; title.textContent = `Asignación existente: ${ex.nombreUEA || ex.uea || ''} - ${ex.claveGrupo || ex.grupo || ''}`;
											const details = document.createElement('div'); details.className = 'small text-muted';
											details.textContent = `Profesor: ${ex.profeso || prof.nombre || ''} ${prof.numeroEconomico?(' (NE '+prof.numeroEconomico+')'):''} | Día: ${ex.dia||''} | Horario: ${(ex.horaInicio||'') + (ex.horaFin? ('-' + ex.horaFin) : '')}`;
											item.appendChild(title); item.appendChild(details);
											container.appendChild(item);
										}
										const resp = await Swal.fire({ title: 'Conflicto de horario', html: container, width: 900, icon: 'warning', showCancelButton: true, confirmButtonText: 'Quitar asignación(es) y asignar', cancelButtonText: 'Cancelar', customClass: { popup: 'my-swal-popup' } });
										askRemove = !!(resp && resp.isConfirmed);
									} else {
										// fallback: preguntar con texto plano
										let txt = 'Conflicto de horario detectado con la(s) asignación(es) existente(s):\n\n';
										for (const c of aJ.conflicts){ const ex = c.existing||{}; txt += `- ${ex.claveUEA||ex.uea||''} ${ex.claveGrupo||ex.grupo||''} (${ex.dia||''} ${ex.horaInicio||''}-${ex.horaFin||''})\n`; }
										txt += '\n¿Deseas quitar la(s) asignación(es) existente(s) para proceder?';
										askRemove = await compatConfirm({ title: 'Conflicto de horario', text: txt, icon: 'warning', showCancelButton: true });
									}
									if (!askRemove) return; // si no quiere quitar, abortar
									// Quitar las asignaciones existentes y reintentar la asignación
									try{
										// Agrupar conflictos por grupo para evitar llamadas repetidas por horario
										const gruposMap = new Map();
										for (const c of conflicts){
											const ex = c.existing || {};
											// clave única por grupo: preferir idGrupo, sino usar claveUEA|claveGrupo, sino claveGrupo sola
											let gKey = null;
											if (ex.idGrupo) gKey = String(ex.idGrupo);
											else if (ex.claveUEA && (ex.claveGrupo || ex.grupo)) gKey = `${String(ex.claveUEA)}|${String(ex.claveGrupo || ex.grupo)}`;
											else if (ex.claveGrupo || ex.grupo) gKey = String(ex.claveGrupo || ex.grupo);
											if (!gKey) continue; // no tenemos info para identificar el grupo
											if (!gruposMap.has(gKey)) gruposMap.set(gKey, ex);
										}
										// Ejecutar una sola petición por grupo
										// Preparar mapa de numeroEconomico -> idProfesor si necesitamos resolver
										let profByNE = new Map();
										try{
											const respP = await fetch('./controlador/recuperarProfesoresTrimestre.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: (new URLSearchParams({ idTrimestre: String(ID_TRIM) })).toString() });
											const jP = await respP.json().catch(()=>null);
											if (jP && jP.ok && Array.isArray(jP.profesores)){
												for (const pp of jP.profesores){ if (pp && (pp.numeroEconomico || pp.idProfesor)) profByNE.set(String(pp.numeroEconomico), pp.idProfesor); }
											}
										}catch(e){ /* fallback: map empty */ }

										for (const [key, ex] of gruposMap.entries()){
											try{
												const params = new URLSearchParams();
												params.append('idTrimestre', String(ID_TRIM));
												// resolver idProfesor: preferir ex.idProfesor; si no, intentar por numeroEconomico
												let idProfToSend = ex.idProfesor ? Number(ex.idProfesor) : null;
												if (!idProfToSend && ex.numeroEconomico){ idProfToSend = profByNE.get(String(ex.numeroEconomico)) || null; }
												// Fallback: si no se pudo resolver por los datos existentes, usar el profesor seleccionado (conflicto en su programación)
												if (!idProfToSend && prof && prof.idProfesor) { idProfToSend = Number(prof.idProfesor); }
												if (!idProfToSend){ console.warn('No se pudo resolver idProfesor para grupo conflictivo', key, ex); continue; }
												params.append('idProfesor', String(idProfToSend));
												// enviar claveGrupo (requerido por el controlador)
												const clave = ex.claveGrupo || ex.grupo || '';
												if (!clave){ console.warn('No se encontró claveGrupo para grupo conflictivo', key, ex); continue; }
												params.append('claveGrupo', String(clave));

												const resp = await fetch('./controlador/quitarProgramacionProfesorGrupo.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
												const j = await resp.json().catch(()=>null);
												if (!resp.ok || !j || j.ok !== true){ console.warn('No se pudo quitar asignación conflictiva para', key, j); }
											} catch(innerErr){ console.error('Error al quitar asignación conflictiva', innerErr); }
										}
										// Reintentar asignación
										const retryResp = await fetch('./controlador/asignarGrupoProfesor.php', { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' }, body: bodyA.toString() });
										const retryJ = await retryResp.json().catch(()=>null);
										if (!retryResp.ok || (retryJ && retryJ.ok === false)){
											const msg = (retryJ && retryJ.msg) ? retryJ.msg : 'Error al asignar después de eliminar conflictos';
											compatSwal({ title:'Error', text: msg, icon: 'error' });
											return;
										}
										// Éxito en reintento: continuar actualización UI
										// actualizar columnas NE y Nombre
										tdNE.textContent = prof.numeroEconomico || ''; tdNom.textContent = prof.nombre || '';
										try{ asignMap.set(String(grupo.idGrupo), { idGrupo: grupo.idGrupo, idProfesor: prof.idProfesor, numeroEconomico: prof.numeroEconomico, profesor: prof.nombre, nombre: prof.nombre }); }catch(_e){}
										inp.value=''; drop.innerHTML=''; drop.style.display='none';
										compatSwal('Listo','Profesor asignado','success');
									} catch(err){ console.error('Error quitando asignaciones:', err); swalErr('No se pudo quitar la(s) asignación(es) existente(s)'); }
									return;
								}
								// Si no hubo traslape (o servidor respondió exitosamente), validar estado HTTP
								if (!aResp.ok){ const msg = (aJ && aJ.msg) ? aJ.msg : 'Error al asignar'; compatSwal({ title:'Error', text:msg, icon:'error' }); return; }
								// actualizar columnas NE y Nombre
								tdNE.textContent = prof.numeroEconomico || ''; tdNom.textContent = prof.nombre || '';
								// actualizar asignMap local para reflejar el cambio
								try{ asignMap.set(String(grupo.idGrupo), { idGrupo: grupo.idGrupo, idProfesor: prof.idProfesor, numeroEconomico: prof.numeroEconomico, profesor: prof.nombre, nombre: prof.nombre }); }catch(_e){}
								inp.value=''; drop.innerHTML=''; drop.style.display='none';
								compatSwal('Listo','Profesor asignado','success');
							}catch(e){ console.error(e); swalErr('No se pudo completar la asignación'); }
						}

					}catch(e){ clearChildren(subContent); const err=document.createElement('div'); err.className='text-danger'; err.textContent='Error cargando vista Libre'; subContent.appendChild(err); console.error(e); }
				});
			} catch(e){
				clearChildren(subContent); const err3=document.createElement('div'); err3.className='text-danger'; err3.textContent = (e && e.message ? e.message : 'No se pudo cargar el detalle'); subContent.appendChild(err3);
			}
		})();
	}

	async function renderUEAMode(){
		console.debug('asignacionTrimestral: renderUEAMode called, ID_TRIM=', ID_TRIM);
		const cont = document.getElementById('vista-uea');
		if (!cont) { console.debug('asignacionTrimestral: vista-uea not found'); return; }
		if (!ueaState.built) buildUEADom(cont);
	const { inputSearch, selArea, selEstado, right, tbody } = ueaState.elements;
		// cargar resumen
		try {
			const r = await fetch('controlador/recuperaUEAsResumenTrimestre.php?idTrimestre='+encodeURIComponent(ID_TRIM));
			const j = await r.json();
			ueaState.rawRows = (j && j.ok && Array.isArray(j.data)) ? j.data : [];
			// Limpiar panel derecho y selección previa para evitar mostrar detalles desactualizados
			try{
				if (right) {
					while(right.firstChild) right.removeChild(right.firstChild);
					const hint = document.createElement('div'); hint.className = 'text-muted'; hint.textContent = 'Selecciona una UEA para ver detalle.'; right.appendChild(hint);
				}
				if (tbody){ const prev = tbody.querySelector('tr.uea-selected'); if (prev) prev.classList.remove('uea-selected'); const prevCell = tbody.querySelector('td.uea-cell-selected'); if (prevCell) prevCell.classList.remove('uea-cell-selected'); }
			} catch(_e){}
			// poblar áreas
			const setA = new Set(); (ueaState.rawRows||[]).forEach(row=>{ if (row.areaNombre) setA.add(String(row.areaNombre)); });
			clearChildren(selArea);
			const optAll = document.createElement('option'); optAll.value=''; optAll.textContent='Área: Todas'; selArea.appendChild(optAll);
			Array.from(setA).sort().forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; selArea.appendChild(o); });
			aplicarFiltros();
		} catch(e){
			console.error('recuperaUEAsResumenTrimestre error', e);
			const { tbody } = ueaState.elements; tbody.innerHTML = '<tr><td colspan="2" class="text-danger">No se pudo cargar el resumen de UEA</td></tr>';
		}
		// listeners (solo una vez)
		if (!inputSearch._ueaListenersAttached){
			inputSearch.addEventListener('input', aplicarFiltros);
			selArea.addEventListener('change', aplicarFiltros);
			selEstado.addEventListener('change', aplicarFiltros);
			// No dropdown selector: selection via table rows only
			inputSearch._ueaListenersAttached = true;
		}
	}

	// export a nivel de módulo (encerrado) para que wireEvents lo invoque
	try { if (typeof window !== 'undefined') window.renderUEAMode = renderUEAMode; } catch(_){ }
})();
