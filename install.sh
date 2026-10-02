#!/usr/bin/env bash
# Formkurva – installationsskript för Docker-värden.
# Kör på servern (t.ex. en Debian/Ubuntu-VM eller LXC med Docker installerat):
#   curl -fsSL https://raw.githubusercontent.com/richardstenlund/formkurva/main/install.sh | bash
# eller efter att ha klonat repot:
#   bash install.sh

set -euo pipefail

REPO_URL="https://github.com/richardstenlund/formkurva.git"
INSTALL_DIR="${FORMKURVA_DIR:-$HOME/formkurva}"

info()  { printf '\033[1;32m%s\033[0m\n' "$1"; }
warn()  { printf '\033[1;33m%s\033[0m\n' "$1"; }
error() { printf '\033[1;31m%s\033[0m\n' "$1" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Kommandot '$1' saknas. Installera det och kör skriptet igen."
    exit 1
  fi
}

require_cmd git
require_cmd docker

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  error "Varken 'docker compose' eller 'docker-compose' hittades. Installera Docker Compose och försök igen."
  exit 1
fi

# Hämta eller uppdatera koden.
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Hittade befintlig installation i $INSTALL_DIR, hämtar senaste versionen..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Klonar Formkurva till $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '/+=' | cut -c1-24
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24
  fi
}

# Skapa .env om den saknas.
if [ -f .env ]; then
  warn ".env finns redan, lämnar den orörd. Redigera den manuellt vid behov: $INSTALL_DIR/.env"
else
  info "Skapar .env med nya lösenord och dina uppgifter..."
  read -rp "E-post för administratörskontot: " ADMIN_EMAIL_INPUT
  read -rsp "Lösenord för administratörskontot (minst 12 tecken): " ADMIN_PASSWORD_INPUT
  echo
  read -rp "Adress sidan nås på, t.ex. http://192.168.1.61:3000 [http://localhost:3000]: " APP_URL_INPUT
  APP_URL_INPUT="${APP_URL_INPUT:-http://localhost:3000}"

  DB_PASSWORD_GENERATED="$(gen_secret)"
  DB_ROOT_PASSWORD_GENERATED="$(gen_secret)"

  cat > .env <<EOF
# Genererad av install.sh $(date '+%Y-%m-%d %H:%M')
ADMIN_EMAIL=${ADMIN_EMAIL_INPUT}
ADMIN_PASSWORD=${ADMIN_PASSWORD_INPUT}
DB_NAME=formkurva
DB_USER=formkurva
DB_PASSWORD=${DB_PASSWORD_GENERATED}
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD_GENERATED}
APP_URL=${APP_URL_INPUT}
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Formkurva <noreply@localhost>
EOF
  chmod 600 .env
  info ".env skapad. Databaslösenordet genererades automatiskt och ligger i filen."
fi

info "Startar containrarna med $COMPOSE..."
$COMPOSE up -d --build

info "Väntar på att databasen ska bli klar..."
for _ in $(seq 1 30); do
  if docker inspect --format '{{.State.Health.Status}}' formkurva-db 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

if docker inspect --format '{{.State.Health.Status}}' formkurva-db 2>/dev/null | grep -q healthy; then
  info "Databasen är klar."
else
  warn "Databasen svarade inte som 'healthy' inom väntetiden. Kontrollera loggen med: docker logs formkurva-db"
fi

APP_URL_SHOWN="$(grep -m1 '^APP_URL=' .env | cut -d= -f2-)"
info "Klart! Öppna sidan på: ${APP_URL_SHOWN:-http://localhost:3000}"
info "Adminer (databasvy) finns på port 8081 på samma server."
info "Uppdatera senare genom att köra detta skript igen, eller: cd $INSTALL_DIR && git pull && $COMPOSE up -d --build"
