@echo off
setlocal
cd /d "%~dp0"

set "MOVEMAIL_URL=http://localhost:8080"

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 (
  echo Starting MoveMail at %MOVEMAIL_URL%
  echo Keep this window open while playing. Press Control-C here to stop.
  start "" "%MOVEMAIL_URL%"
  py -3 -m http.server 8080 --bind 127.0.0.1
  goto :server_end
)

python -c "import sys; raise SystemExit(sys.version_info.major != 3)" >nul 2>&1
if not errorlevel 1 (
  echo Starting MoveMail at %MOVEMAIL_URL%
  echo Keep this window open while playing. Press Control-C here to stop.
  start "" "%MOVEMAIL_URL%"
  python -m http.server 8080 --bind 127.0.0.1
  goto :server_end
)

echo MoveMail needs Python 3 to start its local web server.
echo Install Python 3 from https://www.python.org/downloads/ and run this file again.
echo During installation, select "Add Python to PATH".
echo Do not open index.html directly: camera access may not work.
pause
exit /b 1

:server_end
if errorlevel 1 (
  echo.
  echo The local server could not start. Port 8080 may already be in use.
  echo Close any other MoveMail server window, then try again.
  pause
)
endlocal
