#!/usr/bin/env bash
# Deploy mtg-table-dev to a long-lived Node host running systemd.
#
# The app needs a persistent process (it holds WebSocket connections) and a
# durable data directory, so it cannot run on a serverless platform. This
# script updates the code in place and restarts the service; it never touches
# /var/lib/mtg-table, where player data lives.
#
# Usage, from the repo root:
#   deploy/deploy.sh user@host
#
# The remote needs: node >= 20, a `mtg` service user, and sudo.

set -euo pipefail

TARGET="${1:?usage: deploy/deploy.sh user@host}"
APP_DIR="${APP_DIR:-/opt/mtg-table}"
DATA_DIR="${DATA_DIR:-/var/lib/mtg-table}"
SERVICE="${SERVICE:-mtg-table}"
SERVICE_USER="${SERVICE_USER:-mtg}"
LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> deploying $LOCAL_ROOT -> $TARGET:$APP_DIR"

# --- preflight -------------------------------------------------------------
echo "==> checking prerequisites on $TARGET"
ssh "$TARGET" "command -v node >/dev/null || { echo 'node is not installed' >&2; exit 1; }"
ssh "$TARGET" "node -e 'const v=+process.versions.node.split(\".\")[0]; if(v<20){console.error(\"node >= 20 required, found \"+v); process.exit(1)} console.log(\"node\", process.versions.node)'"
ssh "$TARGET" "id -u $SERVICE_USER >/dev/null 2>&1 || id $SERVICE_USER >/dev/null 2>&1 || true"

# --- durable state directory ----------------------------------------------
# Created before the code lands, because the service starts writing to it
# immediately and /var/lib is not part of the deploy payload.
echo "==> ensuring $DATA_DIR exists and is owned by $SERVICE_USER"
ssh "$TARGET" "sudo install -d -o $SERVICE_USER -g $SERVICE_USER -m 0750 '$DATA_DIR'"

# --- ship the code ---------------------------------------------------------
# data/ is excluded: it holds the card catalog, which is already committed and
# lives with the code, plus caches. Mutable state is on DATA_DIR instead.
echo "==> syncing code (excluding node_modules, .git, data caches)"
rsync -az --delete \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'data/users.json' \
  --exclude 'data/sessions.json' \
  --exclude 'data/tables.json' \
  --exclude 'data/friends.json' \
  --exclude 'data/avatars/' \
  --exclude 'data/images/' \
  --exclude 'data/.auth-secret' \
  --exclude 'certs/' \
  --exclude 'scratch/' \
  --exclude '*.log' \
  "$LOCAL_ROOT"/ "$TARGET:$APP_DIR/"

# --- dependencies ----------------------------------------------------------
echo "==> installing dependencies"
ssh "$TARGET" "cd '$APP_DIR' && npm ci --omit=dev"

# --- service ---------------------------------------------------------------
echo "==> installing systemd unit"
scp "$LOCAL_ROOT/deploy/mtg-table.service" "$TARGET:/tmp/$SERVICE.service"
ssh "$TARGET" "sudo cp /tmp/$SERVICE.service /etc/systemd/system/$SERVICE.service && rm -f /tmp/$SERVICE.service"

echo "==> reloading systemd"
ssh "$TARGET" "sudo systemctl daemon-reload && sudo systemctl enable $SERVICE"

# --- secret ----------------------------------------------------------------
# Generated once and never overwritten: changing it invalidates every
# outstanding token, so an existing secret is left alone.
echo "==> ensuring AUTH_SECRET is set"
ssh "$TARGET" "sudo install -d -m 0750 /etc/mtg-table"
ssh "$TARGET" "sudo touch /etc/mtg-table/env && sudo chmod 0600 /etc/mtg-table/env"
ssh "$TARGET" "sudo grep -q '^AUTH_SECRET=' /etc/mtg-table/env || sudo sh -c 'echo AUTH_SECRET=\$(openssl rand -hex 32) >> /etc/mtg-table/env'"
ssh "$TARGET" "sudo grep -q '^AUTH_SECRET=' /etc/mtg-table/env && echo 'AUTH_SECRET present'"

# --- restart ---------------------------------------------------------------
echo "==> restarting $SERVICE"
ssh "$TARGET" "sudo systemctl restart $SERVICE"
sleep 3
ssh "$TARGET" "systemctl is-active --quiet $SERVICE && echo 'service active' || { sudo systemctl status $SERVICE --no-pager -l | tail -20; exit 1; }"

# --- verify ----------------------------------------------------------------
echo "==> verifying the card catalog loaded"
ssh "$TARGET" "sudo journalctl -u $SERVICE -n 60 --no-pager | grep -E 'catalog ready' | tail -1"

PORT="$(ssh "$TARGET" "sudo systemctl show $SERVICE -p Environment --value | tr ' ' '\n' | grep '^PORT=' | cut -d= -f2" || true)"
PORT="${PORT:-8888}"
echo "==> smoke test over TLS on port $PORT"
curl -sk --max-time 15 "https://127.0.0.1:$PORT/api/decks" -o /dev/null -w '  /api/decks -> HTTP %{http_code}\n'

echo
echo "Done. Follow the logs with:  ssh $TARGET 'sudo journalctl -u $SERVICE -f'"
