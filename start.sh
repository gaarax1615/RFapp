#!/usr/bin/env bash
# Arranca Backend (Python :8787) y Frontend (Vite :5173) en local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/Backend"
FRONTEND="$ROOT"

if [[ ! -d "$BACKEND" ]]; then
  echo "Falta la carpeta Backend/." >&2
  exit 1
fi

if [[ ! -x "$BACKEND/.venv/bin/python" ]]; then
  echo "Creando entorno Python del Backend..."
  python3 -m venv "$BACKEND/.venv"
  "$BACKEND/.venv/bin/pip" install -U pip
  "$BACKEND/.venv/bin/pip" install -e "$BACKEND"
else
  "$BACKEND/.venv/bin/pip" install -e "$BACKEND" >/dev/null
fi

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "Instalando dependencias del Frontend..."
  (cd "$FRONTEND" && npm install)
fi

BACK_PID=""
FRONT_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "Deteniendo Frontend y Backend..."
  if [[ -n "${FRONT_PID}" ]]; then kill "${FRONT_PID}" 2>/dev/null || true; fi
  if [[ -n "${BACK_PID}" ]]; then kill "${BACK_PID}" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend  →  http://127.0.0.1:8787"
(
  cd "$BACKEND"
  exec "$BACKEND/.venv/bin/python" -m sdr_server
) &
BACK_PID=$!

echo "Frontend →  http://localhost:5173/"
(
  cd "$FRONTEND"
  exec npm run dev
) &
FRONT_PID=$!

echo "Ctrl+C para parar ambos."
wait
