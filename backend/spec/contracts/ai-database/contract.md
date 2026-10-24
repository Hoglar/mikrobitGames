# WBS 1.6 – Kontrakt mellom AI-tjenesten og databasen

**Status:** Ferdigstilt og godkjent av prosjekteier som dokumentasjonsleveranse for [WBS 1.6 / issue #6](https://github.com/Hoglar/mikrobitGames/issues/6), 2026-10-24. Versjon 1.0. Oppsett, implementasjon og kjøring av tester følger i komponent- og integreringsarbeidet.

## Formål og ansvar

AI-tjenesten skal besvare frie spørsmål ved å generere og utføre kontrollerte lesespørringer. Den kan undersøke alle spilleres tillatte data og sammenligne på tvers av spill, som avtalt i [WBS 1.5](../backend-ai/contract.md). Datamodellen følger [WBS 1.4](../../models/data-model.md), og direkte databasetilgang bygger på [ADR-001](../../../../spec/decisions/adr-001-direkte-datatilgang-for-ai.md).

AI-tjenestens kode kontrollerer og utfører spørringene. Modellen foreslår SQL, men får ikke bestemme tilkobling, rettigheter eller sikkerhetsgrenser. PostgreSQL skal håndheve lesetilgangen selv om modellen gir en skadelig instruksjon.

## Tilkobling og tilgjengelige data

Tjenesten bruker PostgreSQLs protokoll gjennom et etablert databasebibliotek til `mikrobit_games` på `127.0.0.1:5432`. Den får en egen innlogging, `ai_reader`, med SCRAM-autentisering. Tilkoblingshemmeligheten oppbevares i beskyttet serverkonfigurasjon og sendes aldri til modellen, nettleseren eller logger.

AI-en får tilgang gjennom tre **databasevisninger**: navngitte utsnitt av tabellene som viser bare tillatte kolonner. Visningene inneholder alle rader fra sine kildetabeller, også historiske rekorder og deaktiverte spill. Feltene beholder navn og typer fra datamodellen.

| Visning | Kilde | Tilgjengelige felt |
| --- | --- | --- |
| `ai_read.players` | `app.players` | `id`, `username`, `username_key`, `created_at` |
| `ai_read.games` | `app.games` | `id`, `name`, `score_unit`, `ranking_direction`, `min_value`, `max_value`, `is_active` |
| `ai_read.records` | `app.records` | `id`, `player_id`, `game_id`, `value`, `created_at` |

`password_hash` og hele `app.sessions` er utilgjengelige. Nye databasefelt blir ikke automatisk synlige: visningene definerer kolonnene eksplisitt og endres gjennom en gjennomgått migrering.

## Rettigheter som databasen håndhever

- `ai_reader` får `CONNECT` til databasen, `USAGE` på `ai_read` og bare `SELECT` på de tre visningene. Rollen får ingen direkte tilgang til applikasjonens grunntabeller og ingen skriverettigheter gjennom visningene.
- Rollen eier ingen databaseobjekter, er ikke superbruker og kan ikke opprette databaser, roller, skjemaer eller midlertidige tabeller. Den kan ikke overta eller arve backendens, migreringsbrukerens eller administratorens rettigheter.
- Rollen får ingen privilegier for serverfiler, systemkommandoer eller generell tilgang til alle data. Tillatelser gjennom `PUBLIC` og rollemedlemskap må også kontrolleres; uønsket tilgang fjernes. Applikasjonsfunksjoner som utfører skriving eller gir utvidet tilgang, skal ikke være kjørbare av `ai_reader`.
- Visningene eies av en separat rolle uten superbrukerrettigheter, med leserettigheter til de nødvendige kildekolonnene. `ai_reader` får ingen medlemskap i denne rollen. Visningene bruker eierens tilgang til grunntabellene.
- Alle AI-spørringer kjøres i en `READ ONLY`-transaksjon som ekstra beskyttelse. Databasebrukerens begrensede rettigheter er fortsatt nødvendige; en transaksjonsinnstilling alene er ikke en tilgangskontroll.

## Kontroll av AI-generert SQL

1. AI-tjenesten mottar SQL og eventuelle parameterverdier fra modellen som upålitelig input. Både brukerens spørsmål og tekst hentet fra databasen behandles som data, aldri som tillatelse til å endre sikkerhetsreglene.
2. En SQL-parser kontrollerer hele spørringen, inkludert delspørringer og `WITH`-uttrykk. Bare én lesende `SELECT` tillates, med referanser til visningene over. Koblinger, filtrering, sortering og sammenstillinger på tvers av spill er tillatt.
3. Skriving, `SELECT INTO`, låsende lesing, flere kommandoer, endring av innstillinger og referanser til andre databaseobjekter avvises. Funksjoner, operatorer og typekonverteringer må finnes på en gjennomgått liste over tillatte operasjoner uten sideeffekter. Listen versjoneres ved implementasjon. Det er ikke nok å sjekke at teksten begynner med `SELECT`.
4. Godkjent SQL kjøres med `ai_reader`. Separate dataverdier bindes som parametere. Parameterbinding erstatter ikke kontrollen av selve SQL-strukturen. Tilkobling, transaksjon og tidsavbrudd styres av tjenestekoden.
5. Tjenesten returnerer kolonnenavn og rader til modellen som datagrunnlag. Ved feil avbrytes transaksjonen og forbindelsen ryddes. Ingen feil skal føre til nytt forsøk med en kraftigere databasebruker.

Eksempel på tillatt lesing, med normalisert brukernavn bundet til `$1`:

```sql
SELECT DISTINCT g.id, g.name
FROM ai_read.records AS r
JOIN ai_read.players AS p ON p.id = r.player_id
JOIN ai_read.games AS g ON g.id = r.game_id
WHERE p.username_key = $1
ORDER BY g.name, g.id;
```

## Grenser og feil

Startgrenser i første versjon: én aktiv databaseforbindelse for AI, høyst tre spørringsforsøk per spørsmål, `statement_timeout` på 2 sekunder per spørring og høyst 1 000 rader / 1 MiB per resultat. Tjenesten håndhever grensene; modellen kan ikke slå dem av. Sammenstillinger kan beregnes over hele det tillatte datasettet. Grensene vurderes på hjemmemaskinen og holdes innenfor 60-sekundersfristen fra 1.5. Eventuelle justeringer oppdateres i kontrakten og testforventningene sammen.

| Utfall | Håndtering |
| --- | --- |
| Gyldig spørring uten treff | Tomt datasett; kan gi `no_data` etter 1.5. |
| Ugyldig eller forbudt SQL | Avvis før kjøring. Eventuell korrigering må holde seg innenfor forsøksgrensen. Hvis spørsmålet ikke kan besvares, brukes `cannot_answer`. |
| For stort resultat | Avbryt med `RESULT_TOO_LARGE`. Et ufullstendig resultat skal ikke fremstilles som komplett. Spørringen kan avgrenses eller sammenstilles innenfor forsøksgrensen. |
| Tidsavbrudd, rettighetsfeil eller utilgjengelig database | Rydd opp og rapporter teknisk feil gjennom 1.5. Feilen skal ikke fremstilles som at spilleren mangler rekorder. |

Logger inneholder forespørsels-ID, varighet og feiltype, uten tilkoblingshemmeligheter eller rå databaseuttrekk.

## Beskyttelse av Linux-systemet

Modellen får ingen verktøy for shell-kommandoer, generell kodekjøring eller filskriving. AI-prosessene skal kjøre som en egen Linux-bruker uten sudo, uten tilgang til backendens og migreringsbrukerens hemmeligheter og uten skriverettigheter til kildekode, databasefiler eller systemkonfigurasjon. Nødvendig skriving begrenses til egne områder for eksempelvis cache og logger.

Disse kravene konkretiseres og verifiseres i AI-modulen og driftsoppsettet. Databasekontrakten beskytter datatilgangen; beskyttelse av resten av maskinen krever også riktige prosess- og filrettigheter.

## Kvalitetskrav og senere verifisering

| Krav | Prioritet | Kontroll ved implementasjon og integrering |
| --- | --- | --- |
| AI-005: Kun tillatte data og ingen endringer | 1 | Bekreft lesing fra alle tre visninger. Forsøk direkte lesing av passordhash og sesjoner, samt innsetting, endring, sletting, oppretting og rollebytte. Test databasebrukeren direkte, uavhengig av SQL-filteret og `READ ONLY`. Alle forbudte handlinger skal avvises, og data og skjema skal være uendret. |
| AI-006: Kontrollert utførelse | 1 | Test skadelig brukerinput og databaseinnhold, flere SQL-kommandoer, skriving skjult i deluttrykk og funksjoner som endrer tilstand eller forsøker fil-/systemtilgang. Alle skal stoppes. Kontroller også Linux-brukerens rettigheter ved driftsoppsett. |
| AI-007: Riktige og tydelige utfall | 2 | Kjør kjente spørsmål mot testdata på tvers av spill og sammenlign radene med en uavhengig fasit. Tomt resultat, avvist SQL og databasefeil skal skilles. |
| AI-008: Begrenset ressursbruk | 3 | Mål varighet, resultatstørrelse og samtidige forbindelser. Test at tids-, forsøks- og resultatgrenser håndheves, og at vanlig rekordlagring fortsatt fungerer under AI-belastning. |

Modelluttrekk ved implementasjon skal kontrollere faktiske visningskolonner og effektive rettigheter mot kontrakten. Enhetstester dekker SQL-kontrollen; integrasjonstester bruker en isolert PostgreSQL-database. Testkode og detaljerte scenarioer følger i komponentarbeidet. Spørringstid og feilandel kan bidra til prosjektets felles FoM; kontrakten krever ingen egen måleserie.

## Faglig grunnlag

- PostgreSQL: [rettigheter](https://www.postgresql.org/docs/current/ddl-priv.html), [GRANT og rolletilganger](https://www.postgresql.org/docs/current/sql-grant.html), [visninger](https://www.postgresql.org/docs/current/sql-createview.html).
- PostgreSQL: [READ ONLY-transaksjoner](https://www.postgresql.org/docs/current/sql-set-transaction.html), [privilegerte roller](https://www.postgresql.org/docs/current/predefined-roles.html), [tidsavbrudd](https://www.postgresql.org/docs/current/runtime-config-client.html).
