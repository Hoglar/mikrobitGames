# Krav til databasedelen – WBS 5.1

**Status:** Ferdigstilt for [WBS 5.1 / issue #15](https://github.com/Hoglar/mikrobitGames/issues/15), 2026-10-24. Dette dokumentet fordeler databasedelens krav og ansvar. Testkode er nå skrevet; databaseimplementasjon og produktmålinger gjenstår. Teknisk struktur eies av datamodellen, og byggerekkefølgen av [implementeringsplanen](implementation-plan.md).

## Grunnlag og modell

Databasen lagrer spillere, sesjoner, spill og historiske personlige rekorder i PostgreSQL. [Datamodellen](models/data-model.md) definerer felt og regler; [ER-diagrammet](models/database-er.drawio) viser strukturen. [database-schema.json](models/database-schema.json) er en maskinlesbar forventning for den avgrensede modellkontrollen i [testplanen](test-plan.md).

Krav-ID-er og prioriteringer videreføres fra [kontrakt 1.4](contracts/backend-database/contract.md) og [kontrakt 1.6](contracts/ai-database/contract.md). Kontraktene er autoritative for oppførsel og tilgang. Endringer i modellen oppdaterer diagram, maskinlesbar forventning og berørte tester sammen.

## Krav og ansvar

| Kravgrunnlag | Databasens ansvar | Verifisering |
| --- | --- | --- |
| DB-001 | Riktige felter, datatyper, obligatoriske verdier, nøkler og radlokale begrensninger. Bevare alle registrerte rekordoppføringer frem til kontosletting. | TDB-01–04 |
| DB-002 | Støtte transaksjoner, låsing og atomisk sletting av spiller med sesjoner og rekorder. | TDB-04, TDB-06; samtidighet gjennom integrasjon etter 1.4. |
| DB-003, AI-005 | Egne roller for backend og AI. Bare tillatte operasjoner og data skal være tilgjengelige, også når tilgangen prøves direkte mot PostgreSQL. | TDB-05 |
| DB-004–005 | Bekreftede lagringer tåler omstart; rollback etterlater ikke delvise endringer. Databasefeil er tilgjengelige for tjenestens feilhåndtering. | TDB-06–07 |
| DB-006–007, AI-008 | Støtte de avtalte belastnings- og ressursgrensene. | TDB-08 og integrasjon mot faktisk backend og AI. |
| DB-008 | Gjentakbart oppsett med migreringer, sikkerhetskopiering og gjenoppretting. | TDB-01, TDB-07 |

**Prioritering:** 1. Dataintegritet og sikkerhet. 2. Pålitelighet. 3. Ytelse, ressursbruk og drift. Målbare grenser finnes i kontraktene og måles under implementering; ingen måleresultater foreligger nå.

Backend avgjør om et resultat er en ny rekord, kontrollerer spillerens innlogging og håndhever spillavhengige resultatgrenser. Databasen håndhever strukturelle regler og utfører transaksjonene. Eksempelvis kan en fremmednøkkel sikre at spillet finnes, mens sammenligningen med spillerens forrige rekord testes i backend og integrasjon.

## Tilgang og livsløp

- `backend_app` får rettighetene definert i 1.4, inkludert nødvendig oppretting, lesing, oppdatering og sletting. Innloggings- og eierskapskontroll skjer i backend.
- `ai_reader` får bare lesetilgang gjennom `ai_read.players`, `ai_read.games` og `ai_read.records` etter 1.6. Passordhash og sesjoner skal være utilgjengelige.
- Oppretting og endring av struktur, visninger og rettigheter skjer gjennom versjonerte migreringer med en separat oppsettsrolle. Testene bruker tjenestenes egne roller når deres tilgang undersøkes.
- SQL-filteret, verktøytilgangen og Linux-isolasjonen for AI implementeres og testes i AI-modulen og driftsoppsettet. Databasetester gir bevis for databasegrensen.

## Overlevering til WBS 5.2

Bruk [leseoversikten](README.md) som inngang til implementeringsgrunnlaget. Testpakken og oppstart med SQL-migreringer er konkretisert i [testgrensesnittene](../verification/test-runtime.md). PostgreSQL-hovedversjon fastsettes ved byggestart; test og drift skal bruke samme hovedversjon. Valgene og kjørekommandoene dokumenteres under [database](../database/README.md).

Etabler modellkontroll og en reell baseline før forbedringsiterasjonene. Migreringer lagres under `backend/database/migrations/`, syntetiske data under `backend/database/seeds/`, og resultater under `backend/results/`. [ADR-005](../../spec/decisions/adr-005-postgresql.md) begrunner PostgreSQL; [ADR-001](../../spec/decisions/adr-001-direkte-datatilgang-for-ai.md) begrunner AI-tilgangen.
