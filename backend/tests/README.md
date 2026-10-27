# Backend-tester

**Revisjon 2026-10-27:** Test-/kontrollkoden er tilpasset API 0.2.0, databasekontrakt 1.2 og modellformat 2. Kontrollversjon 2 bruker 24/4/4 modellpunkter og skiller måleserien fra den tidligere versjonen. Se [endringsoversikten](../../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester). Kontrollverktøyenes egne tester er kjørt; produktimplementasjon og faktiske produktmålinger gjenstår.

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

Testfasiten kommer fra [DB-planen](../spec/test-plan.md), [backendplanen](../spec/backend-module.md) og [AI-planen](../spec/ai-module.md). [OpenAPI for kontrakt 1.3](../../spec/contracts/webapp-backend/openapi.yaml), versjon 0.2.0, er gjeldende implementeringsgrunnlag; kjørbare kontrakttester følger denne revisjonen.

Kontrollkoblingen er eksplisitt: integrasjon/benchmark har `@check(id, gruppe, ...)`, mens enhetstestene kobles til gruppene i `pipeline.unit_group`. Alle deltester i en gruppe må bestå. Modellpunktene følger 24/4/4-fordelingen i [implementeringsplanen](../spec/implementation-plan.md). Verktøyenes egne tester teller aldri som produktets FoM.

Kontroller av faktiske komponenter kan først bestå når komponentene er implementert. Testpakken er ikke bevis på at database, backend eller AI allerede virker. Offentlig publisering, faktisk nettleser og Micro:bit-demonstrasjon inngår også ved systemleveransen.
