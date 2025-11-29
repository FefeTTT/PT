"use strict";

var alertWarning = document.getElementById('resp-warning');
alertWarning.style.display = "none";
var alertSuccess = document.getElementById('resp-success');
alertSuccess.style.display = "none";

function pulsar(e) {
  if (e.which === 13 && !e.shiftKey) {
    e.preventDefault();
    console.log('prevented');
    return false;
  }
}

function onLoad() {
  swal({
    title: "Aviso sobre asignación de UEAS",
    text: "Estimad@ profesor(a), es importante mencionarles que debido a la demanda docente en el Departamento de Ciencias Básicas se deben cubrir dos UEA en licenciatura y en caso de apoyar en alguna UEA de posgrado u otro deptartamento se debe solicitar previa autorización a la jefatura",
    icon: "info",
    buttons: {
      cancel: "Tengo problemas con ello",
      ok: "Le he entendido y estoy de acuerdo"
    } // buttons: ["Tengo problemas con ello", "Le he entendido y estoy de acuerdo"],

  }).then(function (value) {
    switch (value) {
      case "ok":
        swal("Ententido", "Muy bien, proceda con su llenado de preferencias", "success");
        break;

      default:
        swal("Pongase en contacto", "Se le recomienda mandar un email al jefe del departamento y comentarle su situación. En caso de que llene el formulario se toma por entendido que no tiene problemas con lo mencionado con anterioridad", "warning");
        break;
    }
  });
}

document.getElementById('email').addEventListener('input', function () {
  campo = event.target;
  valido = document.getElementById('emailOK');
  var reg = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var regOficial = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/; //Se muestra un texto a modo de ejemplo, luego va a ser un icono

  if (reg.test(campo.value) && regOficial.test(campo.value)) {
    valido.innerText = "Email válido"; //valido.innerText = "válido oficial y extraoficialmente";
  } else if (reg.test(campo.value)) {
    valido.innerText = "Email válido"; //valido.innerText = "válido extraoficialmente";
  } else {
    valido.innerText = "Email incorrecto";
  }
}); //Se ejecuta al dar click en "Guardar", realiza el llamado AJAX a insertarPreferenciasTrimestralDocente.php

function guardar() {
  var msg_err = "";
  var validacion_err = 0;
  var numEcon = document.getElementById("noEcon").value;

  if (!numEcon) {
    validacion_err++;
    msg_err += "Ingrese su número económico.\n";
  }

  var email = document.getElementById("email").value;

  if (!email) {
    validacion_err++;
    msg_err += "Ingrese el email proporcionado al Departamento de Ciencias Básicas.\n";
  }

  var grupos = document.getElementById("noGrup").value;

  if (grupos == "" || grupos < 2) {
    validacion_err++;
    msg_err += "El número mínimo de grupos es 2.\n"; //alert("El número mínimo de grupos es 2.");
  }

  var uea1 = document.getElementById("uea1").value;
  var uea2 = document.getElementById("uea2").value;
  var uea3 = document.getElementById("uea3").value;
  var uea4 = document.getElementById("uea4").value;
  var uea5 = document.getElementById("uea5").value; // console.log(uea1 + " "+ uea2  + " "+ uea3 );

  if (!(uea1 != 0 && uea2 != 0 && uea3 != 0 && uea4 != 0 && uea5 != 0)) {
    msg_err += "Debe escoger 5 uea's.\n";
    validacion_err++; //alert("Debe escoger 3 UEA's como mínimo.");
  }

  if (uea5 != 0 || uea4 != 0) {
    if (!(uea1 != uea2 && uea1 != uea3 && uea1 != uea4 && uea1 != uea5) || !(uea2 != uea3 && uea2 != uea4 && uea2 != uea5) || !(uea3 != uea4 && uea3 != uea5) || !(uea4 != uea5)) {
      msg_err += "Las UEA's deben ser diferentes entre sí.\n";
      validacion_err++; //alert("Las UEA's deben ser diferentes entre sí.");
    }
  } else {
    if (!(uea1 != uea2 && uea1 != uea3 && uea1 != uea4 && uea1 != uea5) || !(uea2 != uea3 && uea2 != uea4 && uea2 != uea5) || !(uea3 != uea4 && uea3 != uea5)) {
      msg_err += "Las UEA's deben ser diferentes entre sí.\n";
      validacion_err++; //alert("Las UEA's deben ser diferentes entre sí.");
    }
  }

  formularioDocentes = document.querySelector('#form-docentes');
  var datos = new FormData(formularioDocentes); //console.log(...datos);

  var checkboxes = document.querySelectorAll('input[type="checkbox"]');
  var total_checkboxes = 0;
  var total_l = 0;
  var total_ma = 0;
  var total_mi = 0;
  var total_j = 0;
  var total_v = 0;

  for (var k = 0; k < checkboxes.length; k++) {
    if (checkboxes[k].checked == true) {
      total_checkboxes++;
      if (checkboxes[k].value == 1 || checkboxes[k].value == 6 || checkboxes[k].value == 11 || checkboxes[k].value == 16 || checkboxes[k].value == 21 || checkboxes[k].value == 26 || checkboxes[k].value == 31 || checkboxes[k].value == 36 || checkboxes[k].value == 41) total_l++;
      if (checkboxes[k].value == 2 || checkboxes[k].value == 7 || checkboxes[k].value == 12 || checkboxes[k].value == 17 || checkboxes[k].value == 22 || checkboxes[k].value == 27 || checkboxes[k].value == 32 || checkboxes[k].value == 37 || checkboxes[k].value == 42) total_ma++;
      if (checkboxes[k].value == 3 || checkboxes[k].value == 8 || checkboxes[k].value == 13 || checkboxes[k].value == 18 || checkboxes[k].value == 23 || checkboxes[k].value == 28 || checkboxes[k].value == 33 || checkboxes[k].value == 38 || checkboxes[k].value == 43) total_mi++;
      if (checkboxes[k].value == 4 || checkboxes[k].value == 9 || checkboxes[k].value == 14 || checkboxes[k].value == 19 || checkboxes[k].value == 24 || checkboxes[k].value == 29 || checkboxes[k].value == 34 || checkboxes[k].value == 39 || checkboxes[k].value == 44) total_j++;
      if (checkboxes[k].value == 5 || checkboxes[k].value == 10 || checkboxes[k].value == 15 || checkboxes[k].value == 20 || checkboxes[k].value == 25 || checkboxes[k].value == 30 || checkboxes[k].value == 35 || checkboxes[k].value == 40 || checkboxes[k].value == 45) total_v++;
    }
  } //var checkedOne = Array.prototype.slice.call(checkboxes).some(x => x.checked);
  //console.log(checkedOne);


  if (total_l < 3 || total_ma < 3 || total_mi < 3 || total_j < 3 || total_v < 3) {
    msg_err += "Debe seleccionar al menos tres horarios por día.";
    validacion_err++;
  }

  if (!(validacion_err != 0)) {
    swal({
      title: "¡Procesando!",
      text: "Se esta procesando la información,\npor favor espere al mensaje de confirmación.",
      icon: "info"
    }); // ver la ueas por el orden

    console.log(uea1 + ", " + uea2 + ", " + uea3 + ", " + uea4 + ", " + uea5); // crear el llamado a ajax

    var xhr = new XMLHttpRequest(); // abrir la conexión.

  xhr.open('POST', '../controlador/insertarPreferenciasTrimestralDocente.php', true); // retorno de datos

    xhr.onload = function () {
      if (this.status === 200) {
        console.log(xhr.responseText);
        var respuesta = JSON.parse(xhr.responseText);
        console.log(respuesta); // Si la respuesta es correcta

        if (respuesta.respuesta === 'correcto') {
          swal({
            title: "Éxito",
            text: "Se cargo la información de forma correcta",
            icon: "success"
          });
          alertSuccess.innerHTML = '<h2 class="alert-heading">¡Gracias!</h2>' + '<h5>' + respuesta.mensaje + '</h5>';
          alertSuccess.style.display = "block";
          var contenedor = document.getElementById('contenedor-docente');
          alertWarning.style.display = "none";
          contenedor.style.display = "none";
        } else {
          // Hubo un error
          swal({
            title: "¡Error!",
            text: "Ocurrió un error al procesar el formulario.",
            icon: "error"
          });
          alertWarning.innerHTML = '<h1 class="alert-heading">¡Atención!</h1>' + '<h3>' + respuesta.mensaje + '</h3>';
          alertWarning.style.display = "block";
          $('html, body').animate({
            scrollTop: 0
          }, 'slow');
        }
      }
    }; // Enviar la petición


    xhr.send(datos);
  } else {
    //alert( msg_err);
    swal({
      title: "¡Error!",
      text: msg_err,
      icon: "warning"
    }); //alert("Debe seleccionar al menos tres horarios por día.");
  }
}