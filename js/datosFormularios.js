$('input[type="file"]').on('change',function(){
	var ext = $( this ).val().split('.').pop();
	if($( this ).val != ''){
		if(ext == "xsl" || ext == "xlsx" || ext == "csv"){
		}
		else{
			$( this ).val('');
			alert("Extensión de archivo, no compatible");
		}
	}
});

function cargarPlaneacion(){
	console.log("entro a la funcion");
	var archivo = $("#import-file").val();
	if(archivo===""){
		alert("El archivo está vacío");
		return false;
	}
	alert("Comenzará el proceso de carga de la planeación");
	var formData = new FormData();
	var files = $("#import-file")[0].files[0];
	formData.append('archivoexcel',files);
	$.ajax({
		url: './controlador/guardar_planeacion.php',
		type: 'POST',
		data: formData,
		contentType: false,
		processData: false,
		success: function(resp){
			//registrarExcel(resp);
			alert(resp);
			console.log(resp);
		}, error: function(jqXHR, textStatus, errorThrown){
		  console.log(jqXHR);
		  console.log(textStatus);
		  console.log(errorThrown);
		  console.log(jqXHR.responseText);
		}
	});
	return false;
}

function guardarTrim(){
	// debugger;
	var f = new FormData();
		f.append('trim', document.getElementById("trim").value);
		f.append('fecha', document.getElementById("fecha").value);
		
		$.ajax({
			url: 'controlador/guardarTrim.php',
			type: 'POST',
			data: f,
			//dataType: "json",
			contentType: false,
			processData: false,
			success: function(resp){
				console.log(resp);
				console.log("trimestre y fecha guardados");
				// alert(resp);
			},
			error : function(xhr, status) {
				alert('Problema al guardar el trimestre y la fecha: ');
				console.log(JSON.stringify(xhr));
				console.log(JSON.stringify(status));
			},
			complete : function(xhr, status) {
	        		// alert('Petición realizada');
	    		}
		});
	
}

function nuevoTrim(){
	var trim = document.getElementById("trim").value;
	var fecha = document.getElementById("fecha").value;
	if(trim == "" || fecha == ""){
		alert("Los campos de trimestre y fecha son requeridos");
	} else{
		guardarTrim();
		var url= "https://docenciacienciasbasicas.azc.uam.mx/docentes.php?trim="+trim+"&fecha="+fecha;
		window.location.href = url;
	}
}

function cargarCatalogo(tipo){
	console.log("entro a la funcion");
	if(tipo == '1'){
		var archivo = $("#update-uea").val();
		if(archivo===""){
			alert("El archivo está vacío");
		}
		//alert('tipo 1 archivo no vacío');
		const formData = new FormData();
		var files = $("#update-uea")[0].files[0];
		formData.append('tipo',tipo);
		formData.append('archivoexcel',files);
		// crear el llamado a ajax
		$.ajax({
			url: 'controlador/import_catalogo.php',
			type: 'POST',
			data: formData,
			contentType: false,
			processData: false,
			success: function(resp){
				//registrarExcel(resp);
				alert(resp);
			}
		});

	}else if(tipo == '2'){
		var archivo = $("#update-docentes").val();
		if(archivo===""){
			alert("El archivo está vacío");
		}
		var formData = new FormData();
		var files = $("#update-docentes")[0].files[0];
		formData.append('tipo',tipo);
		formData.append('archivoexcel',files);
		// crear el llamado a ajax
		$.ajax({
			url: 'controlador/import_catalogo.php',
			type: 'POST',
			data: formData,
			contentType: false,
			processData: false,
			success: function(resp){
				//registrarExcel(resp);
				console.log(resp)
				alert(resp);
			},
			error : function(xhr, status) {
				alert('Disculpe, existió un problema.');
				console.log(JSON.stringify(xhr));
				console.log(JSON.stringify(status));
			},
			complete : function(xhr, status) {
	        		// alert('Petición realizada');
	    		}
		});
	}
	return false;
}

function enviarForm(){
	// var trim = '<?php if(isset($trimestre))echo $trimestre; else echo null;?>';
	// var fecha = '<?php if(isset($fecha))echo $fecha; else echo null;?>';
	var fecha = document.getElementById("fecha").value;
	if(trim == '' || fecha == ''){
		alert('No se ha establecido el trimestre ni la fecha límite.');
	} else{
		guardarTrim();
		var fecha_dos = fecha.replace(/ /g,"+"); //antes se reemplazaba por %20

		var f = new FormData();
		f.append('trim', document.getElementById("trim").value);
		f.append('fecha', document.getElementById("fecha").value);
		f.append('fecha2', fecha_dos);
		
		$.ajax({
			url: 'controlador/enviarForm.php',
			type: 'POST',
			data: f,
			//dataType: "json",
			contentType: false,
			processData: false,
			success: function(resp){
				console.log(resp);
				//alert(resp);
				swal({
		                  title: "Éxito",
		                  text: "Éxito al enviar el formulario a los profesores",
		                  icon: "success",
		                });
			},
			error : function(xhr, status) {
				alert('Disculpe, existió un problema.');
				console.log(JSON.stringify(xhr));
				console.log(JSON.stringify(status));
			},
			complete : function(xhr, status) {
	        		// alert('Petición realizada');
	    		}
		});

	}
}

function cat_ejemplo(tipo){
	if(tipo == 'uea')
		myWindow=window.open('img_catalogos.php?cat=uea','myWin','width=750,height=800');
	else if(tipo == 'docentes')
		myWindow=window.open('img_catalogos.php?cat=prof','myWin','width=910,height=750');
	else if(tipo == 'plan')
		myWindow=window.open('img_catalogos.php?cat=plan','myWin','width=1200,height=750');
}
