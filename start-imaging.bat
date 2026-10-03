@echo off
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
 .venv\Scripts\python.exe -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
) else (
 python -m uvicorn service:app --app-dir ml/skin --host 127.0.0.1 --port 8010
)
