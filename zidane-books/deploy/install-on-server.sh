#!/usr/bin/env bash
# Zidane Books: one-time install on an Ubuntu server that already runs nginx (e.g. the zidane.com.pk VPS).
# It runs next to the existing website and does not touch it. It adds a new nginx site for its own subdomain.
#
# Two ways to get the code onto the server:
#   A) from the release zip (no GitHub needed): unzip it, then from inside the folder
#        sudo DOMAIN=books.zidane.com.pk ADMIN_EMAIL=you@zidane.com.pk bash deploy/install-on-server.sh
#   B) straight from GitHub:
#        sudo DOMAIN=books.zidane.com.pk ADMIN_EMAIL=you@zidane.com.pk GITHUB_TOKEN=github_pat_xxx bash install-on-server.sh
#
# DOMAIN        subdomain for the app; its DNS A record must already point at this server
# ADMIN_EMAIL   first director login (the script asks for the password)
# GITHUB_TOKEN  only for way B: read-only token for the private repo zidanefinance-bot/hassan
# BRANCH        optional, default ccr-52506c1f-ufvep1
# PORT          optional, default 3200 (local port the app listens on; nginx forwards to it)
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN, e.g. books.zidane.com.pk}"
ADMIN_EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # the unzipped release, when run from inside it
if [ -z "$GITHUB_TOKEN" ] && [ ! -f "$PKG_DIR/package.json" ]; then echo "Run this from inside the unzipped zidane-books folder, or set GITHUB_TOKEN"; exit 1; fi
BRANCH="${BRANCH:-ccr-52506c1f-ufvep1}"
PORT="${PORT:-3200}"
APP_USER=zidanebooks
SRC=/opt/zidane-books-src
DATA=/var/lib/zidane-books
ENV_FILE=/etc/zidane-books.env

[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
if ss -ltn "( sport = :$PORT )" | grep -q ":$PORT"; then echo "Port $PORT is already in use. Re-run with PORT=<free port>"; exit 1; fi

echo "==> Packages"
apt-get update -y
apt-get install -y git curl ca-certificates nginx certbot python3-certbot-nginx
NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/v([0-9]+).*/\1/' || echo 0)
NODE_MINOR=$(node -v 2>/dev/null | sed -E 's/v[0-9]+\.([0-9]+).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "${NODE_MINOR:-0}" -lt 13 ]; }; then
  echo "==> Installing Node.js 22 (the website keeps working; it uses its own process)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> App user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA/uploads" "$DATA/backups"
chown -R "$APP_USER:$APP_USER" "$DATA"

echo "==> Code"
if [ -n "$GITHUB_TOKEN" ]; then
  if [ -d "$SRC/.git" ]; then
    git -C "$SRC" fetch --depth 1 origin "$BRANCH" && git -C "$SRC" checkout -B "$BRANCH" FETCH_HEAD
  else
    git clone --depth 1 --branch "$BRANCH" "https://x-access-token:${GITHUB_TOKEN}@github.com/zidanefinance-bot/hassan.git" "$SRC"
  fi
  git -C "$SRC" remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/zidanefinance-bot/hassan.git"
else
  mkdir -p "$SRC/zidane-books"
  [ "$PKG_DIR" = "$SRC/zidane-books" ] || cp -a "$PKG_DIR/." "$SRC/zidane-books/"
fi
cd "$SRC/zidane-books"
if [ -d src ]; then npm ci && npm run build && npm prune --omit=dev; else npm ci --omit=dev; fi   # the release zip already has the built app
chown -R root:root "$SRC"

echo "==> Settings"
if [ ! -f "$ENV_FILE" ]; then
  read -r -s -p "Choose the director password for $ADMIN_EMAIL (8+ characters): " ADMIN_PASSWORD; echo
  [ "${#ADMIN_PASSWORD}" -ge 8 ] || { echo "Password too short"; exit 1; }
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=$PORT
DB_FILE=$DATA/zidane-books.db
UPLOAD_DIR=$DATA/uploads
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV
  chmod 600 "$ENV_FILE"
fi

echo "==> Service"
cat > /etc/systemd/system/zidane-books.service <<UNIT
[Unit]
Description=Zidane Books
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$SRC/zidane-books
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) --disable-warning=ExperimentalWarning server/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now zidane-books
sleep 2
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo " app is up"

echo "==> nginx site for $DOMAIN (the existing website config is not changed)"
cat > /etc/nginx/sites-available/zidane-books <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/zidane-books /etc/nginx/sites-enabled/zidane-books
nginx -t && systemctl reload nginx

echo "==> HTTPS certificate"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect || echo "!! certbot failed. Check that $DOMAIN points to this server, then run: certbot --nginx -d $DOMAIN"

echo "==> Daily backup at 2:30am (keeps 30 days in $DATA/backups)"
cat > /etc/cron.d/zidane-books-backup <<CRON
30 2 * * * $APP_USER cd $SRC/zidane-books && $(command -v node) --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('$DATA/zidane-books.db').exec(\"VACUUM INTO '$DATA/backups/zidane-books-\"+new Date().toISOString().slice(0,10)+\".db'\")" && find $DATA/backups -name '*.db' -mtime +30 -delete
CRON

echo
echo "Done. Open https://$DOMAIN and sign in as $ADMIN_EMAIL"
echo "Later updates: sudo bash $SRC/zidane-books/deploy/update-on-server.sh"
