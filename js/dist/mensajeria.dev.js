"use strict";

var alertWarning = document.getElementById('resp-warning');
alertWarning.style.display = "none";
var alertSuccess = document.getElementById('resp-success');
alertSuccess.style.display = "none";
var inputFile = $("#inputFile");
var listaDeArchivos = $("#listaDeArchivos");
var archivosParaSubir = [];
$(function () {
  var dropZoneId = "drop-zone";
  var buttonId = "clickHere";
  var mouseOverClass = "mouse-over";
  var dropZone = $("#" + dropZoneId);
  var ooleft = dropZone.offset().left;
  var ooright = dropZone.outerWidth() + ooleft;
  var ootop = dropZone.offset().top;
  var oobottom = dropZone.outerHeight() + ootop;
  var inputFile = dropZone.find("inputFile");
  document.getElementById(dropZoneId).addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.addClass(mouseOverClass);
    var x = e.pageX;
    var y = e.pageY;

    if (!(x < ooleft || x > ooright || y < ootop || y > oobottom)) {
      inputFile.offset({
        top: y - 15,
        left: x - 100
      });
    } else {
      inputFile.offset({
        top: -400,
        left: -400
      });
    }
  }, true);

  if (buttonId != "") {
    var clickZone = $("#" + buttonId);
    var oleft = clickZone.offset().left;
    var oright = clickZone.outerWidth() + oleft;
    var otop = clickZone.offset().top;
    var obottom = clickZone.outerHeight() + otop;
    $("#" + buttonId).mousemove(function (e) {
      var x = e.pageX;
      var y = e.pageY;

      if (!(x < oleft || x > oright || y < otop || y > obottom)) {
        inputFile.offset({
          top: y - 15,
          left: x - 160
        });
      } else {
        inputFile.offset({
          top: -400,
          left: -400
        });
      }
    });
  }

  document.getElementById(dropZoneId).addEventListener("drop", function (e) {
    $("#" + dropZoneId).removeClass(mouseOverClass);
  }, true);
});

function actualizarListaDeArchivos() {
  var listaHtml = archivosParaSubir.map(function (item, index) {
    return "<li>\n        ".concat(item.name, "\n        <button data-index=\"").concat(index, "\" data-name=\"").concat(item.name, "\" class=\"file-list-eliminar\">Eliminar</button>\n        </li>");
  });
  listaDeArchivos.html(listaHtml);
}

inputFile.on('change', function (e) {
  var files = e.target.files;
  if (files.length == 0) return;
  files = Array.from(files);
  archivosParaSubir = files;
  actualizarListaDeArchivos(); // $(this).val('');
});
$(document).on("click", ".file-list-eliminar", function () {
  var index = $(this).data('index');
  archivosParaSubir.splice(index, 1);
  actualizarListaDeArchivos();
  var data = new DataTransfer(); // now you need to iterate this

  var el = document.getElementById("inputFile");

  for (var c = 0; c < el.files.length; c++) {
    // @ts-ignore
    var file = el.files[c];
    if ($(this).data('name') != file.name) data.items.add(file);
  } // then you can put the data files to any input file you want


  var el2 = document.getElementById("inputFile");
  el2.files = data.files;
  files = Array.from(document.getElementById('inputFile').files); // que archivos quedan despues de la eliminacion
  // console.log( files);
  // console.log( files.length);
});

function validar() {
  if (document.getElementById('asunto').value == "") {
    swal({
      title: "Verifique el asunto",
      text: "El asunto no debe estar vacío",
      icon: "error"
    });
    return false;
  }

  if (document.getElementById('cuerpo').value == "") {
    swal({
      title: "Verifique el cuerpo",
      text: "El cuerpo no debe estar vacío",
      icon: "error"
    });
    return false;
  }

  if (document.getElementById('grupoDestino').value == "0") {
    swal({
      title: "Verifique el grupo destino",
      text: "Debe selecionar un grupo",
      icon: "error"
    });
    return false;
  } // posible comentario para evitar enviar mensaje
  // PRUEBAS


  enviarMensaje();
}

function enviarMensaje() {
  var txtCuerpo = $('#cuerpo').val();
  txtCuerpo = txtCuerpo.replace(/\n/g, "<br />"); //$("#idDelDiv").html(cuerpo);

  var filesLength = document.getElementById('inputFile').files.length;
  var formData = new FormData();
  formData.append('asunto', document.getElementById('asunto').value);
  formData.append('cuerpo', txtCuerpo);
  formData.append('idGrupo', document.getElementById('grupoDestino').value);

  for (var i = 0; i < filesLength; i++) {
    formData.append("file[]", document.getElementById('inputFile').files[i]); // que archivo se guarda?
    //console.log( document.getElementById('inputFile').files[i]);
  }

  document.getElementById('submit_mensajeria').disabled = true;
  swal({
    title: "Espere",
    text: "Se van a enviar los emails, por favor espere hasta el aviso final de los envíos.",
    icon: "info"
  });
  $.ajax({
    url: './controlador/enviarMensajeria.php',
    type: 'POST',
    data: formData,
    contentType: false,
    processData: false,
    success: function success(resp) {
      swal({
        title: "Correos enviados",
        text: resp,
        icon: "success"
      });
      document.getElementById('asunto').value = "";
      document.getElementById('cuerpo').value = "";
      document.getElementById('grupoDestino').value = "0";
      $("#inputFile").val('');
      $("#listaDeArchivos").empty();
    },
    error: function error(XMLHttpRequest, textStatus, errorThrown) {
      alert("Status: " + textStatus);
      alert("Error: " + errorThrown);
      alert("XMLHTTP: " + JSON.stringify(XMLHttpRequest));
    },
    nocontent: function nocontent(error) {
      alert(arr["error"]);
      var arr = JSON.parse(error);

      if (arr["status"] == "Error") {
        alert(arr["error"]);
      }
    }
  });
  $("#submit_mensajeria").prop('disabled', false);
  return true;
}

function onLoad() {
  cargaGrupos();
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
          return regeneratorRuntime.awrap(fetch('./controlador/recuperaCategorias.php'));

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
  var tabla = document.getElementById('grupoDestino');

  for (var i = 0; i < data.length; i++) {
    var opt = document.createElement('option');
    opt.value = data[i].idC;
    opt.innerHTML = data[i].nombreC;
    tabla.appendChild(opt);
  }
}

function pulsar(e) {
  if (e.which === 13 && !e.shiftKey) {
    e.preventDefault();
    console.log('prevented');
    return false;
  }
}