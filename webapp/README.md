# Webapp

Spill, launcher, dashboard, felles Web Serial-adapter og kommunikasjon med backend.

Kontrakter: [Micro:bit–webapp](../spec/contracts/microbit-webapp/README.md) og [webapp–backend](../spec/contracts/webapp-backend/README.md).

Frontendutviklere: bruk den godkjente [API-guiden](../spec/contracts/webapp-backend/contract.md) og [OpenAPI 0.1.0](../spec/contracts/webapp-backend/openapi.yaml) for innlogging, spilldata, rekordinnsending og AI-spørsmål. Godkjenning av kontrakt 1.3 er bekreftet 2026-10-27.

- [spec/](spec/README.md): krav, modeller og testplan.
- [tests/](tests/README.md): lokale tester.
- [verification/](verification/README.md): verifikasjonsverktøy.
- [results/](results/README.md): dokumenterte resultater.

## Felles Micro:bit-bibliotek

[Implementeringsplanen](spec/game-input-implementation-plan.md) beskriver et lokalt JavaScript-bibliotek med ES-moduler for Micro:bit V2. Biblioteket skal eie Web Serial-forbindelsen og tilby det samme input-/output-grensesnittet til alle spill, uten avhengighet til et bestemt frontendrammeverk eller backend.

Planen dekker modulansvar, tilkobling og gjenoppretting, meldingsvalidering, input-hendelser, kommandoer, spillbytte og trinnvise leveranser med testkriterier. Spillplattformen har fortsatt ansvar for pause/gjenopptakelse, poeng og lagring av resultater. Se også [utviklergrensesnittet](../spec/contracts/microbit-webapp/web-page-developer-interface.md) og [testplanen](spec/game-input-test-plan.md).

Bibliotek, eksempel, `package.json` og testverktøy er ikke implementert ennå. Npm-kommandoene i planen er planlagte leveranser, ikke kommandoer som kan kjøres i denne utsjekkingen.

Teknologi og kommandoer for oppsett, kjøring og testing dokumenteres her når implementasjonen starter. Mappene er etablert, men funksjonaliteten er ikke implementert. Se [felles prosjektstruktur](../docs/project-structure.md).
