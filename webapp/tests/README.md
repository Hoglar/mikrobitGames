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

`tests/app/browser/canvas-resize.spec.js` kontrollerer at Tetris faktisk har synlige canvas-piksler etter størrelsesendring under langsom modullasting, gjentatte bytter mellom aktive spill og tapte resize-varsler. Den første regresjonen holder modulimporten igjen mens iframe-layout går fra 0 × 0 til normal størrelse; testen bruker den faktiske SDK-runtime og trenger ikke fullskjerm for å få bildet tilbake. Kjør målrettet med `npm run test:app -- canvas-resize.spec.js`.

Se [valideringen av canvas-resize](../results/tetris-canvas-resize-validation-2026-11-05.md) for reproduksjon og resultat før/etter rettingen.

Tetris-testene dekker også tiltestabilisering, roligere repetisjon og beskyttelse
mot sideflytting ved drop. Browser-testen kontrollerer faktisk landingskolonne
gjennom sandbox og Web Serial-adapter. Se [tiltvalideringen](../results/tetris-tilt-validation-2026-11-05.md).

## Spillkassetter og lokale rekorder

`npm run test:cartridges` bygger og kjører en separat suite mot utviklingsserveren. Den oppretter en midlertidig, selvstendig spillmappe, verifiserer oppdaging/SDK/sandbox og tester ekte IndexedDB, samtidige faner, navnelagring, eksport/import og uendret online-ID. Spillet fjernes etter testen. `npm run test:app` dekker de migrerte medfølgende spillene og appen fra `dist/`; den separate importtesten inngår ikke i samme config fordi den må oppdage en mappe etter serverstart.

`tests/unit/cartridges.test.js` tester de 47 frosne legacy-ID-ene, deklarativ sammenligning/codec, navnenormalisering og importgrensen. Fysisk Micro:bit og faktisk PostgreSQL/produksjonsutrulling er egne akseptansepunkter. Se [valideringsrapporten](../results/cartridges-validation.md).
