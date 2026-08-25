@echo off
title Clinica Dental App - no cerrar esta ventana mientras la uses
echo Iniciando la app, esperá unos segundos...
start "Clinica Dental App (servidor)" "C:\Program Files\nodejs\node.exe" "C:\Users\Usuario\Documents\clinica-dental-app\node_modules\next\dist\bin\next" dev "C:\Users\Usuario\Documents\clinica-dental-app"
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000/agenda"
