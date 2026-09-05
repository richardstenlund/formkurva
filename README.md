# Formkurva

Hälsotracker med Node.js, Express och MariaDB. Körs som Docker-containrar och passar en Proxmox-VM eller LXC med Docker.

## Starta på egen server

1. Installera Docker Engine och Docker Compose på en liten Debian/Ubuntu-VM i Proxmox.
2. Kopiera projektmappen till servern.
3. Kör:

```bash
docker compose up -d --build
```

4. Öppna `http://SERVERNS-IP:3000`.

## Första administratören

Kopiera `.env.example` till `.env`, byt adminlösenordet och starta sedan containern:

```bash
cp .env.example .env
nano .env
docker compose up -d --build
```

Logga in med `ADMIN_EMAIL` och `ADMIN_PASSWORD`. Adminrollen skapas automatiskt om kontot saknas. Öppna sedan **Admin** i menyn för att göra andra konton till administratörer eller vanliga användare. `.env` ska aldrig läggas upp på GitHub.

Admin-sidan finns även direkt på `/admin.html` och innehåller kontostatistik, rollbyte, tvångsutloggning och radering av konton. Vanliga användare skickas bort från sidan automatiskt.

På profilsidan finns lösenordsbyte, profilbild, mål och måttenhet. Historiken kan exporteras som JSON eller CSV och tidigare mätningar kan ändras.

Gym-sidan finns på `/gym.html`. Där kan användare välja bland övningar för alla stora muskelgrupper, logga träningspass och bygga egna träningsdagar. Träningspassen och schemat sparas i MariaDB via API:et.

Vid vanlig HTTP i hemnätet ska `SECURE_COOKIES` vara `false`. När du lägger sidan bakom HTTPS ändrar du den till `true` och kör om containern.

Adminer körs på port `8081` för att administrera MariaDB via webbläsaren. Öppna `http://SERVERNS-IP:8081` från hemnätet. Logga in med server `db`, användare `formkurva`, databas `formkurva` och lösenordet från `DB_PASSWORD` i `.env`. Exponera inte Adminer mot internet utan HTTPS och extra åtkomstskydd.

Databasen sparas i Docker-volymen `formkurva_db` och överlever omstart eller uppdatering av containern. När sidan körs via servern sparas användarkonton, profiler, teman, mätningar och träningsdata i MariaDB på servern, inte i webbläsaren.

## Uppdatera

```bash
git pull
docker compose up -d --build
```

## Säkerhetskopiera

Backup-containern skapar automatiskt en komprimerad MariaDB-dump varje dygn och behåller 14 dagar. Filerna finns i volymen `formkurva_backups`.

Manuell backup: `docker compose exec db mariadb-dump -u root -p formkurva > formkurva.sql`.

## Viktigt före internetpublicering

- Lägg sidan bakom HTTPS via exempelvis Caddy, Nginx Proxy Manager eller Cloudflare Tunnel.
- Ändra inte `SESSION_DAYS` till en lång period utan att förstå risken.
- Exponera inte MariaDB-porten mot internet.
- Den inbyggda kontofunktionen använder hashade lösenord och sessionscookies. Glömt lösenord och e-postutskick ingår inte ännu.
