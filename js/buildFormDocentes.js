document.addEventListener('DOMContentLoaded', function(){
  const root = document.getElementById('form-root');
  if (!root) {
    console.error('buildFormDocentes: #form-root no encontrado en el DOM');
    return;
  }

  // Helpers
  function clearRoot() {
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function showSpinner() {
    clearRoot();
    const wrap = document.createElement('div');
    wrap.className = 'd-flex align-items-center';
    wrap.id = 'form-loading';
    const strong = document.createElement('strong');
    strong.textContent = 'Cargando formulario…';
    const spinner = document.createElement('div');
    spinner.className = 'spinner-border ms-3';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    wrap.appendChild(strong);
    wrap.appendChild(spinner);
    root.appendChild(wrap);
  }

  function showAlert(type, message, preText) {
    clearRoot();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    if (preText) {
      const pre = document.createElement('pre');
      pre.textContent = preText.slice(0,2000);
      alert.appendChild(pre);
    }
    root.appendChild(alert);
  }

  showSpinner();

  // Rutas candidatas al controlador (intentar en orden)
  const candidates = [
    'controlador/recuperaUEAS.php',
    '../controlador/recuperaUEAS.php',
    '/PT_Fernando/controlador/recuperaUEAS.php',
    '/controlador/recuperaUEAS.php'
  ];

  (async function tryPaths(){
    const tried = [];
    for (const url of candidates) {
      console.debug('buildFormDocentes: probando', url);
      try {
        const resp = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
        tried.push({ url, status: resp.status });
        if (!resp.ok) {
          console.warn('buildFormDocentes: respuesta no OK', url, resp.status);
          continue;
        }
        // comprobar content-type y parsear JSON (si aplica)
        const contentType = (resp.headers.get('content-type') || '').toLowerCase();
        let data;
        if (!contentType.includes('application/json')) {
          const bodyText = await resp.text();
          console.error('buildFormDocentes: content-type inesperado desde', url, contentType);
          showAlert('danger', 'Respuesta inesperada al cargar UEA (no JSON). Revise la Consola y Network.', bodyText);
          return;
        }
        try {
          data = await resp.json();
        } catch (e) {
          console.error('buildFormDocentes: JSON inválido desde', url, e);
          const txt = await resp.text();
          showAlert('danger', 'Respuesta JSON inválida. Revise la Consola.', txt);
          return;
        }
        try {
          await buildForm(root, data);
          return;
        } catch (e) {
          console.error('buildFormDocentes: error construyendo formulario', e);
          showAlert('danger', 'Error al construir el formulario. Revise la Consola.');
          return;
        }
      } catch (err) {
        console.warn('buildFormDocentes: error fetch', url, err);
        tried.push({ url, error: String(err) });
      }
    }
    // Si llegamos aquí, ninguna ruta funcionó
    clearRoot();
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning';
    const p = document.createElement('p');
    p.textContent = 'No se pudieron cargar las UEA desde el servidor. Rutas probadas:';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(tried, null, 2);
    const p2 = document.createElement('p');
    p2.innerHTML = 'Verifique en DevTools → Network la URL correcta del controlador <code>recuperaUEAS.php</code>.';
    alert.appendChild(p);
    alert.appendChild(pre);
    alert.appendChild(p2);
    root.appendChild(alert);
  })();

  // Build option elements (DOM) from ueas array
  function makeOptions(ueas) {
    const opts = [];
    if (!Array.isArray(ueas) || ueas.length === 0) {
      const o = document.createElement('option');
      o.value = '0';
      o.textContent = '(No hay UEA disponibles)';
      opts.push(o);
      return opts;
    }
    ueas.forEach(u => {
      let clave = '';
      let nombre = '';
      if (u && typeof u === 'object') {
        clave = u.claveUEA || u.clave || u.cUEA || u.clave || '';
        nombre = u.nombre || u.label || u.nombreUEA || u.nUEA || '';
      } else {
        clave = String(u);
        nombre = String(u);
      }
      const txt = (clave ? (clave + ' ') : '') + nombre;
      const o = document.createElement('option');
      o.value = clave;
      o.textContent = txt;
      opts.push(o);
    });
    return opts;
  }

  async function buildForm(root, ueas) {
    clearRoot();
    const options = makeOptions(ueas);

    // Obtener horarios desde el servidor (controlador que delega en el DAO)
    var horariosAll = [];
    try {
      const resp = await fetch('controlador/recuperarHorarios.php', { cache: 'no-store', credentials: 'same-origin' });
      if (resp && resp.ok) {
        const j = await resp.json();
        if (j && j.ok && Array.isArray(j.horarios)) horariosAll = j.horarios;
      } else {
        console.warn('buildFormDocentes: no se pudo recuperar horarios del servidor, status:', resp && resp.status);
      }
    } catch (e) {
      console.warn('buildFormDocentes: error fetch recuperarHorarios.php', e);
    }

    const form = document.createElement('form');
    form.action = '#';
    form.method = 'post';
    form.autocomplete = 'off';
    form.id = 'form-docentes';
    // Añadir campo hidden 'trim' con el id de trimestre tomado de la query string
    try {
      const params = new URLSearchParams(window.location.search || '');
      const trimParam = params.get('trim') || params.get('idTrimestre');
      if (trimParam) {
        const hid = document.createElement('input'); hid.type = 'hidden'; hid.name = 'trim'; hid.value = String(trimParam);
        form.appendChild(hid);
      }
    } catch (e) {
      // no fatal
      console.warn('buildFormDocentes: no se pudo anexar campo trim al formulario', e);
    }

    // row: noEcon, email, noGrup
    const row1 = document.createElement('div');
    row1.className = 'row g-3';

    const col1 = document.createElement('div'); col1.className = 'col-md-4';
    const labelNo = document.createElement('label'); labelNo.className = 'form-label'; labelNo.htmlFor = 'noEcon'; labelNo.textContent = 'Número económico';
    const inputNo = document.createElement('input'); inputNo.type = 'number'; inputNo.id = 'noEcon'; inputNo.name = 'noEco'; inputNo.className = 'form-control'; inputNo.min = '1'; inputNo.required = true;
    col1.appendChild(labelNo); col1.appendChild(inputNo);

    const col2 = document.createElement('div'); col2.className = 'col-md-4';
    const labelEmail = document.createElement('label'); labelEmail.className = 'form-label'; labelEmail.htmlFor = 'email'; labelEmail.textContent = 'Correo';
    const inputEmail = document.createElement('input'); inputEmail.type = 'email'; inputEmail.id = 'email'; inputEmail.name = 'email'; inputEmail.className = 'form-control'; inputEmail.required = true;
    const emailOK = document.createElement('div'); emailOK.id = 'emailOK'; emailOK.className = 'form-text';
    col2.appendChild(labelEmail); col2.appendChild(inputEmail); col2.appendChild(emailOK);

    const col3 = document.createElement('div'); col3.className = 'col-md-4';
    const labelGr = document.createElement('label'); labelGr.className = 'form-label'; labelGr.htmlFor = 'noGrup'; labelGr.textContent = 'Número de grupos (mínimo 2)';
    const inputGr = document.createElement('input'); inputGr.type = 'number'; inputGr.id = 'noGrup'; inputGr.name = 'noGrupos'; inputGr.className = 'form-control'; inputGr.min = '1'; inputGr.required = true;
    col3.appendChild(labelGr); col3.appendChild(inputGr);

    row1.appendChild(col1); row1.appendChild(col2); row1.appendChild(col3);
    form.appendChild(row1);

    const hr1 = document.createElement('hr'); hr1.className = 'my-4'; form.appendChild(hr1);

    const p1 = document.createElement('p'); p1.className = 'mb-1'; p1.innerHTML = 'En los siguientes campos, indicar sus preferencias en cuanto a las UEA que desea impartir. Debe indicar <strong>5 UEA</strong>, recuerde que deben ser diferentes entre sí.';
    const p2 = document.createElement('p'); p2.className = 'mb-3'; p2.textContent = 'En la medida de lo posible, el Departamento le asignará las UEA que usted indique como primera y segunda opción.';
    form.appendChild(p1); form.appendChild(p2);

    const rowU = document.createElement('div'); rowU.className = 'row g-3';
    const selects = [];
    for (let i = 1; i <= 5; i++) {
      const col = document.createElement('div'); col.className = 'col-md-6';
      const lab = document.createElement('label'); lab.className = 'form-label'; lab.htmlFor = `uea${i}`; lab.textContent = `${i}ra UEA`.replace('1ra','1ra').replace('2ra','2da');
      const sel = document.createElement('select'); sel.id = `uea${i}`; sel.name = `uea${i}`; sel.className = 'form-select';
      const opt0 = document.createElement('option'); opt0.value = '0'; opt0.textContent = '-- Seleccionar UEA --'; sel.appendChild(opt0);
      // append clones of master options
      options.forEach(o => sel.appendChild(o.cloneNode(true)));
      col.appendChild(lab); col.appendChild(sel); rowU.appendChild(col);
      selects.push(sel);
    }
    form.appendChild(rowU);

    const hr2 = document.createElement('hr'); hr2.className = 'my-4'; form.appendChild(hr2);

    const p3 = document.createElement('p'); p3.innerHTML = 'En la siguiente tabla, indique los horarios de su preferencia. <strong>Como mínimo, debe indicar tres horarios por día.</strong>';
    form.appendChild(p3);

    const horaDiv = document.createElement('div'); horaDiv.id = 'hora-semana'; horaDiv.className = 'table-responsive';
    const table = document.createElement('table'); table.id = 'horarios'; table.className = 'table table-bordered';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach(text => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; trh.appendChild(th);
    });
    thead.appendChild(trh); table.appendChild(thead);
  const tbody = buildHorarioRows(horariosAll);
    table.appendChild(tbody);
    horaDiv.appendChild(table);
    form.appendChild(horaDiv);

    const mb = document.createElement('div'); mb.className = 'mb-3';
    const labObs = document.createElement('label'); labObs.className = 'form-label'; labObs.htmlFor = 'contenido'; labObs.textContent = 'Observaciones';
    const txt = document.createElement('textarea'); txt.id = 'contenido'; txt.name = 'obser'; txt.className = 'form-control'; txt.rows = 4; txt.setAttribute('onkeydown','pulsar(event)'); txt.placeholder = "Escriba sus observaciones e indique la modalidad preferente de las UEA's que pidió (Tradicional | SAI | SAC | Virtual | Movilidad)";
    mb.appendChild(labObs); mb.appendChild(txt);
    form.appendChild(mb);

    const mb2 = document.createElement('div'); mb2.className = 'mb-3';
    const pbtn = document.createElement('p'); pbtn.innerHTML = 'Presione <strong>UNA</strong> sola vez el botón para Confirmar y espere el mensaje.';
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'submit_docentes'; btn.className = 'btn btn-primary'; btn.textContent = 'Confirmar solicitud'; btn.addEventListener('click', function(){ if (typeof guardar === 'function') guardar(); });
    // Aplicar disabled si previamente se solicitó deshabilitar el envío
    try {
      if (window && window._disableSubmitRequested) {
        btn.disabled = true;
        btn.setAttribute('disabled','disabled');
        btn.classList && btn.classList.add('disabled');
      }
    } catch (e) { /* noop */ }
    mb2.appendChild(pbtn); mb2.appendChild(btn);
    form.appendChild(mb2);

    // Build behavior: prevent duplicate selections across the 5 selects
    const masterOptions = options.map(o => o.cloneNode(true));

    function refreshUEAOptions() {
      // collect selected values except '0'
      const selected = new Set(selects.map(s => s.value).filter(v => v && v !== '0'));
      selects.forEach(s => {
        const cur = s.value;
        // remove all non-default options
        // keep the first (default) option then rebuild
        while (s.options.length > 1) s.remove(1);
        // append options that are not selected elsewhere, or the currently selected value
        masterOptions.forEach(opt => {
          const val = opt.value;
          if (val === cur || !selected.has(val)) {
            s.appendChild(opt.cloneNode(true));
          }
        });
        // restore selection if still present
        if ([...s.options].some(o => o.value === cur)) {
          s.value = cur;
        } else {
          // if previously selected value is no longer available, reset to default
          s.value = '0';
        }
      });
    }

    selects.forEach(s => s.addEventListener('change', refreshUEAOptions));
    // initial refresh to ensure no duplicates present
    refreshUEAOptions();

    root.appendChild(form);
  }

  function buildHorarioRows(horariosAll){
    // rows data: each row label (display) and the start/end times used to find the matching idHorario in DB
    const rows = [
      ['7:00 - 8:30', '7:00', '8:30'],
      ['8:30 - 10:00', '8:30', '10:00'],
      ['10:00 - 11:30', '10:00', '11:30'],
      ['11:30 - 13:00', '11:30', '13:00'],
      ['13:00 - 14:30', '13:00', '14:30'],
      ['14:30 - 16:00', '14:30', '16:00'],
      ['16:00 - 17:30', '16:00', '17:30'],
      ['17:30 - 19:00', '17:30', '19:00'],
      ['19:00 - 20:30', '19:00', '20:30']
    ];
    const tbody = document.createElement('tbody');

    // helper para normalizar la hora de la BD a formato usado en labels: '07:00:00' -> '7:00'
    function horaToLabel(h) {
      if (!h) return '';
      var s = String(h).trim();
      var parts = s.split(':');
      if (parts.length >= 2) {
        var hh = parseInt(parts[0],10);
        var mm = parts[1];
        // mantener minutos tal cual (ej. '00', '30') y eliminar ceros a la izquierda sólo en la hora
        return String(hh) + ':' + mm;
      }
      return s;
    }

    // pre-index horarios por día para búsquedas rápidas
    var byDay = { 'lu': [], 'ma': [], 'mi': [], 'ju': [], 'vi': [] };
    (horariosAll || []).forEach(function(h){
      try {
        var d = String(h.dia || '').toLowerCase();
        if (d.indexOf('lu') === 0 || d.indexOf('lunes') === 0) byDay['lu'].push(h);
        else if (d.indexOf('ma') === 0 || d.indexOf('martes') === 0) byDay['ma'].push(h);
        else if (d.indexOf('mi') === 0 || d.indexOf('mier') === 0 || d.indexOf('miercoles') === 0) byDay['mi'].push(h);
        else if (d.indexOf('ju') === 0 || d.indexOf('jueves') === 0) byDay['ju'].push(h);
        else if (d.indexOf('vi') === 0 || d.indexOf('viernes') === 0) byDay['vi'].push(h);
      } catch(e) { /* ignore malformed */ }
    });

    rows.forEach(function(r){
      var tr = document.createElement('tr');
      var th = document.createElement('th'); th.scope = 'row'; th.textContent = r[0]; tr.appendChild(th);
      // para cada día (lu..vi) buscar idHorario por horaInicio/horaFin
      var dayPrefixes = ['lu','ma','mi','ju','vi'];
      dayPrefixes.forEach(function(prefix){
        var td = document.createElement('td');
        var inp = document.createElement('input'); inp.className = 'form-check-input'; inp.type = 'checkbox'; inp.name = 'horario[]';
        // indicar el día en el checkbox para que la validación en cliente use data-day en lugar de valores numéricos fijos
        inp.setAttribute('data-day', prefix);
        // buscar horario que coincida con start/end
        var candidates = byDay[prefix] || [];
        var found = null;
        for (var i = 0; i < candidates.length; i++) {
          try {
            var c = candidates[i];
            var sLabel = horaToLabel(c.horaInicio || c.horaInicio || c.horaInicio);
            var eLabel = horaToLabel(c.horaFin || c.horaFin || c.horaFin);
            if (String(sLabel) === String(r[1]) && String(eLabel) === String(r[2])) { found = c; break; }
          } catch(e) { }
        }
        if (found && found.idHorario) {
          inp.value = String(found.idHorario);
        } else {
          // si no existe, dejar value vacío (se interpretará como no seleccionado)
          inp.value = '';
        }
        td.appendChild(inp);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    return tbody;
  }

  function escapeHtml(str){
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

});
