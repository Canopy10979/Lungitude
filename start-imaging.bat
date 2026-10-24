@echo off
cd /d "%~dp0"
set "LUNGITUDE_PYTHON=python"
if exist .venv\Scripts\python.exe set "LUNGITUDE_PYTHON=.venv\Scripts\python.exe"
if exist .env (
 "%LUNGITUDE_PYTHON%" -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010 --env-file .env
) else (
 "%LUNGITUDE_PYTHON%" -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
)
