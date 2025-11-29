"use strict";

// js/menuPrincipalAdmin.js
// Crea el panel principal de administración (mosaicos/botones)
(function () {
  function crearMenuPrincipalAdmin(adminMenu) {
    if (!adminMenu) adminMenu = document.getElementById('admin-menu');
    if (!adminMenu) return; // Container flex (igual estructura que la original)

    var container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '12px'; // Left panel (30%)

    var left = document.createElement('div');
    left.style.flex = '0 0 30%';
    var nav = document.createElement('div');
    nav.className = 'mb-2';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Buscar por nombre o número económico';
    input.className = 'form-control mb-2';
    input.id = 'dir-search-input';
    nav.appendChild(input);
    var nuevoBtn = document.createElement('button');
    nuevoBtn.className = 'btn btn-primary btn-sm mb-2';
    nuevoBtn.textContent = 'Nuevo profesor';
    nuevoBtn.addEventListener('click', function () {
      if (typeof window.mostrarModalNuevoProfesor === 'function') window.mostrarModalNuevoProfesor();
    });
    nav.appendChild(nuevoBtn);
    var toggleFiltersBtn = document.createElement('button');
    toggleFiltersBtn.type = 'button';
    toggleFiltersBtn.className = 'btn btn-outline-secondary btn-sm mb-2 ms-2';
    toggleFiltersBtn.id = 'btnToggleFiltros';
    toggleFiltersBtn.setAttribute('aria-expanded', 'false');
    toggleFiltersBtn.textContent = 'Mostrar filtros';
    toggleFiltersBtn.addEventListener('click', function () {
      var controlsRef = document.getElementById('dir-controls');
      if (!controlsRef) return;
      var hidden = controlsRef.classList.toggle('d-none');

      if (hidden) {
        toggleFiltersBtn.textContent = 'Mostrar filtros';
        toggleFiltersBtn.setAttribute('aria-expanded', 'false');
      } else {
        toggleFiltersBtn.textContent = 'Ocultar filtros';
        toggleFiltersBtn.setAttribute('aria-expanded', 'true');
      }
    });
    nav.appendChild(toggleFiltersBtn);
    left.appendChild(nav); // Table list

    var listWrap = document.createElement('div');
    listWrap.style.maxHeight = '60vh';
    listWrap.style.overflow = 'auto';
    var table = document.createElement('table');
    table.className = 'table table-sm table-hover';
    var thead = document.createElement('thead');
    var trHead = document.createElement('tr');
    var thName = document.createElement('th');
    thName.textContent = 'Nombre';
    var thNum = document.createElement('th');
    thNum.textContent = 'No. Económico';
    trHead.appendChild(thName);
    trHead.appendChild(thNum);
    thead.appendChild(trHead);
    var tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    listWrap.appendChild(table);
    left.appendChild(listWrap); // Right panel (70%)

    var right = document.createElement('div');
    right.style.flex = '1 1 70%';
    right.id = 'dir-right-panel';
    var placeholderCard = document.createElement('div');
    placeholderCard.className = 'card';
    var placeholderBody = document.createElement('div');
    placeholderBody.className = 'card-body';
    placeholderBody.textContent = 'Seleccione un profesor a la izquierda para ver sus detalles.';
    placeholderCard.appendChild(placeholderBody);
    right.appendChild(placeholderCard);
    container.appendChild(left);
    container.appendChild(right);
    adminMenu.appendChild(container); // Expose some elements for other modules
    // (the rest of the logic — fetchProfesores, handlers — stays in menuUsuarios.js)
  }

  try {
    if (typeof window !== 'undefined') window.crearMenuPrincipalAdmin = crearMenuPrincipalAdmin;
  } catch (e) {}
})();