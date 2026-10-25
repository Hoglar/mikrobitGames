# Teknisk design: interne grensesnitt og testtilkobling

Dette dokumentet eier de konkrete interne designvalgene som implementasjonen og testpakken deler: oppstart, miljøvariabler, funksjonssignaturer, modellmeldinger og instrumentering. Det ligger ved testverktøyene, men inngår i designgrunnlaget for første implementasjon. Funksjonskrav og sikkerhetsgrenser kommer fra [kontraktene og modulkravene](../spec/README.md); testtilkoblingen skal ikke innføre nye produktkrav. Endres et internt grensesnitt, oppdateres dette dokumentet, berørte kall og tester sammen etter reglene i implementeringsplanen.

Testpakken implementerer ikke backendfunksjonene; den starter og kontrollerer den virkelige koden. Daglig bruk står i [kjøreguiden](README.md).

## Oppstart og isolasjon

- Før oppsett skal filplasseringer og tilgang følge [reglene for versjonskontroll og lokale data](../../docs/project-structure.md#versjonskontroll-og-lokale-data). Dokumenter de valgte driftsstiene i oppsettet. Testinstansens midlertidige, syntetiske data holdes adskilt fra driftsdata; eksisterende modellfiler blir liggende utenfor repositoryet.
- API eksponerer `app` i `backend/api/src/http_api.py`, AI eksponerer `app` i `backend/ai-service/src/transport.py`. Standardkommandoene bruker `python -m uvicorn`, én prosess per tjeneste.
- Applikasjonsavhengigheter låses i `backend/requirements.txt`. Testavhengigheter ligger i `verification/requirements.txt`.
- SQL-migreringer ligger i `backend/database/migrations/*.sql` og kjøres i filnavnrekkefølge på en tom database. Testpakken oppretter de to innloggingsrollene `backend_app` og `ai_reader` med forskjellige, tilfeldige testpassord. Migreringene etablerer skjema, visningseier, begrensninger og effektive rettigheter. Bruk gjeldende databasenavn, ikke hardkodet driftsdatabase.
- Databaseinstansen er ny og eies av testkjøringen. Ingen ekstern/eksisterende DB-DSN aksepteres av testpakken. Omstart, tømming og gjenoppretting gjelder bare denne instansen.
- HTTPS-testinngangen bruker et midlertidig lokalt sertifikat som testklienten stoler på. Dette kontrollerer API/cookie-/Origin-oppførsel, men erstatter ikke senere kontroll av Caddy og offentlig HTTPS.

Testkommandoen setter følgende miljøvariabler før tjenestene starter:

| Variabel | Bruk |
| --- | --- |
| `MBG_DATABASE_DSN` | Tjenestens egen rolle, aldri administratorens. API og AI får forskjellige hemmeligheter. |
| `MBG_PUBLIC_ORIGIN` | Den lokale HTTPS-inngangen som skal godtas ved CSRF-kontroll. |
| `MBG_AI_URL` | AI-inngang gjennom testreléet; kan gi kontrollerte feil i gateway-testene. |
| `MBG_OLLAMA_URL` | Lokal modellinngang gjennom testreléet. |
| `MBG_MODEL` | Modellnavnet fra planen/lokal konfigurasjon. |
| `MBG_TEST_METRICS=1` | Aktiverer DB-timing for benchmark, se nedenfor. |

API og AI skal tilby `/openapi.json` for uttrekk. Frontendfasiten er `spec/contracts/webapp-backend/openapi.yaml`; intern AI-fasit fra kontrakt 1.5 er [ai-openapi.json](../tests/fixtures/ai-openapi.json). Fasiten hentes aldri fra tjenestens eget uttrekk.

## Kontrollerte modellmeldinger

For testadapteren konkretiseres den planlagte interne JSON-protokollen slik:

```json
{"type":"query","sql":"SELECT value FROM ai_read.records WHERE player_id = $1","parameters":["11111111-1111-4111-8111-111111111111"]}
```

```json
{"type":"answer","status":"ok","answer":"Ada har registrerte rekorder."}
```

Bruk Ollamas `POST /api/chat` uten strømming. JSON ligger i `message.content`, med `options.num_ctx=4096` og `options.num_predict=512`. Tjenesten kontrollerer skjema, SQL, datagrunnlag og budsjett. Dette konkretiserer modelladapteren; det endrer ikke frontend- eller API–AI-kontrakten. SQL-en inneholder PostgreSQL-parametere (`$1` osv.); driveradapteren må binde disse sikkert.

Under feiltester svarer et kontrollert HTTP-relé med avtalte meldinger. Ved virkelig AI-test videresender det til en egen Ollama-prosess og registrerer at faktiske modellkall ble utført. Testpakken setter `OLLAMA_NO_CLOUD=1`, bruker installerte modellfiler og foretar ingen nedlasting under testen. Se [Ollamas offisielle konfigurasjonsveiledning](https://github.com/ollama/ollama/blob/main/docs/faq.mdx).

## Data og tid

Funksjonstestene bruker Ada/Nora, to spill og åtte historiske rekorder fra DB-planen. Rekorddatoene er faste. Sesjonene opprettes relativt til testkjøringens UTC-klokke slik at innlogging fungerer på vilkårlig testdato; tidspunktet registreres. Eksakte utløpsgrenser testes separat med styrt klokke i enhetstestene.

Testtoken sendes som tekst i cookie; `token_hash` beregnes som SHA-256 av cookieverdien kodet som UTF-8. Dette gjør den tidligere generelle tokenbeskrivelsen entydig for testadapteren. Ingen ekte passord eller brukere inngår.

## Interne funksjoner for enhetstestene

| Modul | Grensesnitt |
| --- | --- |
| `score_rules.py` | `is_improvement(value, previous, direction) -> bool`; `previous=None` er første rekord. |
| Samme | `validate_score(value, min_value, max_value)`; avvis med `ValueError`/`TypeError`, inkludert boolske verdier. |
| Samme | `rank_scores([(player_id, value), ...], direction) -> [(rank, player_id, value), ...]`; delt plassering 1,1,3 og stabil ID-sortering. |
| `auth_service.py` | `normalize_username(text) -> str`; små ASCII-bokstaver, `ValueError` ved ugyldig navn. |
| Samme | `session_expiry(created_at, renewed_at) -> datetime`; tidligste av siste fornyelse + 259 200 sekunder og opprettelse + 2 592 000 sekunder. |
| Samme | `session_is_valid(expires_at, absolute_expires_at, now) -> bool`; begge grenser er eksklusive. Tidspunktene har tidssone. |
| `query_policy.py` | `validate_query(sql)`; godta tillatt SQL og reis `ValueError`/underklasse ved avvisning. Ingen SQL utføres her. |
| `ai_gateway.py` | `validate_response(payload, expected_request_id)`; reis `ValueError` ved ugyldig svar. |

## Benchmark og gjenoppretting

API må ved `MBG_TEST_METRICS=1` sende `Server-Timing: db;dur=<millisekunder>` for toppliste, sesjonsoppslag og resultatregistrering. Målegrensen er fra backend ber om DB-operasjonen, inkludert poolventing, til resultat/commit er klart. HTTP-tid måles uavhengig i testklienten. Manglende DB-måling gir BLOCKED, ikke en antatt DB-tid. Instrumenteringen gjennomgås sammen med databaseadapteren.

Benchmarkdata: 1 000 spillere, 10 spill og 10 000 historiske rekorder. Last: 30 aktive spillere, 6 operasjoner/s med 60/20/20-fordeling, 120 s oppvarming og 900 s måling per fase. Deretter ti topper med 30 samtidige kall per operasjonstype. Forsinket utsending, feil, råtider, PSS, CPU-ticks og forbindelser beholdes. Målingen foregår på serveren; SSH/internett inngår ikke i HTTP-/DB-tiden.

`backend/database/restore.sh <backupfil>` skal gjenopprette til databasen i `MBG_ADMIN_DSN` og fjerne gjenopprettede sesjoner. Testpakken lager kopien og en separat tom måldatabase, kjører den virkelige gjenopprettingsrutinen og sammenligner data etterpå. Rutinen implementeres i databasearbeidet, ikke erstattes av en testdobbel.

## Prosessrettigheter og lokale tilpasninger

Planens separate Linux-brukere må også være satt opp for at isolasjonstesten skal bestå. Standard oppstart under samme bruker gir FAIL på den testen; det skjules ikke selv om funksjonstestene består. Det endelige bruker-/tjenesteoppsettet gjøres ved implementering og drift.

Ressursmålingen krever lesetilgang til API- og PostgreSQL-prosessenes `/proc/<pid>/smaps_rollup` og `stat`. Dette må tas med i engangsoppsettet når tjenestene får separate brukere. Manglende tilgang gir BLOCKED; verktøyet erstatter ikke PSS med en annen minnemåling eller endrer systemrettigheter automatisk. Startkommandoer som bytter bruker må starte selve tjenesten med samme PID (`exec`), slik at UID- og ressurskontrollen måler tjenesten.

Ved behov kan `api_command`, `ai_command` og `ollama_command` angis som argumentlister i `backend/check.local.json`. For API/AI erstattes hele argumentet `{python}` med venv-Python og `{port}` med tildelt port. Startkommandoen skal beholde miljøvariablene og håndtere terminering av hele prosessgruppen. Testbrukerne trenger tilgang til kildekode og sin egen konfigurasjon, men ikke hverandres hemmeligheter. `postgres_bin` kan angi PostgreSQL-binærmappen; `model_directory` angir ferdig nedlastede modellfiler.

Uttrekksverktøyene normaliserer dokumentasjonsfelt, referanser, rekkefølge og avtalte typealiaser. Ukjent/dynamisk kildekode kan gi BLOCKED for manuell avklaring; importgrafen alene beviser ikke kjøreoppførsel. Om automatisk normalisering ikke kan avgjøre et avvik, endres ikke fasiten automatisk.
