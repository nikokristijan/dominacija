#!/bin/bash
# Gradi i (ponovno) pokreće produkcijski poslužitelj za testiranje na portu 3100 s čistom bazom.
cd "$(dirname "$0")/.."
pkill -f "next-server" 2>/dev/null; pkill -f "next start" 2>/dev/null; sleep 1.5
rm -rf .data
NEXT_PUBLIC_DEV_MODE=true npx next build > "${1:-/tmp/build.log}" 2>&1 || { tail -30 "${1:-/tmp/build.log}"; exit 1; }
DEV_MODE=true SESSION_SECRET=test-secret ADMIN_USERS=admin nohup npx next start -p 3100 > "${2:-/tmp/server.log}" 2>&1 &
sleep 4
curl -s -o /dev/null -w "server %{http_code}\n" http://localhost:3100/
