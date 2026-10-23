#!/usr/bin/env bash
# Daily backup of Zidane Books: the database AND the attachments (signed DCs, bill photos, payment proofs).
# Run by cron at 2:30am (see install-on-server.sh / update-on-server.sh), or by hand:  sudo bash deploy/backup.sh
#
# 1. A consistent copy of the database is taken while the app keeps running (VACUUM INTO).
# 2. Database + uploads go into one file: zidane-books-YYYY-MM-DD.tar.gz in /var/lib/zidane-books/backups (kept 14 days,
#    fewer if the disk gets below 5 GB free; at least 3 are always kept).
# 3. Off-site (optional, strongly recommended): when BACKUP_REMOTE is set in /etc/zidane-books.env, the file is
#    encrypted with BACKUP_PASSPHRASE and copied there with rclone (Google Drive, Dropbox, another server...).
#    Off-site copies are kept BACKUP_KEEP_DAYS days (default 90). See deploy/BACKUP.md.
# The result of each run is written to backups/last-backup.json, which the app shows to directors.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
ENV_FILE=/etc/zidane-books.env
# cron starts with a bare PATH: use the same node the app's service runs on
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
UNIT_NODE=$(sed -n 's/^ExecStart=\([^ ]*node\) .*/\1/p' /etc/systemd/system/zidane-books.service 2>/dev/null | head -1 || true)
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
OUT="$DATA/backups"
KEEP_LOCAL="${BACKUP_KEEP_LOCAL_DAYS:-14}"
MIN_FREE_GB="${BACKUP_MIN_FREE_GB:-5}" # never let backups fill the disk the website and other apps share
KEEP_REMOTE="${BACKUP_KEEP_DAYS:-90}"
STAMP=$(date +%Y-%m-%d)
NAME="zidane-books-$STAMP.tar.gz"
STATUS="$OUT/last-backup.json"
mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

status() { # ok/failed, offsite: done/skipped/failed, message
  printf '{"at":"%s","ok":%s,"file":"%s","size":%s,"offsite":"%s","message":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$NAME" "${SIZE:-0}" "$2" "$3" > "$STATUS"
  chmod 644 "$STATUS"
}
fail() { status false "${OFFSITE:-skipped}" "$1"; echo "!! $1" >&2; exit 1; }

echo "==> Database snapshot"
# as the app's own user, so SQLite's side files (-wal/-shm) never end up owned by root
APP_USER=$(stat -c %U "$DB")
SNAP="$OUT/.snapshot-$$.db"
rm -f "$SNAP"
runuser -u "$APP_USER" -- node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);d.exec(\"VACUUM INTO '\"+process.argv[2]+\"'\");const c=new DatabaseSync(process.argv[2]);const r=c.prepare('PRAGMA integrity_check').get();if(Object.values(r)[0]!=='ok')process.exit(3)" "$DB" "$SNAP" || { rm -f "$SNAP"; fail "database snapshot failed"; }
mv "$SNAP" "$WORK/zidane-books.db"

echo "==> Packing database + attachments"
mkdir -p "$WORK/pack"
mv "$WORK/zidane-books.db" "$WORK/pack/"
[ -d "$UPLOADS" ] && cp -a "$UPLOADS" "$WORK/pack/uploads"
tar -C "$WORK/pack" -czf "$OUT/$NAME.part" . || fail "packing failed"
mv "$OUT/$NAME.part" "$OUT/$NAME"
chmod 600 "$OUT/$NAME"
SIZE=$(stat -c %s "$OUT/$NAME")
find "$OUT" -maxdepth 1 \( -name 'zidane-books-*.tar.gz' -o -name 'zidane-books-*.db' \) -mtime +"$KEEP_LOCAL" -delete
# every backup carries all attachments, so on a small disk keep fewer: drop the oldest while free space is low (keep 3)
while [ "$(df -Pk "$OUT" | awk 'NR==2 {print $4}')" -lt $((MIN_FREE_GB * 1024 * 1024)) ]; do
  OLDEST=$(ls -1tr "$OUT"/zidane-books-*.tar.gz "$OUT"/zidane-books-*.db 2>/dev/null | head -1)
  [ "$(ls -1 "$OUT"/zidane-books-*.tar.gz 2>/dev/null | wc -l)" -le 3 ] && { echo "!! Less than ${MIN_FREE_GB} GB free on the disk"; break; }
  echo "    disk low: removing old $OLDEST"; rm -f "$OLDEST"
done
echo "    $OUT/$NAME ($((SIZE / 1024)) KB)"

OFFSITE=skipped
if [ -n "${BACKUP_REMOTE:-}" ]; then
  echo "==> Off-site copy to $BACKUP_REMOTE"
  OFFSITE=failed
  command -v rclone >/dev/null || fail "rclone isn't installed, so nothing went off-site (see deploy/BACKUP.md)"
  [ -n "${BACKUP_PASSPHRASE:-}" ] || fail "BACKUP_PASSPHRASE is not set, so the off-site copy was not sent unencrypted"
  command -v gpg >/dev/null || fail "gpg isn't installed, so the off-site copy can't be encrypted"
  printf '%s' "$BACKUP_PASSPHRASE" > "$WORK/pass"; chmod 600 "$WORK/pass"
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$WORK/pass" --symmetric --cipher-algo AES256 -o "$WORK/$NAME.gpg" "$OUT/$NAME" || fail "encryption failed"
  RC=(rclone --config "${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}")
  "${RC[@]}" copyto "$WORK/$NAME.gpg" "$BACKUP_REMOTE/$NAME.gpg" || fail "upload to $BACKUP_REMOTE failed"
  "${RC[@]}" delete --min-age "${KEEP_REMOTE}d" --include 'zidane-books-*.tar.gz.gpg' "$BACKUP_REMOTE" || true
  OFFSITE=done
fi

status true "$OFFSITE" "$([ "$OFFSITE" = done ] && echo "saved here and off-site" || echo "saved on this server only")"
echo "Backup done ($OFFSITE off-site)."
