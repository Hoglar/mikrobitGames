# Backend-tester

**Revisjon 2026-10-27:** Spesifikasjonene er oppdatert til API 0.2.0, databasekontrakt 1.2 og modellformat 2. Eksisterende kjørbar test-/kontrollkode gjelder tidligere rekordmodell og kan ikke verifisere denne revisjonen før [tilpasningene](../../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester) er gjennomført. Modellsettet skal bli 24/4/4; dagens verktøy er fortsatt 20/4/4. Dette er dokumentasjonskontroll, ikke bestått produkttest.

**Kjør hele testfasen med `./backend/check`.** [Kjøreguiden](../verification/README.md) viser engangsoppsett, oppdatering av serverklonen og hvordan rapporten leses. [Testgrensesnittene](../verification/test-runtime.md) er input til implementasjonen.

| Del | Hva kontrolleres? |
| --- | --- |
| [Enhetstester](unit/) | Rekordregler, innloggingens rene regler, SQL-filter og AI-svarformat. |
| [Databaseintegrasjon](integration/database_checks.py) | CRUD, begrensninger, kaskader, rollback, faktiske roller, omstart og gjenoppretting. |
| [API-integrasjon](integration/api_checks.py) | Konto/sesjoner, passord/sletting, rekorder, samtidighet, ukjent commit, offentlige oversikter, input/CSRF og rategrenser. |
| [AI-integrasjon](integration/ai_checks.py) | Meldinger, tekniske feil, SQL-sikkerhet, budsjetter, samtidighet, historikk, ressursgrenser og isolasjon. |
| [Benchmark](benchmarks/benchmark_checks.py) | Fast HTTP-/DB-last med og uten AI, topper, ressursbruk og faktisk kald/varm lokal modell. |
| [Modelluttrekk](../verification/model_checks.py) | PostgreSQL-kataloger, OpenAPI og komponentavhengigheter mot uavhengig fasit. |
| [Kontrollverktøyenes tester](verification/) | Bevisste modellavvik, manglende målinger, FoM-vekter, reléer, feilinjeksjon og rapportering. |

Testfasiten kommer fra [DB-planen](../spec/test-plan.md), [backendplanen](../spec/backend-module.md) og [AI-planen](../spec/ai-module.md). [OpenAPI for kontrakt 1.3](../../spec/contracts/webapp-backend/openapi.yaml), versjon 0.2.0, er gjeldende implementeringsgrunnlag; kjørbare kontrakttester må tilpasses.

Kontrollkoblingen er eksplisitt: integrasjon/benchmark har `@check(id, gruppe, ...)`, mens enhetstestene kobles til gruppene i `pipeline.unit_group`. Alle deltester i en gruppe må bestå. Modellpunktene skal følge 24/4/4-fordelingen i [implementeringsplanen](../spec/implementation-plan.md). Verktøyenes egne tester teller aldri som produktets FoM.

Kontroller av faktiske komponenter kan først bestå når komponentene er implementert. Testpakken er ikke bevis på at database, backend eller AI allerede virker. Offentlig publisering, faktisk nettleser og Micro:bit-demonstrasjon inngår også ved systemleveransen.
