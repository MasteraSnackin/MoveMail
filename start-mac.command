#!/bin/sh

SCRIPT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIRECTORY" || {
  echo "MoveMail could not open its project folder."
  exit 1
}

if command -v python3 >/dev/null 2>&1; then
  PYTHON_COMMAND=python3
elif command -v python >/dev/null 2>&1 &&
  python -c 'import sys; raise SystemExit(sys.version_info.major != 3)' >/dev/null 2>&1; then
  PYTHON_COMMAND=python
else
  echo "MoveMail needs Python 3 to start its local web server."
  echo "Install Python 3 from https://www.python.org/downloads/ and run this file again."
  echo "Do not open index.html directly: camera access may not work."
  exit 1
fi

MOVEMAIL_URL="http://localhost:8080"
echo "Starting MoveMail at $MOVEMAIL_URL"
echo "Keep this window open while playing. Press Control-C here to stop."

if command -v open >/dev/null 2>&1; then
  (
    sleep 1
    open "$MOVEMAIL_URL"
  ) &
else
  echo "Open $MOVEMAIL_URL in Chrome, Edge or Safari."
fi

exec "$PYTHON_COMMAND" -m http.server 8080 --bind 127.0.0.1
