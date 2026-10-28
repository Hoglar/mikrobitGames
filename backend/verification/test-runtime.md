# Teknisk design: interne grensesnitt og testtilkobling

**Revisjon 2026-10-28:** Brukerbestilt samtaleassistent er integrert med API 0.3.0, intern AI-kontrakt 1.3 og AI–database-kontrakt 1.2. Frontendkontrakten er fortsatt et forslag til frontendgruppen. Kontrollversjon 3 beholder 24/4/4 modellpunkter og starter en egen måleserie. Full testfase og benchmark kjøres av brukeren; tidligere rapporter beholdes.

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

Samtalerevisjonen bruker følgende modellhandlinger:

```json
{"type":"tool","name":"history","args":{"game":"Poengjakt","player":"me"}}
```

```json
{"type":"answer","kind":"records","answer":"Ada har registrerte rekorder."}
```

`kind: chat` brukes for vanlig prat og avklaring. Tillatte verktøy er `games({})`, `standings({game})`, `history({game,player})` og `player_games({player})`. Eksakte felt valideres; SQL og ekstra identitetsargumenter avvises. `read_store` bruker fast SQL med native `$1`-binding, SQL-policy, `ai_reader` og uendrede DB-grenser. Svarstatus bestemmes av tjenesten, ikke av et modellfelt `status`.

Bruk Ollamas `POST /api/chat` med `stream:false`, `format:"json"`, `options.num_ctx=16384`, `num_predict=512`, `temperature=0`. Adapteren tillater også vanlig ren tekst eller en JSON-streng som `chat`, fordi faktisk Qwen svarte slik på en hilsen. Ødelagt struktur, ukjente handlinger og ekstra felt godtas ikke som prat. Høyst fire modellkall deler en 60-sekundersfrist; ugyldig modellformat kan korrigeres innenfor den.

Før hvert kall begrenses samlet meldingsinnhold til 12 288 UTF-8-byte. Eldre utvekslinger fjernes først med `notices`; nåværende spørsmål og data klippes ikke. Faktisk `prompt_eval_count` over 15 360, manglende `done` eller avbrutt generering gir teknisk feil. Kontekstvinduet er større for å støtte opptil 20 utvekslinger; full ny ressurs-/tidsmåling gjenstår.

Intern forespørsel krever `request_id`, `player_id`, `player_name`, `conversation_id`, `question` og valgfri `game_id`. API-et utleder samtale-ID fra autentisert token med nøkkelsatt BLAKE2b og en tilfeldig prosessnøkkel. Ingen token/hash sendes videre. Testhjelperen `e.ai()` lager en ny samtale-ID som standard; tester av historikk gjenbruker den eksplisitt. API-tester bruker reell sesjonscookie. Minne, sletting og levetid beskrives i [kontrakt 1.5](../spec/contracts/backend-ai/contract.md).

Kontrollversjon 3 endrer testen av fravær av historikk til kontroll av sesjonsbundet historikk. SQL-angrep avvises allerede som modellhandlinger; parser og databaseroller testes fortsatt direkte. Resultatgrensen på 1 000 rader testes med 1 001 faktiske rekordholdere gjennom `standings`. Grensen på 1 MiB testes direkte gjennom samme `read_store.query` som `ai_reader`, fordi modellen ikke lenger kan be om vilkårlig brede projeksjoner. SQL-tidsavbrudd testes ved å låse tabellen for den faste verktøyspørringen. Ingen grense, benchmarklast eller faktakrav er slakket. Tidligere rapporter tilhører tidligere kontrollgrunnlag.

Under feiltester svarer et kontrollert HTTP-relé med avtalte meldinger. Ved virkelig AI-test videresender det til en egen Ollama-prosess og registrerer at faktiske modellkall ble utført. Testpakken setter `OLLAMA_NO_CLOUD=1`, bruker installerte modellfiler og foretar ingen nedlasting under testen. Se [Ollamas offisielle konfigurasjonsveiledning](https://github.com/ollama/ollama/blob/main/docs/faq.mdx).

## Data og tid

Funksjonstestene bruker Ada/Nora, to spill, åtte fullførte forsøk og åtte historiske rekorder fra DB-planen. Rekorddatoene er faste. Sesjonene opprettes relativt til testkjøringens UTC-klokke slik at innlogging fungerer på vilkårlig testdato; tidspunktet registreres. Eksakte utløpsgrenser testes separat med styrt klokke i enhetstestene.

Sesjonsdata som flyttes i SQL bruker intervaller i sekunder, i samsvar med kontrakt 1.4. Kalenderintervaller som `interval '29 days'` gir en annen varighet over sommer-/vintertid. Innloggingstester av feil passord bruker et feil passord som oppfyller OpenAPI-skjemaets lengdekrav; ellers testes ugyldig input (400), ikke ugyldige innloggingsopplysninger (401) og påfølgende rategrense (429).

Testtoken sendes som tekst i cookie; `token_hash` beregnes som SHA-256 av cookieverdien kodet som UTF-8. Dette gjør den tidligere generelle tokenbeskrivelsen entydig for testadapteren. Ingen ekte passord eller brukere inngår.

## Interne funksjoner for enhetstestene

| Modul | Grensesnitt |
| --- | --- |
| `score_rules.py` | `is_improvement(value, previous, direction) -> bool`; `previous=None` er første rekord. |
| Samme | `validate_score(value, min_value, max_value)`; avvis med `ValueError`/`TypeError`, inkludert boolske verdier. |
| Samme | `validate_attempt(status, value, min_value, max_value)`; `completed` bruker sluttresultatgrensene, `incomplete` tillater `None` eller sikkert ikke-negativt heltall uten sluttresultatgrensene. Ukjent status/ugyldig verdi gir `ValueError`/`TypeError`. Validering gjør ikke et ufullført forsøk rekordberettiget. |
| Samme | `rank_scores([(player_id, value), ...], direction) -> [(rank, player_id, value), ...]`; delt plassering 1,1,3 og stabil ID-sortering. |
| `auth_service.py` | `normalize_username(text) -> str`; små ASCII-bokstaver, `ValueError` ved ugyldig navn. |
| Samme | `session_expiry(created_at, renewed_at) -> datetime`; tidligste av siste fornyelse + 259 200 sekunder og opprettelse + 2 592 000 sekunder. |
| Samme | `session_is_valid(expires_at, absolute_expires_at, now) -> bool`; begge grenser er eksklusive. Tidspunktene har tidssone. |
| `query_policy.py` | `validate_query(sql)`; godta tillatt SQL og reis `ValueError`/underklasse ved avvisning. Ingen SQL utføres her. |
| `ai_gateway.py` | `validate_response(payload, expected_request_id)`; reis `ValueError` ved ugyldig svar. |

## Benchmark og gjenoppretting

API må ved `MBG_TEST_METRICS=1` sende `Server-Timing: db;dur=<millisekunder>` for toppliste, sesjonsoppslag og resultatregistrering. Målegrensen er fra backend ber om DB-operasjonen, inkludert poolventing, til resultat/commit er klart. HTTP-tid måles uavhengig i testklienten. Manglende DB-måling gir BLOCKED, ikke en antatt DB-tid. Instrumenteringen gjennomgås sammen med databaseadapteren.

API-ets databaseforbindelser går gjennom `CommitFaultProxy`, som kan miste en COMMIT-bekreftelse kontrollert. Begge TCP-forbindelsene i mellomleddet bruker `TCP_NODELAY`: videresending av små PostgreSQL-meldinger skal ikke legge til venting fra Nagle-algoritmen og forsinkede TCP-kvitteringer. Mellomleddet beholdes i hele kjøringen; feilinjeksjonen aktiveres bare av den aktuelle testen. Tidsmålingen inkluderer fortsatt den faktiske forbindelsen og all venting; ingen målt tid trekkes fra. Tidligere kjøringer uten dette socket-valget kan ha transportforsinkelser fra testoppsettet og sammenlignes ikke direkte med den korrigerte serien.

Benchmarkdata: 1 000 spillere, 10 spill og 10 000 historiske rekorder og 10 000 tilhørende fullførte forsøk. Last: 30 aktive spillere, 6 operasjoner/s med 60/20/20-fordeling, 120 s oppvarming og 900 s måling per fase. Deretter ti topper med 30 samtidige kall per operasjonstype. Forsinket utsending, feil, råtider, PSS, CPU-ticks og forbindelser beholdes. Målingen foregår på serveren; SSH/internett inngår ikke i HTTP-/DB-tiden.

PSS og CPU-ticks leses fra `/proc` for API, PostgreSQL-hovedprosessen og alle dens direkte barn. Prosesslisten leses uten en forutgående SQL-inspeksjonsforbindelse. Hvis en underprosess avsluttes, prosesslisten endres eller et PID gjenbrukes under lesingen, forsøkes hele målingen på nytt, høyst tre forsøk med 10 ms mellomrom. Prosessidentitet kontrolleres med starttid fra `/proc/PID/stat`. Dette er en sekvensiell måling med kontroll av prosesslisten, ikke et atomisk øyeblikksbilde fra kjernen. Hvert forsøk beholder tidsvindu, PID-er, delmålinger og eventuell feil/errno i `process_measurement_attempts`. Rettighetsfeil, manglende hovedprosesser, ugyldige felt eller uttømte forsøk gir fortsatt manglende måling og BLOCKED. Ingen prosess utelates og ingen tidligere verdi gjenbrukes. SQL-inspeksjon av forbindelser skjer etter prosessmålingen.

`backend/database/restore.sh <backupfil>` skal gjenopprette til databasen i `MBG_ADMIN_DSN` og fjerne gjenopprettede sesjoner. Testpakken lager kopien og en separat tom måldatabase, kjører den virkelige gjenopprettingsrutinen og sammenligner data etterpå. Rutinen implementeres i databasearbeidet, ikke erstattes av en testdobbel.

## Prosessrettigheter og lokale tilpasninger

Planens separate Linux-brukere må også være satt opp for at isolasjonstesten skal bestå. Standard oppstart under samme bruker gir FAIL på den testen; det skjules ikke selv om funksjonstestene består. Det endelige bruker-/tjenesteoppsettet gjøres ved implementering og drift.

Ressursmålingen krever lesetilgang til API- og PostgreSQL-prosessenes `/proc/<pid>/smaps_rollup` og `stat`. Dette må tas med i engangsoppsettet når tjenestene får separate brukere. Manglende tilgang gir BLOCKED; verktøyet erstatter ikke PSS med en annen minnemåling eller endrer systemrettigheter automatisk. Startkommandoer som bytter bruker må starte selve tjenesten med samme PID (`exec`), slik at UID- og ressurskontrollen måler tjenesten.

Ved behov kan `api_command`, `ai_command` og `ollama_command` angis som argumentlister i `backend/check.local.json`. For API/AI erstattes hele argumentet `{python}` med venv-Python og `{port}` med tildelt port. Startkommandoen skal beholde miljøvariablene og håndtere terminering av hele prosessgruppen. Testbrukerne trenger tilgang til kildekode og sin egen konfigurasjon, men ikke hverandres hemmeligheter. `postgres_bin` kan angi PostgreSQL-binærmappen; `model_directory` angir ferdig nedlastede modellfiler.

Uttrekksverktøyene normaliserer dokumentasjonsfelt, referanser, rekkefølge og avtalte typealiaser. Ukjent/dynamisk kildekode kan gi BLOCKED for manuell avklaring; importgrafen alene beviser ikke kjøreoppførsel. Om automatisk normalisering ikke kan avgjøre et avvik, endres ikke fasiten automatisk.
