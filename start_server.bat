@echo off
echo ========================================================
echo   INICIANDO ENTORNO DEV (PHP + REDIS CACHE)
echo ========================================================

echo.
echo [1/2] Levantando contenedor de Redis en /solution...
cd frontend-react\solution
docker-compose up -d
cd ..\..

echo.
echo [2/2] Levantando servidor PHP en el puerto 8080...
echo Presiona Ctrl+C para detener ambos.
php -S localhost:8080

echo.
echo Deteniendo contenedor de Redis...
cd frontend-react\solution
docker-compose stop
cd ..\..
echo Entorno apagado.
