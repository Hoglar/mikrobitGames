# Backend

Samlet modul for API, database og lokal AI.

- [api/src/](api/src/README.md): REST API, autentisering og formidling av spilldata og AI-forespørsler.
- [database/](database/README.md): databaseendringer, testdata og tilgangsrettigheter.
- [ai-service/src/](ai-service/src/README.md): lokal AI og kontrollert lesetilgang til highscore-data.

Krav, modeller, tester, verifikasjonsskript og resultater deles mellom de tre interne delene. Kontrakten mot webappen ligger [felles](../spec/contracts/webapp-backend/README.md); de [interne kontraktene](spec/contracts/README.md) ligger her.

Se [ADR-001](../spec/decisions/adr-001-direkte-datatilgang-for-ai.md) om AI-tilgang (fortsatt Proposed) og [ADR-003](../spec/decisions/adr-003-repository-structure.md) om organiseringen.

- [spec/](spec/README.md): krav, modeller og testplan.
- [tests/](tests/README.md): lokale tester.
- [verification/](verification/README.md): verifikasjonsverktøy.
- [results/](results/README.md): dokumenterte resultater.

Teknologi og kommandoer for oppsett, kjøring og testing dokumenteres her når implementasjonen starter. Mappene er etablert, men funksjonaliteten er ikke implementert. Se [felles prosjektstruktur](../docs/project-structure.md).
