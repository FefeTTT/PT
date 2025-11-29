function onload(){
  cargaTrim();
}
function cargaTrim(){
  consultaTrim().then(
    data=>mostrarTrim(data)
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaTrim(){
  var response= await fetch('controlador/recuperaTrim.php');
  if(response.ok){
    var datos= await response.text();
    //console.log(data);
    var data= JSON.parse(datos);
    return data;
  }
}
function mostrarTrim(data){
  var div=document.getElementById('bloque-titulo');
    div.innerHTML = "Opciones disponibles para el trimestre ";

  if( data.length!=0)
    for(var i=0;i<1;i++){
   div.innerHTML+= data[i].nombre;

  }
  else {
    div.innerHTML = "No hay trimestres registrados actualmente";
    document.getElementById('btnSP').onclick = function MyFuncion () {
      swal({
        title: '¡Atención!',
        text: 'Se necesita crear un trimestre para poder acivar esta opción',
        icon: 'warning'
      });
    }
    document.getElementById('btnCP').onclick = function MyFuncion () {
      swal({
        title: '¡Atención!',
        text: 'Se necesita crear un trimestre para poder acivar esta opción',
        icon: 'warning'
      });
    }
    document.getElementById('btnER').onclick = function MyFuncion () {
      swal({
        title: '¡Atención!',
        text: 'Se necesita crear un trimestre para poder acivar esta opción',
        icon: 'warning'
      });
    }
  }
}

function cargarProfesoresSP(){
  consultaProfesoresSP().then(
    data=>mostrarProfesoresSP(data)
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaProfesoresSP(){
  var response= await fetch('controlador/recuperaProfesoresSP.php');
  if(response.ok){
    var datos= await response.text();
    //console.log(data);
    var data= JSON.parse(datos);
    return data;
  }
}
function mostrarProfesoresSP(data){
  var div=document.getElementById('bloque_Preferencias');
    div.innerHTML = "";
    
  if( data.length!=0){
    if (div.className == "col-sm-9 col-xs-12 text-center")
      div.className = "col-sm-9 col-xs-12";

    var tabla   = document.createElement("table");
    var tblHead = document.createElement("thead");
    var hilHead = document.createElement("tr");
    
    tabla.className= "table table-hover";
    tblHead.className= "thead-dark";

    var celHead0 = document.createElement("th");
    var textoCelda = document.createTextNode("#");
    celHead0.appendChild(textoCelda);
    celHead0.scope= "col";
    
    var celHead1 = document.createElement("th");
    textoCelda = document.createTextNode("Número ecónomico");
    celHead1.appendChild(textoCelda);
    celHead1.scope= "col";

    var celHead2 = document.createElement("th");
    textoCelda = document.createTextNode("Nombre");
    celHead2.appendChild(textoCelda);
    celHead2.scope= "col";

    var celHead3 = document.createElement("th");
    textoCelda = document.createTextNode("Correo");
    celHead3.appendChild(textoCelda);
    celHead3.scope= "col";
    
    var celHead4 = document.createElement("th");
    textoCelda = document.createTextNode("Recordatorio");
    celHead4.appendChild(textoCelda);
    celHead4.scope= "col";

    hilHead.appendChild(celHead0);
    hilHead.appendChild(celHead1);
    hilHead.appendChild(celHead2);
    hilHead.appendChild(celHead3);
    hilHead.appendChild(celHead4);

    tblHead.appendChild(hilHead);
    tabla.appendChild(tblHead);
      tabla.setAttribute("border", "2");

    var tblBody = document.createElement("tbody");

    var cnt= 0;

    for(var i=0;i<data.length;i++){
    var hilBody = document.createElement("tr");
    var celBody = document.createElement("td");
    textoCelda = document.createTextNode(++cnt);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
        
    var celBody = document.createElement("td");
    textoCelda = document.createTextNode(data[i].noEconomico);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);

    var celBody = document.createElement("td");
    textoCelda = document.createTextNode(data[i].nombre);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);

    var celBody = document.createElement("td");
    if( data[i].correo_uam!= null){
      textoCelda = document.createTextNode(data[i].correo_uam);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
    } else {
      textoCelda = document.createTextNode(data[i].correo_personal);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      }
      
    var celBody = document.createElement("td");
    botonCelda = document.createElement("button");
    botonCelda.type = 'button';
    botonCelda.id = data[i].noEconomico;
    botonCelda.innerText = 'Enviar recordatorio';
    botonCelda.onclick = function() { 
      enviarRecordatorioPersonal( this); 
    }
    celBody.appendChild(botonCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
      
    }
    
    tabla.appendChild(tblBody);
    div.appendChild(tabla);
  } else {
    div.innerHTML = "No hay profesores en esta categoría";

    if (div.className == "col-sm-9 col-xs-12")
      div.className = "col-sm-9 col-xs-12 text-center";
  }
}

function cargarProfesoresCP(){
  consultaProfesoresCP().then(
    data=>mostrarProfesoresCP(data)
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaProfesoresCP(){
  var response= await fetch('controlador/recuperaProfesoresCP.php');
  if(response.ok){
    var datos= await response.text();
    //console.log(data);
    var data= JSON.parse(datos);
    return data;
  }
}
function mostrarProfesoresCP(data){
  var div=document.getElementById('bloque_Preferencias');
    div.innerHTML = "";

  if( data.length!=0){
    if (div.className == "col-sm-9 col-xs-12 text-center")
      div.className = "col-sm-9 col-xs-12";

    var tabla   = document.createElement("table");
    var tblHead = document.createElement("thead");
    var hilHead = document.createElement("tr");
    
    tabla.className= "table table-hover";
    tblHead.className= "thead-dark";
    
    var celHead0 = document.createElement("th");
    var textoCelda = document.createTextNode("#");
    celHead0.appendChild(textoCelda);
    celHead0.scope= "col";

    var celHead1 = document.createElement("th");
    textoCelda = document.createTextNode("Número ecónomico");
    celHead1.appendChild(textoCelda);
    celHead1.scope= "col";

    var celHead2 = document.createElement("th");
    textoCelda = document.createTextNode("Nombre");
    celHead2.appendChild(textoCelda);
    celHead2.scope= "col";

    var celHead3 = document.createElement("th");
    textoCelda = document.createTextNode("Correo");
    celHead3.appendChild(textoCelda);
    celHead3.scope= "col";
    
    var celHead4 = document.createElement("th");
    textoCelda = document.createTextNode("");
    celHead4.appendChild(textoCelda);
    celHead4.scope= "col";

    hilHead.appendChild(celHead0);
    hilHead.appendChild(celHead1);
    hilHead.appendChild(celHead2);
    hilHead.appendChild(celHead3);
    hilHead.appendChild(celHead4);

    tblHead.appendChild(hilHead);
    tabla.appendChild(tblHead);
      tabla.setAttribute("border", "2");

    var tblBody = document.createElement("tbody");

    var cnt= 0;
    
    for(var i=0;i<data.length;i++){
    var hilBody = document.createElement("tr");
    var celBody = document.createElement("td");
    textoCelda = document.createTextNode( ++cnt);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
    
    var celBody = document.createElement("td");
    textoCelda = document.createTextNode(data[i].noEconomico);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);

    var celBody = document.createElement("td");
    textoCelda = document.createTextNode(data[i].nombre);
    celBody.appendChild(textoCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);

    var celBody = document.createElement("td");
    if( data[i].correo_uam!= null){
      textoCelda = document.createTextNode(data[i].correo_uam);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
    } else {
      textoCelda = document.createTextNode(data[i].correo_personal);
      celBody.appendChild(textoCelda);
      hilBody.appendChild(celBody);
      tblBody.appendChild(hilBody);
      }
      
    var celBody = document.createElement("td");
    botonCelda = document.createElement("button");
    botonCelda.type = 'button';
    botonCelda.id = 'btnVP_'+data[i].noEconomico;
    botonCelda.value = data[i].idProfesor;
    botonCelda.innerText = 'Ver preferencias';
    botonCelda.onclick = function( event) {
      window.open('https://docenciacienciasbasicas.azc.uam.mx/preferencia_prof.php?id='+this.value, 
        "Preferencias", "width=%50, height=%50, scrollbars=no, status=no")
      //location.href = 'https://docenciacienciasbasicas.azc.uam.mx/preferencia_prof.php?id='+this.value;
    }
    celBody.appendChild(botonCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
    
    
    botonCelda = document.createElement("button");
    botonCelda.type = 'button';
    botonCelda.id = data[i].noEconomico;
    botonCelda.innerText = 'Borrar preferencias';
    botonCelda.onclick = function() { 
      borrarPreferencias( this); 
    }
    celBody.appendChild(botonCelda);
    hilBody.appendChild(celBody);
    tblBody.appendChild(hilBody);
    
    }
    tabla.appendChild(tblBody);
    div.appendChild(tabla);
  } else {
    div.innerHTML = "No hay profesores en esta categoría";

    if (div.className == "col-sm-9 col-xs-12")
      div.className = "col-sm-9 col-xs-12 text-center";
  }
}

function enviarRecordatorio(){
  consultaRecordatorio().then(
    //data=>mostrarProfesoresCP(data)
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaRecordatorio(){
  var response= await fetch('controlador/enviarRecordatorio.php');
  if(response.ok){
    swal({
	    title: 'Recordatorios enviados',
	    text: "Se enviarón los email's a todos los profesores y profesoras que no han llenado sus preferencias",
	    icon: 'success'
  	});
  }
}

function enviarRecordatorioPersonal(data){
  consultaRecordatorioPersonal(data).then(
    //data=>mostrarProfesoresCP(data)
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaRecordatorioPersonal(data){
  //console.log('controlador/enviarRecordatorioPersonal.php?id='+data.id);
  var response= await fetch('controlador/enviarRecordatorioPersonal.php?id='+data.id);
  if(response.ok){
    swal({
	    title: 'Recordatorio enviado',
	    text: "Correo enviado.",
	    icon: 'success'
  	});
  }
}

function borrarPreferencias(data){
  consultaBorrarPreferencias(data).then(
    //data=>mostrarProfesoresCP(data)
    cargarProfesoresCP()
  ).catch(
    function(err){
      console.log(err);
    }
  );
}
async function consultaBorrarPreferencias(data){
  //console.log('controlador/borrarPreferenciasNEco.php?nE='+data.id);
  var response= await fetch('controlador/borrarPreferenciasNEco.php?nE='+data.id);
    if(response.ok){
    swal({
	    title: 'Preferencias borradas',
	    text: "",
	    icon: 'success'
  	});
  }
}
