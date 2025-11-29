<?php
require_once "plantilla.php";
session_start();
if ( !isset($_SESSION["success"])) {
    header('Location: login.php');
    return;
}

// Leer idTrimestre enviado desde el menú de trimestres (POST)
$idTrimestre = isset($_POST['idTrimestre']) ? (int)$_POST['idTrimestre'] : 0;
?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Programación trimestral</title>
    <script>
        window.ID_TRIMESTRE = <?php echo json_encode($idTrimestre); ?>;
    </script>
    <script defer src="./js/asignacionTrimestral.js"></script>
</head>

<body>
    <div class="container py-3">
        <div class="row mb-3">
            <div class="col">
                <h2 id="titulo-trimestre" class="mb-1">Programación del trimestre</h2>
                <small id="subtitulo-trimestre" class="text-body-secondary"></small>
            </div>
        </div>

        <div class="row mb-3">
            <div class="col">
                <div class="btn-group" role="group" aria-label="Modo de programación">
                    <button id="btn-modo-profesores" type="button" class="btn btn-primary">Profesores</button>
                    <button id="btn-modo-uea" type="button" class="btn btn-outline-secondary">UEA</button>
                </div>
            </div>
        </div>
        <!-- Vista modo Profesores -->
        <div id="vista-profesores" class="row g-3">
            <div class="col-lg-4">
                <div class="mb-2">
                    <label class="form-label" for="filtro-busqueda">Buscar profesor</label>
                    <input id="filtro-busqueda" type="text" class="form-control form-control-sm" placeholder="Buscar por No. económico o nombre" />
                </div>
                <div class="border rounded" style="max-height: 60vh; overflow:auto;">
                    <table class="table table-sm table-hover mb-0" id="tbl-profesores">
                        <thead class="table-dark sticky-top">
                            <tr>
                                <th style="width:110px;">NE</th>
                                <th>Nombre</th>
                                <th style="width:110px;">En trim.</th>
                            </tr>
                        </thead>
                        <tbody id="tb-profesores"></tbody>
                    </table>
                </div>
            </div>
            <div class="col-lg-8">
                <div class="card shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <div class="fw-semibold" id="det-nombre">&nbsp;</div>
                                <div class="text-body-secondary small">No. económico: <span id="det-ne">&nbsp;</span></div>
                                <div class="mt-1">Estado en el trimestre: <span id="det-estado" class="badge bg-secondary">&nbsp;</span></div>
                                <div class="mt-1 small">No. grupos: <span id="det-no-grupos" class="fw-semibold">—</span></div>
                                <div class="mt-1 small">Observaciones: <span id="det-observaciones" class="text-body-secondary">—</span></div>
                            </div>
                            <div>
                                <button id="btn-ver-preferencias" type="button" class="btn btn-sm btn-secondary" data-bs-toggle="modal" data-bs-target="#modal-preferencias">
                                    Ver preferencias
                                </button>
                            </div>
                        </div>

                        <div class="table-responsive" id="pref-uea-wrap">
                            <table class="table table-sm align-middle">
                                <thead class="table-dark">
                                    <tr>
                                        <th>UEA (clave - nombre)</th>
                                        <th style="width: 120px;">Prioridad</th>
                                        <th>Grupos asignados</th>
                                    </tr>
                                </thead>
                                <tbody id="tb-pref-ueas"></tbody>
                            </table>
                            <div class="mt-2 d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                                <button id="btn-agregar-uea" type="button" class="btn btn-outline-primary btn-sm">+ Agregar UEA (prioridad 0)</button>
                                <div id="agregar-uea-area" class="mt-2 mt-sm-0" style="display:none; min-width:0;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Vista modo UEA: estructura similar a 'Profesores' (JS puede reutilizar estos elementos) -->
        <div id="vista-uea" class="row g-3" style="display:none;">
            <div class="col-lg-4">
                <!-- Selector de UEA removido por petición: usar búsqueda y tabla para seleccionar -->
                <div class="mb-2">
                    <label class="form-label" for="uea-search">Buscar UEA</label>
                    <input id="uea-search" type="text" class="form-control form-control-sm" placeholder="Buscar por clave o nombre" />
                </div>
                <div class="d-flex gap-2 mb-2">
                    <select id="uea-area-select" class="form-select form-select-sm">
                        <option value="">Área: Todas</option>
                    </select>
                    <select id="uea-estado-select" class="form-select form-select-sm">
                        <option value="0">Estado: Todos</option>
                        <option value="1">Completas (100%)</option>
                        <option value="2">Con faltantes</option>
                    </select>
                </div>
                <div class="border rounded" style="max-height: 60vh; overflow:auto;">
                    <table class="table table-sm table-hover mb-0 uea-table" id="uea-table">
                        <thead class="table-dark sticky-top"><tr>
                            <th style="white-space:nowrap">Clave</th>
                            <th>Nombre</th>
                        </tr></thead>
                        <tbody id="uea-tbody"></tbody>
                    </table>
                </div>
            </div>
            <div class="col-lg-8">
                <div id="uea-detail" class="card shadow-sm">
                    <div class="card-body">
                        <div id="uea-detail-empty" class="text-muted">Selecciona una UEA para ver detalle.</div>
                        <div id="uea-detail-content" style="display:none;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal: Ver Preferencias del Profesor -->
    <div class="modal fade" id="modal-preferencias" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Preferencias del profesor</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="pref-resumen" class="mb-1 text-body-secondary"></div>
                    <div id="pref-extra" class="mb-3 small"></div>
                    <div class="table-responsive mb-3">
                        <table class="table table-sm">
                            <thead class="table-dark">
                                <tr>
                                    <th>UEA (clave - nombre)</th>
                                    <th style="width:120px;">Prioridad</th>
                                    <th style="width:100px;"># Grupos</th>
                                </tr>
                            </thead>
                            <tbody id="modal-pref-ueas"></tbody>
                        </table>
                    </div>
                    <div>
                        <div class="fw-semibold mb-2">Horarios preferidos</div>
                        <div id="modal-pref-horarios-grid" class="modal-horarios-wrap"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="btn-editar-preferencias" type="button" class="btn btn-primary">Editar preferencias</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    </div>
</body>

</html>