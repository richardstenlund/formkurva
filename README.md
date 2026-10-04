# Formkurva

Hälsotracker med Node.js, Express och PostgreSQL. Körs som Docker-containrar och passar en Proxmox-VM eller LXC med Docker.

## Snabbinstallation med skript

Kör på Docker-servern (den klonar repot, skapar `.env` med genererade lösenord och startar containrarna):

```bash
curl -fsSL https://raw.githubusercontent.com/richardstenlund/formkurva/main/install.sh | bash
```

Skriptet frågar efter admin-e-post, adminlösenord och adressen sidan ska nås på (t.ex. `http://192.168.1.61:3000`). Kör samma kommando igen senare för att uppdatera och bygga om containrarna.

## Starta på egen server manuellt

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

Glömt lösenord finns på inloggningen. Fyll i `SMTP_*` och `APP_URL` i `.env` för att skicka återställningslänken med e-post. Utan SMTP loggas länken i serverloggen och visas bara i utvecklingsläge.

Den samlade översiktssidan (`/`) samlar kroppsmått och träningspass på ett ställe. Där kan användare logga kroppsvikt, midja, bröst, överarm, lår och höft, spara längd i sin profil och registrera träningspass med övning, muskelgrupp, set, reps, vikt och tid. Uppgifterna sparas per konto i PostgreSQL. På översiktssidan finns medaljer för träningsmängd, aktiva dagar, morgon/dag/kvällsträning och antal pass per övning. Diagram visar träningsdagar per vecka och valda kroppsmåtts förändring. Träningspåminnelser kan ställas in per tid och vardags-/helgfrekvens; de visas medan Formkurva är öppet. Webbläsaraviseringar är valfria och kräver tillåtelse samt HTTPS eller localhost.

Fliken **Community** låter användare hitta varandra (sök på visningsnamn), se publika profiler med medaljer, skicka vänförfrågningar (även via e-post), och tävla mot vänner i en topplista per vecka eller månad. Vänner kan se varandras personbästa och senaste pass, jämföra veckan, skicka peppning (💪 👏 🔥 ⚔️, en av varje sort per dag) och se mottagna hälsningar (med räknare i menyn) och ett vänflöde. Fler hälsningar: 🏆 Grattis och 👋 Pigga (för vänner som inte tränat på 3 dagar). Dessutom finns ett gemensamt lagmål, en rekordtavla per övning och sociala medaljer. Man kan välja bort att synas i communityn; vänner ser fortfarande träningen. Kroppsmått och e-postadresser delas aldrig, och vänskap kan tas bort när som helst.

Vid vanlig HTTP i hemnätet ska `SECURE_COOKIES` vara `false`. När du lägger sidan bakom HTTPS ändrar du den till `true` och kör om containern.

Adminpanelen (`/admin.html`) har en länk **Öppna databasen** till Adminer på port `8081`. Adminer administrerar PostgreSQL via webbläsaren. Logga in med server `db`, driver `PostgreSQL`, användare `formkurva`, databas `formkurva` och lösenordet från `DB_PASSWORD` i `.env`. Exponera inte Adminer mot internet utan HTTPS och extra åtkomstskydd.

Databasen sparas i en separat Docker-volym (`<compose-projektnamn>_postgres_data`) och överlever omstart eller uppdatering av containern. Den har ett eget volymnamn för att inte återanvända äldre MariaDB- eller PostgreSQL-data av misstag. När sidan körs via servern sparas användarkonton, profiler, teman, mätningar och träningsdata i PostgreSQL på servern, inte i webbläsaren.

## Uppdatera

```bash
git pull
docker compose up -d --build
```

## Säkerhetskopiera

Backup-containern skapar automatiskt en komprimerad PostgreSQL-dump varje dygn och behåller 14 dagar. Filerna finns i volymen `formkurva_backups`.

Manuell backup:

```bash
docker compose exec db pg_dump -U formkurva -d formkurva > formkurva.sql
```

## Viktigt före internetpublicering

- Lägg sidan bakom HTTPS via exempelvis Caddy, Nginx Proxy Manager eller Cloudflare Tunnel.
- Ändra inte `SESSION_DAYS` till en lång period utan att förstå risken.
- Exponera inte PostgreSQL-porten mot internet.
- Den inbyggda kontofunktionen använder hashade lösenord och sessionscookies. Konfigurera SMTP innan du litar på glömt-lösenord mot internet.
