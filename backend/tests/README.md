# Backend-tester

**Revisjon 2026-10-28:** Brukerbestilt samtaleassistent er integrert med API 0.3.0, intern AI-kontrakt 1.3 og AI–database-kontrakt 1.2. Frontendkontrakten er fortsatt et forslag til frontendgruppen. Kontrollversjon 3 beholder 24/4/4 modellpunkter og starter en egen måleserie. Full testfase og benchmark kjøres av brukeren; tidligere rapporter beholdes.

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

Testfasiten kommer fra [DB-planen](../spec/test-plan.md), [backendplanen](../spec/backend-module.md) og [AI-planen](../spec/ai-module.md). [OpenAPI for kontrakt 1.3](../../spec/contracts/webapp-backend/openapi.yaml), versjon 0.3.0, er gjeldende implementeringsgrunnlag; kjørbare kontrakttester følger denne revisjonen.

Kontrollkoblingen er eksplisitt: integrasjon/benchmark har `@check(id, gruppe, ...)`, mens enhetstestene kobles til gruppene i `pipeline.unit_group`. Alle deltester i en gruppe må bestå. Modellpunktene følger 24/4/4-fordelingen i [implementeringsplanen](../spec/implementation-plan.md). Verktøyenes egne tester teller aldri som produktets FoM.

Kontroller av faktiske komponenter kan først bestå når komponentene er implementert. Testpakken er ikke bevis på at database, backend eller AI allerede virker. Offentlig publisering, faktisk nettleser og Micro:bit-demonstrasjon inngår også ved systemleveransen.
