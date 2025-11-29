"use strict";

function cat_ejemplo(tipo) {
  if (tipo == 'grupoMensajeria') {
    var Ancho = screen.width;
    var Alto = screen.height;
    var A = Ancho * 100 / 100;
    var H = Alto * 30 / 100;
    var difA = Ancho - A;
    var difH = Alto + H;
    var tope = difH / 2;
    var lado = difA / 2;
    var Opciones = "status=no, menubar=no, directories=no, location=no, toolbar=no, scrollbars=yes, resizable=no, " + "width=" + A + ", height=" + H + ", top=" + tope + ", left=" + lado + "";
    Ventana = open("img_catalogos.php?cat=" + tipo, "_blank", Opciones);
  }
}

function guardarGrupo() {
  var archivo = $("#import-file").val();

  if (archivo === "") {
    swal({
      title: "Alerta",
      text: "Debe seleccionar un archivo",
      icon: "error"
    });
    return false;
  } else if (document.getElementById('nombreGpr').value === "") {
    swal({
      title: "Alerta",
      text: "Escriba un nombre para el grupo",
      icon: "error"
    });
    return false;
  }

  var formData = new FormData();
  var files = $("#import-file")[0].files[0];
  formData.append('archivoexcel', files);
  formData.append('nombreGrupo', document.getElementById('nombreGpr').value);
  $.ajax({
    url: 'controlador/guardar_grupo.php',
    type: 'POST',
    data: formData,
    contentType: false,
    processData: false,
    success: function success(resp) {
      swal({
        title: "Grupo guardado",
        text: resp,
        icon: "success"
      });
      refrescarGrupos();
      document.getElementById('nombreGpr').value = "";
      document.getElementById('import-file').value = "";
    }
  });
  return false;
}

function onLoad() {
  cargaGrupos();
  cargarIntegranteGrp();
}

function cargaGrupos() {
  consultaGrupos().then(function (data) {
    return mostrarGrupos(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaGrupos() {
  var response, datos, data;
  return regeneratorRuntime.async(function consultaGrupos$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.next = 2;
          return regeneratorRuntime.awrap(fetch('controlador/recuperaCategorias.php'));

        case 2:
          response = _context.sent;

          if (!response.ok) {
            _context.next = 10;
            break;
          }

          _context.next = 6;
          return regeneratorRuntime.awrap(response.text());

        case 6:
          datos = _context.sent;
          console.log(data);
          data = JSON.parse(datos);
          return _context.abrupt("return", data);

        case 10:
        case "end":
          return _context.stop();
      }
    }
  });
}

function mostrarGrupos(data) {
  var tabla = document.getElementById('grupoEdicion');

  for (var i = 0; i < data.length; i++) {
    var opt = document.createElement('option');
    opt.value = data[i].idC;
    opt.innerHTML = data[i].nombreC;
    tabla.appendChild(opt);
  }
}

function refrescarGrupos() {
  var desplegable = document.getElementById('grupoEdicion');
  desplegable.innerHTML = '';
  var opt = document.createElement('option');
  opt.value = 0;
  opt.innerHTML = 'Seleccione un grupo';
  desplegable.appendChild(opt);
  cargaGrupos();
}

function cargarIntegranteGrp() {
  consultaIntegranteGrp().then(function (data) {
    return mostrarIntegranteGrp(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaIntegranteGrp() {
  var select, response, datos, data;
  return regeneratorRuntime.async(function consultaIntegranteGrp$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          select = document.getElementById("grupoEdicion").value;
          _context2.next = 3;
          return regeneratorRuntime.awrap(fetch('controlador/recuperaIntegrantesIDC.php?idC=' + select));

        case 3:
          response = _context2.sent;

          if (!response.ok) {
            _context2.next = 10;
            break;
          }

          _context2.next = 7;
          return regeneratorRuntime.awrap(response.text());

        case 7:
          datos = _context2.sent;
          //console.log(data);
          data = JSON.parse(datos);
          return _context2.abrupt("return", data);

        case 10:
        case "end":
          return _context2.stop();
      }
    }
  });
}

function mostrarIntegranteGrp(data) {
  var div = document.getElementById('bloque_integrantes');
  var divCaja = document.getElementById('editarGpr');
  var divEliminar = document.getElementById('boton_eliminar');
  div.innerHTML = "";
  divEliminar.innerHTML = "";

  if (data.length != 0) {
    if (div.className == "col-sm-9 col-xs-12 text-center") div.className = "col-sm-9 col-xs-12";
    divCaja.style.display = "block";
    var tabla = document.createElement("table");
    var tblHead = document.createElement("thead");
    var hilHead = document.createElement("tr");
    tabla.className = "table table-hover";
    tblHead.className = "thead-dark";
    var celHead0 = document.createElement("th");
    var textoCelda = document.createTextNode("ID");
    celHead0.scope = "col";
    celHead0.appendChild(textoCelda);
    var celHead1 = document.createElement("th");
    textoCelda = document.createTextNode("Nombre");
    celHead1.scope = "col";
    celHead1.appendChild(textoCelda);
    var celHead2 = document.createElement("th");
    textoCelda = document.createTextNode("Email");
    celHead2.scope = "col";
    celHead2.appendChild(textoCelda);
    var celHead3 = document.createElement("th");
    textoCelda = document.createTextNode("Saludo");
    celHead3.scope = "col";
    celHead3.appendChild(textoCelda);
    hilHead.appendChild(celHead0);
    hilHead.appendChild(celHead1);
    hilHead.appendChild(celHead2);
    hilHead.appendChild(celHead3);
    tblHead.appendChild(hilHead);
    tabla.appendChild(tblHead);
    tabla.setAttribute("border", "2");
    var tblBody = document.createElement("tbody");

    for (var i = 0; i < data.length; i++) {
      var hilBody = document.createElement("tr");
      hilBody.id = "row_" + data[i].idIntegrante;
      var celBody = document.createElement("td");
      textoCelda = document.createTextNode(data[i].idIntegrante);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      var celBody = document.createElement("td");
      textoCelda = document.createTextNode(data[i].nombre);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      var celBody = document.createElement("td");
      textoCelda = document.createTextNode(data[i].email);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      var celBody = document.createElement("td");
      textoCelda = document.createTextNode(data[i].saludo);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      var celBody = document.createElement("td");
      botonCelda = document.createElement("button");
      botonCelda.type = 'button';
      botonCelda.id = data[i].idIntegrante;
      botonCelda.innerText = 'Editar';

      botonCelda.onclick = function () {
        cargarEditarIntgr(this);
      };

      celBody.appendChild(botonCelda);
      botonCelda = document.createElement("button");
      botonCelda.type = 'button';
      botonCelda.id = data[i].idIntegrante;
      botonCelda.innerText = 'Borrar';

      botonCelda.onclick = function () {
        cargarBorrarIntgr(this);
      };

      celBody.appendChild(botonCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
    }

    var hilBody = document.createElement("tr");
    hilBody.id = "row_-1";
    var celBody = document.createElement("td");
    textoCelda = document.createTextNode("#");
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
    var celBody = document.createElement("td");
    var inputCelda = document.createElement("input");
    inputCelda.placeholder = "Nombre nuevo";
    inputCelda.id = "nombre_-1";
    inputCelda.name = "nombre_-1";
    inputCelda.type = "text";
    celBody.appendChild(inputCelda);
    hilBody.appendChild(celBody);
    var celBody = document.createElement("td");
    inputCelda = document.createElement("input");
    inputCelda.placeholder = "Email nuevo";
    inputCelda.id = "email_-1";
    inputCelda.name = "email_-1";
    inputCelda.type = "text";
    celBody.appendChild(inputCelda);
    hilBody.appendChild(celBody);
    var celBody = document.createElement("td");
    inputCelda = document.createElement("input");
    inputCelda.placeholder = "Saludo nuevo";
    inputCelda.id = "saludo_-1";
    inputCelda.name = "saludo_-1";
    inputCelda.type = "text";
    celBody.appendChild(inputCelda);
    hilBody.appendChild(celBody);
    var celBody = document.createElement("td");
    botonCelda = document.createElement("button");
    botonCelda.type = 'button';
    botonCelda.id = "-1";
    botonCelda.innerText = 'Agregar';

    botonCelda.onclick = function () {
      cargarAgregarIntgr(this);
    };

    celBody.appendChild(botonCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
    tabla.appendChild(tblBody);
    div.appendChild(tabla);
    divEliminar.style.display = "block";
    var botonEliminar = document.createElement("button");
    botonEliminar.type = 'button';
    botonEliminar.id = "eliminarGrp";
    botonEliminar.innerText = 'Eliminar el grupo';

    botonEliminar.onclick = function () {
      cargarEliminarGrp();
    };

    divEliminar.appendChild(botonEliminar);
  } else {
    div.innerHTML = "No hay miembros en el grupo";
    divCaja.style.display = "none";
    divEliminar.style.display = "none";
  }
}

function pulsar(e) {
  if (e.which === 13 && !e.shiftKey) {
    e.preventDefault();
    console.log('prevented');
    return false;
  }
}

function botonEditar(data) {
  alert("hola " + data.id);
}

function cargarEditarIntgr(data) {
  consultaEditarIntgr(data).then(function (data) {
    return mostrarEditarIntgr(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaEditarIntgr(data) {
  var response, datos;
  return regeneratorRuntime.async(function consultaEditarIntgr$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(fetch('controlador/recuperaIntegranteIDI.php?idIntgr=' + data.id));

        case 2:
          response = _context3.sent;

          if (!response.ok) {
            _context3.next = 9;
            break;
          }

          _context3.next = 6;
          return regeneratorRuntime.awrap(response.text());

        case 6:
          datos = _context3.sent;
          //console.log(data);
          data = JSON.parse(datos);
          return _context3.abrupt("return", data);

        case 9:
        case "end":
          return _context3.stop();
      }
    }
  });
}

function mostrarEditarIntgr(data) {
  var hilBody = document.getElementById('row_' + data[0].idIntegrante);
  hilBody.innerHTML = "";

  if (data.length != 0) {
    for (var i = 0; i < data.length; i++) {
      var celBody = document.createElement("td");
      textoCelda = document.createTextNode(data[i].idIntegrante);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      var celBody = document.createElement("td");
      var inputCelda = document.createElement("input");
      inputCelda.placeholder = data[i].nombre;
      inputCelda.id = "nombre_" + data[i].idIntegrante;
      inputCelda.name = "nombre_" + data[i].idIntegrante;
      inputCelda.type = "text";
      celBody.appendChild(inputCelda);
      hilBody.appendChild(celBody);
      var celBody = document.createElement("td");
      inputCelda = document.createElement("input");
      inputCelda.placeholder = data[i].email;
      inputCelda.id = "email_" + data[i].idIntegrante;
      inputCelda.name = "email_" + data[i].idIntegrante;
      inputCelda.type = "text";
      celBody.appendChild(inputCelda);
      hilBody.appendChild(celBody);
      var celBody = document.createElement("td");
      inputCelda = document.createElement("input");
      inputCelda.placeholder = data[i].saludo;
      inputCelda.id = "saludo_" + data[i].idIntegrante;
      inputCelda.name = "saludo_" + data[i].idIntegrante;
      inputCelda.type = "text";
      celBody.appendChild(inputCelda);
      hilBody.appendChild(celBody);
      var celBody = document.createElement("td");
      var botonCelda = document.createElement("button");
      botonCelda.type = 'button';
      botonCelda.id = data[i].idIntegrante;
      botonCelda.innerText = 'Guardar';

      botonCelda.onclick = function () {
        cargarActualizarIntgr(this);
      };

      celBody.appendChild(botonCelda);
      hilBody.appendChild(celBody);
    }
  } else {
    div.innerHTML = "No hay miembros en el grupo";
    var divCaja = document.getElementById('editarGpr');
    divCaja.style.display = "none";
  }
}

function cargarActualizarIntgr(data) {
  consultaActualizarIntgr(data).then(function (data) {
    return mostrarActualizarIntgr(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaActualizarIntgr(data) {
  var nombre, email, saludo, response, datos;
  return regeneratorRuntime.async(function consultaActualizarIntgr$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          nombre = document.getElementById('nombre_' + data.id).value;
          email = document.getElementById('email_' + data.id).value;
          saludo = document.getElementById('saludo_' + data.id).value;

          if (!(nombre == "" && email == "" && saludo == "")) {
            _context4.next = 5;
            break;
          }

          return _context4.abrupt("return", "");

        case 5:
          if (nombre == "") {
            nombre = document.getElementById('nombre_' + data.id).placeholder;
          }

          if (email == "") {
            email = document.getElementById('email_' + data.id).placeholder;
          }

          if (saludo == "") {
            saludo = document.getElementById('saludo_' + data.id).placeholder;
          }

          console.log('controlador/actualizaIntegrante.php?idIntgr=' + data.id + '&nombre=' + nombre + '&email=' + email + '&saludo=' + saludo);
          _context4.next = 11;
          return regeneratorRuntime.awrap(fetch('controlador/actualizaIntegrante.php?idIntgr=' + data.id + '&nombre=' + nombre + '&email=' + email + '&saludo=' + saludo));

        case 11:
          response = _context4.sent;

          if (!response.ok) {
            _context4.next = 18;
            break;
          }

          _context4.next = 15;
          return regeneratorRuntime.awrap(response.text());

        case 15:
          datos = _context4.sent;
          //console.log(data);
          data = JSON.parse(datos);
          return _context4.abrupt("return", data);

        case 18:
        case "end":
          return _context4.stop();
      }
    }
  });
}

function mostrarActualizarIntgr(data) {
  cargarIntegranteGrp();
}

function cargarBorrarIntgr(data) {
  consultaBorrarIntgr(data).then(function (data) {
    return mostrarBorrarIntgr(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaBorrarIntgr(data) {
  var response, datos;
  return regeneratorRuntime.async(function consultaBorrarIntgr$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.next = 2;
          return regeneratorRuntime.awrap(fetch('controlador/eliminaIntegranteIDI.php?idIntgr=' + data.id));

        case 2:
          response = _context5.sent;

          if (!response.ok) {
            _context5.next = 9;
            break;
          }

          _context5.next = 6;
          return regeneratorRuntime.awrap(response.text());

        case 6:
          datos = _context5.sent;
          //console.log(data);
          data = JSON.parse(datos);
          return _context5.abrupt("return", data);

        case 9:
        case "end":
          return _context5.stop();
      }
    }
  });
}

function mostrarBorrarIntgr(data) {
  cargarIntegranteGrp();
}

function cargarAgregarIntgr(data) {
  consultaAgregarIntgr(data).then(function (data) {
    return mostrarAgregarIntgr(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaAgregarIntgr(data) {
  var nombre, email, saludo, select, response, datos;
  return regeneratorRuntime.async(function consultaAgregarIntgr$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          nombre = document.getElementById('nombre_-1').value;
          email = document.getElementById('email_-1').value;
          saludo = document.getElementById('saludo_-1').value;

          if (!(nombre == "" || email == "" || saludo == "")) {
            _context6.next = 6;
            break;
          }

          swal({
            title: 'Error',
            text: "Debe llenar los 3 campos: nombre, email y saludo, para poder agregar un nuevo integrante al grupo.",
            icon: 'error'
          });
          return _context6.abrupt("return", "Datos de nuevo integrante incorrectos");

        case 6:
          select = document.getElementById("grupoEdicion").value; //console.log('controlador/agregarIntegrante.php?idGpr='+select+'&nombre='+nombre+'&email='+email+'&saludo='+saludo);

          _context6.next = 9;
          return regeneratorRuntime.awrap(fetch('controlador/agregarIntegrante.php?idGpr=' + select + '&nombre=' + nombre + '&email=' + email + '&saludo=' + saludo));

        case 9:
          response = _context6.sent;

          if (!response.ok) {
            _context6.next = 16;
            break;
          }

          _context6.next = 13;
          return regeneratorRuntime.awrap(response.text());

        case 13:
          datos = _context6.sent;
          console.log(datos);
          return _context6.abrupt("return", data);

        case 16:
        case "end":
          return _context6.stop();
      }
    }
  });
}

function mostrarAgregarIntgr(data) {
  cargarIntegranteGrp();
}

function cargarEliminarGrp() {
  consultaEliminarGrp().then(function (data) {
    return mostrarEliminarGrp(data);
  })["catch"](function (err) {
    console.log(err);
  });
}

function consultaEliminarGrp() {
  var idGrupo, response, datos;
  return regeneratorRuntime.async(function consultaEliminarGrp$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          idGrupo = document.getElementById("grupoEdicion").value;
          _context7.next = 3;
          return regeneratorRuntime.awrap(fetch('controlador/eliminaGrupoIDGpr.php?idGpr=' + idGrupo));

        case 3:
          response = _context7.sent;

          if (!response.ok) {
            _context7.next = 10;
            break;
          }

          _context7.next = 7;
          return regeneratorRuntime.awrap(response.text());

        case 7:
          datos = _context7.sent;
          console.log(datos);
          return _context7.abrupt("return", datos);

        case 10:
        case "end":
          return _context7.stop();
      }
    }
  });
}

function mostrarEliminarGrp(data) {
  var select = document.getElementById('grupoEdicion');
  var opt = document.createElement('option');
  select.innerHTML = "";
  opt.value = 0;
  opt.innerHTML = "Seleccione un grupo";
  select.appendChild(opt);
  cargaGrupos();
  cargarIntegranteGrp();
}