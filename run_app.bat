.\.venv\Scripts\activate@echo off
echo ========================================
echo   Flask App Startup Script
echo ========================================
echo.

:: Check for .venv first
if not exist ".venv\Scripts\activate.bat" goto CHECK_VENV_ALT
set "VENV_PATH=.venv"
goto ACTIVATE

:CHECK_VENV_ALT
:: Check for venv second
if not exist "venv\Scripts\activate.bat" goto VENV_NOT_FOUND
set "VENV_PATH=venv"
goto ACTIVATE

:VENV_NOT_FOUND
echo [ERROR] Virtual environment folder not found.
echo Could not find ".venv" or "venv" in:
echo %CD%
echo.
echo Please create one by running: python -m venv .venv
echo.
goto END_PAUSE

:ACTIVATE
echo [INFO] Found virtual environment at: %VENV_PATH%
echo [INFO] Activating...
call "%VENV_PATH%\Scripts\activate.bat"

:: Check if activation worked
if errorlevel 1 goto FAILED_ACTIVATE

echo [INFO] Environment activated successfully.
echo [INFO] Starting Flask server...
echo.

:: Run Flask
flask run

:: Capture exit code
if errorlevel 1 (
    echo.
    echo [ERROR] Flask server exited with an error.
)
goto END_PAUSE

:FAILED_ACTIVATE
echo [ERROR] Failed to activate the virtual environment.
goto END_PAUSE

:END_PAUSE
echo.
echo ----------------------------------------
echo Script finished. Press any key to close.
pause > nul
