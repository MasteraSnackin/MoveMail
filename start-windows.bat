@echo off
setlocal
cd /d "%~dp0"

set "MOVEMAIL_URL=http://localhost:8080"
set "MOVEMAIL_NODE_MAJOR="

for /f "delims=" %%V in ('node -p "Number(process.versions.node.split('.')[0])" 2^>nul') do set "MOVEMAIL_NODE_MAJOR=%%V"
if not defined MOVEMAIL_NODE_MAJOR goto :python_fallback
if %MOVEMAIL_NODE_MAJOR% LSS 22 goto :python_fallback

echo Starting MoveMail at %MOVEMAIL_URL%
echo Keep this window open while playing. Press Control-C here to stop.
node scripts\sync-static.mjs
if errorlevel 1 goto :server_end
start "" "%MOVEMAIL_URL%"
node server.mjs
goto :server_end

:python_fallback
echo Node.js 22 or newer is not available, so ElevenLabs voice output is unavailable.
echo Starting the device-voice version instead.
if not exist "public\index.html" (
  echo The built public folder is missing. Install Node.js 22 and run this file again.
  pause
  exit /b 1
)

py -3 -c "import sys" >nul 2>&1
if not errorlevel 1 (
  start "" "%MOVEMAIL_URL%"
  py -3 -m http.server 8080 --bind 127.0.0.1 --directory public
  goto :server_end
)

python -c "import sys; raise SystemExit(sys.version_info.major != 3)" >nul 2>&1
if not errorlevel 1 (
  start "" "%MOVEMAIL_URL%"
  python -m http.server 8080 --bind 127.0.0.1 --directory public
  goto :server_end
)

echo MoveMail needs Node.js 22, or Python 3 for device-voice mode.
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
