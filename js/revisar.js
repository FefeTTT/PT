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

// Utilidad global: eliminar todos los hijos de un nodo (disponible en todo el módulo)
function clearChildren(el){
	try{
		if (!el) return;
		while (el.firstChild) el.removeChild(el.firstChild);
	}catch(e){ /* noop */ }
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
				clearChildren(tbProfes());
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
						clearChildren(detEstado());
						detEstado().className = '';
					detNoGrupos().textContent = '—';
					detObservaciones().textContent = '—';
						return;
				}
				detNombre().textContent = p.nombre || '';
				detNE().textContent = p.numeroEconomico || '';
				// Renderizar botón toggle también en el panel derecho con la misma funcionalidad
				clearChildren(detEstado());
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
			clearChildren(tbPrefUEAs());
			clearChildren(modalPrefUEAs());
			clearChildren(modalHorariosGridWrap());
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
		const btnBack = document.createElement('button'); btnBack.className='btn btn-link btn-sm'; btnBack.textContent='« Volver a preferencias'; btnBack.addEventListener('click', async ()=>{ resetPrefUEAContainer(); await cargarPreferenciasProfesor(); });
		head.appendChild(hTitle); head.appendChild(btnBack);
		wrap.appendChild(head);
		// asegurar visibilidad del contenedor
		try { wrap.style.display = ''; } catch(_) {}

		// Submenú: Preferencias de profesor | Profesores que han impartido la UEA | Libre
		const submenu = document.createElement('div');
		submenu.className = 'uea-submenu btn-group btn-group-sm mb-2';
		const btnSubPref = document.createElement('button'); btnSubPref.type='button'; btnSubPref.className='btn btn-primary'; btnSubPref.textContent='Preferencias de profesor';
		const btnSubImpartido = document.createElement('button'); btnSubImpartido.type='button'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubImpartido.textContent='Profesores que han impartido la UEA';
		const btnSubLibre = document.createElement('button'); btnSubLibre.type='button'; btnSubLibre.className='btn btn-outline-secondary'; btnSubLibre.textContent='Libre';
		submenu.appendChild(btnSubPref); submenu.appendChild(btnSubImpartido); submenu.appendChild(btnSubLibre);
		wrap.appendChild(submenu);

		// Contenedor de contenido del submenú
		const subContent = document.createElement('div'); subContent.id = 'uea-subcontent'; wrap.appendChild(subContent);

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

		// Vista Preferencias de profesor: helper para construir tabla
		function buildPreferenciasTable(prioridades){
			subContent.innerHTML = '';
			const tblWrap = document.createElement('div'); tblWrap.className='pref-table-responsive';
			const table = document.createElement('table'); table.className='table table-sm align-middle pref-table-minwidth pref-uea-table';
			const thead = document.createElement('thead'); thead.className='table-dark';
			const trh = document.createElement('tr');
			const cols = ['Grupo','Lunes','Martes','Miércoles','Jueves','Viernes','Número económico','Nombre','Prioridad 0','Prioridad 1','Prioridad 2','Prioridad 3','Prioridad 4','Prioridad 5'];
			cols.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; if (c==='Grupo') th.className='grupo-col sticky-col'; trh.appendChild(th); });
			thead.appendChild(trh); table.appendChild(thead);
			const tbody = document.createElement('tbody'); table.appendChild(tbody);

			// Render filas por grupo
			for (const g of grupos){
				const tr = document.createElement('tr');
				const tdG = document.createElement('td'); tdG.textContent = g.claveGrupo; tdG.className='grupo-col sticky-col'; tr.appendChild(tdG);
				// preparar horarios por día
				const horariosArr = Array.isArray(g.horarios) ? g.horarios : [];
				const byDay = { lunes:[], martes:[], miercoles:[], jueves:[], viernes:[] };
				for (const h of horariosArr){ const d = String(h.dia).toLowerCase(); const label=(h.horaInicio? h.horaInicio:'') + (h.horaFin? '-' + h.horaFin:''); if(byDay[d] && !byDay[d].includes(label)) byDay[d].push(label); }
				['lunes','martes','miercoles','jueves','viernes'].forEach(d=>{ const td=document.createElement('td'); td.textContent = byDay[d].length? byDay[d].join(', ') : '—'; tr.appendChild(td); });
				// Económico y Nombre desde asignMapByGrupo si existe
				const asg = asignMapByGrupo.get(String(g.idGrupo)) || asignMapByGrupo.get(String(g.claveGrupo)) || null;
				const tdEco = document.createElement('td'); tdEco.textContent = asg ? (asg.numeroEconomico || '') : ''; tr.appendChild(tdEco);
				const tdNom = document.createElement('td'); tdNom.textContent = asg ? (asg.profesor || '') : ''; tr.appendChild(tdNom);
				// Prioridades 0..5
				for (let pri=0; pri<=5; pri++){
					const td = document.createElement('td');
					const list = (prioridades && prioridades[pri]) ? prioridades[pri] : [];
					if (pri === 0){
						// botón para agregar profesor a prioridad 0 en esta UEA
						const btnAdd = document.createElement('button');
						btnAdd.type='button'; btnAdd.className='btn btn-outline-success btn-sm priority-add-btn me-1'; btnAdd.textContent = '+ Agregar';
						btnAdd.addEventListener('click', async ()=>{
							try{
								const input = prompt('Número económico del profesor a agregar a prioridad 0:');
								if (!input) return;
								const body = new URLSearchParams();
								body.append('idTrimestre', String(ID_TRIM));
								body.append('claveUEA', String(uea.claveUEA));
								body.append('numeroEconomico', String(input));
								body.append('prioridad', '0');
								const resp = await fetch('./controlador/agregarProfesorUEAPrioridad.php', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString() });
								const j = await resp.json().catch(()=>null);
								if (!resp.ok || !j || j.ok !== true) throw new Error((j && j.error) ? j.error : ('HTTP ' + resp.status));
								// recargar prioridades
								const p = await fetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: uea.claveUEA });
								if (p && p.ok) buildPreferenciasTable(p.prioridades); else throw new Error('No se pudo recargar preferencias');
							} catch(e){ swalErr(e && e.message ? e.message : 'No se pudo agregar a prioridad 0'); }
						});
						td.appendChild(btnAdd);
					}
					if (Array.isArray(list) && list.length){
						for (const prof of list){
							const b = document.createElement('button'); b.type='button'; b.className='btn btn-outline-primary btn-sm priority-chip me-1'; b.textContent = prof.nombre || ('NE ' + (prof.numeroEconomico||''));
							b.title = (prof.numeroEconomico ? ('NE ' + prof.numeroEconomico + ' - ') : '') + (prof.nombre || '');
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

		// Cargar y renderizar vista "Preferencias de profesor" por defecto
		const prefResp = await fetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: uea.claveUEA });
		if (!prefResp || !prefResp.ok){ throw new Error(prefResp && prefResp.error ? prefResp.error : 'No se pudieron cargar preferencias de UEA'); }
		buildPreferenciasTable(prefResp.prioridades || {});

		// Handlers de los otros botones (placeholder por ahora)
		btnSubPref.addEventListener('click', async ()=>{
			try{ const res = await fetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: uea.claveUEA }); if (res && res.ok) buildPreferenciasTable(res.prioridades||{}); } catch(e){ swalErr('No se pudieron cargar preferencias'); }
			btnSubPref.className='btn btn-primary'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubLibre.className='btn btn-outline-secondary';
		});
		btnSubImpartido.addEventListener('click', ()=>{ clearChildren(subContent); const a = document.createElement('div'); a.className='alert alert-info'; a.textContent='Pendiente de implementar'; subContent.appendChild(a); btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-primary'; btnSubLibre.className='btn btn-outline-secondary'; });
		btnSubLibre.addEventListener('click', ()=>{ clearChildren(subContent); const a2 = document.createElement('div'); a2.className='alert alert-info'; a2.textContent='Pendiente de implementar'; subContent.appendChild(a2); btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubLibre.className='btn btn-primary'; });
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
			const dialog = document.createElement('div'); dialog.className = 'modal-dialog modal-xl';
			const content = document.createElement('div'); content.className = 'modal-content';
			const header = document.createElement('div'); header.className = 'modal-header';
			const h5 = document.createElement('h5'); h5.className = 'modal-title'; h5.textContent = 'Programación asignada';
			const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'btn-close'; btnClose.setAttribute('data-bs-dismiss','modal'); btnClose.setAttribute('aria-label','Cerrar');
			header.appendChild(h5); header.appendChild(btnClose);
			const bodyWrap = document.createElement('div'); bodyWrap.className = 'modal-body';
			const bodyDiv = document.createElement('div'); bodyDiv.id = 'modal-programacion-body'; bodyWrap.appendChild(bodyDiv);
			const footer = document.createElement('div'); footer.className = 'modal-footer';
			const btnFoot = document.createElement('button'); btnFoot.type='button'; btnFoot.className='btn btn-secondary'; btnFoot.setAttribute('data-bs-dismiss','modal'); btnFoot.textContent='Cerrar'; footer.appendChild(btnFoot);
			content.appendChild(header); content.appendChild(bodyWrap); content.appendChild(footer);
			dialog.appendChild(content); modal.appendChild(dialog);
			document.body.appendChild(modal);
		}
		const body = modal.querySelector('#modal-programacion-body');
		clearChildren(body);
		if (!prog || !prog.length){
			const noDiv = document.createElement('div'); noDiv.className = 'text-body-secondary'; noDiv.textContent = 'El profesor no tiene grupos asignados en este trimestre.'; body.appendChild(noDiv);
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
				clearChildren(addUEAArea());
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
				// Restaurar comportamiento original: activar modo y recargar datos del modo profesor
				try{
					setModoActivo('profesores');
					// recargar la lista y detalles para asegurar que la vista vuelva a su estado previo
					await cargarProfesoresTabla();
					await cargarPreferenciasProfesor();
				} catch(e){
					console.error('Error al activar modo profesores', e);
				}
			});
				btnUEA().addEventListener('click', async ()=>{
					console.debug('asignacionTrimestral: btn-modo-uea clicked');
					setModoActivo('uea');
					try{ await renderUEAMode(); }catch(e){ console.error('renderUEAMode error', e); swalErr('No se pudo cargar el modo UEA'); }
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

	// Utilidad para escapar HTML simple
	function escapeHtml(str){
		return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
	}

	async function construirTablaHorarios(horarios){
		const wrap = modalHorariosGridWrap();
		clearChildren(wrap);
		// Si no hay horarios y no estamos en modo edición, mostrar mensaje y salir.
		if ((!horarios || !horarios.length) && !editMode){
			const noDiv = document.createElement('div'); noDiv.className = 'text-body-secondary'; noDiv.textContent = 'Sin horarios preferidos'; wrap.appendChild(noDiv);
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
		clearChildren(td);
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
			clearChildren(selectEl);
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
								// recargar prioridades
								const p = await localFetchJSON('./controlador/recuperarPreferenciasUEAEnTrimestre.php', { idTrimestre: ID_TRIM, claveUEA: u.claveUEA });
								if (p && p.ok) buildPreferenciasTable(grupos, p.prioridades, asignMapByGrupo, prefMapByProf, progMapByProf); else throw new Error('No se pudo recargar preferencias');
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
									const p1 = document.createElement('p'); p1.innerHTML = `<span class=\"label\">UEA:</span> ${u.claveUEA || ''} - ${ueaNombre}`; detalle.appendChild(p1);
									const p2 = document.createElement('p'); p2.innerHTML = `<span class="label">Grupo:</span> ${g.claveGrupo || ''}`; detalle.appendChild(p2);
									const p3 = document.createElement('p'); p3.innerHTML = `<span class="label">Profesor actual:</span> ${asg.profesor || ''} (${asg.numeroEconomico || ''})`; detalle.appendChild(p3);
									const p4 = document.createElement('p'); p4.innerHTML = `<span class="label">Nuevo profesor:</span> ${prof.nombre || ''} (${prof.numeroEconomico || ''})`; detalle.appendChild(p4);
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
				btnSubImpartido.addEventListener('click', ()=>{ clearChildren(subContent); const a=document.createElement('div'); a.className='alert alert-info'; a.textContent='Pendiente de implementar'; subContent.appendChild(a); btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-primary'; btnSubLibre.className='btn btn-outline-secondary'; });
				btnSubLibre.addEventListener('click', ()=>{ clearChildren(subContent); const a2=document.createElement('div'); a2.className='alert alert-info'; a2.textContent='Pendiente de implementar'; subContent.appendChild(a2); btnSubPref.className='btn btn-outline-secondary'; btnSubImpartido.className='btn btn-outline-secondary'; btnSubLibre.className='btn btn-primary'; });
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
	const { inputSearch, selArea, selEstado } = ueaState.elements;
		// cargar resumen
		try {
			const r = await fetch('controlador/recuperaUEAsResumenTrimestre.php?idTrimestre='+encodeURIComponent(ID_TRIM));
			const j = await r.json();
			ueaState.rawRows = (j && j.ok && Array.isArray(j.data)) ? j.data : [];
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
