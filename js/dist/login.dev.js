"use strict";

// js/login.js
// Mejora UX del formulario de login: evita envíos dobles, muestra estado y valida campos mínimos.
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('login');
  if (!form) return;
  var submitBtn = form.querySelector('button[type="submit"]'); // Crear placeholder para mostrar intentos si no existe

  var intentosInfo = document.getElementById('intentos_info'); // Crear placeholder para mostrar mensaje de error general (debajo de "Iniciar sesión")

  var errorInfo = document.getElementById('login_error');

  if (!errorInfo) {
    errorInfo = document.createElement('div');
    errorInfo.id = 'login_error';
    errorInfo.style.marginBottom = '8px';
    errorInfo.style.fontSize = '1rem'; // Insertarlo al principio del formulario (debajo del título "Iniciar sesión")

    if (form.firstChild) form.insertBefore(errorInfo, form.firstChild);else form.appendChild(errorInfo);
  }

  if (!intentosInfo) {
    intentosInfo = document.createElement('div');
    intentosInfo.id = 'intentos_info';
    intentosInfo.className = 'intentos-info'; // Insertarlo después del campo de contraseña

    var pwdInput = document.getElementById('passw');

    if (pwdInput && pwdInput.parentNode) {
      pwdInput.parentNode.appendChild(intentosInfo);
    } else {
      form.appendChild(intentosInfo);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // Simple protección contra envíos dobles

    if (submitBtn) {
      submitBtn.disabled = true;
      var originalText = submitBtn.textContent;
      submitBtn.textContent = 'Validando...';
    } // Enviar por POST usando Fetch (Promise) con FormData
    // Helper para mostrar avisos (preferentemente SweetAlert, fallback a inline)


    function showAlertMessage(message, type) {
      type = type || 'error';

      if (window.Swal && typeof Swal.fire === 'function') {
        var title = type === 'error' ? 'Error' : type === 'success' ? 'Correcto' : 'Aviso';
        Swal.fire({
          title: title,
          text: message,
          icon: type,
          customClass: {
            popup: 'my-swal-popup',
            confirmButton: 'my-swal-confirm',
            cancelButton: 'my-swal-cancel'
          }
        });
      } else if (window.swal && typeof swal === 'function') {
        try {
          swal(message);
        } catch (e) {
          if (errorInfo) {
            errorInfo.textContent = message;
            errorInfo.className = 'intentos-info';
          }
        }
      } else {
        if (errorInfo) {
          errorInfo.textContent = message;
          errorInfo.className = 'intentos-info';
        } else {
          alert(message);
        }
      }
    }

    var formData = new FormData(form);
    fetch('controlador/validarlogin.php', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP error ' + response.status);
      return response.json();
    }).then(function (result) {
      if (!result || !result.success) {
        // Preparar mensaje de error general (debajo del título "Iniciar sesión")
        var serverMsg = result && (result.error || result.msg) ? result.error || result.msg : null; // Filtrar mensajes técnicos no deseados (por ejemplo 'Intento incrementado')

        if (serverMsg && /incrementa|increment|incrementado/i.test(serverMsg)) {
          serverMsg = null;
        }

        var displayMsg = serverMsg ? serverMsg : 'Usuario o contraseña incorrecto.'; // Mostrar el mensaje general usando SweetAlert (fallback inline)

        showAlertMessage(displayMsg, 'error'); // Borrar y enfocar el campo de contraseña para seguridad/UX

        if (pwdInput) {
          try {
            pwdInput.value = '';
            pwdInput.focus();
          } catch (e) {
            /* ignore */
          }
        } // Mostrar sólo los intentos restantes justo debajo de la contraseña


        var intento = result && typeof result.intento !== 'undefined' ? parseInt(result.intento, 10) : null;
        var max = result && typeof result.max !== 'undefined' ? parseInt(result.max, 10) : 3;

        if (intento !== null && !isNaN(intento)) {
          var restantes = max - intento;

          if (restantes <= 0) {
            intentosInfo.textContent = 'Cuenta bloqueada (0 intentos restantes).';
            intentosInfo.className = 'intentos-info intentos-info--blocked';
          } else if (restantes === 1) {
            intentosInfo.textContent = '1 intento restante antes del bloqueo.';
            intentosInfo.className = 'intentos-info intentos-info--warn';
          } else {
            intentosInfo.textContent = 'Intentos restantes: ' + restantes + ' / ' + max;
            intentosInfo.className = 'intentos-info';
          }
        } else {
          // No hay info de intentos: limpiar la zona de intentos para no mostrar mensajes mezclados
          intentosInfo.textContent = '';
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }

        return;
      } // Login exitoso — redirigir según función


      var funcion = (result.funcion_name || '').toLowerCase();
      var destino = 'index.php';

      switch (funcion) {
        case 'administrador':
          destino = 'index_administrador.php';
          break;

        case 'consulta':
          destino = 'index_consulta.php';
          break;

        case 'registro':
          destino = 'index_registro.php';
          break;

        case 'horarios':
          destino = 'index_horarios.php';
          break;

        case 'profesor':
          destino = 'index_profesor.php';
          break;
      } // Redirigir pasando user en la querystring


      window.location.href = destino + '?user=' + encodeURIComponent(result.user_name || '');
    })["catch"](function (err) {
      console.error('Error en validación de login:', err); // Mostrar aviso de error con SweetAlert (intentos se mantienen en su zona)

      showAlertMessage('Error de conexión al validar. Intente más tarde.', 'error');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }); // Mejora: permitir mostrar/ocultar contraseña si se agrega un control

  var pwdInput = document.getElementById('passw');

  if (pwdInput) {
    // Limpiar mensaje general al modificar la contraseña
    pwdInput.addEventListener('input', function () {
      if (errorInfo) errorInfo.textContent = '';
    }); // Crear toggle si no existe

    var toggleId = 'toggle-passw';

    if (!document.getElementById(toggleId)) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = toggleId;
      toggle.className = 'btn btn-sm btn-outline-secondary ms-2';
      toggle.textContent = 'Mostrar';
      toggle.style.marginTop = '6px';
      pwdInput.parentNode.appendChild(toggle);
      toggle.addEventListener('click', function () {
        if (pwdInput.type === 'password') {
          pwdInput.type = 'text';
          toggle.textContent = 'Ocultar';
        } else {
          pwdInput.type = 'password';
          toggle.textContent = 'Mostrar';
        }
      });
    }
  } // Cuando cambie o pierda foco el campo usuario, consultar intentos


  var usuarioInput = document.getElementById('usuario');

  if (usuarioInput) {
    var consultaIntentos = function consultaIntentos() {
      var usuarioVal = usuarioInput.value.trim();

      if (!usuarioVal) {
        intentosInfo.textContent = '';
        return;
      }

      fetch('controlador/recuperaUsuarioIntentos.php?usuario=' + encodeURIComponent(usuarioVal), {
        credentials: 'same-origin'
      }).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      }).then(function (data) {
        if (!data || !data.success) {
          intentosInfo.textContent = data && data.error ? 'Error: ' + data.error : '';
          intentosInfo.className = 'intentos-info intentos-info--muted';
          return;
        }

        var restantes = data.restantes;
        var max = data.max || 3;

        if (restantes <= 0) {
          intentosInfo.textContent = 'Usuario bloqueado (0 intentos restantes).';
          intentosInfo.className = 'intentos-info intentos-info--blocked';
        } else if (restantes === 1) {
          intentosInfo.textContent = 'Cuidado: 1 intento restante antes de bloqueo.';
          intentosInfo.className = 'intentos-info intentos-info--warn';
        } else {
          intentosInfo.textContent = 'Intentos restantes: ' + restantes + ' / ' + max;
          intentosInfo.className = 'intentos-info';
        }
      })["catch"](function (err) {
        console.error('Error al consultar intentos:', err);
        intentosInfo.textContent = 'No se pudo consultar intentos.';
        intentosInfo.className = 'intentos-info intentos-info--muted';
      });
    };

    usuarioInput.addEventListener('blur', consultaIntentos);
    usuarioInput.addEventListener('input', function () {
      // opcional: debounce - aquí simple cancel previous text
      intentosInfo.textContent = '';
      if (errorInfo) errorInfo.textContent = '';
    }); // si ya hay valor en carga, consultar

    if (usuarioInput.value && usuarioInput.value.trim().length > 0) {
      consultaIntentos();
    }
  }
});