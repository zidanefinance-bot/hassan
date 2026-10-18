#!/usr/bin/env bash
# Pull the latest Zidane Books code, rebuild and restart. Data in /var/lib/zidane-books is kept.
#   sudo bash /opt/zidane-books-src/zidane-books/deploy/update-on-server.sh
set -euo pipefail
SRC=/opt/zidane-books-src
BRANCH="${BRANCH:-$(git -C "$SRC" rev-parse --abbrev-ref HEAD)}"
DATA=/var/lib/zidane-books
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
echo "==> Backup before update"
node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('$DATA/zidane-books.db').exec(\"VACUUM INTO '$DATA/backups/before-update-\"+Date.now()+\".db'\")"
echo "==> Code ($BRANCH)"
git -C "$SRC" fetch --depth 1 origin "$BRANCH" && git -C "$SRC" checkout -B "$BRANCH" FETCH_HEAD
cd "$SRC/zidane-books"
npm ci && npm run build && npm prune --omit=dev
systemctl restart zidane-books
sleep 2
PORT=$(grep '^PORT=' /etc/zidane-books.env | cut -d= -f2)
curl -fsS "http://127.0.0.1:${PORT:-3200}/api/health" && echo " updated and running"
