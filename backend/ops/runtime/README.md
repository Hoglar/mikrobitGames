# Vedvarende backend og offentlig HTTPS via Funnel

**Valgt av brukeren 2026-10-29:** Tailscale Funnel brukes fordi Parrot står bak to rutere. Opennote.no og hjemmeruternes portvideresending endres ikke. Frontend og API får samme offentlige `https://…ts.net`-adresse. Dette er driftsoppsett etter bestått testfase, ikke en ny FoM-kjøring.

Funnel terminerer HTTPS og videresender til Caddy på `127.0.0.1:8080`. Caddy serverer frontend og sender `/api/*` videre uten å fjerne prefikset. Bare webinngangen publiseres; database, API, AI og modell har ingen offentlig lytter. Besøkende trenger ikke Tailscale. Maskinen og internettforbindelsen må være oppe. **Publisert adresse: https://parrot.tail106c62.ts.net.** Helseendepunktet er bekreftet fra mobilnett av brukeren 2026-10-29. Se [frontendens hurtigguide](../../../spec/contracts/webapp-backend/quickstart.md) og [driftskontrollen](../../results/runtime-2026-10-29.md).

## 1. Avhengigheter og egen innlogging

Fra prosjektroten på Parrot:

```bash
sudo bash backend/ops/runtime/install-deps.sh
sudo tailscale up --accept-dns=false --accept-routes=false
```

Første kommando installerer Caddy, Tailscale og nødvendige Debian 13 / Parrot 7-pakker. Tailscale hentes fra leverandørens signerte pakkekilde. Caddys standardtjeneste maskeres før pakkeinstallasjonen, slik at den ikke starter en tilfeldig webside på port 80. Prosjektet har sin egen `mbg-web.service` på loopback. Skriptet overtar ikke en allerede kjørende Caddy.

Den andre kommandoen viser en innloggingslenke. Åpne lenken og logg inn selv. Ingen innloggingslenker, passord, nøkler eller kontoopplysninger skal committes eller deles i chat. Tailscale må ha HTTPS/Funnel tillatt for maskinen; aktiveringskommandoen viser eventuell godkjenningslenke. Dette setter opp en konto hos ekstern tunneltilbyder, ikke en ekstern AI-tjeneste. Modellkjøringen er fortsatt lokal.

Finn maskinens DNS-navn:

```bash
tailscale status --json
```

Bruk `Self.DNSName` uten punktum til slutt, prefikset med `https://`, som origin i neste steg. Ikke del hele statusutskriften; den kan inneholde andre maskiner/kontoopplysninger.

## 2. Installer backend uten offentlig publisering

Erstatt eksempelnamnet med maskinens faktiske navn:

```bash
sudo /usr/bin/python3 backend/ops/runtime/setup.py --origin https://MASKIN.TAILNET.ts.net --demo-games
```

Kommandoen lager et nytt kodeutslipp under `/opt/mikrobit-games/releases/`, en egen venv med låste avhengigheter, fire datatjenester og en lokal webinngang. Root trengs til brukere, beskyttet konfigurasjon og systemd. Passord lages tilfeldig og blir i root-eide filer med modus 0600 under `/etc/mikrobit-games/`. Tjenestene får bare egne hemmeligheter. Det kjøres ingen full testfase eller benchmark.

`--demo-games` oppretter bare to katalogoppføringer: Poengjakt (demo) og Sprint (demo). Ingen kontoer, kjente passord, sesjoner eller testrekorder kopieres. Omitér flagget hvis katalogen skal være tom. Registrer egne kontoer via API-et. Virkelige spill-ID-er og regler må avtales før frontendspill publiseres.

| Tjeneste | Linux-bruker | Lokal inngang / data |
| --- | --- | --- |
| `mbg-db` | `mbg-db` | PostgreSQL 17, `127.0.0.1:5433`, privat socket `/run/mbg-db`, data `/var/lib/mikrobit-games/postgresql` |
| `mbg-api` | `mbg-api` | `127.0.0.1:8000`, DB-rolle `backend_app` |
| `mbg-ai` | `mbg-ai` | `127.0.0.1:8001`, DB-rolle `ai_reader` |
| `mbg-model` | `mbg-model` | Ollama `127.0.0.1:11435`, eget modellager under `/var/lib/mikrobit-games/models` |
| `mbg-web` | `mbg-web` | Caddy `127.0.0.1:8080`, statiske filer `/var/www/mikrobit-games/current` |

Modellen kopieres og SHA-256-kontrolleres fra det eksisterende testlageret. Den lastes ikke ned igjen. Eksisterende Ollama på 11434 og eventuell PostgreSQL på 5432 overtas ikke. Unngå samtidig benchmark og aktiv drift: prosessene deler maskinens CPU/RAM.

Oppsettet initialiserer bare en tom driftsdatabase. Kjørte migreringer registreres med SHA-256. Eksisterende data eller endrede gamle migreringer overskrives ikke. En ny kjøring kan oppdatere kode og tjenester, men nullstiller ikke databasen. Tidligere kode beholdes via `/opt/mikrobit-games/previous`; automatisk SQL-nedgradering tilbys ikke. Gjennomgå backendendringer og ta backup før senere oppdatering.

## 3. Kontroller lokalt, og åpne Funnel

```bash
curl --fail http://127.0.0.1:8080/api/v1/health
sudo systemctl status mbg-db mbg-api mbg-ai mbg-model mbg-web --no-pager
```

Når lokal inngang virker:

```bash
sudo tailscale funnel --bg http://127.0.0.1:8080
sudo tailscale funnel status
```

Dette siste steget gjør nettsiden/API-et offentlig. Følg eventuell lenke for å tillate Funnel. `--bg` lagrer oppsettet slik at Funnel fortsetter etter omstart. Tailscale kan kreve fornyet innlogging når enhetens nøkkel utløper; driftsansvarlig må følge kontoens policy. Ikke gjør andre tjenester til Funnel-mål.

Åpne den viste HTTPS-adressen og `/api/v1/health` fra mobilnett eller en annen PC uten Tailscale. Ingen sertifikatadvarsel skal godtas. Gjennomfør [frontendens integrasjonsflyt](../../../spec/contracts/webapp-backend/quickstart.md). Lokal oppstart alene beviser ikke ekstern tilgjengelighet eller femminuttersmålet etter fysisk reboot.

Ved første backendoppsett vises en velkomstside. Den er nå erstattet av frontend fra commit `fdfdbca`, publisert 2026-10-29. Ti spillvarianter er registrert med frontendens eksakte ID-er og regler. Se [publiseringskontrollen](../../../results/verification/frontend-publication-2026-10-29.md).

## 4. Publiser frontendpakken

Frontendgruppen leverer én komplett statisk pakke med `index.html`, spill og ressurser. Bygg fra repo-roten:

```bash
npm --prefix webapp run build
npm --prefix webapp run catalog:commands
```

Første kommando lager `webapp/dist/` med SHA-256-filoversikt. Den andre skriver vedlikeholdskommandoer for spillregisteret, uten å kjøre dem. Kontroller eksisterende spill mot registeret før du registrerer manglende ID-er. Ikke kjør `create` på ID-er som allerede finnes, og ikke endre regler for spill med historikk. På Parrot kjøres hver gjennomgåtte `create`-kommando med eksisterende administrasjonsverktøy og lokal vedlikeholdsrolle, slik (erstatt argumentene med den genererte kommandoens verdier):

```bash
sudo -u mbg-db env MBG_ADMIN_DSN='host=/run/mbg-db port=5433 dbname=mikrobit_games user=mbg-db' /opt/mikrobit-games/current/.venv/bin/python /opt/mikrobit-games/current/backend/database/manage-game.py create --id UUID --name NAVN --unit ENHET --direction RETNING --min MIN --max MAX
```

De ti variantene i `fdfdbca` er allerede registrert. Ved samme register trengs bare ny publisering av det ferdige bygget:

```bash
sudo /usr/bin/python3 backend/ops/runtime/publish-web.py webapp/dist
```

Skriptet kontrollerer byggmappen, kopierer til en ny mappe og bytter `current` atomisk. Forrige bygg ligger i `/var/www/mikrobit-games/previous`. Ved feil i den lokale HTTP-kontrollen byttes lenken tilbake. Skjulte filer og symlinker tillates ikke i webpakken. Kildekode, `.git`, serverkonfigurasjon og database skal aldri være webroot.

Frontend kaller relative `/api/v1/...`-stier fra den samme HTTPS-adressen. Ikke åpne generell CORS eller fjern cookie-/CSRF-kravene for å få en annen utviklingsadresse til å fungere.

## Drift, logger, backup og stopp

```bash
sudo systemctl status mbg-db mbg-api mbg-ai mbg-model mbg-web tailscaled --no-pager
sudo journalctl -u mbg-api -u mbg-ai -u mbg-model -u mbg-web --since '10 minutes ago'
sudo systemctl restart mbg-api
```

Tilgangslogging er ikke aktivert i Uvicorn/Caddy. Ikke legg på logging av cookie, passord eller rå samtaler. PostgreSQL logger ikke SQL-setninger ved feil i dette oppsettet. Under Funnel ser API-et foreløpig lokal proxy-IP for besøkende: IP-grensen på sensitive kall deles derfor mellom dem. Den brukerbaserte passordgrensen gjelder fortsatt. Vi godtar ikke fritt innsendte `X-Forwarded-For`-verdier som grunnlag for å omgå grensene.

Ta en privat sikkerhetskopi med ny filsti (ingen passord i kommandoen):

```bash
sudo -u mbg-db env MBG_ADMIN_DSN='host=/run/mbg-db port=5433 dbname=mikrobit_games user=mbg-db' /opt/mikrobit-games/current/.venv/bin/python /opt/mikrobit-games/current/backend/database/maintenance.py backup /var/backups/mikrobit-games/VELG-NYTT-FILNAVN.dump
```

Kopier backup sikkert til en annen maskin; lokal disk alene beskytter ikke mot diskhavari. Restore skal gjøres til en separat tom database, med gjennomgang av slettede kontoer og tømming av gjenopprettede sesjoner etter eksisterende databasekontrakt. Ikke kjør restore over driftsdata.

Stopp bare den offentlige webpubliseringen:

```bash
sudo tailscale funnel --https=443 off
```

Stopp tjenestene midlertidig uten å slette data:

```bash
sudo systemctl stop mbg-web mbg-api mbg-ai mbg-model mbg-db
```

Før planlagt maskinreboot: avtal nedetid. Etter reboot kontrolleres tjenestestatus, ekstern HTTPS, innlogging og bevaring av bekreftede data. Automatisk oppstart er konfigurert, men skal ikke rapporteres som fysisk reboot-verifisert før dette faktisk er prøvd.

## Kilder

Oppsettet bygger på [ADR-007](../../../spec/decisions/adr-007-backend-web-hosting.md), [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel), [Funnel-kommandoen og varig oppstart](https://tailscale.com/docs/reference/tailscale-cli/funnel), [signerte Debian-pakker](https://pkgs.tailscale.com/stable/#debian-trixie) og [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Ingen endring av produktets API-kontrakt inngår i driftsoppsettet.
