var alertWarning = document.getElementById('resp-warning');
alertWarning.style.display = "none";

var alertSuccess = document.getElementById('resp-success');
alertSuccess.style.display = "none";

/**
 * Crear una alerta dentro de un contenedor usando nodos DOM en lugar de innerHTML.
 * container: elemento donde insertar la alerta
 * title: texto del título (string)
 * body: texto del cuerpo (string)
 * extraClass: clases adicionales para el wrapper (por ejemplo 'app-alert-error')
 */
function setAlert(container, title, body, extraClass) {
  try {
    if (!container) return;
    // limpiar contenido existente
    while (container.firstChild) container.removeChild(container.firstChild);
    var wrapper = document.createElement('div');
    wrapper.className = 'app-alert' + (extraClass ? ' ' + extraClass : '');

    if (title) {
      var h = document.createElement('h3');
      h.className = 'app-alert-title';
      h.textContent = title;
      wrapper.appendChild(h);
    }

    if (body) {
      var p = document.createElement('p');
      p.className = 'app-alert-body';
      p.textContent = body;
      wrapper.appendChild(p);
    }

    container.appendChild(wrapper);
    container.style.display = 'block';
  } catch (e) { console.warn('setAlert error', e); }
}

// Compatibilidad: si el proyecto usa llamadas a `swal(...)` (SweetAlert v1)
// pero la plantilla cargó SweetAlert2 (global `Swal`), creamos un wrapper
// mínimo que mapea las llamadas más comunes a `Swal.fire(...)` para evitar
// errores de referencia y mantener el comportamiento esperado.
// Si `swal` no existe, o existe pero es una clase/constructor (SweetAlert2 exportado
// como `swal`) o no es una función invocable al estilo v1, instalamos un wrapper
// seguro que delega en `Swal.fire` cuando está disponible.
try {
  var _swalIsBad = false;
  if (typeof swal !== 'undefined') {
    // detectar ES6 class mediante toString
    try {
      var sStr = Function.prototype.toString.call(swal || function(){});
      if (sStr && sStr.trim().indexOf('class ') === 0) _swalIsBad = true;
    } catch (e) { _swalIsBad = true; }
    // si swal existe y no es función invocable en el estilo antiguo, lo marcamos
    if (typeof swal !== 'function') _swalIsBad = true;
  }
  if ((typeof swal === 'undefined' || _swalIsBad) && typeof Swal !== 'undefined') {
    window.swal = function(arg1, arg2, arg3) {
    // Firma simple: swal(title, text, icon)
    if (typeof arg1 === 'string') {
      return Swal.fire({ title: arg1, text: arg2 || '', icon: arg3 || undefined, confirmButtonText: 'OK' }).then(function(res){
        if (res && res.isConfirmed) return 'ok';
        // no cancel button in this signature -> other dismiss reasons return null
        return null;
      });
    }
    // Firma con objeto: swal({ title, text, icon, buttons: { ok, cancel } })
    if (typeof arg1 === 'object' && arg1 !== null) {
      var opts = arg1;
      var s = { title: opts.title || opts.text || '', text: opts.text || opts.message || '', icon: opts.icon || opts.type || undefined };
      if (opts.buttons && typeof opts.buttons === 'object') {
        s.showCancelButton = true;
        s.confirmButtonText = opts.buttons.ok || 'OK';
        s.cancelButtonText = opts.buttons.cancel || 'Cancel';
      }
      return Swal.fire(s).then(function(res){
        // Devolver string 'ok' si se confirmó
        if (res && res.isConfirmed) return 'ok';
        // Devolver 'cancel' sólo si el usuario pulsó el botón Cancel (no por cerrar con backdrop/esc)
        try {
          if (res && res.isDismissed && typeof Swal !== 'undefined' && Swal.DismissReason && res.dismiss === Swal.DismissReason.cancel) {
            return 'cancel';
          }
        } catch (e) { /* ignore */ }
        return null;
      });
    }
      return Promise.resolve(null);
    };
  }
} catch (e) {
  // No bloquear; si algo falla aquí, seguimos sin el wrapper pero no interrumpimos la carga
  console.warn('Compat wrapper swal -> Swal failed', e);
}

function pulsar(e) {
  if (e.which === 13 && !e.shiftKey) {
    e.preventDefault();
    console.log('prevented');
    return false;
  }
}

// Helpers para (des)habilitar el botón principal de envío creado dinámicamente
function disableSubmitButton(){
  try {
    var btn = document.getElementById('submit_docentes');
    if (btn) {
      btn.disabled = true;
      btn.classList && btn.classList.add('disabled');
      return;
    }
    // si no existe aún, observar #form-root para cuando se cree
    var root = document.getElementById('form-root');
    if (!root) root = document.getElementById('contenedor-docente') || document.body;
    if (!window._submitObserverAttached) {
      try {
        var obs = new MutationObserver(function(muts){
          muts.forEach(function(m){
            (m.addedNodes || []).forEach(function(n){
              try {
                if (n.nodeType !== 1) return;
                if (n.id === 'submit_docentes') { n.disabled = true; n.classList && n.classList.add('disabled'); }
                var found = n.querySelector && n.querySelector('#submit_docentes');
                if (found) { found.disabled = true; found.classList && found.classList.add('disabled'); }
              } catch(e){}
            });
          });
        });
        obs.observe(root, { childList: true, subtree: true });
        window._submitObserver = obs; window._submitObserverAttached = true;
      } catch(e){ console.warn('disableSubmitButton observer failed', e); }
    }
  } catch(e){ console.warn('disableSubmitButton error', e); }
}

function enableSubmitButton(){
  try {
    var btn = document.getElementById('submit_docentes');
    if (btn) {
      btn.disabled = false;
      try { btn.removeAttribute && btn.removeAttribute('disabled'); } catch(e){}
      btn.classList && btn.classList.remove('disabled');
      // limpiar cualquier bandera previa
      window._disableSubmitRequested = false;
    }
    // if an observer exists, disconnect it (no longer needed)
    try { if (window._submitObserver) { window._submitObserver.disconnect(); window._submitObserverAttached = false; window._submitObserver = null; } } catch(e){}
  } catch(e){ console.warn('enableSubmitButton error', e); }
}

// Formatea una fecha ISO (YYYY-MM-DD o variantes) a formato en español
// ejemplo: "2025-11-03" -> "3 de noviembre de 2025"
function formatDateSpanish(iso) {
  try {
    if (!iso) return '';
    var s = String(iso).trim().slice(0, 10);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    if (m) {
      var year = m[1];
      var month = parseInt(m[2], 10);
      var day = parseInt(m[3], 10);
      if (month >= 1 && month <= 12) {
        return day + ' de ' + months[month - 1] + ' de ' + year;
      }
    }
    // Fallback usando Date y toLocaleDateString en español
    var d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return iso;
  } catch (e) {
    return iso || '';
  }
}

function onLoad(data) {
  // Construir texto contextual con datos del trimestre si están disponibles
  var textoTrim = '';
  var fechaLim = '';
  if (data) {
    // Preferir mostrar año+sigla juntos (ej. 2025A) si ambos están presentes
    var anio = data.año || data.anio || '';
    var sigla = data.sigla || '';
    if (anio && sigla) {
      // Mostrar con guion entre año y sigla, por ejemplo: 2025-A
      textoTrim = String(anio) + '-' + String(sigla);
    } else {
      var periodo = data.periodoNombre || data.sigla || '';
      textoTrim = [periodo, sigla, anio].filter(Boolean).join(' ');
    }
    fechaLim = data.fechaLimite || '';
  }
  var mensajeBase = "Estimad@ profesor(a), es importante mencionarles que debido a la demanda docente en el Departamento de Ciencias Básicas se deben cubrir tres UEA en licenciatura y en caso de apoyar en alguna UEA de posgrado u otro departamento se debe solicitar previa autorización a la jefatura";
  var mensajeTrim = textoTrim ? ("\n\nTrimestre: " + textoTrim) : '';
  // Formatear la fecha límite a texto: día, mes en letras y año
  var mensajeFecha = '';
  if (fechaLim) {
    var fechaFormateada = formatDateSpanish(fechaLim);
    if (fechaFormateada) mensajeFecha = "\n\nFecha límite: " + fechaFormateada;
  }

  swal({
    title: "Aviso sobre asignación de UEAS",
    text: mensajeBase + mensajeTrim + mensajeFecha,
    icon: "info",
    buttons: {
      cancel: "Tengo problemas con ello",
      ok: "Le he entendido y estoy de acuerdo",
    }
  })
  .then((value) => {
    switch (value) {
      case "ok":
        try {
          // habilitar el botón de envío si estaba deshabilitado
          enableSubmitButton();
          var __b = document.getElementById('submit_docentes');
          if (__b) { __b.disabled = false; try { __b.removeAttribute && __b.removeAttribute('disabled'); } catch(e){}; __b.classList && __b.classList.remove('disabled'); }
        } catch(e) { /* ignore */ }
        swal("Entendido", "Muy bien, proceda con su llenado de preferencias", "success");
        break;
        case "cancel":
        // Intentar deshabilitar el botón de envío inmediatamente usando la propiedad disabled
        try {
          var _btn = document.getElementById('submit_docentes');
          if (_btn) {
            _btn.disabled = true;
            _btn.setAttribute && _btn.setAttribute('disabled','disabled');
            _btn.classList && _btn.classList.add('disabled');
          } else {
            // Si aún no existe (por orden de carga), marcar una bandera para aplicarlo después
            window._disableSubmitRequested = true;
          }
        } catch (e) { console.warn('No se pudo deshabilitar submit_docentes en el case cancel', e); }
        swal("Póngase en contacto", "Se le recomienda mandar un email al jefe del departamento y comentarle su situación. En caso de que llene el formulario se toma por entendido que no tiene problemas con lo mencionado con anterioridad", "warning");
        break;
    }
    // No tratar otros dismiss (backdrop/esc) como cancel; el caso 'cancel' en el switch
    // solo se ejecuta cuando el wrapper devuelve 'cancel' (usuario pulsó el botón)
    // nada de null u otros valores.
  });
}

/**
 * Inicialización adicional: obtener metadata del trimestre indicado en la URL
 * y rellenar los elementos del DOM (titulo, texto-trimestre, fecha-limite).
 * Usa fetch() y cadenas de promesas (Promises) para respetar el requisito.
 */
function initTrimMetadata() {
  try {
    const params = new URLSearchParams(window.location.search);
    const trimParam = params.get('trim') || params.get('idTrimestre');
    if (!trimParam) return Promise.resolve(null);
    const id = parseInt(trimParam, 10);
    if (isNaN(id) || id <= 0) return Promise.reject(new Error('trim inválido'));

    // Llamar al controlador que retorna datos del trimestre
    return fetch('controlador/recuperarTrimestre.php?trim=' + encodeURIComponent(id), { method: 'GET', credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('Error en la respuesta del servidor');
        return response.json();
      })
      .then(function(json) {
        if (!json || !json.ok) throw new Error(json && json.error ? json.error : 'Respuesta inválida');
        return json.data; // puede ser null si no existe
      })
      .then(function(data) {
        if (!data) return null;
        // Poner texto en los elementos del DOM
        const titulo = document.getElementById('titulo-trimestre');
        const texto = document.getElementById('texto-trimestre');
        const fecha = document.getElementById('fecha-limite');
        const periodo = data.periodoNombre || data.sigla || '';
        const sigla = data.sigla || '';
        const anio = data.año || data.anio || '';
        // Preferir mostrar año+sigla (ej. 2025A) si ambos están presentes
        let textoTrim = '';
        if (anio && sigla) {
              // Mostrar con guion entre año y sigla, por ejemplo: 2025-A
              textoTrim = String(anio) + '-' + String(sigla);
            } else {
          textoTrim = [periodo, sigla, anio].filter(Boolean).join(' ');
        }
        if (titulo) titulo.textContent = 'Programación Docente ' + (textoTrim || '');
        if (texto) texto.textContent = textoTrim;
        if (fecha) fecha.textContent = formatDateSpanish(data.fechaLimite) || '';
        return data;
      });
  } catch (err) {
    return Promise.reject(err);
  }
}

var emailEl = document.getElementById('email');
if (emailEl) {
  emailEl.addEventListener('input', function(e) {
    var campo = e.target;
    var valido = document.getElementById('emailOK');

    var reg =
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    var regOficial=
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    //Se muestra un texto a modo de ejemplo, luego va a ser un icono
    if (!valido) return;
    if (reg.test(campo.value) && regOficial.test(campo.value)) {
      valido.innerText = "Email válido";
    } else if (reg.test(campo.value)) {
      valido.innerText = "Email válido";
    } else {
      valido.innerText = "Email incorrecto";
    }
  });
}



//Se ejecuta al dar click en "Guardar", realiza el llamado AJAX a insertarPreferenciasTrimestralDocente.php
function guardar(){
  // Protección: si el envío fue deshabilitado por no aceptar el aviso, bloquear aquí
  try {
    var _submitBtnGuard = document.getElementById('submit_docentes');
    if ((_submitBtnGuard && _submitBtnGuard.disabled) || window._disableSubmitRequested) {
      swal({ title: "Aviso", text: "No puede enviar el formulario hasta aceptar el aviso inicial.", icon: "warning" });
      return;
    }
  } catch(e) { /* ignore */ }
  var msg_err="";
  var validacion_err= 0;
  // El id del trimestre es obligatorio: comprobar que venga en la URL o en el formulario
  try {
    const paramsCheck = new URLSearchParams(window.location.search);
    const trimParamCheck = paramsCheck.get('trim') || paramsCheck.get('idTrimestre');
    if (!trimParamCheck) {
      swal({ title: "Trimestre requerido", text: "Sin saber el trimestre no se puede enviar el formulario.", icon: "error" });
      return;
    }
  } catch (e) {
    // si algo falla al parsear, impedir envío por seguridad
    swal({ title: "Trimestre requerido", text: "Sin saber el trimestre no se puede enviar el formulario.", icon: "error" });
    return;
  }
  
  var numEcon= document.getElementById("noEcon").value;
  if(!numEcon){
    validacion_err++;
    msg_err+="Ingrese su número económico.\n";
  }
  
  var email= document.getElementById("email").value;
  if(!email){
    validacion_err++;
    msg_err+="Ingrese el email proporcionado al Departamento de Ciencias Básicas.\n";
  }  

  var grupos = document.getElementById("noGrup").value;
  if(grupos == "" || grupos<2){
    validacion_err++;
    msg_err+="El número mínimo de grupos es 2.\n";
    //alert("El número mínimo de grupos es 2.");
  }

  var uea1 = document.getElementById("uea1").value;
  var uea2 = document.getElementById("uea2").value;
  var uea3 = document.getElementById("uea3").value;
  var uea4 = document.getElementById("uea4").value;
  var uea5 = document.getElementById("uea5").value;

  // console.log(uea1 + " "+ uea2  + " "+ uea3 );
  if( !(uea1 != 0 && uea2 != 0 && uea3 != 0 && uea4 != 0 && uea5 != 0) ){
    msg_err+= "Debe escoger 5 UEA.\n";
    validacion_err++;
    //alert("Debe escoger 3 UEA's como mínimo.");
  }

  if ( uea5!=0 || uea4!= 0 ){
    if( !(uea1 != uea2 && uea1 != uea3 && uea1 != uea4 && uea1 != uea5)
        || !(uea2!= uea3 && uea2!= uea4 && uea2!= uea5)
        || !(uea3!= uea4 && uea3!= uea5)
        || !(uea4!= uea5)){
          msg_err+= "Las UEA deben ser diferentes entre sí.\n";
          validacion_err++;
          //alert("Las UEA's deben ser diferentes entre sí.");
        }
  } else {
    if( !(uea1 != uea2 && uea1 != uea3 && uea1 != uea4 && uea1 != uea5)
      || !(uea2!= uea3 && uea2!= uea4 && uea2!= uea5)
      || !(uea3!= uea4 && uea3!= uea5)){
        msg_err+= "Las UEA deben ser diferentes entre sí.\n";
        validacion_err++;
        //alert("Las UEA's deben ser diferentes entre sí.");
      }
  }

  formularioDocentes = document.querySelector('#form-docentes');
  const datos = new FormData(formularioDocentes);
  //console.log(...datos);
  var checkboxes = document.querySelectorAll('input[type="checkbox"]');
  var total_checkboxes=0;
  var total_l=0;
  var total_ma=0;
  var total_mi=0;
  var total_j=0;
  var total_v=0;
  for (let k = 0; k < checkboxes.length; k++) {
    try {
      var cb = checkboxes[k];
      if (!cb || cb.checked !== true) continue;
      total_checkboxes++;
      // Preferir atributo data-day (lu, ma, mi, ju, vi) establecido al construir la tabla
      var dayAttr = cb.getAttribute && cb.getAttribute('data-day');
      if (dayAttr) {
        switch (String(dayAttr).toLowerCase()) {
          case 'lu': total_l++; break;
          case 'ma': total_ma++; break;
          case 'mi': total_mi++; break;
          case 'ju': total_j++; break;
          case 'vi': total_v++; break;
          default: break;
        }
        continue;
      }
      // Fallback: si no existe data-day, inferir columna a partir del value numérico antiguo (1..45)
      var valNum = Number(cb.value);
      if (!isNaN(valNum) && valNum > 0) {
        var col = ((valNum - 1) % 5); // 0 -> lunes, 1 -> martes, ...
        if (col === 0) total_l++;
        else if (col === 1) total_ma++;
        else if (col === 2) total_mi++;
        else if (col === 3) total_j++;
        else if (col === 4) total_v++;
      }
    } catch (e) { console.warn('Error evaluando checkbox horario:', e); }
  }
  //var checkedOne = Array.prototype.slice.call(checkboxes).some(x => x.checked);
  //console.log(checkedOne);
  if( total_l<3 || total_ma<3 || total_mi<3 ||
  	total_j<3 || total_v<3){
      msg_err+= "Debe seleccionar al menos tres horarios por día.";
      validacion_err++;
    }
    
  if( !(validacion_err!= 0)){
    swal({
      title: "¡Procesando!",
      text: "Se esta procesando la información,\npor favor espere al mensaje de confirmación.",
      icon: "info",
    });
    
    //ver los datos que se envian del formulario en la consola
    //console.log(...datos);

    // crear el llamado a ajax usando fetch (Promises)
    fetch('controlador/insertarPreferenciasTrimestralDocente.php', {
      method: 'POST',
      body: datos,
      credentials: 'same-origin'
    })
    .then(function(response) {
      return response.text().then(function(text){
        // intentar parsear JSON, si falla devolver error claro
        try { return JSON.parse(text); } catch (e) { throw new Error('Respuesta no JSON: ' + text); }
      });
    })
    .then(function(respuesta) {
      console.log('respuesta', respuesta);
      if (respuesta && respuesta.respuesta === 'correcto') {
        // Mostrar solo el SweetAlert de éxito; no ocultar el formulario
        swal({ title: "Éxito", text: "Se cargó la información de forma correcta.", icon: "success" });
        try { alertWarning.style.display = "none"; } catch(e){}
        // Resetear el formulario para dejarlo vacío pero conservar campos hidden (ej. trim)
        try {
          var formEl = (typeof formularioDocentes !== 'undefined' && formularioDocentes) ? formularioDocentes : document.querySelector('#form-docentes');
          if (formEl && typeof formEl.reset === 'function') {
            formEl.reset();
            // Asegurar que todos los checkboxes quedan desmarcados
            try {
              var cbs = formEl.querySelectorAll && formEl.querySelectorAll('input[type="checkbox"]');
              if (cbs && cbs.length) {
                cbs.forEach(function(cb){ try { cb.checked = false; } catch(e){} });
              }
            } catch(e){ /* noop */ }
          }
        } catch (e) { console.warn('Error reseteando formulario:', e); }
      } else {
        swal({ title: "¡Error!", text: (respuesta && respuesta.mensaje) ? respuesta.mensaje : "Ocurrió un error al procesar el formulario.", icon: "error" });
        if (respuesta && respuesta.mensaje) {
          try { setAlert(alertWarning, '¡Atención!', respuesta.mensaje, 'app-alert-error'); } catch(e){}
        }
        try { $('html, body').animate({scrollTop:0}, 'slow'); } catch(e){}
      }
    })
    .catch(function(err){
      console.error('Fetch error:', err);
      swal({ title: "¡Error!", text: "Ocurrió un error al enviar la petición: " + (err && err.message ? err.message : String(err)), icon: "error" });
    });
  } else {
    //alert( msg_err);
    swal({
      title: "¡Error!",
      text: msg_err,
      icon: "warning",
    });
    //alert("Debe seleccionar al menos tres horarios por día.");
  }
}

// Ejecutar la inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Comprobar que el id del trimestre está presente en la URL; es obligatorio para enviar
  try {
    const params = new URLSearchParams(window.location.search);
    const trimParam = params.get('trim') || params.get('idTrimestre');
    if (!trimParam) {
      // Mostrar mensaje y deshabilitar envío.
      swal({ title: "Trimestre requerido", text: "Sin saber el trimestre no se puede enviar el formulario.", icon: "error" });
      // Marcar bandera para que la lógica de deshabilitado la aplique si el botón aún no existe
      window._disableSubmitRequested = true;
      // También mostrar alerta visible en la página
      try {
        setAlert(alertWarning, '¡Atención!', 'Sin saber el trimestre no se puede enviar el formulario.', 'app-alert-error');
      } catch (e) {}
    } else {
      // Si existe trim, añadirlo como input hidden dentro del formulario para que FormData lo incluya
      try {
        var formulario = document.querySelector('#form-docentes');
        if (formulario) {
          var existing = formulario.querySelector('input[name="trim"]');
          if (!existing) {
            var hid = document.createElement('input'); hid.type = 'hidden'; hid.name = 'trim'; hid.value = trimParam;
            formulario.appendChild(hid);
          } else {
            existing.value = trimParam;
          }
        }
      } catch (e) { console.warn('No se pudo anexar campo trim al formulario', e); }

      // Primero obtener metadata del trimestre para mostrarla en el aviso
      initTrimMetadata().then(function(data){
        try { onLoad(data); } catch (e) { console.warn('onLoad fallo:', e); }
      }).catch(function(err){
        var msg = err && err.message ? err.message : 'No se pudo recuperar metadata de trimestre.';
        console.warn('No se pudo recuperar metadata de trimestre:', msg);
        try {
          // Intentar mostrar SweetAlert si está disponible
          var shown = false;
          try {
            if (typeof swal === 'function') { swal("Trimestre no disponible", msg, "error"); shown = true; }
            else if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') { Swal.fire({ title: 'Trimestre no disponible', text: msg, icon: 'error' }); shown = true; }
          } catch (e) { /* ignore and fallback */ }

          // Mostrar aviso visible en la página usando las clases definidas en /css/styles.css
          if (!shown) {
            if (alertWarning) {
              // Agregar estructura semántica y clases para estilizar desde /css/styles.css
              setAlert(alertWarning, '¡Atención!', msg, 'app-alert-error');
            } else {
              // último recurso: native alert
              alert('Trimestre no disponible: ' + msg);
            }
          } else {
            // igualmente mostrar en el banner para usuarios sin soporte de popups
            try { if (alertWarning) { setAlert(alertWarning, '¡Atención!', msg, 'app-alert-error'); } } catch(e){}
          }

          // Deshabilitar envío por seguridad
          try { window._disableSubmitRequested = true; disableSubmitButton(); } catch(e){}
        } catch (e) { console.warn('No se pudo mostrar aviso de trimestre:', e); }
        // No llamar a onLoad(null) cuando falla la recuperación de metadata.
        // Evitamos así que se muestre el aviso inicial que corresponde sólo a un
        // trimestre válido; la página queda en estado de error y el envío queda
        // deshabilitado por seguridad.
        try { window._trimLoadFailed = true; } catch(e){}
      });
    }
  } catch (err) {
    console.warn('Error comprobando trim en URL', err);
    swal({ title: "Trimestre requerido", text: "Sin saber el trimestre no se puede enviar el formulario.", icon: "error" });
    window._disableSubmitRequested = true;
  }
  // Si en el aviso se pidió deshabilitar el submit antes de que el formulario exista,
  // aplicar la deshabilitación inmediatamente después de la carga.
  setTimeout(function(){
    try {
      if (window._disableSubmitRequested) {
        var _b = document.getElementById('submit_docentes');
        if (_b) {
          _b.disabled = true;
          _b.classList && _b.classList.add('disabled');
          window._disableSubmitRequested = false;
        }
      }
    } catch(e){/* silencioso */}
  }, 50);
});
