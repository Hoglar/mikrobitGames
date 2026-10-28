# Webapp

**[Implementasjonsplan for hele websiden](spec/implementation-plan.md)** – arkitektur, leveranserekkefølge, tester og benchmarks.

Spill, launcher, dashboard, felles Web Serial-adapter og kommunikasjon med backend.

Kontrakter: [Micro:bit–webapp](../spec/contracts/microbit-webapp/README.md) og [webapp–backend](../spec/contracts/webapp-backend/README.md).

Frontendutviklere: bruk den samordnede [API-guiden](../spec/contracts/webapp-backend/contract.md) og [OpenAPI 0.2.0](../spec/contracts/webapp-backend/openapi.yaml) for innlogging, spilldata, private forsøk, offentlige rekorder og AI-spørsmål. Se [konflikter og beslutninger](../spec/contracts/webapp-backend/alignment.md). Godkjenningen av 0.1.0 gjaldt den tidligere revisjonen.

- [spec/](spec/README.md): krav, modeller og testplan.
- [tests/](tests/README.md): lokale tester.
- [verification/](verification/README.md): verifikasjonsverktøy.
- [results/](results/README.md): dokumenterte resultater.

## Felles Micro:bit-bibliotek

[Implementeringsplanen](spec/game-input-implementation-plan.md) beskriver et lokalt JavaScript-bibliotek med ES-moduler for Micro:bit V2. Biblioteket skal eie Web Serial-forbindelsen og tilby det samme input-/output-grensesnittet til alle spill, uten avhengighet til et bestemt frontendrammeverk eller backend.

Planen dekker modulansvar, tilkobling og gjenoppretting, meldingsvalidering, input-hendelser, kommandoer, spillbytte og trinnvise leveranser med testkriterier. Spillplattformen har fortsatt ansvar for pause/gjenopptakelse, poeng og lagring av resultater. Se også [utviklergrensesnittet](../spec/contracts/microbit-webapp/web-page-developer-interface.md) og [testplanen](spec/game-input-test-plan.md).

Adapterbiblioteket og et lokalt eksempel med to små spill er implementert. Se [bibliotekets brukerveiledning](src/microbit-input/README.md) og [valideringsrapporten](results/game-input-validation.md). Plattformregler og Testlab-opptak er også etablert; full frontend og backendintegrasjon gjenstår.

Fra `webapp/`, med Node 24.22.1 og npm 11.19.1: `npm ci`, `npm test`, `npm run benchmark` og `npm run benchmark:input`. Programvaretestene trenger ingen fysisk enhet. Playwright 1.64.1 er en låst utviklingsavhengighet; biblioteket har ingen kjøretidsavhengigheter. Installer Chromium med `npx playwright install chromium`, og kjør `npm run test:browser` for nettlesermock og browser-benchmark. Rapporter lagres under `results/`.

`npm run dev:input` starter eksemplet på `http://127.0.0.1:4173/examples/microbit-input/`. Det bruker ekte Web Serial ved vanlig kjøring; automatiske nettlesertester erstatter bare nettleserens serial-API. Spillene deler ett input-/output-grensesnitt og venter på spillerens fortsettvalg etter inputbrudd. Reelle USB-/tillatelseskontroller og instrumentert fysisk latens er ikke verifisert. Se [felles prosjektstruktur](../docs/project-structure.md).

## Leveranse til hjemmeserveren

Frontend og alle spill skal bygges som én [samlet webpakke](spec/Komponentspesifikasjon_webapplikasjon_forklart.md#samlet-webpakke). Planlagt byggegrensesnitt er `npm ci` og `npm run build` fra `webapp/`, med hele leveransen i `webapp/dist/`. Byggekommandoen etableres ved implementering. Backend-/driftsgruppen publiserer pakken gjennom Caddy på Parrot; nettleseren henter frontend, spill og ressurser fra samme adresse som API-et. Se [publiseringsplanen](../backend/spec/implementation-plan.md#publisering-av-webpakken).
