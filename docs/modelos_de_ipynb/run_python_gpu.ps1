param(
    [string]$Image = "nvcr.io/nvidia/rapidsai/base:26.04-cuda12-py3.13",
    [string]$ContainerName = "python_gpu",
    [string]$DataDir = "C:\Users\jafet\OneDrive\Escritorio\Uni\CB\ServidorPython\volumen\archivos",
    [string]$OutputDir = "",
    [int]$MaxIterDE = 100,
    [int]$PopSizeDE = 20,
    [int]$NRandomFallback = 10000,
    [ValidateSet("async", "cuda", "pool", "managed", "managed_pool")]
    [string]$CudfPandasRmmMode = "async",
    [switch]$SkipRun,
    [switch]$Recreate
)

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$PythonScript = "/workspace/docs/modelos_de_ipynb/get_viabilidad_gpu_local.py"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $ScriptDir "salidas_gpu"
}

$OutputDir = (New-Item -ItemType Directory -Force -Path $OutputDir).FullName

if (-not (Test-Path -LiteralPath $DataDir)) {
    throw "No existe DataDir: $DataDir"
}

$DfHistPath = Join-Path $DataDir "df_hist.json"
$EcoNombrePath = Join-Path $DataDir "eco-nombre.json"

if (-not (Test-Path -LiteralPath $DfHistPath)) {
    throw "No existe df_hist.json en: $DataDir"
}

if (-not (Test-Path -LiteralPath $EcoNombrePath)) {
    throw "No existe eco-nombre.json en: $DataDir"
}

Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "DataDir:     $DataDir"
Write-Host "OutputDir:   $OutputDir"
Write-Host "Image:       $Image"
Write-Host "Container:   $ContainerName"
Write-Host "RMM mode:    $CudfPandasRmmMode"

$Existing = docker ps -a --filter "name=^/$ContainerName$" --format "{{.Names}}"

if ($Existing -eq $ContainerName -and $Recreate) {
    Write-Host "Eliminando contenedor existente: $ContainerName"
    docker rm -f $ContainerName | Out-Host
    $Existing = ""
}

if ($Existing -eq $ContainerName) {
    $Running = docker ps --filter "name=^/$ContainerName$" --filter "status=running" --format "{{.Names}}"
    if ($Running -ne $ContainerName) {
        Write-Host "Iniciando contenedor existente: $ContainerName"
        docker start $ContainerName | Out-Host
    }
    else {
        Write-Host "Contenedor ya activo: $ContainerName"
    }
}
else {
    Write-Host "Creando contenedor RAPIDS/cuDF: $ContainerName"
    $RunArgs = @(
        "run",
        "-d",
        "--name", $ContainerName,
        "--gpus", "all",
        "--shm-size=2g",
        "--ulimit", "memlock=-1",
        "--ulimit", "stack=67108864",
        "-v", "${ProjectRoot}:/workspace",
        "-v", "${DataDir}:/data:ro",
        "-v", "${OutputDir}:/outputs",
        "-e", "VIABILIDAD_DATA_DIR=/data",
        "-e", "VIABILIDAD_OUTPUT_DIR=/outputs",
        "-e", "USE_CUDF=1",
        "-e", "CUDF_PANDAS_RMM_MODE=$CudfPandasRmmMode",
        "-e", "MAXITER_DE=$MaxIterDE",
        "-e", "POPSIZE_DE=$PopSizeDE",
        "-e", "N_RANDOM_FALLBACK=$NRandomFallback",
        "-w", "/workspace/docs/modelos_de_ipynb",
        $Image,
        "tail",
        "-f",
        "/dev/null"
    )
    docker @RunArgs | Out-Host
}

Write-Host "Verificando GPU y cuDF dentro del contenedor..."
docker exec $ContainerName nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
docker exec -e CUDF_PANDAS_RMM_MODE=$CudfPandasRmmMode $ContainerName python -c "import os; import cudf, cudf.pandas; cudf.pandas.install(); import pandas as pd; print('mode', os.getenv('CUDF_PANDAS_RMM_MODE')); print('cudf', cudf.__version__); print('pandas', pd.__version__)"

if (-not $SkipRun) {
    Write-Host "Ejecutando modelo GPU local..."
    docker exec -it `
        -e CUDF_PANDAS_RMM_MODE=$CudfPandasRmmMode `
        -e VIABILIDAD_DATA_DIR=/data `
        -e VIABILIDAD_OUTPUT_DIR=/outputs `
        -e USE_CUDF=1 `
        -e MAXITER_DE=$MaxIterDE `
        -e POPSIZE_DE=$PopSizeDE `
        -e N_RANDOM_FALLBACK=$NRandomFallback `
        $ContainerName python $PythonScript
}
else {
    Write-Host "Listo. Ejecuta cuando quieras:"
    Write-Host "docker exec -it -e CUDF_PANDAS_RMM_MODE=$CudfPandasRmmMode $ContainerName python $PythonScript"
}
