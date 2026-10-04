#!/usr/bin/env bash
# Formkurva - helautomatisk installation (inga frågor ställs).
# Kör som root på en Debian/Ubuntu-server:
#   curl -fsSL https://raw.githubusercontent.com/richardstenlund/formkurva/main/install.sh | sudo bash
# Valfria inställningar (sätts före kommandot): ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL, FORMKURVA_DIR

set -euo pipefail

REPO_URL="https://github.com/richardstenlund/formkurva.git"
INSTALL_DIR="${FORMKURVA_DIR:-/opt/formkurva}"

info()  { printf '\033[1;32m%s\033[0m\n' "$1"; }
warn()  { printf '\033[1;33m%s\033[0m\n' "$1"; }
error() { printf '\033[1;31m%s\033[0m\n' "$1" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  error "Skriptet måste köras som root. Använd: curl -fsSL https://raw.githubusercontent.com/richardstenlund/formkurva/main/install.sh | sudo bash"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  info "Installerar git och curl..."
  apt-get update -y
  apt-get install -y git curl ca-certificates
fi

if ! command -v docker >/dev/null 2>&1; then
  info "Installerar Docker (kan ta någon minut)..."
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  error "Docker Compose hittades inte. Installera 'docker-compose-plugin' och kör igen."
  exit 1
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Hittade befintlig installation i $INSTALL_DIR, hämtar senaste versionen..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Hämtar Formkurva till $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

gen_secret() {
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-24}" || true
}

CREATED_ENV=0
if [ -f .env ]; then
  warn ".env finns redan och lämnas orörd."
else
  CREATED_ENV=1
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  ADMIN_EMAIL_VALUE="${ADMIN_EMAIL:-admin@formkurva.local}"
  ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-$(gen_secret 16)}"
  APP_URL_VALUE="${APP_URL:-http://${IP:-localhost}:3000}"
  cat > .env <<EOF
# Genererad av install.sh $(date '+%Y-%m-%d %H:%M')
ADMIN_EMAIL=${ADMIN_EMAIL_VALUE}
ADMIN_PASSWORD=${ADMIN_PASSWORD_VALUE}
DB_NAME=formkurva
DB_USER=formkurva
DB_PASSWORD=$(gen_secret 24)
DB_ROOT_PASSWORD=$(gen_secret 24)
APP_URL=${APP_URL_VALUE}
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Formkurva <noreply@localhost>
EOF
  chmod 600 .env
fi

info "Startar Formkurva (första bygget tar några minuter)..."
$COMPOSE up -d --build

info "Väntar på att sidan ska svara..."
READY=0
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then READY=1; break; fi
  sleep 2
done
[ "$READY" -eq 1 ] || warn "Sidan svarade inte ännu. Kontrollera med: docker logs formkurva"

get_env() { grep -m1 "^$1=" .env | cut -d= -f2-; }
echo
info "============================================================"
info " Formkurva är installerat!"
info " Öppna:     $(get_env APP_URL)"
if [ "$CREATED_ENV" -eq 1 ]; then
  info " Inloggning (installationskonto, används bara en gång):"
  info "   E-post:   $(get_env ADMIN_EMAIL)"
  info "   Lösenord: $(get_env ADMIN_PASSWORD)"
  info " Efter inloggning ber sidan dig skapa din egen administratör."
  info " Uppgifterna finns också i $INSTALL_DIR/.env"
fi
info " Uppdatera senare: cd $INSTALL_DIR && git pull --ff-only && $COMPOSE up -d --build"
info "============================================================"