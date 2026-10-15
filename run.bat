@echo off
REM run.bat - one double-click to launch Trend Duel locally. No commands to remember.
REM Claude Code: keep this file working at every milestone. If launching
REM changes, this file changes with it.

cd /d "%~dp0"

REM This project's dedicated port. MUST match PORT in verify.py
REM (guarded by tests/test_invariants.py).
set PORT=5093

REM Activate the tooling virtual environment if there is one. The game
REM itself needs nothing installed - the folder docs\ IS the app.
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"

if not exist "docs\index.html" (
    echo docs\index.html is missing - there is no site to serve.
    echo Run:  python verify.py   to see what is wrong.
    pause
    exit /b 1
)

REM Open the browser only ONCE the server answers (kit M19.2 lesson): a bare
REM `start "" http://...` fired before the port is bound shows "site can't be
REM reached", which in front of a class reads as a broken app.
echo Starting Trend Duel on port %PORT%... the browser opens by itself once the server answers.
echo (If it does not, open http://127.0.0.1:%PORT%/ yourself.)
echo Other devices on this network can open http://THIS-PC-IP:%PORT%/ while this window stays open.
start "" /b python open_when_ready.py %PORT%
REM ---- EDIT THIS ONE LINE PER PROJECT ----
python -m http.server %PORT% --directory docs
REM -----------------------------------------

REM Keep the window open if the server crashes, so the error is readable.
echo.
echo Trend Duel's local server has stopped. If there is an error above, screenshot or copy it.
pause
