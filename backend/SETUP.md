# Første implementasjon

Arbeidsgrunnlag: API 0.2.0 i frontendkontrakt 1.3 (fortsatt forslag overfor frontendgruppen), databasekontrakt 1.2 og de avtalte AI-kontraktene. Ingen produktbaseline er kjørt av utviklingsagenten. Testkode og forventninger beholdes.

## Plassering og avhengigheter

Python 3.13 og PostgreSQL **17** brukes på denne Parrot-maskinen. Applikasjonsbibliotekene låses i `requirements.txt`; kontrollpakken har sin egen eksisterende lås. `.venv/` inneholder bare installerte biblioteker og ignoreres av Git.

Testpakken lager en ny database under `/tmp/mbg-tests-*`, med tilfeldige passord, egne porter på loopback og syntetiske data. Den skal ikke kobles til driftsdatabasen. `backend/check.local.json` er ignorert og inneholder bare maskinens startkommandoer og modellsti. Rapporter ligger i ignorerte `backend/results/runs/`.

Ved senere drift brukes `/etc/mikrobit-games/` til beskyttet konfigurasjon (én fil per tjeneste, 0600), `/var/lib/mikrobit-games/postgresql/` til database, `/var/lib/mikrobit-games/models/` til modellfiler, `/var/backups/mikrobit-games/` til tilgangsbegrensede sikkerhetskopier og journald til logger. Ingen av disse dataene skal legges i Git. Oppsettet for testbrukere er separat fra offentlig drift.

## Byggevalg

API bruker FastAPI, parameterbundet psycopg med høyst fem forbindelser, Argon2id (19 MiB, to iterasjoner, én tråd) og HTTPX for AI. Databasens transaksjoner låser spiller før spill. Alle forsøk lagres; idempotens bygger på spiller og forsøks-ID. Bare rekorder er offentlige.

AI bruker én prosess og én aktiv oppgave, høyst tre SQL-forsøk og fire modellkall. SQLGlot parser PostgreSQL-SQL før lesing. Tillatelseslisten er versjonert i `ai-service/src/query_policy.py`: lesende SELECT/CTE, JOIN, aggregater, sortering, vanlige sammenligninger og aritmetikk; bare `ai_read.players`, `games` og `records`. Funksjoner og typer må finnes eksplisitt på listen. Ukjente syntakstrær avvises. Resultater begrenses til 1000 rader og 1 MiB uten stille avkorting.

Ollama bruker den avtalte `qwen3:4b-instruct-2507-q4_K_M`, 4096 konteksttokens og 512 genererte tokens. Modellfiler skal ligge utenfor repoet; ingen nedlasting under testfasen. Faktakvalitet, tidsbruk og minnebruk er ennå ikke målt.

## Testfasen

Engangsoppsettet trenger sudo i din egen terminal (passordet skal ikke deles med agenten):

```bash
sudo bash backend/ops/setup-test-host.sh hoglar
```

Når den avtalte modellen mangler i det eksisterende Ollama-lageret, bruk i stedet:

```bash
sudo bash backend/ops/setup-test-host.sh hoglar --download-model
```

Dette engangsstegget laster ned den navngitte modellen til testlageret gjennom en midlertidig Ollama-prosess på loopback. Det gjør ingen inferens og stopper prosessen etterpå. Modellen kjører som `mbg-test-model`; root brukes bare til oppsett og prosessopprydding. Testkommandoen selv foretar ingen nedlasting.

Dette oppretter `mbg-test-api`, `mbg-test-ai` og `mbg-test-model`, gir dem lesetilgang til nødvendig kode/biblioteker og installerer en avgrenset, root-eid startfil i `/usr/local/libexec/mbg-test-launch`. Startfilen kan bare brukes av den navngitte utvikleren; den slipper root før Python/Ollama starter. Testlederen beholder kun `CAP_SYS_PTRACE` (lese PSS for tjenester med andre brukere) og `CAP_KILL` (stoppe sine testprosesser). Disse rettighetene arves ikke av database eller tjenester. Tjenestene har ingen slike rettigheter. Dette er lokal testinfrastruktur og gir testlederen innsyn i andre prosesser på maskinen; bruk den bare på den avtalte utviklingsmaskinen.

`backend/check` har et lite oppstartstillegg for den lokale `isolated_launcher`-innstillingen. Oppstartstillegget endrer ikke testsettet, forventningene eller FoM-beregningen. Uten denne konfigurasjonen brukes den opprinnelige oppstarten. Oppsettet kopierer bare den avtalte modellen fra eksisterende Ollama-lager til `/var/lib/mikrobit-games-test/models/` og kontrollerer SHA-256; originalen beholdes. Dersom modellen mangler, meldes blokkeringen i stedet for å bytte modell.

Når engangsoppsettet er ferdig, gjennomgå og commit endringene selv. Kjør deretter fra prosjektroten på Parrot:

```bash
./backend/check
./backend/check report
```

Full kjøring tar omtrent 40–60 minutter. En ren Git-versjon er nødvendig for et komplett FoM-punkt. Agenten kjører bare oppstarts-/syntakskontroller. Brukeren starter den første målingen og bestiller eventuelle rettinger.

Offentlig HTTPS, webpakke, DNS, brannmur og oppstart etter full maskinreboot ferdigstilles ved senere systemleveranse. Ingen offentlige porter skal åpnes av dette oppsettet.

## Avklart feil i testdata

`Credentials.password` i OpenAPI krever minst 12 kodepunkter også ved innlogging. `TBE-07-rate-limit` brukte `wrong` (5 kodepunkter) og forventet 401, mens kontrakten krever 400 for dette inputet. Etter brukerens rettingsbestilling bruker testen `WrongPassword123!`, som er gyldig input, men feil passord. Forventningen er fortsatt ti svar med 401 og deretter 429. API-kontrakten og implementasjonen er uendret.

## Utført klargjøring og kontroll

På denne Parrot 7.3-maskinen er Python 3.13.5, PostgreSQL 17.11 og Ollama 0.32.15 tilgjengelig. Bibliotekene er installert i `.venv`; `pip check` melder ingen ødelagte avhengigheter. Maskinen har Intel i7-5820K og omtrent 207 GB ledig disk ved byggestart. `nvidia-smi` fikk ikke kontakt med driveren; GPU-kjøring er ikke bekreftet, og CPU-kjøring må vurderes gjennom den avtalte målingen.

Brukeren har kjørt engangsoppsettet og modellklargjøringen. Modellmanifestet finnes i `/var/lib/mikrobit-games-test/models/`, med SHA-256 `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0` og deklarert samlet filstørrelse 2 497 293 803 byte. Dette er installasjonsmetadata, ikke et mål på kvalitet, hastighet eller minnebruk. Ingen modellspørsmål er sendt av agenten.

Oppstartskontrollen brukte en separat tom PostgreSQL-instans i en midlertidig mappe, nye roller og prosjektets migrering. API og AI startet på loopback, begge leverte OpenAPI, API-ets DB-avhengige helsesjekk ga 200, og AI-rollen kunne koble til den avtalte spillvisningen. Kontrollen brukte samme lokale bruker til tjenesteoppstart; faktisk prosessisolasjon og PSS-måling gjenstår i brukerens testfase. Alle midlertidige prosesser ble stoppet og databasen fjernet. Modellens nedlastingsprosess er også stoppet.

Ved første leveranse ble Python-syntaks/import, shell-syntaks, C-kompilering med advarsler som feil, avhengighetskonsistens og Git-unntak kontrollert. `backend/tests/` og innholdet i `backend/verification/` var da uendret. Agenten hadde ikke kjørt enhetstester, integrasjonstester, modellkontroller eller benchmarks, produsert baseline/rapport eller gjort commit/push. Senere kontroller og rettinger beskrives nedenfor.

Den installerte testlederens privilegieoppstart er også kontrollert med `/usr/local/libexec/mbg-test-launch check report`. Den startet som forventet og meldte at ingen rapport finnes (returkode 2); denne kommandoen kjørte ingen tester.

## Oppstartsretting etter første brukerutførte kjøring

Kjøringen `20261027T174958.751158Z` på commit `5b41984244483b8fec6e2f85f3d847754ff2923d` ble blokkert ved API-/AI-oppstart og feilet i oppryddingen. Rapporten beholdes. Den er ikke et komplett FoM-punkt.

Årsaken er gjenskapt: C-startprogrammet åpnet venv-Python, men sendte `python` som `argv[0]`. Python valgte da `/usr` som miljø og fant ikke FastAPI. Testlederen ble dessuten startet på nytt av `backend/check` for å komme inn i `.venv`; dette mistet rettighetene til måling og opprydding etter at arv av rettigheter var slått av.

Startprogrammet bruker nå absolutt venv-sti også i `argv[0]`. Testlederen avviser feil miljø eller manglende målerettigheter tidlig. Installer den endrede binærfilen med `sudo bash backend/ops/setup-test-host.sh hoglar`. Modellen lastes ikke ned igjen.

En kort oppstartskontroll av de faktiske tjenestebrukerne kjøres med:

```bash
/usr/local/libexec/mbg-test-launch check startup
```

Den bruker samme isolerte miljø og startkommandoer som testpakken, kontrollerer prosessbrukere, manglende privilegier hos tjenestene, PSS-lesing, helsesjekk og metadata, og stopper alle prosessene. Den kjører ingen produktkontroller, inferens eller benchmarks og lager ingen FoM-rapport. Første komplette testfase kjøres fortsatt av brukeren med `./backend/check` etter egen commit.

Etter at brukeren installerte rettelsen, bestod denne oppstartskontrollen: API, AI og Ollama kjørte med hver sin avtalte bruker og uten ekstra prosessrettigheter; testlederen kunne lese PSS for API og PostgreSQL; helsesjekk, OpenAPI og modelloversikt svarte. Alle prosessene ble stoppet og den midlertidige databasen fjernet. Ingen ny full testkjøring eller FoM-måling er utført.

## Retting av måleoppsett og testdata etter andre kjøring

Brukerens kjøring `20261027T175640.430159Z` fikk 34 PASS, 5 FAIL og 1 BLOCKED i integrasjon/benchmark. Arbeidsmappen var ikke ren, og benchmarken manglet én PSS-verdi. Rapporten beholdes uendret. Denne rettingsrunden omfatter testdata og måleoppsett; samtidighetsfeil, ytelse og ekte AI-svar er fortsatt urettet.

- `TBE-02-renew-expiry` bruker nå sekunder i SQL-intervallene. PostgreSQL i `Europe/Oslo` viser at den tidligere 30-døgnsperioden blir 2 595 600 sekunder over vintertid og 2 588 400 over sommertid. Kontraktens intervall er alltid 2 592 000 sekunder. Databasens begrensninger og testens forventninger er beholdt.
- `TBE-07-rate-limit` bruker et feil passord som oppfyller skjemaet, som beskrevet ovenfor. Det endrer ikke forventede statuskoder eller rategrensen.
- PSS-måleren lager ikke lenger en kortlivet SQL-forbindelse før avlesningen. Ved endret prosessliste eller avsluttet underprosess forsøkes hele avlesningen på nytt, høyst tre ganger. Alle forsøk lagres med PID-er, delmålinger og feildiagnostikk. Manglende tilgang eller fortsatt ustabil måling gir fremdeles BLOCKED. Den gamle rapporten mangler PID/errno; prosesskappløpet er en identifisert svakhet i målekoden, men kan ikke bevises som årsaken til akkurat den historiske manglende verdien.

Avgrenset kontroll etter rettelsen: 72/72 av kontrollverktøyenes egne tester bestod, inkludert ni nye målerkontroller. De to berørte API-scenarioene bestod mot en separat midlertidig PostgreSQL-instans og virkelige tjenester. Denne funksjonskontrollen brukte utviklerens bruker og ingen ekte modell. Oppstartskontrollen ble separat kjørt med de faktiske tjenestebrukerne; samlet PSS for API og PostgreSQL-familien, prosessrettigheter, metadata og opprydding bestod. Alle midlertidige tjenester og databaser ble stoppet og fjernet.

Ingen full testfase, benchmark, modellspørsmål eller ny FoM-rapport er kjørt av agenten. Lastprofil, terskler, kontrollpunkter og FoM-formel er beholdt. Endret test-/målekode gir ny `control_digest` og en separat kurveserie; eldre rapporter skal beholdes.

Det trengs ingen ny sudo-installasjon for denne rettingen. Gjennomgå og commit endringene selv, kontroller at `git status --short` er tom, og kjør deretter `./backend/check` fra prosjektroten. Produktfeil kan gi en målbar baseline; manglende målinger eller en uren arbeidsmappe kan fortsatt blokkere FoM.
