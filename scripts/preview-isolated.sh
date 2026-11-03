#!/usr/bin/env bash
# Local visual preview fully isolated from production Supabase.
# Does NOT merge, deploy, migrate, or write to any real Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."

export VITE_PREVIEW_ISOLATED=1
# Non-routable loopback — createClient may exist, but Auth/REST cannot reach production.
export VITE_SUPABASE_URL="http://127.0.0.1:9"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_isolated_preview_only"
unset SUPABASE_URL SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID || true

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-5173}"

echo "Starting isolated Driver Compliance preview on http://${HOST}:${PORT}"
echo "VITE_PREVIEW_ISOLATED=1  VITE_SUPABASE_URL=http://127.0.0.1:9  (values not production)"
exec bun run dev -- --host "$HOST" --port "$PORT"
