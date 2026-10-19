#!/usr/bin/env bash
# Run by the zidane-books-update timer (see enable-auto-update.sh). Does nothing unless GitHub has a newer version.
set -euo pipefail
SRC=/opt/zidane-books-src
DATA=/var/lib/zidane-books
BRANCH="${BRANCH:-$(git -C "$SRC" rev-parse --abbrev-ref HEAD)}"
exec 9>/run/zidane-books-update.lock
flock -n 9 || { echo "Another update is running"; exit 0; }

git -C "$SRC" fetch --quiet --depth 1 origin "$BRANCH"
OLD=$(git -C "$SRC" rev-parse HEAD)
NEW=$(git -C "$SRC" rev-parse FETCH_HEAD)
[ "$OLD" = "$NEW" ] && exit 0
echo "New version: ${OLD:0:7} -> ${NEW:0:7} ($(git -C "$SRC" log -1 --format=%s FETCH_HEAD))"

if BRANCH="$BRANCH" bash "$SRC/zidane-books/deploy/update-on-server.sh"; then
  echo "Updated to ${NEW:0:7}"
  exit 0
fi

# the new version didn't come up: put the previous one back
echo "Update failed. Going back to ${OLD:0:7}"
git -C "$SRC" checkout --quiet -B "$BRANCH" "$OLD"
cd "$SRC/zidane-books"
npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev
systemctl restart zidane-books
sleep 3
PORT=$(grep '^PORT=' /etc/zidane-books.env | cut -d= -f2)
if ! curl -fsS "http://127.0.0.1:${PORT:-3200}/api/health" >/dev/null; then
  # the new version may have upgraded the database; restore the copy taken just before the update
  LAST=$(ls -t "$DATA"/backups/before-update-*.db 2>/dev/null | head -1)
  if [ -n "$LAST" ]; then
    echo "Restoring database from $LAST"
    systemctl stop zidane-books
    mv "$DATA/zidane-books.db" "$DATA/zidane-books.db.failed-$(date +%s)"
    rm -f "$DATA/zidane-books.db-wal" "$DATA/zidane-books.db-shm"
    cp "$LAST" "$DATA/zidane-books.db"
    chown --reference="$DATA" "$DATA/zidane-books.db" 2>/dev/null || true
    systemctl start zidane-books
  fi
fi
exit 1
