// js/login.js
// Mejora UX del formulario de login: evita envíos dobles, muestra estado y valida campos mínimos.

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('login');
  if (!form) return;
  var submitBtn = form.querySelector('button[type="submit"]');

  // Crear placeholder para mostrar intentos si no existe
  var intentosInfo = document.getElementById('intentos_info');
  // Crear placeholder para mostrar mensaje de error general (debajo de "Iniciar sesión")
  var errorInfo = document.getElementById('login_error');
  if (!errorInfo) {
    errorInfo = document.createElement('div');
    errorInfo.id = 'login_error';
    errorInfo.style.marginBottom = '8px';
    errorInfo.style.fontSize = '1rem';
    // Insertarlo al principio del formulario (debajo del título "Iniciar sesión")
    if (form.firstChild) form.insertBefore(errorInfo, form.firstChild);
    else form.appendChild(errorInfo);
  }
  if (!intentosInfo) {
    intentosInfo = document.createElement('div');
    intentosInfo.id = 'intentos_info';
    intentosInfo.className = 'intentos-info';
    // Insertarlo después del campo de contraseña
    var pwdInput = document.getElementById('passw');
    if (pwdInput && pwdInput.parentNode) {
      pwdInput.parentNode.appendChild(intentosInfo);
    } else {
      form.appendChild(intentosInfo);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Simple protección contra envíos dobles
    if (submitBtn) {
      submitBtn.disabled = true;
      var originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando...';
    }

    // Enviar por POST usando Fetch (Promise) con FormData
    // Helper para mostrar avisos (preferentemente SweetAlert, fallback a inline)
    function showAlertMessage(message, type) {
      type = type || 'error';
      if (window.Swal && typeof Swal.fire === 'function') {
        var title = (type === 'error') ? 'Error' : ((type === 'success') ? 'Correcto' : 'Aviso');
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
        try { swal(message); } catch (e) { if (errorInfo) { errorInfo.textContent = message; errorInfo.className = 'intentos-info'; } }
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
    })
      .then(function (response) {
        if (response.status === 429) {
          return response.json().then(result => {
            throw new Error(result.msg || 'Demasiados intentos. Intente más tarde.');
          });
        }
        if (!response.ok) throw new Error('HTTP error ' + response.status);
        return response.json();
      })
      .then(function (result) {
        if (!result || !result.success) {
          var serverMsg = (result && (result.error || result.msg)) ? (result.error || result.msg) : null;
          var displayMsg = serverMsg ? serverMsg : 'Usuario o contraseña incorrecto.';


          showAlertMessage(displayMsg, 'error');

          if (pwdInput) {
            try { pwdInput.value = ''; pwdInput.focus(); } catch (e) { console.log(e); }
          }

          if (intentosInfo) {
            intentosInfo.textContent = '';
          }

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }
          return;
        }

        var destino = 'index.php';
        window.location.href = destino;
      })
      .catch(function (err) {
        console.error('Error en validación de login:', err);

        showAlertMessage(err.message || 'Error de conexión al validar. Intente más tarde.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
  });

  // Mejora: permitir mostrar/ocultar contraseña si se agrega un control
  var pwdInput = document.getElementById('passw');
  if (pwdInput) {
    // Limpiar mensaje general al modificar la contraseña
    pwdInput.addEventListener('input', function () {
      if (errorInfo) errorInfo.textContent = '';
    });
    // Crear toggle si no existe
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
  }
});
