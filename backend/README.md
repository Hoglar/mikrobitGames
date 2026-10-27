# Backend

Samlet modul for API, database og lokal AI.

**Før implementasjon: start i [leseoversikten](spec/README.md).** Den skiller krav, teknisk design og arbeidsplan, og viser hvilke dokumenter som er fasit.

- [api/src/](api/src/README.md): REST API, autentisering og formidling av spilldata og AI-forespørsler.
- [database/](database/README.md): databaseendringer, testdata og tilgangsrettigheter.
- [ai-service/src/](ai-service/src/README.md): lokal AI og kontrollert lesetilgang til highscore-data.

Krav, modeller, tester, verifikasjonsskript og resultater deles mellom de tre interne delene. Kontrakten mot webappen ligger [felles](../spec/contracts/webapp-backend/README.md); de [interne kontraktene](spec/contracts/README.md) ligger her.

Se [ADR-001](../spec/decisions/adr-001-direkte-datatilgang-for-ai.md) om AI-tilgang og [ADR-003](../spec/decisions/adr-003-repository-structure.md) om organiseringen. Begge beslutningene er godkjent.

- [spec/](spec/README.md): krav, modeller og testplan.
- [tests/](tests/README.md): lokale tester.
- [verification/](verification/README.md): verifikasjonsverktøy.
- [results/](results/README.md): dokumenterte resultater.

Hele den automatiserte testfasen kjøres med `./backend/check` fra prosjektroten. Se [kjøreguiden](verification/README.md) for engangsoppsett på Parrot og hvordan rapportene leses. Testpakken er [tilpasset API 0.2.0 og privat forsøkshistorikk](../spec/contracts/webapp-backend/alignment.md#tilpasning-av-eksisterende-kjørbare-tester). Kontrollverktøyenes egne tester kan kjøres med `./backend/check selftest`. Komponentene er ennå ikke implementert; produktkontrollene er derfor BLOCKED og ingen produktbaseline er målt. Se også [felles prosjektstruktur](../docs/project-structure.md).
