#!/usr/bin/env bash
# Install a newer Zidane Books and restart. Data in /var/lib/zidane-books is kept, and backed up first.
#   from a new release zip: unzip it, then from inside the folder:  sudo bash deploy/update-on-server.sh
#   from GitHub (if installed that way):  sudo bash /opt/zidane-books-src/zidane-books/deploy/update-on-server.sh
set -euo pipefail
SRC=/opt/zidane-books-src
DATA=/var/lib/zidane-books
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
echo "==> Backup before update"
node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('$DATA/zidane-books.db').exec(\"VACUUM INTO '$DATA/backups/before-update-\"+Date.now()+\".db'\")"
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
systemctl restart zidane-books
sleep 2
PORT=$(grep '^PORT=' /etc/zidane-books.env | cut -d= -f2)
curl -fsS "http://127.0.0.1:${PORT:-3200}/api/health" && echo " updated and running"
