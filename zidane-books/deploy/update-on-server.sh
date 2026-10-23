#!/usr/bin/env bash
# Install a newer Zidane Books and restart. Data in /var/lib/zidane-books is kept, and backed up first.
#   from a new release zip: unzip it, then from inside the folder:  sudo bash deploy/update-on-server.sh
#   from GitHub (if installed that way):  sudo bash /opt/zidane-books-src/zidane-books/deploy/update-on-server.sh
set -euo pipefail
SRC=/opt/zidane-books-src
DATA=/var/lib/zidane-books
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
if [ "$PKG_DIR" != "$SRC/zidane-books" ]; then
  echo "==> Code from release package $PKG_DIR"
  rm -rf "$SRC/zidane-books/server" "$SRC/zidane-books/dist"
  cp -a "$PKG_DIR/." "$SRC/zidane-books/"
  cd "$SRC/zidane-books" && npm ci --omit=dev
else
  BRANCH="${BRANCH:-$(git -C "$SRC" rev-parse --abbrev-ref HEAD)}"
  echo "==> Code from GitHub ($BRANCH)"
  git -C "$SRC" fetch --depth 1 origin "$BRANCH" && git -C "$SRC" checkout -B "$BRANCH" FETCH_HEAD
  cd "$SRC/zidane-books"
  npm ci && npm run build && npm prune --omit=dev
fi
# AI reading a bill photo can take over a minute: give the proxy room (older installs had nginx's 60s default)
NG=/etc/nginx/sites-available/zidane-books
if [ -f "$NG" ] && ! grep -q proxy_read_timeout "$NG"; then
  sed -i 's#proxy_pass http://127.0.0.1:\([0-9]*\);#proxy_pass http://127.0.0.1:\1;\n        proxy_read_timeout 180s;#' "$NG"
  nginx -t && systemctl reload nginx
fi
# the daily backup now also covers attachments and can go off-site (deploy/backup.sh); older installs move over to it
CRON_FILE=/etc/cron.d/zidane-books-backup
if [ -f "$CRON_FILE" ] && ! grep -q deploy/backup.sh "$CRON_FILE"; then
  echo "30 2 * * * root bash $SRC/zidane-books/deploy/backup.sh >> /var/log/zidane-books-backup.log 2>&1" > "$CRON_FILE"
  echo "==> Daily backup now includes attachments (deploy/backup.sh)"
fi
# backup right before the switch, so nothing typed during the build is missed if we ever have to roll back
echo "==> Backup before update"
mkdir -p "$DATA/backups"
node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('$DATA/zidane-books.db').exec(\"VACUUM INTO '$DATA/backups/before-update-\"+Date.now()+\".db'\")"
systemctl restart zidane-books
PORT=$(grep '^PORT=' /etc/zidane-books.env | cut -d= -f2)
# give it up to 30 seconds to start
for _ in $(seq 15); do
  sleep 2
  if curl -fsS "http://127.0.0.1:${PORT:-3200}/api/health" >/dev/null 2>&1; then echo "updated and running"; exit 0; fi
done
echo "The app didn't start. See: sudo journalctl -u zidane-books -n 50"
exit 1
