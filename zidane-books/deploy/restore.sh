#!/usr/bin/env bash
# Bring Zidane Books back from a backup made by deploy/backup.sh.
#
#   sudo bash deploy/restore.sh --test  zidane-books-2026-10-23.tar.gz      # safe drill: checks the backup, changes nothing
#   sudo bash deploy/restore.sh --apply zidane-books-2026-10-23.tar.gz      # really restore (asks to confirm)
#
# The file can be a path, a name in /var/lib/zidane-books/backups, or an off-site name ending in .gpg
# (it is then downloaded from BACKUP_REMOTE and decrypted with BACKUP_PASSPHRASE from /etc/zidane-books.env).
# Older plain .db backups work too (database only).
# --apply first saves today's data as before-restore-<time>, so a restore can itself be undone.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
MODE="${1:-}"; FILE="${2:-}"
[[ "$MODE" == "--test" || "$MODE" == "--apply" ]] && [ -n "$FILE" ] || { sed -n '4,5p' "$0" | sed 's/^# *//'; exit 1; }
ENV_FILE=/etc/zidane-books.env
# cron starts with a bare PATH: use the same node the app's service runs on
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
UNIT_NODE=$(sed -n 's/^ExecStart=\([^ ]*node\) .*/\1/p' /etc/systemd/system/zidane-books.service 2>/dev/null | head -1)
[ -n "$UNIT_NODE" ] && [ -x "$UNIT_NODE" ] && export PATH="$(dirname "$UNIT_NODE"):$PATH"
command -v node >/dev/null || { echo "node not found"; exit 1; }
DATA=/var/lib/zidane-books
# read KEY=value lines the way systemd does (values may contain spaces); the file is never executed
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    v="${BASH_REMATCH[2]}"; v="${v%\"}"; v="${v#\"}"; export "${BASH_REMATCH[1]}=$v"
  done < "$ENV_FILE"
fi
DB="${DB_FILE:-$DATA/zidane-books.db}"
UPLOADS="${UPLOAD_DIR:-$DATA/uploads}"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# find the file
if [ ! -f "$FILE" ] && [ -f "$DATA/backups/$FILE" ]; then FILE="$DATA/backups/$FILE"; fi
if [ ! -f "$FILE" ] && [[ "$FILE" == *.gpg ]]; then
  [ -n "${BACKUP_REMOTE:-}" ] || { echo "BACKUP_REMOTE isn't set, so I can't download $FILE"; exit 1; }
  echo "==> Downloading $FILE from $BACKUP_REMOTE"
  rclone --config "${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}" copyto "$BACKUP_REMOTE/$(basename "$FILE")" "$WORK/$(basename "$FILE")"
  FILE="$WORK/$(basename "$FILE")"
fi
[ -f "$FILE" ] || { echo "Backup not found: $FILE"; echo "Local backups:"; ls -1 "$DATA/backups" 2>/dev/null | grep -E '^zidane-books-' | tail -10; exit 1; }

# decrypt / unpack into WORK/pack
mkdir -p "$WORK/pack"
case "$FILE" in
  *.gpg)
    [ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "BACKUP_PASSPHRASE isn't set in $ENV_FILE"; exit 1; }
    printf '%s' "$BACKUP_PASSPHRASE" > "$WORK/pass"; chmod 600 "$WORK/pass"
    gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$WORK/pass" -d -o "$WORK/b.tar.gz" "$FILE" || { echo "Couldn't decrypt: wrong BACKUP_PASSPHRASE?"; exit 1; }
    tar -C "$WORK/pack" -xzf "$WORK/b.tar.gz" ;;
  *.tar.gz) tar -C "$WORK/pack" -xzf "$FILE" ;;
  *.db) cp "$FILE" "$WORK/pack/zidane-books.db" ;;
  *) echo "Unknown backup type: $FILE"; exit 1 ;;
esac
[ -f "$WORK/pack/zidane-books.db" ] || { echo "No database inside $FILE"; exit 1; }

echo "==> Checking the backup"
node --disable-warning=ExperimentalWarning -e "
const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1],{readOnly:true});
const ok=Object.values(d.prepare('PRAGMA integrity_check').get())[0];
const n=(t)=>{try{return d.prepare('SELECT COUNT(*) c FROM '+t).get().c}catch{return '-'}};
const last=d.prepare(\"SELECT MAX(at) m FROM activity\").get()?.m;
console.log('    integrity:',ok);console.log('    documents:',n('documents'),'· jobs:',n('jobs'),'· payments:',n('payments'),'· contacts:',n('contacts'),'· items:',n('items'));
console.log('    last activity in this backup:',last||'-');if(ok!=='ok')process.exit(3)" "$WORK/pack/zidane-books.db" || { echo "!! This backup's database is damaged. Try an older one."; exit 1; }
FILES=$([ -d "$WORK/pack/uploads" ] && find "$WORK/pack/uploads" -type f | wc -l || echo 0)
echo "    attachments: $FILES files"

if [ "$MODE" = "--test" ]; then echo "Test passed: this backup can be restored. Nothing on the server was changed."; exit 0; fi

read -r -p "This replaces ALL current Books data with the backup above. Type RESTORE to continue: " OK
[ "$OK" = "RESTORE" ] || { echo "Cancelled. Nothing changed."; exit 1; }
APP_USER=$(stat -c %U "$DB" 2>/dev/null || echo zidanebooks)
KEEP="$DATA/backups/before-restore-$(date +%Y%m%d-%H%M%S)"
echo "==> Stopping the app and keeping today's data in $KEEP"
systemctl stop zidane-books
mkdir -p "$KEEP"
for f in "$DB" "$DB-wal" "$DB-shm"; do [ -f "$f" ] && mv "$f" "$KEEP/"; done
[ -d "$UPLOADS" ] && mv "$UPLOADS" "$KEEP/uploads"
echo "==> Putting the backup in place"
cp "$WORK/pack/zidane-books.db" "$DB"
if [ -d "$WORK/pack/uploads" ]; then cp -a "$WORK/pack/uploads" "$UPLOADS"; else mkdir -p "$UPLOADS"; fi
chown -R "$APP_USER:$APP_USER" "$DB" "$UPLOADS" "$KEEP"
systemctl start zidane-books
PORT=$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2)
for _ in $(seq 15); do
  sleep 2
  if curl -fsS "http://127.0.0.1:${PORT:-3200}/api/health" >/dev/null 2>&1; then echo "Restored and running. Today's data before the restore is in $KEEP"; exit 0; fi
done
echo "!! The app didn't start after the restore. Today's data is safe in $KEEP. See: journalctl -u zidane-books -n 50"
exit 1
