# Første implementasjon

**Drift og frontendtilkobling (2026-10-29):** Full testfase på commit `3bd5d07` bestod alle 72/69/42 kontroller, med 100 % krav-/modell-FoM. Se [resultatarkivet](../results/fom/README.md). Vedvarende drift er installert med [Tailscale Funnel](ops/runtime/README.md) på **https://parrot.tail106c62.ts.net**. Helseendepunktet er bekreftet fra mobilnett av brukeren. Se [driftskontrollen](results/runtime-2026-10-29.md) og [frontendens API-hurtigguide](../spec/contracts/webapp-backend/quickstart.md). Selve frontendpakken gjenstår. Notatene nedenfor beskriver implementering og tidligere avgrensede prøver.

**Gjeldende samtaleløsning, 2026-10-28:** Assistenten er nå integrert i API-et med opptil 20 utvekslinger per innlogging, navngitte dataverktøy og reset-rute. Ingen nye avhengigheter, modellnedlasting eller sudo-oppsett trengs for denne endringen. Prøv med `.venv/bin/python backend/ops/try-ai.py`, og avslutt prøven før benchmark. Full testfase startes av brukeren med `./backend/check` fra prosjektroten. Lagre først en ren commit hvis kjøringen skal gi et sammenlignbart FoM-punkt. Kontrollversjon 3 starter ny serie; tidligere rapporter beholdes. Historiske diagnoser nedenfor beskriver tidligere varianter. Se [gjeldende kontrakt](spec/contracts/backend-ai/contract.md).

**Avgrenset kontroll før overlevering:** 72 kontrollverktøytester og 69 enhetstester består. Tolv utvalgte API/AI-integrasjonskontroller består samlet over diagnosekjøringen og omkontrollen av den rettede storresultat-fixturen; alle 32 modellkontroller består. Siste omkontroll ligger lokalt i `backend/results/runs/conversation-final-check.json`, tidligere diagnose i `conversation-integration-20261028T142241Z.json`. Ingen full testfase, benchmark eller ny FoM er kjørt for denne revisjonen. Den siste planlagte Qwen-prøven gjennom API ble avbrutt før utførelse; ingen ny påstand om full faktakvalitet eller svartid gjøres. Hilsener ble kontrollert i den tidligere avgrensede modellprøven, mens integrasjon og minnegrenser er kontrollert med styrte modellsvar.


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

## Prøv AI-en selv i terminalen

Kjør fra prosjektroten på Parrot med det eksisterende testoppsettet:

```bash
.venv/bin/python backend/ops/try-ai.py
```

Dette er manuell utprøving, ikke `./backend/check`: ingen automatisk spørsmålsserie,
benchmark, FoM eller krav om ren commit. Unngå samtidig benchmark, siden modellen
vil konkurrere om maskinens ressurser. Programmet starter en egen midlertidig
database med Ada/Nora-data og eksisterende API, AI og modell på loopback. Det bruker
modellstien fra `backend/check.local.json` og laster ikke ned noe. Forespørslene går
gjennom API-et med en syntetisk spillersesjon; identiteten bestemmes av API-et.
Produktets instruksjoner, SQL-filter, databaseroller og tids-/forsøksgrenser beholdes.

Du starter som **Ada med Poengjakt som spillkontekst**, akkurat som i modelltesten.
Skriv for eksempel «Hvordan ligger jeg an mot Nora i Sprint?». Hvert spørsmål
behandles selvstendig: AI-en husker ikke tidligere spørsmål eller svar.

- `/data` viser de faktiske offentlige rekordene direkte fra testdatabasen.
- `/spiller nora` eller `/spiller ada` bytter syntetisk innlogget spiller.
- `/spill ingen`, `/spill sprint` eller `/spill poengjakt` endrer spillkontekst.
- `/hjelp` viser kommandoene.
- `/avslutt`, Ctrl+D eller Ctrl+C stopper tjenestene og fjerner databasen.

Fasit: Ada har Poengjakt 100 → 120 poeng og Sprint 60 000 → 55 000 ms;
Nora har Poengjakt 110 → 115 poeng og Sprint 65 000 → 58 000 ms.
Ada er dermed 3 sekunder raskere i Sprint. Dette er rekordhistorikk, ikke alle forsøk.
Svar, status og tidsbruk vises i terminalen. Ingen samtalerapport lagres av verktøyet;
kopier interessante spørsmål og svar hvis de skal undersøkes videre. Testmiljøets
midlertidige logger slettes ved normal avslutning.

Denne diagnosen kjører tjenestene som utviklerens Linux-bruker. Den bruker egne
databaseroller, men verifiserer ikke separate Linux-brukere eller prosessisolasjon;
det gjør den ordinære testfasen. Ingen offentlig tilgang åpnes. En ren Ollama-chat
ville ikke hatt denne databasekoblingen og ville derfor prøvd en annen funksjon.

Terminalverktøyet fjerner `DISPLAY`, `WAYLAND_DISPLAY` og `XAUTHORITY` fra sitt
eget prosessmiljø før tjenestene starter. Modellen trenger ingen grafikkvinduer;
arvet SSH-grafikkvideresending kan ellers gi `connect 127.0.0.1 port 6000:
Connection refused` under grafikkoppdagelse. Endringen påvirker ikke terminalens
SSH-oppsett og deaktiverer ikke GPU-beregning. En eventuell HTTP-feil som
`503 AI_UNAVAILABLE` må undersøkes separat: den kan også skyldes intern
datahentingsfeil etter ugyldig modellgenerert SQL.

## Separat samtaleprototype

Etter brukerens bestilling finnes et eget forsøk med kort samtalehistorikk og
navngitte dataverktøy i [prototypemappen](prototypes/conversation/README.md).
Start fra prosjektroten med:

```bash
.venv/bin/python backend/prototypes/conversation/run.py
```

Det bruker samme Qwen og syntetiske Ada/Nora-data, men en annen samtaleflyt enn
backendens AI. `/ny` glemmer samtalen; bytte av spiller glemmer også historikken.
Ingen varig samtalelagring eller ny frontend/API-kontrakt er innført. Første
avgrensede evaluering ga riktige toppliste- og Sprint-svar, men også feil ved
hilsen, et verktøyvalg og en oppdiktet tilleggspåstand. Prototypen er derfor klar
til manuell utprøving, ikke godkjent for produksjon. Se README-en for detaljer,
kontroller og kjente begrensninger. Ordinær `./backend/check` måler fortsatt den
eksisterende backendimplementasjonen.

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

## Undersøkelse og retting av samtidighetsfeil etter første komplette måling

Brukerens kjøring `20261027T185538.809129Z` på ren commit `e21d82edc82301c1ef26b4e64a9771780db67291` var komplett målbar: 72 verktøytester, 52 enhetstester og 36 integrasjon-/benchmarkkontroller bestod; fire kontroller feilet. FoM var 83,33 % krav og 100 % modell. Rapporten beholdes uendret, men årsaksundersøkelsen nedenfor viser at den inneholder feilpåvirkning fra testoppsettet.

De to samtidighetsfeilene ble gjenskapt mot en midlertidig database med uendret produktkode og uendrede testforventninger. Gjennom `CommitFaultProxy` kom flere 503 `SERVICE_UNAVAILABLE`; mot direkte databaseforbindelse bestod begge kontrollene. Mellomleddet sendte PostgreSQL-svar videre én protokollmelding av gangen uten `TCP_NODELAY`. Dette la til transportventing mens transaksjonene holdt spillerlåsen. Rettelsen setter `TCP_NODELAY` på forbindelsen mot API-et og forbindelsen mot PostgreSQL. Normal testkjøring bruker fortsatt mellomleddet, og feilinjeksjonen er beholdt.

Etter rettelsen bestod `TBE-05-concurrent-records` og `TBE-05-concurrent-replay` gjennom mellomleddet. Seks tilknyttede kontroller bestod også: `TBE-03-records`, `TBE-03-incomplete`, `TBE-05-retry-conflict`, `TBE-05-atomic-attempt-record`, `TBE-05-unknown-commit` og `TBE-05-revocation-race`. De kontrollerer blant annet at lagring er atomisk, at gjentakelse ikke lager duplikater, at tilbakekalt sesjon avvises og at tapt COMMIT-bekreftelse fortsatt simuleres og håndteres. Kontrollverktøyenes 72 egne tester bestod.

Disse avgrensede funksjonskontrollene brukte reell API/AI-oppstart og PostgreSQL med standard lokal testoppstart under utviklerens Linux-bruker. De testet ikke prosessisolasjon eller ekte AI. Miljøet ble stoppet og de midlertidige databasene fjernet. Ingen full testfase, benchmark, modellspørsmål, commit eller push er utført av agenten i denne runden.

Ingen produktkode, krav, testforventninger, pool-/tidsgrenser eller belastningsprofil er endret. Testinfrastrukturen er rettet; dette gir ny `control_digest` og en separat måleserie. Neste komplette kjøring blir første punkt med korrigert databasetransport, og skal ikke fremstilles som en backend-ytelsesforbedring over `e21d82e`. Ytelsen må måles på nytt. AI-feilen er ikke behandlet i denne runden. Ingen ny sudo-installasjon trengs: gjennomgå og commit, kontroller ren arbeidsmappe, og kjør `./backend/check` selv.

## AI-undersøkelse og delvis retting 2026-10-28

Brukerens komplette kjøring `20261027T194827.319030Z` på commit `d70e9fa5d8944705060c716eea29a7c0fcd65ec3` hadde 39 PASS og én FAIL i integrasjon/benchmark. Den eneste feilen var `TAI-02-08-real-model`; krav-FoM var 91,67 %. Rapporten beholdes uendret.

En målrettet gjennomgang av modellforslag og databaseutfall avdekket en feil i produktkoden: SQLGlot representerer også `AND`, `OR` og `EXISTS` som `Func`. SQL-filteret vurderte funksjonstypen før sin eksplisitte syntaksliste og avviste dermed allerede tillatt SQL. En gyldig spørring etter spiller-ID **og** spillnavn ble stoppet før databasetilgangen. Filteret kontrollerer nå den eksplisitte syntakslisten først, og kontrollerer fortsatt alle nestede uttrykk og objekter. Ingen nye funksjoner, tabeller eller rettigheter er lagt til.

Etter rettelsen kan modellen lese rekordene 100 og 120 for Ada i Poengjakt og svare om utviklingen. Dette bekrefter at databasetilgangen fungerer. Sammenligningen mot Nora i Sprint har et separat problem: modellen velger fortsatt feil spill/spillergrunnlag, og kan derfor svare `no_data` selv om de nødvendige rekordene finnes. Forsøk på å presisere modellinstruksjon og spillkontekst ga ustabile svar og er forkastet. Modellinstruksjonen, adapteren og orkestreringen er beholdt fra baseline; bare SQL-filteret er rettet.

De 27 eksisterende SQL-policytestene og fire supplerende regresjonstester består. Regresjonstestene kontrollerer også at tillatt `AND`/`OR`/`EXISTS` ikke slipper gjennom nestet lesing av private tabeller, farlige funksjoner eller skriving. De ligger under `backend/ai-service/tests/` og kjøres separat som dokumentert der. Det faste FoM-kontrollsettet, testforventningene, modellvalget og grensene er uendret. Denne produktrettelsen endrer ikke `control_digest`.

Ti målrettede integrasjonskontroller av gateway, AI-transport, SQL-avvisning, private forsøk, forsøksbudsjett, samtidighetsgrense, fravær av samtalehistorikk, resultatgrenser og SQL-tidsavbrudd består på den beholdte koden. Kontrollene bruker midlertidig PostgreSQL og reelle tjenester under utviklerens Linux-bruker; de er ikke en ny kontroll av Linux-prosessisolasjonen.

Den eksisterende `TAI-02-08-real-model` ble deretter kjørt alene, inkludert kald modell og tre varme runder: **7 av 10 svar oppfylte format/status/tidskravene**, mot 3 av 10 i brukerens siste komplette rapport. Alle svar kom innen 60 sekunder; kaldt svar tok omtrent 41 sekunder. Alle tre Sprint-sammenligninger ga fortsatt `no_data`, så kontrollen er fortsatt **FAIL**. Svar om Poengjakt-utvikling og Noras spill samsvarte med testdataene i denne avgrensede kontrollen; det beviser ikke generell faktakvalitet. Råresultatene fra diagnosekjøringen ligger lokalt i `backend/results/runs/ai-targeted-20261028.json`, tydelig merket uten FoM. Ingen tidligere rapport er overskrevet.

Alle midlertidige tjenester ble stoppet og databasen fjernet. Ingen full `./backend/check`, HTTP-/DB-belastningsbenchmark, ny FoM-beregning, commit eller push er utført. SQL-rettelsen er klar til gjennomgang, men den samlede AI-feilen er ikke ferdigrettet. En ny lang testkjøring er ikke nødvendig for å konstatere den gjenværende feilen; videre modellstyring eller modellvalg må undersøkes i en ny avtalt runde. Eksisterende krav, modell og tilgangsgrenser skal fortsatt ligge fast inntil annet avtales.

### Avgrenset sammenligning av spillkontekst 2026-10-28

Etter brukerens bestilling ble samme spørsmål, «Hvordan ligger jeg an mot Nora i Sprint?», kjørt i rekkefølgen med/uten/uten/med spillkontekst. Bare `game_id` i meldingen til modellen ble fjernet i uten-varianten. Forespørselen til AI-tjenesten var identisk: den validerte fortsatt Poengjakt som valgt spill og brukte samme SQL-budsjett. Modell, systeminstruksjon, spørsmålsstillerens identitet og øvrige modellinnstillinger var uendret. De lagrede førstegangskallene er sammenlignet for å bekrefte denne avgrensningen.

Med kontekst undersøkte modellen Ada i Poengjakt i begge forsøk. Uten kontekst undersøkte den Ada i Sprint i begge forsøk, men la til det feilaktige filteret `ranking_direction = 'asc'`. Databasen bruker `lower_is_better` for Sprint, og ingen rader traff filteret. Den hentet heller ikke Nora. Alle fire svar endte som `no_data`, selv om fasiten er Ada 55 000 ms og Nora 58 000 ms. Undersøkelsen støtter at spillkonteksten forstyrrer spillvalget i dette spørsmålet; den viser også at fjerning alene ikke løser sammenligningen. Dette er ett spørsmål med to repetisjoner per variant, ikke generell dokumentasjon av modellkvalitet eller hastighet.

Ingen produktkode, krav eller testforventninger ble endret i sammenligningen. Råmodellkall, SQL, syntetiske databaseutfall, svar og innstillinger er lagret lokalt i `backend/results/runs/ai-context-comparison-20261028.json`. Alle midlertidige tjenester og databasedata ble ryddet. Ingen full testfase, FoM, commit eller push ble utført.

### Sekvensielt forsøk med feltforklaring og sammenligning 2026-10-28

Etter ny bestilling ble tre varianter kjørt én gang hver mot samme spørsmål og datasett: opprinnelig instruksjon uten spillkontekst, samme variant med presise `ranking_direction`-verdier, og deretter samme variant med veiledning om å hente begge spillernes gjeldende rekorder. Variantene kjørte i en midlertidig kopi av AI-koden. Bare spillkontekst ble fjernet fra modellens forespørsel; AI-endepunktets spillkontroll og SQL-budsjett ble beholdt. Kodekopiens opprinnelige 3072-byte kontekstkontroll og alle øvrige grenser gjaldt også de utvidede instruksjonene. Modellinnstillinger og første brukermelding var identiske mellom variantene.

- Referansevarianten brukte fortsatt `ranking_direction='asc'` og returnerte `no_data`.
- Feltforklaringen ga først et feil filter med `higher_is_better`, deretter et korrekt filter med `lower_is_better`. Modellen fikk Adas Sprint-rekorder, men hentet ikke Nora og returnerte fortsatt `no_data`.
- Veiledningen om begge spillere ga SQL med `p.player_id`, selv om `ai_read.players` har kolonnen `id`. PostgreSQL avviste spørringen, og tjenesten svarte 500 `INTERNAL_ERROR`. Dette var en ugyldig modellgenerert spørring, ikke manglende databaserettigheter.

Ingen variant ga korrekt sammenligning. Den planlagte videre kontrollen med andre navn, spill og formuleringer var betinget av et korrekt svar og ble derfor ikke startet. Ingen av instruksjonsvariantene er tatt inn i produktkoden. Resultatet dokumenterer disse konkrete forsøkene, ikke at modellen aldri kan løse oppgaven. Rådata ligger lokalt i `backend/results/runs/ai-field-guidance-20261028.json`. Midlertidig kodekopi, tjenester og database er fjernet. Ingen full testfase, FoM, commit eller push er utført.

### Direkte modellprøve, hilsener og SQL-referanser 2026-10-28

Brukeren bestilte en avgrenset undersøkelse av direkte Qwen-kall, modellmeldingene
fra backend og muligheten for korrigering av ugyldig SQL. Samme installerte modell,
JSON-protokoll og genereringsinnstillinger ble brukt; ingen ny modell ble lastet
ned. Kjøringene nedenfor er diagnoser med syntetiske data, ikke FoM eller grunnlag
for ytelsessammenligning. Tjenestene kjørte under utviklerens Linux-bruker i egne
midlertidige databaser på loopback; prosessisolasjon ble ikke målt på nytt.

Direkte SQL-generering med de tre visningenes skjema, spiller-ID og Sprint-spørsmålet
ga et selvmotsigende filter: brukernavnet måtte både være Nora og forskjellig fra
Nora. SQL-en kunne kjøres, men hentet ingen rader. Et direkte kall med backendens
opprinnelige første modellmelding ga samme første SQL-forslag som backendflyten:
Ada i Poengjakt, selv om spørsmålet gjaldt sammenligning med Nora i Sprint.
Dette bekrefter feil i modellens datavalg også uten backendorkestrering. Den enklere
instruksjonen endret flere inputdetaljer; forsøket identifiserer ikke én bestemt
instruksjon som årsak og beviser ikke generell manglende modellevne.

Meldingsgjennomgangen viste også en svakhet rundt hilsener. Orkestreringen krever
faktisk hentet grunnlag før `ok` og `no_data`, slik rekordspørsmål krever. Når modellen
svarer på en hilsen med en av disse statusene, får den derfor beskjed om å hente data.
For «Hei hei» fulgte feil parameterliste og deretter et udefinert `g`-alias, som ga
databasefeil. En instruksjon om å håndtere hilsener direkte med `cannot_answer`
fungerte på «Hei hei» og «Hallo!», men ga regresjon på rekordutvikling. Den er forkastet;
modellinstruksjonen og protokollen er beholdt fra baseline. Vi har ikke innført
generell chat, klassifisering av hilsener eller fritak fra datakravet for faktasvar.

**Beholdt produktretting:** `query_policy` kontrollerer nå kolonnereferanser og
tabellalias mot det eksplisitte skjemaet for de tre offentlige visningene. Udefinerte
alias, ukjente kolonner og tvetydige referanser avvises før databaseforbindelsen
opprettes. SQLGlot kvalifiserer bare en kopi for kontroll; SQL-en som kjøres blir
ikke automatisk omskrevet. Orkestreringen gir modellen en fast, kort forklaring om
kolonner/alias, uten rå PostgreSQL-feilmeldinger. Avvisningen bruker et SQL-forsøk,
og eventuell korrigering deler eksisterende grenser: tre SQL-forsøk inklusive
spillkontroll, fire modellkall og 60 sekunder. Dette følger kontrakt 1.6 sin regel
om å avvise ugyldig SQL før kjøring og tillate korrigering innen budsjettet.
Ingen kontrakt, tilgang, testforventning eller målegrense er endret. Andre feil ved
databasekjøring, inkludert rettighetsfeil og tidsavbrudd, er fortsatt tekniske feil.

Kontroller etter rettelsen:

- De 27 eksisterende SQL-policytestene og seks supplerende regresjonstestmetoder
  bestod. Tilleggene dekker blant annet avvisning før DB-tilkobling, CTE-er,
  korrelerte delspørringer, aggregater, vindusfunksjoner og bevaring av SQL-en.
- Ti eksisterende integrasjonskontroller for gateway, transport, SQL-policy, private
  forsøk, budsjetter, samtidighet, historikk/fravær av tjeneste, resultatgrenser og
  SQL-tidsavbrudd bestod.
- Fire avgrensede tilleggskontroller bestod: samsvar mellom filterets kolonneliste
  og de virkelige visningene; korrigering av udefinert alias/ukjent kolonne innen
  totalt tre forsøk uten at ugyldig SQL når databasen; stopp ved gjentatte avvisninger;
  og fortsatt teknisk feil uten omforsøk når SELECT-rettigheten trekkes tilbake.
- Komponentenes importgraf samsvarer fortsatt med modellen. Ingen ny komponent
  eller avhengighet mellom komponentene er innført.

Sju ekte modellspørsmål ble deretter prøvd med **koden som beholdes og opprinnelig
instruksjon**. Begge formuleringene om Poengjakt-utvikling hentet relevante data og
ga 100 → 120 / 20 poeng. Spørsmålet om Noras spill hentet Noras data og ga Poengjakt
og Sprint. Begge Sprint-sammenligningene valgte fortsatt feil datagrunnlag og ga
feilaktig `no_data`. Hilsenene ga HTTP 200 med `cannot_answer`, ikke 503; de utløste
fortsatt unødvendige modellforsøk, og «Hallo!»-svaret ga en misvisende forklaring om
tilgangsbeskyttelse/SQL. Hilsener er derfor ikke en ferdig samtalefunksjon.

Den forkastede instruksjonsvarianten ga dessuten et tilsynelatende riktig svar om
Noras spill etter å ha hentet **Adas** rekorder. Begge spillere har de samme spillene
i dette datasettet. Riktig slutttekst eller `ok` er derfor ikke tilstrekkelig bevis
på riktig datagrunnlag. Den beholdte varianten hentet Nora korrekt i dette forsøket;
det er fortsatt bare en avgrenset observasjon, ikke generell faktagodkjenning.

Rå modellmeldinger, SQL, resultater og svar er bevart lokalt, uten å overskrive tidligere
rapporter:

- `backend/results/runs/ai-diagnosis-20261028T083605Z.json`
- `backend/results/runs/ai-reference-checks-20261028T083952Z.json` (inkluderer forkastet hilsen-instruksjon)
- `backend/results/runs/ai-retained-samples-20261028T084241Z.json` (beholdt kode)

Alle tjenester og databaser startet av disse forsøkene er ryddet. Ingen full
`./backend/check`, benchmark, ny FoM, commit eller push er utført. Det faste
kontrollgrunnlaget er uendret. Oppstart av `try-ai.py` på nytt bruker den beholdte
rettelsen uten ny sudo-installasjon. Sprint-feilen gjenstår; en ny lang benchmark
er ikke nødvendig for å bekrefte den. Videre modellforsøk krever en ny bestilt runde.
