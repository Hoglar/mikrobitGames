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

Første implementasjon av database, API og AI er skrevet. [Oppsett og leveransestatus](SETUP.md) beskriver låste avhengigheter, tjenesteisolasjon, kjente avklaringer og utførte oppstartskontroller. Ingen produktbaseline er målt. Frontendkontrakt 1.3 / API 0.2.0 brukes som arbeidsgrunnlag og er fortsatt et forslag overfor frontendgruppen.

Hele den automatiserte testfasen kjøres med `./backend/check` fra prosjektroten. Brukeren starter den første kjøringen etter egen commit. Se [kjøreguiden](verification/README.md) for resultatene og [felles prosjektstruktur](../docs/project-structure.md) for filreglene.
