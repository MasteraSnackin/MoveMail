#!/bin/sh

SCRIPT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIRECTORY" || {
  echo "MoveMail could not open its project folder."
  exit 1
}

MOVEMAIL_URL="http://localhost:8080"
echo "Starting MoveMail at $MOVEMAIL_URL"
echo "Keep this terminal open while playing. Press Control-C here to stop."

if command -v xdg-open >/dev/null 2>&1; then
  (
    sleep 1
    xdg-open "$MOVEMAIL_URL" >/dev/null 2>&1
  ) &
elif command -v gio >/dev/null 2>&1; then
  (
    sleep 1
    gio open "$MOVEMAIL_URL" >/dev/null 2>&1
  ) &
else
  echo "Open $MOVEMAIL_URL in Chrome, Edge or Safari."
fi

MOVEMAIL_NODE_MAJOR=""
if command -v node >/dev/null 2>&1; then
  MOVEMAIL_NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null)
fi

if [ -n "$MOVEMAIL_NODE_MAJOR" ] && [ "$MOVEMAIL_NODE_MAJOR" -ge 22 ]; then
  node scripts/sync-static.mjs || exit 1
  exec node server.mjs
fi

echo "Node.js 22 or newer is not available, so ElevenLabs voice output is unavailable."
echo "Starting the device-voice version instead."
if [ ! -f public/index.html ]; then
  echo "The built public folder is missing. Install Node.js 22 and run this file again."
  exit 1
fi
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 8080 --bind 127.0.0.1 --directory public
elif command -v python >/dev/null 2>&1 &&
  python -c 'import sys; raise SystemExit(sys.version_info.major != 3)' >/dev/null 2>&1; then
  exec python -m http.server 8080 --bind 127.0.0.1 --directory public
fi

echo "MoveMail needs Node.js 22, or Python 3 for device-voice mode."
exit 1
