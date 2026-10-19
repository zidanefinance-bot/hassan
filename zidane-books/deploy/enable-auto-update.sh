#!/usr/bin/env bash
# One-time setup: after this the server updates itself from GitHub every 10 minutes.
# Whenever new work is pushed to the branch, it backs up the database, installs the new version and restarts.
# If the new version doesn't come up healthy, it goes back to the previous one by itself.
#
#   sudo GITHUB_TOKEN=github_pat_xxx bash deploy/enable-auto-update.sh
#
# GITHUB_TOKEN: a fine-grained token with read-only "Contents" access to zidanefinance-bot/hassan only.
# It can read the code and nothing else. It is kept in /opt/zidane-books-src (root only).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
[ -n "$GITHUB_TOKEN" ] || { echo "Set GITHUB_TOKEN (read-only token for zidanefinance-bot/hassan)"; exit 1; }
BRANCH="${BRANCH:-ccr-52506c1f-ufvep1}"
SRC=/opt/zidane-books-src
REPO="https://x-access-token:${GITHUB_TOKEN}@github.com/zidanefinance-bot/hassan.git"

command -v git >/dev/null || { echo "git isn't installed on this server. Install it first (ask before touching a shared server)."; exit 1; }

echo "==> Checking the token can read the code"
git ls-remote --exit-code "$REPO" "refs/heads/$BRANCH" >/dev/null || { echo "Token can't read branch $BRANCH of zidanefinance-bot/hassan. Check the token's repository access and Contents: Read-only."; exit 1; }

if [ ! -d "$SRC/.git" ]; then
  echo "==> Switching $SRC to a GitHub copy (the old copy is kept next to it)"
  rm -rf "$SRC.new"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$SRC.new"
  [ -d "$SRC" ] && mv "$SRC" "$SRC.before-auto-update-$(date +%Y%m%d%H%M)"
  mv "$SRC.new" "$SRC"
else
  git -C "$SRC" remote set-url origin "$REPO"
fi
chmod 700 "$SRC/.git"   # the token lives in .git/config: root only (the app itself still reads the code)
echo "BRANCH=$BRANCH" > /etc/zidane-books-update.env

echo "==> Installing the new version now"
BRANCH="$BRANCH" bash "$SRC/zidane-books/deploy/update-on-server.sh"

echo "==> Checking for updates every 10 minutes"
cat > /etc/systemd/system/zidane-books-update.service <<UNIT
[Unit]
Description=Zidane Books: install a new version from GitHub if there is one
After=network-online.target
[Service]
Type=oneshot
EnvironmentFile=/etc/zidane-books-update.env
ExecStart=/bin/bash $SRC/zidane-books/deploy/auto-update.sh
UNIT
cat > /etc/systemd/system/zidane-books-update.timer <<UNIT
[Unit]
Description=Zidane Books: check GitHub for a new version every 10 minutes
[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now zidane-books-update.timer
echo
echo "Done. New versions now install themselves within 10 minutes."
echo "  History:      sudo journalctl -u zidane-books-update -n 50"
echo "  Update now:   sudo systemctl start zidane-books-update"
echo "  Switch off:   sudo systemctl disable --now zidane-books-update.timer"
