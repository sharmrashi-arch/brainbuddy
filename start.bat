@echo off
cd /d "%~dp0"
echo ============================================
echo   BrainBuddy - starting server...
echo ============================================
if not exist ".venv\Scripts\python.exe" (
  echo [!] .venv not found. Creating it...
  py -3.14 -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
start "" http://127.0.0.1:8000
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
pause