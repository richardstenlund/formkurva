# Formkurva

Hälsotracker med Node.js, Express och SQLite. Körs som en Docker-container och passar en Proxmox-VM eller LXC med Docker.

## Starta på egen server

1. Installera Docker Engine och Docker Compose på en liten Debian/Ubuntu-VM i Proxmox.
2. Kopiera projektmappen till servern.
3. Kör:

```bash
docker compose up -d --build
```

4. Öppna `http://SERVERNS-IP:3000`.

Vid vanlig HTTP i hemnätet ska `SECURE_COOKIES` vara `false`. När du lägger sidan bakom HTTPS ändrar du den till `true` och kör om containern.

Databasen sparas i Docker-volymen `formkurva_data` och överlever omstart eller uppdatering av containern.

## Uppdatera

```bash
git pull
docker compose up -d --build
```

## Säkerhetskopiera

```bash
docker run --rm -v formkurva_data:/data -v "$PWD":/backup alpine tar czf /backup/formkurva-data.tar.gz -C /data .
```

## Viktigt före internetpublicering

- Lägg sidan bakom HTTPS via exempelvis Caddy, Nginx Proxy Manager eller Cloudflare Tunnel.
- Ändra inte `SESSION_DAYS` till en lång period utan att förstå risken.
- Exponera inte SQLite-filen direkt.
- Den inbyggda kontofunktionen använder hashade lösenord och sessionscookies. Glömt lösenord och e-postutskick ingår inte ännu.
