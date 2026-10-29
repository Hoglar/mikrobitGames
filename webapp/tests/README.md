# Tester for webappen

Fra `webapp/`, med Node 24.22.1 og npm 11.19.1:

```sh
npm ci
npm test
npm run benchmark
npm run benchmark:input
npx playwright install chromium
npm run test:browser
```

Ingen fysisk enhet kreves. Biblioteket har ingen kjøretidsavhengigheter; Playwright er en låst utviklingsavhengighet for browser-testene. `tests/unit/` tester regel-/opptaksgrunnlaget mot deler av TWEB/TLAB. `tests/microbit-input/` tester faktisk adapterkode med felles fixtures, fake klokke/transport og native Streams. `npm run test:input` kjører bare disse GI-programvaretestene. Test-ID i testnavn betyr deldekning, ikke at hele akseptansescenarioet er bestått.

Browser-testene installerer Web Serial-mock før modulimport og bruker det leverte eksemplet med to spill. De kontrollerer port-/stream-opprydding, spillbytte, pause, eksplisitt fortsettelse, gjenoppkobling, feil og browser-propagasjon. [GI-planen](../spec/game-input-test-plan.md), [plattformplanen](../spec/platform-test-plan.md) og [TLAB-planen](../spec/games/microbit-testlab/test-plan.md) styrer videre utvidelse. Faktisk backend, OS-tillatelsesdialog og fysisk V2/USB/instrumentert latens inngår ikke i disse mock-testene. Se [resultatrapporten](../results/game-input-validation.md).

## Ferdig webpakke

`npm run test:app` bygger og kjører `tests/app/browser/` med egen Playwright-konfig.
Den lokale serveren eksponerer bare `dist/` og returnerer 503 for umockede API-kall.
Testene bruker eksisterende produksjonsadapter og Web Serial-mock, og kontrollerer
spillramme, start/pause/restart, offentlig Testlab, konto, Dashboard, offentlig
historikk og AI. `tests/unit/app.test.js` tester API-feil, lagringsidentitet og
spillmotorer uten enhet. Se `results/webapp-validation.md` for kjørte resultater.
